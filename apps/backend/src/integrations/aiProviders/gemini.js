// Thin wrapper around Google's Gemini API via the official @google/genai
// SDK. Same isConfigured()/generateFormFields() shape as anthropic.js so
// routes/forms.js's AI route can call either provider identically — only
// the request/response shape of the underlying call differs.
const { GoogleGenAI, Type } = require("@google/genai");
const {
  SYSTEM_PROMPT,
  ALLOWED_TYPES,
  parseModelResponse,
  IMPORT_SYSTEM_PROMPT,
  parseImportResponse,
  INSIGHTS_SYSTEM_PROMPT,
  parseInsightsResponse,
} = require("./shared");

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
// gemini-2.0-flash was deprecated by Google and returns 404 "no longer
// available" for newer accounts/projects — gemini-3.5-flash is the current
// non-preview equivalent as of this writing. Override via GEMINI_MODEL if
// Google deprecates this one too.
const MODEL = process.env.GEMINI_MODEL || "gemini-3.5-flash";

const client = GEMINI_API_KEY ? new GoogleGenAI({ apiKey: GEMINI_API_KEY }) : null;

// responseMimeType alone (just describing the JSON shape in the system
// prompt) turned out unreliable for this model — roughly 1 in 3 real
// calls came back truncated/malformed even with a normal STOP finish
// reason. An explicit responseSchema uses Gemini's constrained decoding,
// which is actually enforced rather than just requested.
const RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    action: { type: Type.STRING, enum: ["add", "replace"] },
    message: { type: Type.STRING },
    fields: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING },
          label: { type: Type.STRING },
          type: { type: Type.STRING, enum: ALLOWED_TYPES },
          required: { type: Type.BOOLEAN },
          options: { type: Type.ARRAY, items: { type: Type.STRING } },
          placeholder: { type: Type.STRING },
          helpText: { type: Type.STRING },
        },
        required: ["label", "type", "required"],
      },
    },
  },
  required: ["action", "fields", "message"],
};

function isConfigured() {
  return !!GEMINI_API_KEY;
}

async function callGemini({ prompt, currentFields }) {
  const res = await client.models.generateContent({
    model: MODEL,
    contents: JSON.stringify({ instruction: prompt, currentFields }),
    config: {
      systemInstruction: SYSTEM_PROMPT,
      maxOutputTokens: 2000,
      responseMimeType: "application/json",
      responseSchema: RESPONSE_SCHEMA,
      // This is a structured-output task, not a reasoning task — thinking
      // tokens were eating 60-70% of the output budget on longer prompts
      // and truncating the actual JSON before the schema fix above.
      thinkingConfig: { thinkingBudget: 0 },
    },
  });
  return parseModelResponse(res.text || "");
}

const LEAD_SCORE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    score: { type: Type.NUMBER },
    reasoning: { type: Type.STRING },
  },
  required: ["score", "reasoning"],
};

const LEAD_SCORE_SYSTEM_PROMPT =
  "You are a sales qualification assistant. Given a lead's details, score how likely they are to convert into a " +
  "paying customer, from 0 (very unlikely) to 100 (very likely). Base it on source quality, stated budget, urgency " +
  "signals in notes, and any other field given. Return a whole number 0-100 and one short sentence explaining why.";

async function scoreLead({ lead }) {
  if (!isConfigured()) {
    throw new Error("Gemini isn't configured yet — ask your platform admin to set GEMINI_API_KEY.");
  }
  const res = await client.models.generateContent({
    model: MODEL,
    contents: JSON.stringify(lead),
    config: {
      systemInstruction: LEAD_SCORE_SYSTEM_PROMPT,
      maxOutputTokens: 300,
      responseMimeType: "application/json",
      responseSchema: LEAD_SCORE_SCHEMA,
      thinkingConfig: { thinkingBudget: 0 },
    },
  });
  const parsed = JSON.parse(res.text || "{}");
  return {
    score: Math.max(0, Math.min(100, Math.round(Number(parsed.score) || 0))),
    reasoning: parsed.reasoning || "",
  };
}

const LEAD_PARSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    name: { type: Type.STRING },
    mobile: { type: Type.STRING },
    email: { type: Type.STRING },
    company: { type: Type.STRING },
    budget: { type: Type.NUMBER },
    interestedProduct: { type: Type.STRING },
    priority: { type: Type.STRING, enum: ["High", "Medium", "Low"] },
    notes: { type: Type.STRING },
  },
};

const LEAD_PARSE_SYSTEM_PROMPT =
  "You extract lead details from a pasted message (e.g. a WhatsApp message, email, or call note) for a CRM. " +
  "Return only the fields you can confidently infer from the text — omit any field you're not sure about rather " +
  "than guessing. budget should be a plain number in rupees (e.g. \"15 lakh\" -> 1500000). Put anything else " +
  "useful (timing, requirements, context) into notes as a short summary, not a verbatim copy.";

async function parseLeadText({ text }) {
  if (!isConfigured()) {
    throw new Error("Gemini isn't configured yet — ask your platform admin to set GEMINI_API_KEY.");
  }
  const res = await client.models.generateContent({
    model: MODEL,
    contents: text,
    config: {
      systemInstruction: LEAD_PARSE_SYSTEM_PROMPT,
      maxOutputTokens: 500,
      responseMimeType: "application/json",
      responseSchema: LEAD_PARSE_SCHEMA,
      thinkingConfig: { thinkingBudget: 0 },
    },
  });
  return JSON.parse(res.text || "{}");
}

