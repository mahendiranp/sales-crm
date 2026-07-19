// Rule Engine unit tests — Phase 2 of the AI Observer. Verifies each rule's
// arithmetic (overdue threshold, rejection-spike threshold) and the
// upsert/resolve/dismiss lifecycle, using the same in-memory Mongo setup as
// auth.test.js and eventEngine.test.js (see those for why). Events here are
// inserted directly into the `events` collection rather than through
// recordEvent(), so timestamps can be backdated to deterministically cross
// the 48-hour/7-day thresholds instead of waiting on real time.
const test = require("node:test");
const assert = require("node:assert/strict");
const { MongoMemoryServer } = require("mongodb-memory-server");

let mongod;
let closeDB;
let collection;
let ruleEngine;

const ready = (async () => {
  mongod = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mongod.getUri("sales_crm_test_rules");
  const { ensureConnected, closeDB: close, collection: col } = require("../src/db/store");
  closeDB = close;
  collection = col;
  ruleEngine = require("../src/services/ruleEngine");
  await ensureConnected();
})();

function isoHoursAgo(hours, from) {
  return new Date(from - hours * 60 * 60 * 1000).toISOString();
}

// Mirrors the shape recordEvent() writes, without going through the
// service — lets these tests set `createdAt` directly.
function makeEvent({ accountId, type, entityId, correlationId, createdAt, payload = {} }) {
  return {
    id: `evt-${Math.random().toString(36).slice(2)}`,
    version: 1,
    correlationId: correlationId || entityId,
    accountId,
    type,
    source: "forms",
    severity: "info",
    entityType: "response",
    entityId,
    actorId: null,
    actorName: null,
    payload,
    metadata: {},
    createdAt,
  };
}

test("ruleApprovalOverdue flags a pending approval older than 48h with no decision", async () => {
  await ready;
  const events = collection("events");
  const now = Date.now();
  await events.insert(
    makeEvent({
      accountId: "acct-overdue",
      type: "approval.pending",
      entityId: "resp-1",
      createdAt: isoHoursAgo(72, now),
      payload: { formId: "form-1", formName: "Vendor Onboarding" },
    })
  );

  const results = await ruleEngine.evaluateRules("acct-overdue", now);
  const overdue = results.find((r) => r.rule === "approval.pending.48h");
  assert.ok(overdue, "should produce an overdue-approval recommendation");
  assert.equal(overdue.entityId, "resp-1");
  assert.equal(overdue.status, "OPEN");
  assert.equal(overdue.priority, "HIGH");
  assert.match(overdue.reason, /72 hours/);
});

test("ruleApprovalOverdue does not flag a pending approval under 48h old", async () => {
  await ready;
  const events = collection("events");
  const now = Date.now();
  await events.insert(
    makeEvent({ accountId: "acct-fresh", type: "approval.pending", entityId: "resp-2", createdAt: isoHoursAgo(2, now) })
  );

  const results = await ruleEngine.evaluateRules("acct-fresh", now);
  assert.equal(results.filter((r) => r.rule === "approval.pending.48h").length, 0);
});

test("ruleApprovalOverdue does not flag an approval that was already decided", async () => {
  await ready;
  const events = collection("events");
  const now = Date.now();
  await events.insert(
    makeEvent({ accountId: "acct-decided", type: "approval.pending", entityId: "resp-3", correlationId: "resp-3", createdAt: isoHoursAgo(90, now) })
  );
  await events.insert(
    makeEvent({ accountId: "acct-decided", type: "approval.approved", entityId: "resp-3", correlationId: "resp-3", createdAt: isoHoursAgo(1, now) })
  );

  const results = await ruleEngine.evaluateRules("acct-decided", now);
  assert.equal(results.filter((r) => r.rule === "approval.pending.48h").length, 0);
});

test("re-running evaluateRules against the same overdue approval refreshes, not duplicates", async () => {
  await ready;
  const events = collection("events");
  const now = Date.now();
  await events.insert(
    makeEvent({ accountId: "acct-repeat", type: "approval.pending", entityId: "resp-4", createdAt: isoHoursAgo(50, now) })
  );

  await ruleEngine.evaluateRules("acct-repeat", now);
  const laterNow = now + 5 * 60 * 60 * 1000; // 5 hours later, still open
  await ruleEngine.evaluateRules("acct-repeat", laterNow);

  const recommendations = collection("recommendations");
  const matches = await recommendations.query((r) => r.accountId === "acct-repeat" && r.rule === "approval.pending.48h");
  assert.equal(matches.length, 1, "should refresh the existing open recommendation, not create a second one");
  assert.match(matches[0].reason, /55 hours/);
});

