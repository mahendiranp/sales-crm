// AI credits: every account gets a one-time signup grant, spends credits on
// AI actions (form generation, document import, lead scoring/parsing), and
// paid plans additionally top up by their plan's monthly allotment on each
// successful billing cycle (see routes/payments.js). This replaces the old
// plan-tier "aiAssistant" hard gate + reset-to-cap monthly counter — AI is
// available to every plan, including Starter, gated purely by balance.
const { randomUUID: uuid } = require("crypto");
const { collection } = require("../db/store");

const settings = collection("settings");
const aiUsageLog = collection("ai_usage_log");

const STARTING_CREDITS = 100;

// Cost per successful AI action — deliberately not uniform: a document
// import (extraction + a full Gemini Vision/JSON call) is heavier than a
// quick lead score, so it costs more.
const CREDIT_COSTS = {
  formBuild: 5,
  documentImport: 10,
  leadScore: 2,
  leadParse: 3,
  formInsights: 8,
};

function defaultCredits() {
  return { remaining: STARTING_CREDITS, used: 0 };
}

// Settings docs are always supposed to exist by the time any AI action can
// even be attempted (created eagerly at signup, or lazily on the first GET
// /settings — see routes/settings.js) — but a lazy require + insert-with-
// defaults fallback here means this module works correctly even if that
// invariant is ever violated, without needing a circular top-level require
// of routes/settings.js.
async function ensureSettingsDoc(accountId) {
  const id = `settings-${accountId}`;
  const current = await settings.find(id);
  if (current) return current;
  // eslint-disable-next-line global-require
  const { defaults } = require("../routes/settings");
  const created = { ...defaults(accountId), aiCredits: defaultCredits() };
  await settings.insert(created);
  return created;
}

async function getCredits(accountId) {
  const current = await ensureSettingsDoc(accountId);
  return current.aiCredits || defaultCredits();
}

async function hasEnoughCredits(accountId, feature) {
  const cost = CREDIT_COSTS[feature];
  const { remaining } = await getCredits(accountId);
  return remaining >= cost;
}

// Called only *after* a successful AI response — a failed Gemini/Anthropic
// call (rate limit, malformed response, network error) never costs the
// account anything. Also logs the action for analytics, independent of the
// running balance, so usage history survives even if credits are later
// topped up or adjusted.
async function deductCredits(accountId, userId, feature, meta = {}) {
  const cost = CREDIT_COSTS[feature];
  const id = `settings-${accountId}`;
  await ensureSettingsDoc(accountId);
  const current = await settings.find(id);
  const credits = current.aiCredits || defaultCredits();
  const next = { remaining: Math.max(0, credits.remaining - cost), used: credits.used + cost };
  await settings.update(id, { aiCredits: next });

  await aiUsageLog.insert({
    id: uuid(),
    accountId,
    userId,
    feature,
    creditsUsed: cost,
    createdAt: new Date().toISOString(),
    ...meta,
  });

  return next;
}

// Adds the plan's monthly allotment to whatever balance is left (a top-up,
// not a reset) — called once per verified payment (routes/payments.js).
async function topUpCreditsForPlan(accountId, monthlyAiCredits) {
  if (!monthlyAiCredits) return;
  const id = `settings-${accountId}`;
  await ensureSettingsDoc(accountId);
  const current = await settings.find(id);
  const credits = current.aiCredits || defaultCredits();
  const next = { remaining: credits.remaining + monthlyAiCredits, used: credits.used };
  await settings.update(id, { aiCredits: next });
  return next;
}

module.exports = {
  STARTING_CREDITS,
  CREDIT_COSTS,
  defaultCredits,
  getCredits,
  hasEnoughCredits,
  deductCredits,
  topUpCreditsForPlan,
};
