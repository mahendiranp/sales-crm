// The rule registry — every rule the engine runs, one file per rule (see
// this directory). Adding a rule means adding a file here and one line
// below; ruleEngine.js never needs to change. Each module exports
// `{ id, run(accountId, now) }`; `run` returns the recommendations it
// produced (via recommendationStore.upsertRecommendation).
const approvalPending48h = require("./approvalPending48h");
const approvalRejectionSpike = require("./approvalRejectionSpike");

module.exports = [approvalPending48h, approvalRejectionSpike];
