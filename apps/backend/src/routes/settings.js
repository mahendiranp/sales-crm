const express = require("express");
const { collection } = require("../db/store");
const { requireManager, requireMasterAdmin } = require("../middleware/auth");
const { limitsFor } = require("../utils/plans");

const router = express.Router();
const settings = collection("settings");
const accounts = collection("accounts");

function defaults(accountId) {
  return {
    id: `settings-${accountId}`,
    accountId,
    companyProfile: { name: "Your Company Pvt Ltd", industry: "Technology", address: "" },
    // "starter" is the free tier every new signup starts on — see
    // utils/plans.js for what each tier actually unlocks. There's no
    // payment processor wired up yet, so nothing moves an account off
    // this without someone (master admin, for now) changing it by hand.
    subscription: { plan: "starter", renewsOn: null },
    whatsappApi: { provider: "", apiKey: "", connected: false },
    emailSettings: { provider: "SMTP", fromAddress: "", connected: false },
    paymentGateway: { provider: "Razorpay", connected: false },
    // "anthropic" | "gemini" — which LLM the Form Builder's AI Assistant
    // calls for this account (see integrations/aiClient.js). Both providers
    // are configured platform-wide via env vars (ANTHROPIC_API_KEY /
    // GEMINI_API_KEY), not per-account keys — this only picks which one.
    aiConfiguration: { provider: "gemini" },
    notifications: { email: true, sms: false, push: true },
    integrations: [],
    // Core CRM sections — unlike `apps` (the Odoo-style optional-modules
    // catalog), these were previously hardcoded always-on in Layout.jsx.
    // Defaults preserve that (everything on) so existing tenants see no
    // change; a tenant can be configured down to e.g. just Forms + Dashboard.
    modules: {
      dashboard: true,
      leads: true,
      contacts: true,
      companies: true,
      deals: true,
      activities: true,
      tasks: true,
      whatsapp: true,
      email: true,
      templates: true,
      analytics: true,
      reports: true,
      performance: true,
      users: true,
      teams: true,
    },
    // Odoo-style "apps" catalog — one boolean per toggleable app key (see
    // apps/web/src/lib/appCatalog.js for the matching catalog). builtIn apps
    // (crm, sales, whatsapp) aren't listed here since they're always on.
    apps: {
      accounting: false,
      invoicing: false,
      expenses: false,
      spreadsheetBi: false,
      documents: false,
      sign: false,
      posShop: false,
      posRestaurant: false,
      subscriptions: false,
      rental: false,
      websiteBuilder: false,
      ecommerce: false,
      blog: false,
      forum: false,
      liveChat: false,
      elearning: false,
      inventory: false,
      manufacturing: false,
      plm: false,
      purchase: false,
      maintenance: false,
      quality: false,
      employees: false,
      recruitment: false,
      timeOff: false,
      appraisals: false,
      referrals: false,
      fleet: false,
      socialMarketing: false,
      emailMarketing: false,
      smsMarketing: false,
      events: false,
      marketingAutomation: false,
      surveys: false,
      forms: false,
      project: false,
      timesheets: false,
      fieldService: false,
      helpdesk: false,
      planning: false,
      appointments: false,
      discuss: false,
      ai: false,
      iot: false,
      voip: false,
      knowledge: false,
      // Not part of the Odoo-style app catalog (it's a capability toggle
      // within Forms, not a standalone page) — surfaced directly in the
      // WhatsApp tab of the Form Builder instead of the Apps grid. Off by
      // default since it's a Growth-plan feature (see utils/plans.js);
      // the PUT / handler below blocks turning it on below that plan.
      whatsappBot: false,
    },
  };
}

router.get("/", async (req, res) => {
  const id = `settings-${req.user.accountId}`;
  let current = await settings.find(id);
  if (!current) {
    current = defaults(req.user.accountId);
    await settings.insert(current);
  }
  const aiUsage = await getAiUsage(req.user.accountId);
  res.json({ ...current, aiUsage });
});

// Master-admin-only, platform-wide view: every tenant (one row per owner
// account — authRole "admin") with which AI provider they've picked in
// Settings → AI Configuration, alongside plan/company for context. Lets
// the platform admin see at a glance who's using Anthropic vs. Gemini
// without opening each tenant's Settings individually.
router.get("/accounts", requireMasterAdmin, async (req, res) => {
  const [allAccounts, allSettings] = await Promise.all([accounts.all(), settings.all()]);
  const owners = allAccounts.filter((a) => a.authRole === "admin");
  const rows = owners.map((a) => {
    const s = allSettings.find((s) => s.accountId === a.id);
    return {
      accountId: a.id,
      name: a.name,
      email: a.email,
      company: a.company || s?.companyProfile?.name || "",
      plan: s?.subscription?.plan || "starter",
      aiProvider: s?.aiConfiguration?.provider || "gemini",
      isMasterAdmin: !!a.isMasterAdmin,
    };
  });
  res.json(rows);
});

