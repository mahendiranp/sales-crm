// Shared between every AI provider (anthropic.js, gemini.js) so the actual
// instructions and response-shape validation stay identical regardless of
// which LLM answered — only the HTTP call shape differs per provider.
const ALLOWED_TYPES = ["text", "longtext", "email", "phone", "number", "date", "time", "dropdown", "radio", "checkbox", "file", "rating", "yesno"];

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

// Every provider's raw text response goes through this same parse/validate
// step, so a model that wraps its JSON in markdown fences or hallucinates
// an extra field type fails the same way regardless of which one answered.
function parseModelResponse(text) {
  const jsonText = (text || "").trim().replace(/^```(json)?/i, "").replace(/```$/, "").trim();
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

// Document import (routes/import.js): given a document's raw text (or, for
// an image, the image itself — see the provider-specific vision path),
// infer the whole form from scratch rather than editing an existing one,
// so this needs its own title field the field-edit flow above doesn't.
const IMPORT_SYSTEM_PROMPT = `You are a form-extraction assistant. You receive the raw content of a document (a scanned or digital form, application, survey, etc.) and reply with ONLY a single JSON object — no markdown fences, no prose outside the JSON — matching exactly this shape:

{
  "title": "string, a short title for this form",
  "description": "string, optional one-sentence description",
  "fields": [ { "label": "string", "type": "one of: ${ALLOWED_TYPES.join(", ")}", "required": boolean, "options": ["only for dropdown/radio/checkbox"], "placeholder": "string, optional", "helpText": "string, optional" } ]
}

Rules:
- Identify every distinct question/blank/checkbox/signature line a respondent would need to fill in, in the order they appear.
- Pick the most specific matching type (email for an email address, phone for a phone number, date for a date, dropdown/radio/checkbox when the document lists fixed choices) rather than defaulting everything to "text".
- Only use types from the allowed list above.
- Keep labels concise and professional, matching the document's own wording where possible.
- If the document doesn't look like a form (no fields to fill in), reply with an empty "fields" array and a "description" explaining that.`;

function parseImportResponse(text) {
  const jsonText = (text || "").trim().replace(/^```(json)?/i, "").replace(/```$/, "").trim();
  let parsed;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    throw new Error("The AI response wasn't valid JSON — try a clearer scan or a different file.");
  }
  if (typeof parsed.title !== "string" || !Array.isArray(parsed.fields)) {
    throw new Error("The AI response didn't match the expected format.");
  }
  return {
    title: parsed.title.trim() || "Imported Form",
    description: typeof parsed.description === "string" ? parsed.description.trim() : "",
    fields: parsed.fields.filter((f) => ALLOWED_TYPES.includes(f.type)),
  };
}

// Form Responses' "AI Insights" (routes/forms.js): given a form's fields
// and a capped batch of its recent responses, summarize themes/trends
// rather than making someone read every submission by hand. Deliberately
// a single free-text summary, not a rigid schema — response data is far
// more varied than a form's own field definitions (open text, ratings,
// choices all mixed together), so forcing it into structured categories
// would either be empty for most forms or fight the model on every call.
const INSIGHTS_SYSTEM_PROMPT = `You are a data analyst. You receive a form's field definitions and a batch of its recent responses (as JSON), and reply with ONLY a single JSON object — no markdown fences, no prose outside the JSON — matching exactly this shape:

{
  "summary": "a few short paragraphs (plain text, use \\n\\n between them) covering: the main themes/patterns across responses, anything notable or unusual, and one actionable suggestion if one is warranted",
  "responseCount": <number of responses actually analyzed>
}

Rules:
- Reference specific field labels and concrete values/examples from the actual data, not generic advice — this must clearly be about *this* form's *actual* responses, not a template answer.
- If a field is mostly free text, characterize the range of answers (sentiment, common complaints/requests) rather than listing every one.
- If there's too little data to say anything meaningful, say so plainly instead of inventing patterns.
- Keep the whole summary under 200 words.`;

function parseInsightsResponse(text) {
  const jsonText = (text || "").trim().replace(/^```(json)?/i, "").replace(/```$/, "").trim();
  let parsed;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    throw new Error("The AI response wasn't valid JSON — try again.");
  }
  if (typeof parsed.summary !== "string" || !parsed.summary.trim()) {
    throw new Error("The AI response didn't match the expected format.");
  }
  return { summary: parsed.summary.trim() };
}

module.exports = {
  ALLOWED_TYPES,
  SYSTEM_PROMPT,
  parseModelResponse,
  IMPORT_SYSTEM_PROMPT,
  parseImportResponse,
  INSIGHTS_SYSTEM_PROMPT,
  parseInsightsResponse,
};
