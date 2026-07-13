// Thin wrapper around Anthropic's Messages API. Mirrors the mock-mode-
// fallback pattern used by emailClient.js: isConfigured() lets callers
// fail gracefully (503, not a crash) before a key is ever set.
const { SYSTEM_PROMPT, parseModelResponse } = require("./shared");

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

module.exports = { isConfigured, generateFormFields };