router.put("/", requireManager, async (req, res) => {
  // Feature flags (Admin Portal apps + core module visibility) can be
  // changed by the tenant owner (their own account/plan) or the platform's
  // master admin — but not by a teammate (manager/viewer) they've added.
  const isOwner = req.user.isMasterAdmin || req.user.authRole === "admin";
  if ((req.body.apps || req.body.modules) && !isOwner) {
    return res.status(403).json({ error: "Only the account owner can manage feature flags." });
  }
  const id = `settings-${req.user.accountId}`;
  let current = await settings.find(id);

  // Without this, any owner could PUT their own subscription.plan and
  // grant themselves Growth/Enterprise limits for free — there's no
  // payment processor wired up yet to be the actual gate. Only the
  // platform's master admin can change it until real billing exists.
  // Compares against the *current* plan rather than just checking whether
  // `subscription` is present — a plain settings save (company profile,
  // notifications, etc.) sends the whole object back including its own
  // unchanged subscription field, which isn't an attempted plan change.
  if (req.body.subscription && !req.user.isMasterAdmin) {
    const currentPlan = (current || defaults(req.user.accountId)).subscription?.plan;
    if (req.body.subscription.plan !== currentPlan) {
      return res.status(403).json({ error: "Only the platform admin can change your subscription plan." });
    }
  }

  // Can't enable a plan-gated app toggle below the plan that unlocks it —
  // otherwise this endpoint would be a backdoor around the pricing table.
  if (req.body.apps && !req.user.isMasterAdmin) {
    const plan = (current || defaults(req.user.accountId)).subscription?.plan;
    const limits = limitsFor(plan);
    if (req.body.apps.whatsappBot && !limits.whatsappBot) {
      return res.status(403).json({ error: `The WhatsApp survey bot requires the Growth plan or higher. Your account is on ${limits.label}.` });
    }
  }

  if (!current) {
    await settings.insert({ ...defaults(req.user.accountId), ...req.body });
  } else {
    await settings.update(id, req.body);
  }
  res.json(await settings.find(id));
});

// Shared by other route files (forms.js, auth.js) that need to check plan
// limits (max forms, max teammates, feature gates) without duplicating
// the "find settings, fall back to defaults" dance.
async function getLimitsForAccount(accountId) {
  const current = await settings.find(`settings-${accountId}`);
  return limitsFor((current || defaults(accountId)).subscription?.plan);
}

// Which AI provider (Anthropic or Gemini) this account picked in
// Settings → AI Configuration — used by the Form Builder's AI Assistant
// route (forms.js) to route the request to the right client.
async function getAiProviderForAccount(accountId) {
  const current = await settings.find(`settings-${accountId}`);
  return current?.aiConfiguration?.provider || "gemini";
}

// "2026-07" style key — AI generation usage resets every calendar month,
// not on a rolling 30-day window, to keep the reset date predictable and
// match how the rest of the plan limits (maxResponsesPerMonth) are framed.
function currentMonthKey() {
  return new Date().toISOString().slice(0, 7);
}

// Rolls the counter over to 0 if the stored month doesn't match the
// current one — called from both the read path (settings GET, so the UI
// shows a fresh count on the 1st even before any generation happens) and
// the increment path below.
function freshAiUsage(stored) {
  const monthKey = currentMonthKey();
  if (!stored || stored.monthKey !== monthKey) return { monthKey, count: 0 };
  return stored;
}

// Read-only usage snapshot for the "AI Left: X/Y" indicator — never
// mutates count, only resets it in-memory if the month has rolled over
// (the write happens lazily on the next actual increment, not here).
async function getAiUsage(accountId) {
  const current = await settings.find(`settings-${accountId}`);
  const plan = (current || defaults(accountId)).subscription?.plan;
  const limit = limitsFor(plan).aiMonthlyLimit;
  const usage = freshAiUsage(current?.aiUsage);
  return { used: usage.count, limit };
}

// Called once per successful AI generation (forms.js's /:id/ai/build route)
// — increments the persisted counter, resetting first if the month rolled
// over since the last call.
async function incrementAiUsage(accountId) {
  const id = `settings-${accountId}`;
  const current = await settings.find(id);
  const usage = freshAiUsage(current?.aiUsage);
  const next = { monthKey: usage.monthKey, count: usage.count + 1 };
  if (!current) {
    await settings.insert({ ...defaults(accountId), aiUsage: next });
  } else {
    await settings.update(id, { aiUsage: next });
  }
  return next;
}

module.exports = router;
module.exports.defaults = defaults;
module.exports.getLimitsForAccount = getLimitsForAccount;
module.exports.getAiUsage = getAiUsage;
module.exports.incrementAiUsage = incrementAiUsage;
module.exports.getAiProviderForAccount = getAiProviderForAccount;
