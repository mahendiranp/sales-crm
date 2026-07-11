// Thin wrapper around Anthropic's Messages API for the Form Builder's AI
// Assistant. Mirrors the mock-mode-fallback pattern used by
// emailClient.js: isConfigured() lets callers fail gracefully (503, not a
// crash) before a key is ever set, rather than throwing at require time.
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-5";

const ALLOWED_TYPES = ["text", "longtext", "email", "phone", "number", "date", "time", "dropdown", "radio", "checkbox", "file", "rating", "yesno"];

function isConfigured() {
  return !!ANTHROPIC_API_KEY;
}

const SYSTEM_PROMPT = `You build and edit fields for a CRM's form builder. You receive the current field list (JSON) and a user instruction, and reply with ONLY a single JSON object — no markdown fences, no prose outside the JSON — matching exactly this shape:

{
  "action": "add" | "replace",
  "fields": [ { "id": "existing-id-or-omit-for-new", "label": "string", "type": "one of: ${ALLOWED_TYPES.join(", ")}", "required": boolean, "options": ["only for dropdown/radio/checkbox"], "placeholder": "string, optional", "helpText": "string, optional" } ],
  "message": "one short sentence summarizing what you did, for display to the user"
}

Rules:
- Use "action": "add" when the instruction only adds new field(s) — "fields" then contains ONLY the new fields (omit "id" on each, one will be assigned).
- Use "action": "replace" when the instruction changes, removes, or reorders any existing field, or asks to build/regenerate the whole form — "fields" then contains the COMPLETE field list that should result, keeping the original "id" for every field that's unchanged so client-side state isn't lost.
- Only use types from the allowed list above.
- Keep labels concise and professional.
- If the instruction is unrelated to building a form, reply with action "add", empty fields, and a message explaining you can only help with form fields.`;

async function generateFormFields({ prompt, currentFields }) {
  if (!isConfigured()) {
    throw new Error("AI Assistant isn't configured yet — set ANTHROPIC_API_KEY in the backend environment to enable it.");
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
    throw new Error(`AI request failed (${res.status}): ${body.slice(0, 300)}`);
  }

  const data = await res.json();
  const text = data.content?.[0]?.text || "";
  const jsonText = text.trim().replace(/^```(json)?/i, "").replace(/```$/, "").trim();

  let parsed;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    throw new Error("The AI response wasn't valid JSON — try rephrasing your request.");
  }

  if (!Array.isArray(parsed.fields) || !["add", "replace"].includes(parsed.action)) {
    throw new Error("The AI response didn't match the expected format.");
  }
  parsed.fields = parsed.fields.filter((f) => ALLOWED_TYPES.includes(f.type));
  return parsed;
}

module.exports = { isConfigured, generateFormFields };
