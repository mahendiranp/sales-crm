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

function scoreLead({ provider, lead }) {
  return PROVIDERS[resolveProvider(provider)].scoreLead({ lead });
}

function parseLeadText({ provider, text }) {
  return PROVIDERS[resolveProvider(provider)].parseLeadText({ text });
}

function extractFormFromDocument({ provider, text, imageBase64, imageMimeType }) {
  return PROVIDERS[resolveProvider(provider)].extractFormFromDocument({ text, imageBase64, imageMimeType });
}

function generateInsights({ provider, formName, fields, responses }) {
  return PROVIDERS[resolveProvider(provider)].generateInsights({ formName, fields, responses });
}

module.exports = {
  isConfigured,
  generateFormFields,
  scoreLead,
  parseLeadText,
  extractFormFromDocument,
  generateInsights,
  PROVIDER_KEYS: Object.keys(PROVIDERS),
};
