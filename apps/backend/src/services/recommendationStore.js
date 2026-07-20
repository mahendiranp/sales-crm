// Storage + lifecycle for recommendations — split out from ruleEngine.js
// so individual rule modules (services/rules/*.js) can write recommendations
// without creating a circular require back into the engine that loads them.
const { randomUUID: uuid } = require("crypto");
const { collection, scopedCollection } = require("../db/store");

const recommendations = collection("recommendations");

const PRIORITY = Object.freeze({ CRITICAL: "CRITICAL", HIGH: "HIGH", MEDIUM: "MEDIUM", LOW: "LOW", INFO: "INFO" });
const STATUS = Object.freeze({ OPEN: "OPEN", RESOLVED: "RESOLVED", DISMISSED: "DISMISSED" });

// Who produced a recommendation. Every recommendation today comes from the
// rule engine, but the field exists from day one so a later AI Observer (or
// a human manually flagging something) can write into the same collection
// and a consumer can still tell deterministic insights apart from
// generated/manual ones.
const GENERATED_BY = Object.freeze({ RULE_ENGINE: "RULE_ENGINE", AI_OBSERVER: "AI_OBSERVER", USER: "USER", SYSTEM: "SYSTEM" });

// Every recommendation gets these two regardless of rule — resolve/dismiss
// are handled generically by the API (see routes/recommendations.js), so
// they don't need a rule-specific handler the way "notify-approver" does.
const UNIVERSAL_ACTIONS = [
  { id: "resolve", label: "Resolve" },
  { id: "dismiss", label: "Dismiss" },
];

// Writes (or refreshes) one recommendation. Recommendations are keyed by
// `rule` + `entityId` so re-running the same rule against the same
// situation — a nightly scan re-checking the same still-overdue approval —
// updates the existing open recommendation's reason/payload instead of
// piling up duplicates. The collection stays a live "what needs attention
// right now" list, not an append-only log (that's what `events` is for).
//
// `statusHistory` gives that live record a cheap audit trail: every create
// appends an OPEN entry, every refresh (re-upsert while still open) appends
// an UPDATED entry, and resolve/dismiss append their own — enough to later
// answer "how long did this sit open" or "how many times did this get
// re-flagged" without needing a separate history collection.
//
// `actions` is the rule's own suggestions (e.g. "Notify Approver") — kept
// as data on the record, not hardcoded in a frontend, so a new rule can
// introduce a new action without a client release. UNIVERSAL_ACTIONS are
// appended automatically so every rule doesn't have to repeat them.
async function upsertRecommendation({
  accountId,
  rule,
  priority,
  score,
  title,
  reason,
  suggestedAction,
  actions = [],
  entityType,
  entityId,
  generatedBy = GENERATED_BY.RULE_ENGINE,
  payload = {},
}) {
  const now = new Date().toISOString();
  const allActions = [...actions, ...UNIVERSAL_ACTIONS];
  const openMatches = await recommendations.query(
    (r) => r.accountId === accountId && r.rule === rule && r.entityId === entityId && r.status === STATUS.OPEN
  );
  if (openMatches[0]) {
    const existing = openMatches[0];
    return recommendations.update(existing.id, {
      priority,
      score,
      title,
      reason,
      suggestedAction,
      actions: allActions,
      payload,
      statusHistory: [...(existing.statusHistory || []), { status: "UPDATED", at: now }],
    });
  }
  const record = {
    id: uuid(),
    accountId,
    rule,
    priority,
    score,
    status: STATUS.OPEN,
    title,
    reason,
    suggestedAction,
    actions: allActions,
    entityType,
    entityId,
    generatedBy,
    payload,
    statusHistory: [{ status: STATUS.OPEN, at: now }],
    createdAt: now,
  };
  return recommendations.insert(record);
}

// Both scoped to accountId (rather than operating on a bare id) so a
// caller can never resolve/dismiss another tenant's recommendation by
// guessing a UUID — same tenant-isolation guarantee every other route in
// this codebase gets from scopedCollection().
//
// `actorName`/`reason` turn "Resolved"/"Dismissed" from a bare status into
// a legible history entry — a human clicking Resolve gets their own name
// and no reason (they clicked the button, that's the reason); the Rule
// Engine auto-resolving a recommendation (see services/rules/*.js) passes
// "System" and a specific reason ("Manager approved the request") so the
// AI Center's Resolved/Dismissed tabs read as history, not just a status
// flip.
async function resolveRecommendation(accountId, id, { actorName = null, reason = null } = {}) {
  const recs = scopedCollection("recommendations", accountId);
  const existing = await recs.find(id);
  if (!existing) return null;
  const now = new Date().toISOString();
  return recs.update(id, {
    status: STATUS.RESOLVED,
    resolvedAt: now,
    resolvedBy: actorName,
    resolveReason: reason,
    statusHistory: [...(existing.statusHistory || []), { status: STATUS.RESOLVED, at: now, actorName, reason }],
  });
}

async function dismissRecommendation(accountId, id, { actorName = null, reason = null } = {}) {
  const recs = scopedCollection("recommendations", accountId);
  const existing = await recs.find(id);
  if (!existing) return null;
  const now = new Date().toISOString();
  return recs.update(id, {
    status: STATUS.DISMISSED,
    dismissedAt: now,
    dismissedBy: actorName,
    dismissReason: reason,
    statusHistory: [...(existing.statusHistory || []), { status: STATUS.DISMISSED, at: now, actorName, reason }],
  });
}

// Lets a rule check, on its next run, whether any of its own still-open
// recommendations should now be auto-resolved because the situation that
// created them no longer holds (e.g. an approval that was overdue got
// decided) — see services/rules/approvalPending48h.js for the caller.
async function findOpenByRule(accountId, rule) {
  return recommendations.query((r) => r.accountId === accountId && r.rule === rule && r.status === STATUS.OPEN);
}

module.exports = {
  recommendations,
  upsertRecommendation,
  resolveRecommendation,
  dismissRecommendation,
  findOpenByRule,
  PRIORITY,
  STATUS,
  GENERATED_BY,
};
