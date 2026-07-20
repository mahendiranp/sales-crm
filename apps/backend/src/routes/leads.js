const express = require("express");
const { randomUUID: uuid } = require("crypto");
const { scopedCollection } = require("../db/store");
const { crudRouter } = require("./crudFactory");
const { requireManager, requireFullAccess, PERMISSION_RANK } = require("../middleware/auth");
const { isConfigured: aiConfigured, scoreLead, parseLeadText } = require("../integrations/aiClient");
const { getAiProviderForAccount, getLimitsForAccount } = require("./settings");
const { hasEnoughCredits, deductCredits, CREDIT_COSTS } = require("../utils/aiCredits");
const { recordEvent, EVENT_TYPES } = require("../services/eventEngine");
const emailClient = require("../integrations/emailClient");
const { emailLayout } = require("../utils/emailTemplate");

const router = express.Router();
const leads = (req) => scopedCollection("leads", req.user.accountId);
const contacts = (req) => scopedCollection("contacts", req.user.accountId);
const companies = (req) => scopedCollection("companies", req.user.accountId);
const salespeople = (req) => scopedCollection("users", req.user.accountId);

// Best-effort — the lead really is assigned either way; a missing/invalid
// email on the directory record just means nobody gets pinged about it,
// same reasoning as tasks.js's notifyAssignee.
async function notifyAssignee(req, lead, assignee) {
  if (!assignee?.email) return;
  try {
    await emailClient.sendMail({
      to: assignee.email,
      subject: `You've been assigned a lead: ${lead.name}`,
      html: emailLayout({
        preheader: "A lead has been assigned to you.",
        heading: "You have been assigned",
        bodyHtml: `<p>Lead</p><p><strong>${lead.name}</strong>${lead.company ? ` — ${lead.company}` : ""}</p>`,
      }),
    });
  } catch {
    // Notification is a nice-to-have — the assignment already succeeded.
  }
}

// Backstop for the form's own required-field rules (Lead Name, plus a
// Mobile Number or Email) — the UI already blocks this, but the API
// shouldn't rely on that alone since it's reachable directly. Checks
// permission first so a view-only account still gets 403 (not 400) when
// it sends an incomplete body — the permission failure should win.
function requireLeadContactInfo(req, res, next) {
  if (req.method === "POST" && req.path === "/") {
    if (PERMISSION_RANK[req.user?.permission] < PERMISSION_RANK.edit) {
      return res.status(403).json({ error: "This account is view-only and cannot make changes." });
    }
    const { name, mobile, email } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ error: "Lead Name is required." });
    if (!(mobile && mobile.trim()) && !(email && email.trim())) {
      return res.status(400).json({ error: "A Mobile Number or Email is required." });
    }
  }
  next();
}

// mount base CRUD first, then add extra action routes
router.use("/", requireLeadContactInfo, crudRouter("leads"));

// Assign a salesperson to a lead. userId refers to the /api/users
// directory (the same "Users" list Users.jsx manages) — not a login
// account, so there's no active/inactive concept to check beyond "does
// this row still exist" (a deleted row is already just absent from the
// list, nothing extra to enforce there).
router.post("/:id/assign", requireManager, async (req, res) => {
  const existing = await leads(req).find(req.params.id);
  if (!existing) return res.status(404).json({ error: "Lead not found" });

  const { userId } = req.body;
  let assignee = null;
  if (userId) {
    assignee = await salespeople(req).find(userId);
    if (!assignee) return res.status(400).json({ error: "That team member no longer exists." });
  }

  const updated = await leads(req).update(req.params.id, { assignedTo: userId || null });

  if (assignee && assignee.id !== existing.assignedTo) {
    await recordEvent({
      accountId: req.user.accountId,
      type: EVENT_TYPES.LEAD_ASSIGNED,
      entityType: "lead",
      entityId: updated.id,
      actorId: req.user.id,
      actorName: req.user.email,
      payload: { name: updated.name, assigneeName: assignee.name },
    });
    await notifyAssignee(req, updated, assignee);
  }

  res.json(updated);
});

// Convert a lead into a customer (Contact) — and, per the CRM's usual
// Lead → Contact + Company flow, links (or creates) the Company that
// matches the lead's free-text `company` name, so a B2B lead doesn't just
// become a floating Contact with no organization behind it.
router.post("/:id/convert", requireManager, async (req, res) => {
  const lead = await leads(req).find(req.params.id);
  if (!lead) return res.status(404).json({ error: "Lead not found" });

  let company = null;
  // Explicit companyId (picked from an existing-companies dropdown) wins
  // over matching by name — a tenant might have two companies with
  // similar names and want to be precise about which one this is.
  if (req.body.companyId) {
    company = await companies(req).find(req.body.companyId);
  } else if (lead.company && lead.company.trim()) {
    const existing = await companies(req).query((c) => c.name.trim().toLowerCase() === lead.company.trim().toLowerCase());
    if (existing.length > 0) {
      company = existing[0];
    } else {
      company = {
        id: uuid(),
        name: lead.company.trim(),
        industry: "",
        employees: "1-10",
        gst: "",
        website: "",
        accountManager: lead.assignedTo || "",
        createdAt: new Date().toISOString(),
      };
      await companies(req).insert(company);
    }
  }

  const contact = {
    id: uuid(),
    leadId: lead.id,
    name: lead.name,
    mobile: lead.mobile,
    email: lead.email,
    address: req.body.address || "",
    companyId: company?.id || null,
    purchaseHistory: [],
    notes: req.body.notes || "",
    documents: [],
    createdAt: new Date().toISOString(),
  };
  await contacts(req).insert(contact);
  await leads(req).update(lead.id, { status: "Converted" });
  res.status(201).json({ ...contact, accountId: req.user.accountId, company });
});

