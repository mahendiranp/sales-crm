const express = require("express");
const dayjs = require("dayjs");
const XLSX = require("xlsx");
const { randomUUID: uuid } = require("crypto");
const { collection, scopedCollection } = require("../db/store");
const { requireManager, requireFullAccess } = require("../middleware/auth");
const { encryptAnswers, decryptResponse } = require("../utils/formCrypto");
const { listTemplates, getTemplate } = require("../data/formTemplates");
const { buildSnapshot, autoAdvance, currentApprovers, applyDecision, applyEscalations } = require("../utils/workflowEngine");
const { isConfigured: aiConfigured, generateFormFields } = require("../integrations/aiClient");
const { getLimitsForAccount, getAiProviderForAccount } = require("./settings");
const { availableDates, allSlotsForDate, slotsForDate, extractBookedTimes } = require("../utils/bookingSlots");
const { validateFileAnswer } = require("../utils/fileUploads");
const emailClient = require("../integrations/emailClient");
const { emailLayout } = require("../utils/emailTemplate");

const router = express.Router();
// Public routes (/public, /responses POST) bypass auth entirely (see
// index.js's PUBLIC_ROUTES allowlist), so they use the raw, unscoped
// collection — there's no req.user to scope by. Every admin-facing route
// below scopes fresh per request via req.user.accountId instead.
const rawForms = collection("forms");
const rawResponses = collection("form_responses");
const accounts = collection("accounts");
const formsFor = (req) => scopedCollection("forms", req.user.accountId);
const responsesFor = (req) => scopedCollection("form_responses", req.user.accountId);
// Everyone sharing a tenant (owner + teammates) for resolving role-based
// approvers — mirrors the membership check in routes/auth.js's /team route.
const tenantAccountsFor = async (req) => (await accounts.all()).filter((a) => (a.accountId || a.id) === req.user.accountId);

// Master admin bypasses plan limits same as every other gate in this app.
// Returns null (ok to proceed) or an error message to send as a 403.
async function checkFormLimit(req) {
  if (req.user.isMasterAdmin) return null;
  const limits = await getLimitsForAccount(req.user.accountId);
  if (limits.maxForms === Infinity) return null;
  const count = (await formsFor(req).all()).length;
  if (count >= limits.maxForms) {
    return `Your plan (${limits.label}) allows up to ${limits.maxForms} form${limits.maxForms === 1 ? "" : "s"}. Upgrade to create more.`;
  }
  return null;
}

// Same shape as checkFormLimit, but for the monthly response quota — this
// runs on the *public*, unauthenticated submission route, so there's no
// req.user to check isMasterAdmin against or scope a collection query by;
// it works off the form's own accountId instead, counting every response
// across every one of that account's forms since the start of the current
// calendar month.
async function checkResponseLimit(form) {
  const account = await accounts.find(form.accountId);
  if (account?.isMasterAdmin) return null;
  const limits = await getLimitsForAccount(form.accountId);
  if (!limits.maxResponsesPerMonth || limits.maxResponsesPerMonth === Infinity) return null;

  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);
  const count = (
    await rawResponses.query((r) => r.accountId === form.accountId && new Date(r.submittedAt) >= startOfMonth)
  ).length;
  if (count >= limits.maxResponsesPerMonth) {
    return `This form's account has reached its monthly response limit (${limits.maxResponsesPerMonth}) on the ${limits.label} plan. Please try again next month, or ask the form owner to upgrade.`;
  }
  return null;
}

async function withResponseCount(form, allResponses) {
  const count = (allResponses || (await rawResponses.query((r) => r.formId === form.id))).filter((r) => r.formId === form.id).length;
  return { ...form, responseCount: count };
}

router.get("/stats", async (req, res) => {
  const [allForms, allResponses] = await Promise.all([formsFor(req).all(), responsesFor(req).all()]);
  const recentResponses = [...allResponses]
    .sort((a, b) => dayjs(b.submittedAt).diff(dayjs(a.submittedAt)))
    .slice(0, 5)
    .map((r) => ({ ...decryptResponse(r), formName: allForms.find((f) => f.id === r.formId)?.name || "Unknown form" }));
  res.json({
    totalForms: allForms.length,
    totalResponses: allResponses.length,
    recentResponses,
  });
});

