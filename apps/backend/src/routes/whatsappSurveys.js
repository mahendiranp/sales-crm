const express = require("express");
const { collection } = require("../db/store");
const { requireManager } = require("../middleware/auth");
const engine = require("../services/whatsappSurveyEngine");
const whatsappClient = require("../integrations/whatsappClient");

const router = express.Router();
const sessions = collection("survey_sessions");
const forms = collection("forms");
const messages = collection("whatsapp_messages");
const settings = collection("settings");

router.get("/", async (req, res) => {
  const { formId } = req.query;
  const all = (await sessions.all()).filter((s) => s.accountId === req.user.accountId);
  const filtered = formId ? all.filter((s) => s.formId === formId) : all;
  res.json(filtered.sort((a, b) => new Date(b.startedAt) - new Date(a.startedAt)));
});

router.get("/config", async (req, res) => {
  const s = await settings.find(`settings-${req.user.accountId}`);
  const enabled = s?.apps?.whatsappBot !== false;
  res.json({ configured: whatsappClient.isConfigured(), enabled });
});

// Meta webhook verification handshake (GET) — Meta calls this once when you
// register the webhook URL in the developer dashboard. Must be declared
// before GET /:id, or Express matches "webhook" as a session id instead.
router.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];
  if (mode === "subscribe" && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    return res.status(200).send(challenge);
  }
  res.sendStatus(403);
});

// Session detail including the field the customer needs to answer next —
// lets the UI render the right input control (buttons, stars, etc.)
// instead of the user having to know the expected reply format.
router.get("/:id", async (req, res) => {
  const session = (await sessions.all()).find((s) => s.id === req.params.id && s.accountId === req.user.accountId);
  if (!session) return res.status(404).json({ error: "Not found" });
  const form = await forms.find(session.formId);
  const currentField = session.status === "in_progress" ? form.fields[session.currentIndex] : null;
  res.json({ session, form: { id: form.id, name: form.name, fields: form.fields }, currentField });
});

// Chat transcript for a session's phone number, oldest first — powers the
// chat-bubble UI.
router.get("/:id/messages", async (req, res) => {
  const session = (await sessions.all()).find((s) => s.id === req.params.id && s.accountId === req.user.accountId);
  if (!session) return res.status(404).json({ error: "Not found" });
  const all = await messages.all();
  const windowEnd = session.completedAt ? new Date(session.completedAt).getTime() + 1000 : Date.now() + 1000;
  const thread = all
    .filter((m) => m.contactName === session.phone && new Date(m.timestamp) >= new Date(session.startedAt) && new Date(m.timestamp).getTime() <= windowEnd)
    .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  res.json(thread);
});

router.post("/", requireManager, async (req, res) => {
  const { formId, phone } = req.body;
  if (!formId || !phone) return res.status(400).json({ error: "formId and phone are required" });
  try {
    const session = await engine.startSession(formId, phone, req.user.accountId);
    res.status(201).json(session);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

// Real inbound message webhook (POST) — Meta Cloud API payload shape.
router.post("/webhook", async (req, res) => {
  try {
    const entry = req.body?.entry?.[0];
    const message = entry?.changes?.[0]?.value?.messages?.[0];
    if (message?.type === "text") {
      await engine.handleReply(message.from, message.text.body);
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("WhatsApp webhook error:", err);
  }
  res.sendStatus(200);
});

// Dev-only: simulate an inbound reply without needing a real WhatsApp
// account or a public webhook URL. Exercises the exact same handleReply()
// path the real webhook uses.
router.post("/simulate-reply", requireManager, async (req, res) => {
  const { phone, text } = req.body;
  if (!phone || text === undefined) return res.status(400).json({ error: "phone and text are required" });
  const result = await engine.handleReply(phone, text);
  res.json(result);
});

module.exports = router;
