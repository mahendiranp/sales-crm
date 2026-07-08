const express = require("express");
const { collection } = require("../db/store");
const { requireManager } = require("../middleware/auth");

const router = express.Router();
const settings = collection("settings");

const DEFAULTS = {
  id: "app-settings",
  companyProfile: { name: "Your Company Pvt Ltd", industry: "Technology", address: "" },
  subscription: { plan: "Pro Trial", renewsOn: null },
  whatsappApi: { provider: "", apiKey: "", connected: false },
  emailSettings: { provider: "SMTP", fromAddress: "", connected: false },
  paymentGateway: { provider: "Razorpay", connected: false },
  aiConfiguration: { provider: "Anthropic (Claude)", apiKey: "", enabled: false },
  notifications: { email: true, sms: false, push: true },
  integrations: [],
};

router.get("/", (req, res) => {
  let current = settings.find("app-settings");
  if (!current) {
    current = DEFAULTS;
    settings.insert(current);
  }
  res.json(current);
});

router.put("/", requireManager, async (req, res) => {
  let current = settings.find("app-settings");
  if (!current) {
    await settings.insert({ ...DEFAULTS, ...req.body });
  } else {
    await settings.update("app-settings", req.body);
  }
  res.json(settings.find("app-settings"));
});

module.exports = router;