router.get("/", async (req, res) => {
  const [allForms, allResponses] = await Promise.all([formsFor(req).all(), responsesFor(req).all()]);
  const withCounts = await Promise.all(allForms.map((f) => withResponseCount(f, allResponses)));
  res.json(withCounts.sort((a, b) => dayjs(b.updatedAt).diff(dayjs(a.updatedAt))));
});

router.get("/templates", (req, res) => {
  res.json(listTemplates());
});

// Cross-form inbox: every response, in any form owned by this tenant,
// whose current workflow step this user can act on and hasn't yet voted
// on. Placed before /:id so "approvals" isn't swallowed as a form id.
router.get("/approvals/pending", async (req, res) => {
  const [allForms, allResponses, tenantAccounts] = await Promise.all([formsFor(req).all(), responsesFor(req).all(), tenantAccountsFor(req)]);
  const pending = allResponses
    .filter((r) => r.workflow?.status === "pending")
    .filter((r) => {
      const approverIds = currentApprovers(r.workflow, tenantAccounts);
      if (!approverIds.includes(req.user.id)) return false;
      return !r.workflow.history.some((h) => h.stepIndex === r.workflow.currentStep && h.actorId === req.user.id);
    })
    .map((r) => {
      const form = allForms.find((f) => f.id === r.formId);
      return { ...decryptResponse(r), formName: form?.name || "Unknown form", formFields: form?.fields || [] };
    })
    .sort((a, b) => dayjs(a.submittedAt).diff(dayjs(b.submittedAt)));
  res.json(pending);
});

// Manual trigger since this repo has no cron infra wired up — call this
// from an external scheduler (Vercel Cron, etc.) on whatever cadence makes
// sense, or run it by hand. Advances overdue steps' escalation.
router.post("/workflow/check-escalations", requireManager, async (req, res) => {
  const allResponses = await responsesFor(req).all();
  let escalated = 0;
  for (const r of allResponses) {
    if (r.workflow?.status !== "pending") continue;
    const before = JSON.stringify(r.workflow.steps[r.workflow.currentStep]);
    const workflow = JSON.parse(JSON.stringify(r.workflow));
    applyEscalations(workflow);
    if (JSON.stringify(workflow.steps[workflow.currentStep]) !== before) {
      await responsesFor(req).update(r.id, { workflow });
      escalated++;
    }
  }
  res.json({ checked: allResponses.length, escalated });
});

