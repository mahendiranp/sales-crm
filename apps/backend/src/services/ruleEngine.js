// Rule Engine — Phase 2 of the AI Observer, and deliberately NOT the AI
// layer. It sits directly on top of the Event Engine (services/eventEngine.js)
// and turns raw events into actionable recommendations using pure,
// deterministic rules — no LLM call, no token budget, no nondeterministic
// answer. The harder judgment calls (e.g. explaining *why* a completion
// rate dropped) are for a later AI Observer phase to build on top of this,
// not to replace it — that phase should be reading recommendations, not
// raw events.
//
// This file is just the loader: the rules themselves live one-per-file
// under services/rules/ (see services/rules/index.js), and the storage/
// lifecycle logic lives in services/recommendationStore.js. Adding a new
// rule never requires touching this file.
const { collection } = require("../db/store");
const RULES = require("./rules");
const {
  upsertRecommendation,
  resolveRecommendation,
  dismissRecommendation,
  PRIORITY,
  STATUS,
  GENERATED_BY,
} = require("./recommendationStore");

// One row per account, tracking when evaluateRules() last actually ran for
// it — "Last analyzed" on the AI Center answers "when did AI last run?",
// which otherwise has no honest answer since there's no scheduled job (see
// this file's own doc comment on that gap already).
const scans = collection("rule_engine_scans");
async function recordScan(accountId) {
  const existing = (await scans.query((s) => s.accountId === accountId))[0];
  const lastRunAt = new Date().toISOString();
  if (existing) return scans.update(existing.id, { lastRunAt });
  return scans.insert({ id: accountId, accountId, lastRunAt });
}
async function getLastScan(accountId) {
  const existing = (await scans.query((s) => s.accountId === accountId))[0];
  return existing?.lastRunAt || null;
}

// Single entry point future callers use to run the full rule set for one
// tenant — a cron job, an admin "recompute recommendations" action, or a
// later event-replay tool. None of them need to know the individual rules.
async function evaluateRules(accountId, now = Date.now()) {
  const results = [];
  for (const rule of RULES) {
    results.push(...(await rule.run(accountId, now)));
  }
  await recordScan(accountId);
  return results;
}

module.exports = {
  evaluateRules,
  getLastScan,
  upsertRecommendation,
  resolveRecommendation,
  dismissRecommendation,
  PRIORITY,
  STATUS,
  GENERATED_BY,
  RULES,
};