// AI qualification: scores 0-100 how likely this lead is to convert, using
// whichever provider the account has configured — gated by plan tier AND
// AI credit balance (utils/aiCredits.js), same as the Form Builder's AI Assistant.
router.post("/:id/ai-score", requireManager, async (req, res) => {
  const lead = await leads(req).find(req.params.id);
  if (!lead) return res.status(404).json({ error: "Lead not found" });

  if (!req.user.isMasterAdmin) {
    const limits = await getLimitsForAccount(req.user.accountId);
    if (!limits.aiAssistant) {
      return res.status(403).json({ error: `AI lead scoring requires the Growth plan or higher. Your account is on ${limits.label}.`, code: "plan_required" });
    }
    if (!(await hasEnoughCredits(req.user.accountId, "leadScore"))) {
      return res.status(403).json({
        error: `You don't have enough AI credits for this (needs ${CREDIT_COSTS.leadScore}). Upgrade your plan for more.`,
        code: "insufficient_credits",
      });
    }
  }

  const provider = await getAiProviderForAccount(req.user.accountId);
  if (!aiConfigured(provider)) {
    const providerLabel = provider === "gemini" ? "Gemini" : "Anthropic";
    const envVar = provider === "gemini" ? "GEMINI_API_KEY" : "ANTHROPIC_API_KEY";
    return res.status(503).json({ error: `${providerLabel} isn't configured yet. Ask your admin to set ${envVar} in the backend environment.` });
  }

  try {
    const { score, reasoning } = await scoreLead({
      provider,
      lead: {
        name: lead.name,
        source: lead.source,
        interestedProduct: lead.interestedProduct,
        budget: lead.budget,
        priority: lead.priority,
        status: lead.status,
        notes: lead.notes || "",
      },
    });
    if (!req.user.isMasterAdmin) await deductCredits(req.user.accountId, req.user.id, "leadScore", { leadId: lead.id });
    const updated = await leads(req).update(lead.id, { leadScore: score, aiScoreReasoning: reasoning });
    res.json(updated);
  } catch (err) {
    const status = /rate-limited|quota/i.test(err.message) ? 429 : 502;
    res.status(status).json({ error: err.message });
  }
});

// AI paste-to-autofill: extracts lead fields from an arbitrary pasted
// message (WhatsApp text, email, call note) — gated by AI credit balance,
// same as AI lead scoring above.
router.post("/parse-ai", requireManager, async (req, res) => {
  const text = (req.body.text || "").trim();
  if (!text) return res.status(400).json({ error: "Paste some text to extract a lead from first." });

  if (!req.user.isMasterAdmin) {
    const limits = await getLimitsForAccount(req.user.accountId);
    if (!limits.aiAssistant) {
      return res.status(403).json({ error: `AI autofill requires the Growth plan or higher. Your account is on ${limits.label}.`, code: "plan_required" });
    }
    if (!(await hasEnoughCredits(req.user.accountId, "leadParse"))) {
      return res.status(403).json({
        error: `You don't have enough AI credits for this (needs ${CREDIT_COSTS.leadParse}). Upgrade your plan for more.`,
        code: "insufficient_credits",
      });
    }
  }

  const provider = await getAiProviderForAccount(req.user.accountId);
  if (!aiConfigured(provider)) {
    const providerLabel = provider === "gemini" ? "Gemini" : "Anthropic";
    const envVar = provider === "gemini" ? "GEMINI_API_KEY" : "ANTHROPIC_API_KEY";
    return res.status(503).json({ error: `${providerLabel} isn't configured yet. Ask your admin to set ${envVar} in the backend environment.` });
  }

  try {
    const fields = await parseLeadText({ provider, text });
    if (!req.user.isMasterAdmin) await deductCredits(req.user.accountId, req.user.id, "leadParse");
    res.json(fields);
  } catch (err) {
    const status = /rate-limited|quota/i.test(err.message) ? 429 : 502;
    res.status(status).json({ error: err.message });
  }
});

// Merge duplicate leads: keep primary, drop the rest
router.post("/merge", requireFullAccess, async (req, res) => {
  const { primaryId, duplicateIds } = req.body;
  const primary = await leads(req).find(primaryId);
  if (!primary) return res.status(404).json({ error: "Primary lead not found" });

  for (const dupId of duplicateIds || []) {
    await leads(req).remove(dupId);
  }
  res.json({ merged: true, primary });
});

module.exports = router;