router.post("/from-template", requireManager, async (req, res) => {
  const limitError = await checkFormLimit(req);
  if (limitError) return res.status(403).json({ error: limitError });
  const { templateKey, name } = req.body;
  const template = getTemplate(templateKey);
  if (!template) return res.status(404).json({ error: "Template not found" });

  const form = {
    id: uuid(),
    name: name?.trim() || template.name,
    description: template.description,
    fields: template.fields.map((f) => ({ ...f, id: uuid() })),
    settings: { submitButtonText: "Submit", confirmationMessage: "Thanks for your submission!" },
    status: "Draft",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  await formsFor(req).insert(form);
  res.status(201).json({ ...form, accountId: req.user.accountId });
});

// Public, unauthenticated: only exposes published forms, and only the
// fields needed to render + submit them (no response counts/settings internals).
router.get("/:id/public", async (req, res) => {
  const form = await rawForms.find(req.params.id);
  if (!form || form.status !== "Published") return res.status(404).json({ error: "Form not found or not published" });
  res.json({ id: form.id, name: form.name, description: form.description, fields: form.fields, settings: form.settings });
});

// Public, unauthenticated: the specific dates the form owner marked
// available for a "booking" field (today or later only). Called first by
// the public form page so it can show a list of pickable dates instead of
// an open-ended date input — the owner set specific dates, not a
// recurring pattern, so an arbitrary date picker would mostly land on
// unavailable days.
router.get("/:id/booking-dates", async (req, res) => {
  const form = await rawForms.find(req.params.id);
  if (!form || form.status !== "Published") return res.status(404).json({ error: "Form not found or not published" });
  const field = form.fields.find((f) => f.id === req.query.fieldId && f.type === "booking");
  if (!field) return res.status(404).json({ error: "Booking field not found on this form." });
  res.json({ dates: availableDates(field) });
});

// Public, unauthenticated: every meeting slot for a "booking" field on a
// given date, each tagged with whether it's already booked — computed
// from the field's availability config plus whatever's already booked by
// existing responses. Called by the public form page after the
// respondent picks one of the dates from /booking-dates, before they've
// submitted anything (so no auth, same as /public and POST /responses).
// Returns already-booked slots too (not just available ones) so the
// picker can show them as visibly taken instead of silently vanishing.
router.get("/:id/booking-slots", async (req, res) => {
  const form = await rawForms.find(req.params.id);
  if (!form || form.status !== "Published") return res.status(404).json({ error: "Form not found or not published" });
  const field = form.fields.find((f) => f.id === req.query.fieldId && f.type === "booking");
  if (!field) return res.status(404).json({ error: "Booking field not found on this form." });
  if (!req.query.date) return res.status(400).json({ error: "date is required (YYYY-MM-DD)." });

  const responses = await rawResponses.query((r) => r.formId === form.id);
  const decryptedAnswers = responses.map((r) => decryptResponse(r).answers);
  const bookedIsoTimes = extractBookedTimes(field, decryptedAnswers);
  const slots = allSlotsForDate(field, req.query.date, bookedIsoTimes);
  res.json({ slots });
});

// Manager-only: same shape as /public but works regardless of publish
// status, so Draft forms can be previewed before going live.
router.get("/:id/preview", requireManager, async (req, res) => {
  const form = await formsFor(req).find(req.params.id);
  if (!form) return res.status(404).json({ error: "Not found" });
  res.json({ id: form.id, name: form.name, description: form.description, fields: form.fields, settings: form.settings });
});

router.get("/:id", async (req, res) => {
  const form = await formsFor(req).find(req.params.id);
  if (!form) return res.status(404).json({ error: "Not found" });
  res.json(await withResponseCount(form));
});

// Builds or edits a form's field list from a natural-language instruction.
// Returns the proposed change without saving it — the builder UI applies it
// to local state, and the user still has to hit Save. 503 (not a crash)
// when no API key is configured yet, so the frontend can fall back to its
// local "add a field for X" pattern-matcher instead of erroring out.
router.post("/:id/ai/build", requireManager, async (req, res) => {
  const form = await formsFor(req).find(req.params.id);
  if (!form) return res.status(404).json({ error: "Not found" });
  if (!req.user.isMasterAdmin) {
    const limits = await getLimitsForAccount(req.user.accountId);
    if (!limits.aiAssistant) {
      return res.status(403).json({ error: `The AI Assistant requires the Growth plan or higher. Your account is on ${limits.label}.` });
    }
  }
  const provider = await getAiProviderForAccount(req.user.accountId);
  if (!aiConfigured(provider)) {
    const providerLabel = provider === "gemini" ? "Gemini" : "Anthropic";
    const envVar = provider === "gemini" ? "GEMINI_API_KEY" : "ANTHROPIC_API_KEY";
    return res.status(503).json({ error: `${providerLabel} isn't configured yet. Ask your admin to set ${envVar} in the backend environment.` });
  }
  const prompt = (req.body.prompt || "").trim();
  if (!prompt) return res.status(400).json({ error: "prompt is required." });
  try {
    const result = await generateFormFields({ provider, prompt, currentFields: form.fields || [] });
    res.json(result);
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

router.post("/", requireManager, async (req, res) => {
  const limitError = await checkFormLimit(req);
  if (limitError) return res.status(403).json({ error: limitError });
  const form = {
    id: uuid(),
    name: req.body.name || "Untitled Form",
    description: req.body.description || "",
    fields: req.body.fields || [],
    settings: req.body.settings || {},
    workflow: req.body.workflow || { enabled: false, steps: [] },
    status: "Draft",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  await formsFor(req).insert(form);
  res.status(201).json({ ...form, accountId: req.user.accountId });
});

router.put("/:id", requireManager, async (req, res) => {
  if (req.body.workflow?.enabled && !req.user.isMasterAdmin) {
    const limits = await getLimitsForAccount(req.user.accountId);
    if (!limits.workflows) {
      return res.status(403).json({ error: `Approval workflows require the Growth plan or higher. Your account is on ${limits.label}.` });
    }
  }
  const updated = await formsFor(req).update(req.params.id, req.body);
  if (!updated) return res.status(404).json({ error: "Not found" });
  res.json(updated);
});

router.delete("/:id", requireFullAccess, async (req, res) => {
  const form = await formsFor(req).find(req.params.id);
  if (!form) return res.status(404).json({ error: "Not found" });
  const formResponses = await responsesFor(req).query((r) => r.formId === req.params.id);
  await Promise.all(formResponses.map((r) => responsesFor(req).remove(r.id)));
  await formsFor(req).remove(req.params.id);
  res.status(204).end();
});

router.post("/:id/duplicate", requireManager, async (req, res) => {
  const limitError = await checkFormLimit(req);
  if (limitError) return res.status(403).json({ error: limitError });
  const form = await formsFor(req).find(req.params.id);
  if (!form) return res.status(404).json({ error: "Not found" });
  const copy = {
    ...form,
    id: uuid(),
    name: `${form.name} (Copy)`,
    status: "Draft",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  await formsFor(req).insert(copy);
  res.status(201).json({ ...copy, accountId: req.user.accountId });
});

router.put("/:id/publish", requireManager, async (req, res) => {
  const updated = await formsFor(req).update(req.params.id, { status: "Published" });
  if (!updated) return res.status(404).json({ error: "Not found" });
  res.json(updated);
});

router.put("/:id/unpublish", requireManager, async (req, res) => {
  const updated = await formsFor(req).update(req.params.id, { status: "Draft" });
  if (!updated) return res.status(404).json({ error: "Not found" });
  res.json(updated);
});

router.get("/:id/responses", async (req, res) => {
  const form = await formsFor(req).find(req.params.id);
  if (!form) return res.status(404).json({ error: "Not found" });

  const { q, fieldId, value } = req.query;
  // Answers are encrypted at rest — decrypt before filtering/searching or
  // matches against ciphertext would silently never hit.
  let list = (await responsesFor(req).query((r) => r.formId === req.params.id)).map(decryptResponse);

  if (fieldId && value) {
    list = list.filter((r) => String(r.answers?.[fieldId] ?? "").toLowerCase() === String(value).toLowerCase());
  }
  if (q) {
    const needle = q.toLowerCase();
    list = list.filter((r) => Object.values(r.answers || {}).some((v) => String(v ?? "").toLowerCase().includes(needle)));
  }

  const sorted = list.sort((a, b) => dayjs(b.submittedAt).diff(dayjs(a.submittedAt)));

  // Opt-in pagination (same pattern as crudFactory) — answers are encrypted
  // at rest, so search/filter above already has to decrypt+scan every
  // response for this form in JS (Mongo can't $regex ciphertext); paginating
  // here still caps what actually goes over the wire to the browser.
  if (req.query.page) {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit, 10) || 50));
    const start = (page - 1) * limit;
    return res.json({
      items: sorted.slice(start, start + limit),
      total: sorted.length,
      page,
      limit,
      totalPages: Math.ceil(sorted.length / limit) || 1,
    });
  }

  res.json(sorted);
});

// Public submission — anonymous form-fillers and the WhatsApp survey engine
// have no session, so the response inherits the *form's* tenant, not a
// (nonexistent) requester's.
router.post("/:id/responses", async (req, res) => {
  const form = await rawForms.find(req.params.id);
  if (!form) return res.status(404).json({ error: "Not found" });

  const responseLimitError = await checkResponseLimit(form);
  if (responseLimitError) return res.status(403).json({ error: responseLimitError });

  // Re-check every file field server-side — the client's checks are just
  // UX, not a security boundary; a submission can be crafted directly
  // against this endpoint. See utils/fileUploads.js for what's enforced
  // (allowlisted types, size cap, magic-byte sniff).
  for (const field of form.fields.filter((f) => f.type === "file")) {
    const err = validateFileAnswer(field.label, req.body.answers?.[field.id]);
    if (err) return res.status(400).json({ error: err });
  }

  // Re-check every booking field server-side — the slot list the
  // respondent saw could be stale by the time they submit (someone else
  // grabbed it, or the availability config changed underneath them).
  const bookingFields = form.fields.filter((f) => f.type === "booking");
  if (bookingFields.length > 0) {
    const existingResponses = await rawResponses.query((r) => r.formId === form.id);
    const decryptedAnswers = existingResponses.map((r) => decryptResponse(r).answers);
    for (const field of bookingFields) {
      const chosen = req.body.answers?.[field.id];
      if (!chosen) continue; // not required at this layer — required-field validation is the client's/field's job
      const dateStr = chosen.slice(0, 10);
      const bookedIsoTimes = extractBookedTimes(field, decryptedAnswers);
      const available = slotsForDate(field, dateStr, bookedIsoTimes);
      if (!available.includes(chosen)) {
        return res.status(409).json({ error: `That time slot for "${field.label}" was just taken — please pick another.` });
      }
    }
  }

  const response = {
    id: uuid(),
    formId: req.params.id,
    // Customer-submitted answers are encrypted (AES-256-GCM) before being
    // written to Mongo — see utils/formCrypto.js.
    answers: encryptAnswers(req.body.answers || {}),
    submittedAt: new Date().toISOString(),
    accountId: form.accountId,
  };
  // Snapshotted at submission time so later edits to the form's workflow
  // config don't retroactively change an approval already in flight.
  if (form.workflow?.enabled && form.workflow.steps?.length) {
    response.workflow = autoAdvance(buildSnapshot(form.workflow));
  } else if (bookingFields.length > 0) {
    // A booking field with no explicitly configured workflow still gets
    // routed for approval — the form owner should always get a chance to
    // confirm/decline a meeting request, not just when they remembered to
    // set up a workflow by hand. Single step, resolves to the tenant
    // owner (authRole "admin") via the same role-based approver mechanism
    // as an explicit workflow — the whole approve/reject UI (My Approvals,
    // response detail panel) already works for any response with a
    // .workflow snapshot, no frontend changes needed for this to show up.
    response.workflow = autoAdvance(
      buildSnapshot({
        steps: [{ id: "confirm-booking", name: "Confirm Booking", mode: "all", approvers: [{ type: "role", value: "admin" }] }],
      })
    );
  }
  await rawResponses.insert(response);
  res.status(201).json(decryptResponse(response));
});

router.get("/:id/responses/:responseId/workflow", async (req, res) => {
  const response = await responsesFor(req).find(req.params.responseId);
  if (!response?.workflow) return res.status(404).json({ error: "This response has no workflow." });
  const tenantAccounts = await tenantAccountsFor(req);
  res.json({ ...response.workflow, currentApproverIds: currentApprovers(response.workflow, tenantAccounts) });
});

// Best-effort confirmation email to whoever submitted the response, once
// the workflow reaches a final "approved" state — looks for the first
// email-type field's answer (there's no login/session tied to a public
// form submission, so that's the only address we have). Never throws:
// a missing email field or a transient SMTP failure shouldn't turn an
// otherwise-successful approval into a 500 for the approving admin.
async function notifyApprovalIfEmailAvailable(form, response) {
  try {
    const emailField = form.fields.find((f) => f.type === "email");
    if (!emailField) return;
    const { answers } = decryptResponse(response);
    const to = answers?.[emailField.id];
    if (!to || typeof to !== "string") return;

    const bookingField = form.fields.find((f) => f.type === "booking");
    const bookingTime = bookingField ? answers?.[bookingField.id] : null;
    const subject = bookingField ? `Your appointment for "${form.name}" is confirmed` : `Your submission for "${form.name}" was approved`;
    const bodyHtml = bookingField
      ? `<p>Good news — your appointment request for <strong>${form.name}</strong> has been approved${
          bookingTime ? ` for <strong>${new Date(bookingTime).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}</strong>` : ""
        }.</p>`
      : `<p>Good news — your submission for <strong>${form.name}</strong> has been approved.</p>`;
    await emailClient.sendMail({
      to,
      subject,
      html: emailLayout({
        preheader: subject,
        heading: bookingField ? "Appointment confirmed ✅" : "Submission approved ✅",
        bodyHtml,
      }),
    });
  } catch {
    // Notification is a nice-to-have — the approval itself already succeeded.
  }
}

router.post("/:id/responses/:responseId/workflow/decide", async (req, res) => {
  const response = await responsesFor(req).find(req.params.responseId);
  if (!response?.workflow) return res.status(404).json({ error: "This response has no workflow." });
  const { action, comment } = req.body;
  if (!["approve", "reject"].includes(action)) return res.status(400).json({ error: "action must be 'approve' or 'reject'." });

  const tenantAccounts = await tenantAccountsFor(req);
  const workflow = JSON.parse(JSON.stringify(response.workflow));
  try {
    applyDecision(workflow, { actorId: req.user.id, actorName: req.user.email, action, comment }, tenantAccounts);
  } catch (err) {
    return res.status(403).json({ error: err.message });
  }
  await responsesFor(req).update(req.params.responseId, { workflow });

  if (workflow.status === "approved") {
    const form = await formsFor(req).find(req.params.id);
    if (form) await notifyApprovalIfEmailAvailable(form, response);
  }

  res.json({ ...workflow, currentApproverIds: currentApprovers(workflow, tenantAccounts) });
});

router.delete("/:id/responses/:responseId", requireFullAccess, async (req, res) => {
  const removed = await responsesFor(req).remove(req.params.responseId);
  if (!removed) return res.status(404).json({ error: "Not found" });
  res.status(204).end();
});

// Excel/Sheets treats a leading =, +, -, or @ as the start of a formula —
// a form respondent could submit "=cmd|'/c calc'!A1" as an answer and have
// it execute when someone opens the exported file (CSV or Excel — both go
// through this same row-builder). Prefixing with a plain quote defuses it
// (Excel shows the literal text, formula never runs).
function sanitizeCsvCell(value) {
  const str = String(value ?? "");
  return /^[=+\-@]/.test(str) ? `'${str}` : str;
}

function responseRows(form, formResponses) {
  return formResponses.map((r) => {
    const row = { "Submitted At": dayjs(r.submittedAt).format("YYYY-MM-DD HH:mm") };
    form.fields.forEach((f) => {
      const answer = r.answers?.[f.id];
      // File answers are a { name, type, dataUrl } object — export just the
      // filename, not the (potentially megabytes-long) base64 payload.
      const cell = f.type === "file" && answer?.name ? answer.name : answer;
      row[f.label] = sanitizeCsvCell(cell ?? "");
    });
    return row;
  });
}

router.get("/:id/responses/export/csv", async (req, res) => {
  const form = await formsFor(req).find(req.params.id);
  if (!form) return res.status(404).json({ error: "Not found" });
  const formResponses = (await responsesFor(req).query((r) => r.formId === req.params.id)).map(decryptResponse);
  const rows = responseRows(form, formResponses);
  const headers = rows.length ? Object.keys(rows[0]) : ["Submitted At", ...form.fields.map((f) => f.label)];
  const escape = (v) => `"${String(v).replace(/"/g, '""')}"`;
  const csv = [headers.map(escape).join(","), ...rows.map((row) => headers.map((h) => escape(row[h] ?? "")).join(","))].join("\n");
  res.setHeader("Content-Disposition", `attachment; filename=${form.name.replace(/\s+/g, "_")}-responses.csv`);
  res.setHeader("Content-Type", "text/csv");
  res.send(csv);
});

router.get("/:id/responses/export/excel", async (req, res) => {
  const form = await formsFor(req).find(req.params.id);
  if (!form) return res.status(404).json({ error: "Not found" });
  const formResponses = (await responsesFor(req).query((r) => r.formId === req.params.id)).map(decryptResponse);
  const rows = responseRows(form, formResponses);
  const wb = XLSX.utils.book_new();
  const sheet = XLSX.utils.json_to_sheet(rows);
  XLSX.utils.book_append_sheet(wb, sheet, "Responses");
  const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
  res.setHeader("Content-Disposition", `attachment; filename=${form.name.replace(/\s+/g, "_")}-responses.xlsx`);
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.send(buffer);
});

module.exports = router;
