const express = require("express");
const { randomUUID: uuid } = require("crypto");
const { scopedCollection } = require("../db/store");
const { requireManager } = require("../middleware/auth");

const router = express.Router();

router.get("/", async (req, res) => res.json(await scopedCollection("whatsapp_messages", req.user.accountId).all()));

// Send a single message
router.post("/send", requireManager, async (req, res) => {
  const { leadId, contactName, message } = req.body;
  const record = {
    id: uuid(),
    leadId,
    contactName,
    direction: "outbound",
    message,
    aiSuggested: false,
    status: "sent",
    timestamp: new Date().toISOString(),
  };
  await scopedCollection("whatsapp_messages", req.user.accountId).insert(record);
  res.status(201).json({ ...record, accountId: req.user.accountId });
});

// Send bulk messages to multiple leads using a template
router.post("/send-bulk", requireManager, async (req, res) => {
  const { leadIds, templateId, customMessage } = req.body;
  const messages = scopedCollection("whatsapp_messages", req.user.accountId);
  const templates = scopedCollection("templates", req.user.accountId);
  const template = templateId ? await templates.find(templateId) : null;
  const body = customMessage || template?.body || "";
  const sent = [];
  for (const leadId of leadIds || []) {
    const record = {
      id: uuid(),
      leadId,
      contactName: req.body.contactNames?.[leadId] || "",
      direction: "outbound",
      message: body,
      aiSuggested: false,
      status: "sent",
      timestamp: new Date().toISOString(),
    };
    await messages.insert(record);
    sent.push(record);
  }
  res.status(201).json({ sentCount: sent.length, messages: sent });
});

// Simple rule-based "AI Reply Suggestion" engine.
// A real deployment would call an LLM (e.g. the Anthropic API) here —
// this mock keeps the project runnable without requiring an API key.
function generateAiSuggestion(incomingMessage) {
  const text = (incomingMessage || "").toLowerCase();
  if (text.includes("available") || text.includes("stock")) {
    return "Yes, it's available. Would you like a demo tomorrow?";
  }
  if (text.includes("price") || text.includes("cost") || text.includes("budget")) {
    return "Our pricing depends on your requirements — I can share a detailed quotation. What's your expected budget?";
  }
  if (text.includes("demo")) {
    return "Sure! I can schedule a demo. Does tomorrow at 11 AM work for you?";
  }
  if (text.includes("discount") || text.includes("offer")) {
    return "We do have festive offers running this month — I'll share the details shortly.";
  }
  if (text.includes("thank")) {
    return "You're welcome! Let us know if there's anything else you need.";
  }
  return "Thanks for reaching out! Could you share a bit more detail so I can help you better?";
}

router.post("/ai-suggest", (req, res) => {
  const { message } = req.body;
  const suggestion = generateAiSuggestion(message);
  res.json({ suggestion });
});

module.exports = router;
