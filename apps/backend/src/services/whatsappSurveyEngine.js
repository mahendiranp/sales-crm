// Conversation engine that walks a WhatsApp survey session through a
// published form's fields, one message at a time — validating each reply
// before advancing, and writing the finished response into the same
// (encrypted) form_responses collection the web form uses.
const { randomUUID: uuid } = require("crypto");
const { collection } = require("../db/store");
const { encryptAnswers } = require("../utils/formCrypto");
const whatsappClient = require("../integrations/whatsappClient");

const forms = collection("forms");
const formResponses = collection("form_responses");
const sessions = collection("survey_sessions");
const messages = collection("whatsapp_messages");
const settings = collection("settings");

// Feature flag: settings.apps.whatsappBot, master-admin controlled (see
// routes/settings.js). Defaults to enabled if the tenant has no settings
// doc yet (matches the default in settings.js).
async function isBotEnabled(accountId) {
  const s = await settings.find(`settings-${accountId}`);
  return s?.apps?.whatsappBot !== false;
}

async function logInbound(phone, text) {
  await messages.insert({
    id: uuid(),
    leadId: null,
    contactName: phone,
    direction: "inbound",
    message: text,
    aiSuggested: false,
    status: "received",
    timestamp: new Date().toISOString(),
  });
}

function formatQuestion(field) {
  let text = field.label;
  if (field.helpText) text += `\n_(${field.helpText})_`;

  switch (field.type) {
    case "dropdown":
    case "radio":
      text += "\n" + field.options.map((o, i) => `${i + 1}. ${o}`).join("\n") + "\n\nReply with the number.";
      break;
    case "checkbox":
      text += "\n" + field.options.map((o, i) => `${i + 1}. ${o}`).join("\n") + "\n\nReply with numbers separated by commas (e.g. 1,3).";
      break;
    case "rating":
      text += "\n\nReply with a number from 1 to 5.";
      break;
    case "yesno":
      text += "\n\nReply Yes or No.";
      break;
    case "email":
      text += "\n\n(Please share your email address)";
      break;
    case "date":
      text += "\n\n(Format: YYYY-MM-DD)";
      break;
    default:
      break;
  }
  if (field.required) text += "\n\n_Required_";
  return text;
}

function parseAnswer(field, raw) {
  const trimmed = (raw || "").trim();
  if (field.required && !trimmed) {
    return { valid: false, error: "This question is required — please reply with an answer." };
  }
  if (!trimmed) return { valid: true, value: "" };

  switch (field.type) {
    case "dropdown":
    case "radio": {
      const idx = parseInt(trimmed, 10);
      if (!idx || idx < 1 || idx > field.options.length) {
        return { valid: false, error: `Please reply with a number between 1 and ${field.options.length}.` };
      }
      return { valid: true, value: field.options[idx - 1] };
    }
    case "checkbox": {
      const idxs = trimmed.split(",").map((s) => parseInt(s.trim(), 10));
      if (idxs.some((i) => !i || i < 1 || i > field.options.length)) {
        return { valid: false, error: `Please reply with numbers between 1 and ${field.options.length}, separated by commas.` };
      }
      return { valid: true, value: idxs.map((i) => field.options[i - 1]) };
    }
    case "rating": {
      const n = parseInt(trimmed, 10);
      if (!n || n < 1 || n > 5) return { valid: false, error: "Please reply with a number from 1 to 5." };
      return { valid: true, value: n };
    }
    case "yesno": {
      const lower = trimmed.toLowerCase();
      if (["yes", "y"].includes(lower)) return { valid: true, value: "Yes" };
      if (["no", "n"].includes(lower)) return { valid: true, value: "No" };
      return { valid: false, error: "Please reply Yes or No." };
    }
    case "email": {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) return { valid: false, error: "Please share a valid email address." };
      return { valid: true, value: trimmed };
    }
    case "number": {
      const n = Number(trimmed);
      if (Number.isNaN(n)) return { valid: false, error: "Please reply with a number." };
      return { valid: true, value: n };
    }
    default:
      return { valid: true, value: trimmed };
  }
}

