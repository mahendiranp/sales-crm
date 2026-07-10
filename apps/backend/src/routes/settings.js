const express = require("express");
const { collection } = require("../db/store");
const { requireManager } = require("../middleware/auth");

const router = express.Router();
const settings = collection("settings");

function defaults(accountId) {
  return {
    id: `settings-${accountId}`,
    accountId,
    companyProfile: { name: "Your Company Pvt Ltd", industry: "Technology", address: "" },
    subscription: { plan: "Pro Trial", renewsOn: null },
    whatsappApi: { provider: "", apiKey: "", connected: false },
    emailSettings: { provider: "SMTP", fromAddress: "", connected: false },
    paymentGateway: { provider: "Razorpay", connected: false },
    aiConfiguration: { provider: "Anthropic (Claude)", apiKey: "", enabled: false },
    notifications: { email: true, sms: false, push: true },
    integrations: [],
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
      // WhatsApp tab of the Form Builder instead of the Apps grid.
      whatsappBot: true,
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
  res.json(current);
});

router.put("/", requireManager, async (req, res) => {
  // Feature flags (the Admin Portal's Apps toggles) are master-admin-only —
  // a company's own admin can manage everything else but not these.
  if (req.body.apps && !req.user.isMasterAdmin) {
    return res.status(403).json({ error: "Only the master admin can manage the Admin Portal's feature flags." });
  }
  const id = `settings-${req.user.accountId}`;
  let current = await settings.find(id);
  if (!current) {
    await settings.insert({ ...defaults(req.user.accountId), ...req.body });
  } else {
    await settings.update(id, req.body);
  }
  res.json(await settings.find(id));
});

module.exports = router;