// This is the auto-resolve half of the "employee leave request" scenario:
// there's no scheduled job re-running rules on a timer (see forms.js's
// evaluateRulesQuietly), so a decision recorded on an already-flagged
// approval is the only moment the rule gets a chance to notice the
// recommendation no longer applies and close it.
test("evaluateRules auto-resolves an overdue-approval recommendation once the approval is decided", async () => {
  await ready;
  const events = collection("events");
  const now = Date.now();
  await events.insert(
    makeEvent({ accountId: "acct-autoresolve", type: "approval.pending", entityId: "resp-5", correlationId: "resp-5", createdAt: isoHoursAgo(72, now) })
  );

  const firstRun = await ruleEngine.evaluateRules("acct-autoresolve", now);
  const created = firstRun.find((r) => r.rule === "approval.pending.48h");
  assert.equal(created.status, "OPEN");

  const laterNow = now + 2 * 60 * 60 * 1000;
  await events.insert(
    makeEvent({ accountId: "acct-autoresolve", type: "approval.approved", entityId: "resp-5", correlationId: "resp-5", createdAt: new Date(laterNow).toISOString() })
  );
  await ruleEngine.evaluateRules("acct-autoresolve", laterNow);

  const recommendations = collection("recommendations");
  const after = await recommendations.find(created.id);
  assert.equal(after.status, "RESOLVED");
  assert.deepEqual(
    after.statusHistory.map((h) => h.status),
    ["OPEN", "RESOLVED"]
  );
});

test("ruleRejectionSpike fires once 3+ rejections land on the same form within 7 days", async () => {
  await ready;
  const events = collection("events");
  const now = Date.now();
  for (let i = 0; i < 3; i++) {
    await events.insert(
      makeEvent({
        accountId: "acct-spike",
        type: "approval.rejected",
        entityId: `resp-spike-${i}`,
        createdAt: isoHoursAgo(i, now),
        payload: { formId: "form-spike" },
      })
    );
  }

  const results = await ruleEngine.evaluateRules("acct-spike", now);
  const spike = results.find((r) => r.rule === "approval.rejection_spike.7d");
  assert.ok(spike, "should produce a rejection-spike recommendation");
  assert.equal(spike.entityId, "form-spike");
  assert.equal(spike.payload.count, 3);
});

test("ruleRejectionSpike does not fire below the threshold", async () => {
  await ready;
  const events = collection("events");
  const now = Date.now();
  await events.insert(
    makeEvent({ accountId: "acct-nospike", type: "approval.rejected", entityId: "resp-1", createdAt: isoHoursAgo(1, now), payload: { formId: "form-x" } })
  );

  const results = await ruleEngine.evaluateRules("acct-nospike", now);
  assert.equal(results.filter((r) => r.rule === "approval.rejection_spike.7d").length, 0);
});

test("resolveRecommendation and dismissRecommendation transition status", async () => {
  await ready;
  const created = await ruleEngine.upsertRecommendation({
    accountId: "acct-lifecycle",
    rule: "test.rule",
    priority: "LOW",
    title: "Test",
    reason: "Test reason",
    entityType: "form",
    entityId: "form-lifecycle",
  });

  const resolved = await ruleEngine.resolveRecommendation("acct-lifecycle", created.id);
  assert.equal(resolved.status, "RESOLVED");
  assert.ok(resolved.resolvedAt);
  assert.deepEqual(
    resolved.statusHistory.map((h) => h.status),
    ["OPEN", "RESOLVED"]
  );

  const other = await ruleEngine.upsertRecommendation({
    accountId: "acct-lifecycle",
    rule: "test.rule2",
    priority: "LOW",
    title: "Test 2",
    reason: "Test reason 2",
    entityType: "form",
    entityId: "form-lifecycle-2",
  });
  const dismissed = await ruleEngine.dismissRecommendation("acct-lifecycle", other.id);
  assert.equal(dismissed.status, "DISMISSED");
  assert.ok(dismissed.dismissedAt);
});

// resolveRecommendation/dismissRecommendation are scoped by accountId
// specifically so a caller can't act on another tenant's recommendation by
// guessing its id — this is the same tenant-isolation guarantee
// scopedCollection() gives every other route in the codebase.
test("resolveRecommendation refuses to touch a recommendation from another account", async () => {
  await ready;
  const created = await ruleEngine.upsertRecommendation({
    accountId: "acct-owner",
    rule: "test.rule3",
    priority: "LOW",
    title: "Owner's recommendation",
    reason: "Test reason",
    entityType: "form",
    entityId: "form-owner",
  });
  const result = await ruleEngine.resolveRecommendation("acct-intruder", created.id);
  assert.equal(result, null);
});

test("upsertRecommendation stamps score, generatedBy, and suggestedAction", async () => {
  await ready;
  const events = collection("events");
  const now = Date.now();
  await events.insert(
    makeEvent({ accountId: "acct-fields", type: "approval.pending", entityId: "resp-fields", createdAt: isoHoursAgo(72, now) })
  );
  const results = await ruleEngine.evaluateRules("acct-fields", now);
  const overdue = results.find((r) => r.rule === "approval.pending.48h");
  assert.equal(overdue.generatedBy, "RULE_ENGINE");
  assert.ok(typeof overdue.score === "number" && overdue.score > 0);
  assert.ok(overdue.suggestedAction.length > 0);
});

test("cleanup: close DB connection", async () => {
  await ready;
  await closeDB();
  await mongod.stop();
});
