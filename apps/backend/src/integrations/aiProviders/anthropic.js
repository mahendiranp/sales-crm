// Thin wrapper around Anthropic's Messages API. Mirrors the mock-mode-
// fallback pattern used by emailClient.js: isConfigured() lets callers
// fail gracefully (503, not a crash) before a key is ever set.
const {
  SYSTEM_PROMPT,
  parseModelResponse,
  IMPORT_SYSTEM_PROMPT,
  parseImportResponse,
  INSIGHTS_SYSTEM_PROMPT,
  parseInsightsResponse,
} = require("./shared");

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-5";

function isConfigured() {
  return !!ANTHROPIC_API_KEY;
}

async function generateFormFields({ prompt, currentFields }) {
  if (!isConfigured()) {
    throw new Error("Anthropic isn't configured yet — ask your platform admin to set ANTHROPIC_API_KEY.");
  }

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 2000,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: JSON.stringify({ instruction: prompt, currentFields }) }],
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Anthropic request failed (${res.status}): ${body.slice(0, 300)}`);
  }

  const data = await res.json();
  return parseModelResponse(data.content?.[0]?.text || "");
}

const LEAD_SCORE_SYSTEM_PROMPT =
  "You are a sales qualification assistant. Given a lead's details, score how likely they are to convert into a " +
  "paying customer, from 0 (very unlikely) to 100 (very likely). Base it on source quality, stated budget, urgency " +
  "signals in notes, and any other field given. Respond with ONLY a JSON object of the shape " +
  '{"score": <0-100 integer>, "reasoning": "<one short sentence>"} — no other text.';

async function scoreLead({ lead }) {
  if (!isConfigured()) {
    throw new Error("Anthropic isn't configured yet — ask your platform admin to set ANTHROPIC_API_KEY.");
  }

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 200,
      system: LEAD_SCORE_SYSTEM_PROMPT,
      messages: [{ role: "user", content: JSON.stringify(lead) }],
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Anthropic request failed (${res.status}): ${body.slice(0, 300)}`);
  }

  const data = await res.json();
  const text = data.content?.[0]?.text || "{}";
  const parsed = JSON.parse(text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1));
  return {
    score: Math.max(0, Math.min(100, Math.round(Number(parsed.score) || 0))),
    reasoning: parsed.reasoning || "",
  };
}

const LEAD_PARSE_SYSTEM_PROMPT =
  "You extract lead details from a pasted message (e.g. a WhatsApp message, email, or call note) for a CRM. " +
  "Return only the fields you can confidently infer from the text — omit any field you're not sure about rather " +
  "than guessing. budget should be a plain number in rupees (e.g. \"15 lakh\" -> 1500000). Put anything else " +
  "useful (timing, requirements, context) into notes as a short summary, not a verbatim copy. Respond with ONLY a " +
  'JSON object using any of these keys: name, mobile, email, company, budget, interestedProduct, priority ' +
  '("High"/"Medium"/"Low"), notes — no other text.';

async function parseLeadText({ text }) {
  if (!isConfigured()) {
    throw new Error("Anthropic isn't configured yet — ask your platform admin to set ANTHROPIC_API_KEY.");
  }

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 500,
      system: LEAD_PARSE_SYSTEM_PROMPT,
      messages: [{ role: "user", content: text }],
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Anthropic request failed (${res.status}): ${body.slice(0, 300)}`);
  }

  const data = await res.json();
  const raw = data.content?.[0]?.text || "{}";
  return JSON.parse(raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1));
}

// Text documents only — Claude can read images too, but that path isn't
// wired up here yet, so an image import on this provider gives a clear
// redirect instead of silently degrading to a text-only guess.
async function extractFormFromDocument({ text, imageBase64 }) {
  if (!isConfigured()) {
    throw new Error("Anthropic isn't configured yet — ask your platform admin to set ANTHROPIC_API_KEY.");
  }
  if (imageBase64) {
    throw new Error("Importing an image requires the Gemini provider — switch it in Settings → AI Configuration.");
  }

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 2500,
      system: IMPORT_SYSTEM_PROMPT,
      messages: [{ role: "user", content: text }],
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Anthropic request failed (${res.status}): ${body.slice(0, 300)}`);
  }

  const data = await res.json();
  return parseImportResponse(data.content?.[0]?.text || "");
}

async function generateInsights({ formName, fields, responses }) {
  if (!isConfigured()) {
    throw new Error("Anthropic isn't configured yet — ask your platform admin to set ANTHROPIC_API_KEY.");
  }

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 800,
      system: INSIGHTS_SYSTEM_PROMPT,
      messages: [
        { role: "user", content: JSON.stringify({ formName, fields: fields.map((f) => ({ label: f.label, type: f.type })), responses }) },
      ],
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Anthropic request failed (${res.status}): ${body.slice(0, 300)}`);
  }

  const data = await res.json();
  return parseInsightsResponse(data.content?.[0]?.text || "");
}

module.exports = { isConfigured, generateFormFields, scoreLead, parseLeadText, extractFormFromDocument, generateInsights };
