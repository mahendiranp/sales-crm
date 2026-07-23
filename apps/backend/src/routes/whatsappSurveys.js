const express = require("express");
const crypto = require("crypto");
const { collection, scopedCollection } = require("../db/store");
const { requireManager } = require("../middleware/auth");
const engine = require("../services/whatsappSurveyEngine");
const whatsappClient = require("../integrations/whatsappClient");

const router = express.Router();
// survey_sessions records carry accountId, so the enforced scopedCollection
// wrapper applies cleanly here (defense-in-depth over the manual .filter()
// this replaces). whatsapp_messages records do NOT carry accountId (logged
// by the webhook before any tenant is known, keyed only by phone number) —
// left as the unscoped collection() below; scoping it would need a deeper
// fix (stamp accountId in whatsappSurveyEngine.js's logInbound/outbound
// paths first), not just a wrapper swap. Flagged as a real, narrow gap:
// GET /:id/messages currently has no tenant boundary on the messages
// collection itself, only on the session that selects the phone/time
// window to search — a shared phone number with overlapping timestamps
// across two tenants could theoretically cross-contaminate.
const forms = collection("forms");
const messages = collection("whatsapp_messages");
const settings = collection("settings");
const sessionsFor = (req) => scopedCollection("survey_sessions", req.user.accountId);

let warnedNoAppSecret = false;

// Meta signs every webhook POST with your app secret (HMAC-SHA256 over the
// raw request body) so you can tell a real Meta callback from someone who
// just guessed the URL. Without WHATSAPP_APP_SECRET set, we can't verify —
// warn once and let it through anyway (mock/dev mode), same pattern as the
// other integrations in this app (formCrypto, JWT).
function verifyMetaSignature(req, res, next) {
  const appSecret = process.env.WHATSAPP_APP_SECRET;
  if (!appSecret) {
    if (!warnedNoAppSecret) {
      // eslint-disable-next-line no-console
      console.warn(
        "⚠️  WHATSAPP_APP_SECRET is not set — webhook signature verification is DISABLED. " +
        "Anyone who finds this URL can POST forged WhatsApp messages. Set it before going live."
      );
      warnedNoAppSecret = true;
    }
    return next();
  }

  const signature = req.header("x-hub-signature-256") || "";
  const expected = "sha256=" + crypto.createHmac("sha256", appSecret).update(req.rawBody || Buffer.alloc(0)).digest("hex");
  const sigBuf = Buffer.from(signature);
  const expBuf = Buffer.from(expected);
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    return res.sendStatus(401);
  }
  next();
}

router.get("/", async (req, res) => {
  const { formId } = req.query;
  const all = await sessionsFor(req).all();
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
  const session = await sessionsFor(req).find(req.params.id);
  if (!session) return res.status(404).json({ error: "Not found" });
  const form = await forms.find(session.formId);
  const currentField = session.status === "in_progress" ? form.fields[session.currentIndex] : null;
  res.json({ session, form: { id: form.id, name: form.name, fields: form.fields }, currentField });
});

// Chat transcript for a session's phone number, oldest first — powers the
// chat-bubble UI.
router.get("/:id/messages", async (req, res) => {
  const session = await sessionsFor(req).find(req.params.id);
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
router.post("/webhook", verifyMetaSignature, async (req, res) => {
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
