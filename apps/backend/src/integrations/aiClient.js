// Dispatches to whichever AI provider the calling account picked (see
// Settings → AI Configuration → Provider) — both providers share the same
// isConfigured()/generateFormFields() shape (see aiProviders/shared.js),
// so this file is just routing, not provider-specific logic.
const anthropic = require("./aiProviders/anthropic");
const gemini = require("./aiProviders/gemini");

const PROVIDERS = { anthropic, gemini };
const DEFAULT_PROVIDER = "gemini";

function resolveProvider(provider) {
  return PROVIDERS[provider] ? provider : DEFAULT_PROVIDER;
}

function isConfigured(provider) {
  return PROVIDERS[resolveProvider(provider)].isConfigured();
}

function generateFormFields({ provider, prompt, currentFields }) {
  return PROVIDERS[resolveProvider(provider)].generateFormFields({ prompt, currentFields });
}

module.exports = { isConfigured, generateFormFields, PROVIDER_KEYS: Object.keys(PROVIDERS) };
