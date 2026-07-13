// Thin wrapper around Google's Gemini API. Same isConfigured()/
// generateFormFields() shape as anthropic.js so routes/forms.js's AI route
// can call either provider identically — only the request/response shape
// of the underlying HTTP call differs.
const { SYSTEM_PROMPT, parseModelResponse } = require("./shared");

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const MODEL = process.env.GEMINI_MODEL || "gemini-2.0-flash";

function isConfigured() {
  return !!GEMINI_API_KEY;
}

async function generateFormFields({ prompt, currentFields }) {
  if (!isConfigured()) {
    throw new Error("Gemini isn't configured yet — ask your platform admin to set GEMINI_API_KEY.");
  }

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents: [{ role: "user", parts: [{ text: JSON.stringify({ instruction: prompt, currentFields }) }] }],
        generationConfig: { maxOutputTokens: 2000, responseMimeType: "application/json" },
      }),
    }
  );

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Gemini request failed (${res.status}): ${body.slice(0, 300)}`);
  }

  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
  return parseModelResponse(text);
}

module.exports = { isConfigured, generateFormFields };