async function generateFormFields({ prompt, currentFields }) {
  if (!isConfigured()) {
    throw new Error("Gemini isn't configured yet — ask your platform admin to set GEMINI_API_KEY.");
  }

  try {
    return await callGemini({ prompt, currentFields });
  } catch (err) {
    const message = err.message || String(err);
    // The SDK throws with a JSON-stringified Google error body as the
    // message (e.g. `{"error":{"code":429,...}}`) — sniff status codes out
    // of that string since there's no structured status field exposed.
    if (/"code":\s*429/.test(message) || /rate-limited|quota/i.test(message)) {
      throw new Error("Gemini's free tier is rate-limited — you've hit the request quota for now. Wait a minute and try again.");
    }
    if (/"code":\s*503/.test(message)) {
      throw new Error("Gemini is temporarily overloaded on Google's end. Wait a moment and try again.");
    }
    // A malformed-JSON response is model flakiness, not a real failure —
    // worth one automatic retry before making the user click again.
    if (/wasn't valid JSON|didn't match the expected format/.test(message)) {
      try {
        return await callGemini({ prompt, currentFields });
      } catch {
        throw new Error("Gemini's response wasn't usable after a retry — try rephrasing your request.");
      }
    }
    throw new Error(`Gemini request failed: ${message.slice(0, 300)}`);
  }
}

const IMPORT_RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING },
    description: { type: Type.STRING },
    fields: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          label: { type: Type.STRING },
          type: { type: Type.STRING, enum: ALLOWED_TYPES },
          required: { type: Type.BOOLEAN },
          options: { type: Type.ARRAY, items: { type: Type.STRING } },
          placeholder: { type: Type.STRING },
          helpText: { type: Type.STRING },
        },
        required: ["label", "type", "required"],
      },
    },
  },
  required: ["title", "fields"],
};

// `text` for a PDF/Word doc whose text was already extracted server-side;
// `imageBase64`/`imageMimeType` for an image (or a scanned PDF page saved
// as one) — sent as inline image data so Gemini reads the layout directly
// instead of us needing a separate OCR step.
async function extractFormFromDocument({ text, imageBase64, imageMimeType }) {
  if (!isConfigured()) {
    throw new Error("Gemini isn't configured yet — ask your platform admin to set GEMINI_API_KEY.");
  }
  const contents = imageBase64
    ? [{ inlineData: { mimeType: imageMimeType, data: imageBase64 } }, { text: "Extract this document's form fields." }]
    : text;

  const call = () =>
    client.models.generateContent({
      model: MODEL,
      contents,
      config: {
        systemInstruction: IMPORT_SYSTEM_PROMPT,
        maxOutputTokens: 2500,
        responseMimeType: "application/json",
        responseSchema: IMPORT_RESPONSE_SCHEMA,
        thinkingConfig: { thinkingBudget: 0 },
      },
    });

  try {
    const res = await call();
    return parseImportResponse(res.text || "");
  } catch (err) {
    const message = err.message || String(err);
    if (/"code":\s*429/.test(message) || /rate-limited|quota/i.test(message)) {
      throw new Error("Gemini's free tier is rate-limited — you've hit the request quota for now. Wait a minute and try again.");
    }
    if (/"code":\s*503/.test(message)) {
      throw new Error("Gemini is temporarily overloaded on Google's end. Wait a moment and try again.");
    }
    if (/wasn't valid JSON|didn't match the expected format/.test(message)) {
      try {
        const res = await call();
        return parseImportResponse(res.text || "");
      } catch {
        throw new Error("Gemini's response wasn't usable after a retry — try a clearer scan or a different file.");
      }
    }
    throw new Error(`Gemini request failed: ${message.slice(0, 300)}`);
  }
}

const INSIGHTS_RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    summary: { type: Type.STRING },
    responseCount: { type: Type.NUMBER },
  },
  required: ["summary"],
};

// `formName`/`fields` give the model the questions being asked; `responses`
// is an array of plain answer objects (already decrypted, already capped
// to a reasonable batch size by the caller — see routes/forms.js).
async function generateInsights({ formName, fields, responses }) {
  if (!isConfigured()) {
    throw new Error("Gemini isn't configured yet — ask your platform admin to set GEMINI_API_KEY.");
  }
  const contents = JSON.stringify({ formName, fields: fields.map((f) => ({ label: f.label, type: f.type })), responses });

  const call = () =>
    client.models.generateContent({
      model: MODEL,
      contents,
      config: {
        systemInstruction: INSIGHTS_SYSTEM_PROMPT,
        maxOutputTokens: 800,
        responseMimeType: "application/json",
        responseSchema: INSIGHTS_RESPONSE_SCHEMA,
        thinkingConfig: { thinkingBudget: 0 },
      },
    });

  try {
    const res = await call();
    return parseInsightsResponse(res.text || "");
  } catch (err) {
    const message = err.message || String(err);
    if (/"code":\s*429/.test(message) || /rate-limited|quota/i.test(message)) {
      throw new Error("Gemini's free tier is rate-limited — you've hit the request quota for now. Wait a minute and try again.");
    }
    if (/"code":\s*503/.test(message)) {
      throw new Error("Gemini is temporarily overloaded on Google's end. Wait a moment and try again.");
    }
    if (/wasn't valid JSON|didn't match the expected format/.test(message)) {
      try {
        const res = await call();
        return parseInsightsResponse(res.text || "");
      } catch {
        throw new Error("Gemini's response wasn't usable after a retry — try again.");
      }
    }
    throw new Error(`Gemini request failed: ${message.slice(0, 300)}`);
  }
}

module.exports = { isConfigured, generateFormFields, scoreLead, parseLeadText, extractFormFromDocument, generateInsights };