function normalizePhone(phone) {
  return (phone || "").replace(/[^\d+]/g, "");
}

async function startSession(formId, rawPhone, accountId) {
  if (!(await isBotEnabled(accountId))) {
    throw Object.assign(new Error("The WhatsApp bot is turned off for this account."), { status: 403 });
  }
  const form = await forms.find(formId);
  if (!form || form.accountId !== accountId) throw Object.assign(new Error("Form not found"), { status: 404 });
  if (form.status !== "Published") throw Object.assign(new Error("Form must be published to send via WhatsApp"), { status: 400 });
  if (!form.fields.length) throw Object.assign(new Error("Form has no fields"), { status: 400 });

  const phone = normalizePhone(rawPhone);
  const existing = (await sessions.all()).find((s) => s.formId === formId && s.phone === phone && s.status === "in_progress");
  if (existing) return existing;

  const session = {
    id: uuid(),
    formId,
    phone,
    currentIndex: 0,
    answers: {},
    status: "in_progress",
    startedAt: new Date().toISOString(),
    completedAt: null,
    accountId,
  };
  await sessions.insert(session);

  const intro = `Hi! 👋 ${form.name}${form.description ? `\n${form.description}` : ""}\n\n`;
  await whatsappClient.sendMessage(phone, intro + formatQuestion(form.fields[0]));
  return session;
}

// Core inbound-reply handler. Used by both the real webhook and the
// dev-only simulate-reply endpoint, so the two paths behave identically.
async function handleReply(phone, text) {
  const normalizedPhone = normalizePhone(phone);
  await logInbound(normalizedPhone, text);

  const allSessions = await sessions.all();
  const session = allSessions
    .filter((s) => s.phone === normalizedPhone && s.status === "in_progress")
    .sort((a, b) => new Date(b.startedAt) - new Date(a.startedAt))[0];

  if (!session) {
    await whatsappClient.sendMessage(normalizedPhone, "You don't have an active survey right now. Thanks for reaching out!");
    return { handled: false };
  }

  // Kill switch: if the bot got disabled after this session started, stop
  // advancing it silently rather than continuing to message the customer.
  if (!(await isBotEnabled(session.accountId))) {
    return { handled: false, disabled: true };
  }

  const form = await forms.find(session.formId);
  const field = form.fields[session.currentIndex];
  const result = parseAnswer(field, text);

  if (!result.valid) {
    await whatsappClient.sendMessage(normalizedPhone, `⚠️ ${result.error}\n\n${formatQuestion(field)}`);
    return { handled: true, session };
  }

  const nextAnswers = { ...session.answers, [field.id]: result.value };
  const nextIndex = session.currentIndex + 1;

  if (nextIndex < form.fields.length) {
    await sessions.update(session.id, { answers: nextAnswers, currentIndex: nextIndex });
    await whatsappClient.sendMessage(normalizedPhone, formatQuestion(form.fields[nextIndex]));
    return { handled: true, session };
  }

  // Last question answered — save the response and finish. Inherits the
  // form's tenant (not the session's requester — there isn't one; this
  // runs from an unauthenticated webhook call or the phone-only simulator).
  await formResponses.insert({
    id: uuid(),
    formId: form.id,
    answers: encryptAnswers(nextAnswers),
    submittedAt: new Date().toISOString(),
    channel: "whatsapp",
    accountId: form.accountId,
  });
  await sessions.update(session.id, { answers: nextAnswers, currentIndex: nextIndex, status: "completed", completedAt: new Date().toISOString() });
  await whatsappClient.sendMessage(normalizedPhone, form.settings?.confirmationMessage || "Thanks for completing the survey! 🙏");
  return { handled: true, session, completed: true };
}

module.exports = { startSession, handleReply, formatQuestion, parseAnswer, normalizePhone };
