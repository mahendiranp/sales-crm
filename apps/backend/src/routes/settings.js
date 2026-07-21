const express = require("express");
const { collection } = require("../db/store");
const { requireManager, requireMasterAdmin } = require("../middleware/auth");
const { limitsFor } = require("../utils/plans");
const { defaultCredits } = require("../utils/aiCredits");
const emailClient = require("../integrations/emailClient");
const { emailLayout } = require("../utils/emailTemplate");

const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:3000";

const router = express.Router();
const settings = collection("settings");
const accounts = collection("accounts");

function defaults(accountId) {
  return {
    id: `settings-${accountId}`,
    accountId,
    companyProfile: { name: "Your Company Pvt Ltd", industry: "Technology", address: "" },
    // "starter" is the free tier every new signup starts on — see
    // utils/plans.js for what each tier actually unlocks. Self-serve
    // upgrade to Growth happens via Razorpay checkout (routes/payments.js);
    // Enterprise is sales-assisted.
    subscription: { plan: "starter", renewsOn: null },
    // One-time signup grant — every account gets this regardless of plan
    // (see utils/aiCredits.js). Paid plans additionally top this up each
    // billing cycle instead of resetting it.
    aiCredits: defaultCredits(),
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
      // Forms is a core, always-marketed feature (landing page, pricing
      // cards), so unlike the other optional apps here it defaults on.
      forms: true,
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
  current = (await enforceSubscriptionExpiry(req.user.accountId)) || current;
  // Fallback for accounts whose settings doc predates aiCredits existing at
  // all — defaults() above already bakes it in for anything created fresh.
  const aiCredits = current.aiCredits || defaultCredits();
  res.json({ ...current, aiCredits });
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
      createdAt: a.createdAt,
      plan: s?.subscription?.plan || "starter",
      aiProvider: s?.aiConfiguration?.provider || "gemini",
      isMasterAdmin: !!a.isMasterAdmin,
      // Which modules/apps this tenant has actually opted into (not just
      // released platform-wide) — lets master admin see at a glance what
      // each account is actually using without opening their Settings.
      optedModules: Object.entries(s?.modules || {}).filter(([, v]) => v !== false).map(([k]) => k),
      optedApps: Object.entries(s?.apps || {}).filter(([, v]) => v).map(([k]) => k),
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

// A paid plan's renewsOn date is set once, at successful payment
// (routes/payments.js), and never touched again until either another
// payment renews it or this downgrades it back to Starter — there's no
// cron/scheduled-job infra in this app (same reasoning as workflow
// escalations in forms.js), so "the next time anything reads this
// account's settings" is the trigger instead of a background sweep.
// Returns the (possibly just-downgraded) settings doc, or null if none
// exists yet.
async function enforceSubscriptionExpiry(accountId) {
  const id = `settings-${accountId}`;
  const current = await settings.find(id);
  if (!current?.subscription?.renewsOn) return current;
  if (current.subscription.plan === "starter") return current;
  if (new Date(current.subscription.renewsOn) > new Date()) return current;

  const previousPlan = current.subscription.plan;
  // downgradedFrom/downgradedAt are surfaced by GET / so the frontend can
  // show a one-time "your plan expired" notice — cleared automatically the
  // next time a real payment succeeds (routes/payments.js's /verify
  // replaces `subscription` wholesale with just { plan, renewsOn }).
  const updated = await settings.update(id, {
    subscription: { plan: "starter", renewsOn: null, downgradedFrom: previousPlan, downgradedAt: new Date().toISOString() },
  });
  await notifyPlanDowngraded(accountId, previousPlan);
  return updated;
}

// Best-effort — a transient SMTP failure shouldn't block the downgrade
// itself, which has already been written by the time this runs.
async function notifyPlanDowngraded(accountId, previousPlan) {
  try {
    const account = await accounts.find(accountId);
    if (!account?.email) return;
    const previousLabel = limitsFor(previousPlan).label;
    await emailClient.sendMail({
      to: account.email,
      subject: `Your ${previousLabel} plan has expired`,
      html: emailLayout({
        preheader: "Your subscription wasn't renewed — you're back on the Starter plan.",
        heading: "Your plan expired",
        bodyHtml: `<p>Hi ${account.name},</p><p>Your <strong>${previousLabel}</strong> plan's billing cycle ended and wasn't renewed, so your account has been moved back to the <strong>Starter</strong> plan. Approval workflows, the WhatsApp bot, and your higher limits are paused until you upgrade again.</p>`,
        cta: { label: "Upgrade your plan", url: `${FRONTEND_URL}/app/settings` },
      }),
    });
  } catch {
    // Notification is a nice-to-have — the downgrade itself already happened.
  }
}

// Shared by other route files (forms.js, auth.js) that need to check plan
// limits (max forms, max teammates, feature gates) without duplicating
// the "find settings, fall back to defaults" dance.
async function getLimitsForAccount(accountId) {
  const current = await enforceSubscriptionExpiry(accountId);
  return limitsFor((current || defaults(accountId)).subscription?.plan);
}

// Which AI provider (Anthropic or Gemini) this account picked in
// Settings → AI Configuration — used by the Form Builder's AI Assistant
// route (forms.js) to route the request to the right client.
async function getAiProviderForAccount(accountId) {
  const current = await settings.find(`settings-${accountId}`);
  return current?.aiConfiguration?.provider || "gemini";
}

module.exports = router;
module.exports.defaults = defaults;
module.exports.getLimitsForAccount = getLimitsForAccount;
module.exports.getAiProviderForAccount = getAiProviderForAccount;
