// Recommendation API tests — GET list/detail, PATCH resolve/dismiss, and
// tenant isolation. Same in-memory Mongo + supertest setup as the other
// test files (see auth.test.js). Recommendations are seeded directly via
// ruleEngine.upsertRecommendation() rather than by feeding events through
// evaluateRules(), since these tests are about the API surface, not the
// rules themselves (covered by ruleEngine.test.js).
const test = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");
const { MongoMemoryServer } = require("mongodb-memory-server");

let mongod;
let app;
let closeDB;
let collection;
let upsertRecommendation;

const ready = (async () => {
  mongod = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mongod.getUri("sales_crm_test_recs");
  const { ensureConnected, closeDB: close, collection: col } = require("../src/db/store");
  closeDB = close;
  collection = col;
  ({ upsertRecommendation } = require("../src/services/ruleEngine"));
  app = require("../src/app");
  await ensureConnected();
})();

const cleanupEmails = [];
function uniqueEmail(prefix) {
  const email = `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
  cleanupEmails.push(email);
  return email;
}

async function signup(overrides = {}) {
  await ready;
  const email = uniqueEmail(overrides.prefix || "test");
  const requested = await request(app)
    .post("/api/auth/signup/request-otp")
    .send({ name: "Test User", email, password: "password123", company: "Test Co", ...overrides });
  const res = await request(app)
    .post("/api/auth/signup/verify-otp")
    .send({ email, otp: requested.body.devOtp });
  return res.body;
}

test("GET /api/recommendations defaults to open recommendations sorted by score", async () => {
  const auth = await signup();
  const accountId = auth.user.accountId || auth.user.id;
  await upsertRecommendation({ accountId, rule: "r1", priority: "HIGH", score: 90, title: "High", reason: "x", entityType: "form", entityId: "e1" });
  await upsertRecommendation({ accountId, rule: "r2", priority: "MEDIUM", score: 50, title: "Medium", reason: "x", entityType: "form", entityId: "e2" });

  const res = await request(app).get("/api/recommendations").set("Authorization", `Bearer ${auth.token}`);
  assert.equal(res.status, 200);
  assert.equal(res.body.items.length, 2);
  assert.equal(res.body.items[0].title, "High");
  assert.ok(res.body.items.every((r) => r.status === "OPEN"));
});

test("GET /api/recommendations filters by priority and status", async () => {
  const auth = await signup();
  const accountId = auth.user.accountId || auth.user.id;
  const rec = await upsertRecommendation({ accountId, rule: "r3", priority: "LOW", score: 10, title: "Low prio", reason: "x", entityType: "form", entityId: "e3" });
  await upsertRecommendation({ accountId, rule: "r4", priority: "HIGH", score: 80, title: "High prio", reason: "x", entityType: "form", entityId: "e4" });

  const byPriority = await request(app).get("/api/recommendations?priority=LOW").set("Authorization", `Bearer ${auth.token}`);
  assert.equal(byPriority.body.items.length, 1);
  assert.equal(byPriority.body.items[0].title, "Low prio");

  await request(app).patch(`/api/recommendations/${rec.id}/resolve`).set("Authorization", `Bearer ${auth.token}`);
  const openOnly = await request(app).get("/api/recommendations").set("Authorization", `Bearer ${auth.token}`);
  assert.equal(openOnly.body.items.length, 1);
  assert.equal(openOnly.body.items[0].title, "High prio");

  const all = await request(app).get("/api/recommendations?status=ALL").set("Authorization", `Bearer ${auth.token}`);
  assert.equal(all.body.items.length, 2);
});

test("GET /api/recommendations rejects an invalid status or priority", async () => {
  const auth = await signup();
  const badStatus = await request(app).get("/api/recommendations?status=NOT_A_STATUS").set("Authorization", `Bearer ${auth.token}`);
  assert.equal(badStatus.status, 400);
  const badPriority = await request(app).get("/api/recommendations?priority=NOT_A_PRIORITY").set("Authorization", `Bearer ${auth.token}`);
  assert.equal(badPriority.status, 400);
});

test("PATCH /:id/resolve and /:id/dismiss transition status", async () => {
  const auth = await signup();
  const accountId = auth.user.accountId || auth.user.id;
  const rec = await upsertRecommendation({ accountId, rule: "r5", priority: "HIGH", score: 70, title: "To resolve", reason: "x", entityType: "form", entityId: "e5" });
  const rec2 = await upsertRecommendation({ accountId, rule: "r6", priority: "HIGH", score: 70, title: "To dismiss", reason: "x", entityType: "form", entityId: "e6" });

  const resolved = await request(app).patch(`/api/recommendations/${rec.id}/resolve`).set("Authorization", `Bearer ${auth.token}`);
  assert.equal(resolved.status, 200);
  assert.equal(resolved.body.status, "RESOLVED");

  const dismissed = await request(app).patch(`/api/recommendations/${rec2.id}/dismiss`).set("Authorization", `Bearer ${auth.token}`);
  assert.equal(dismissed.status, 200);
  assert.equal(dismissed.body.status, "DISMISSED");
});

test("resolve/dismiss record who acted and why, so the history reads as a decision", async () => {
  const auth = await signup();
  const accountId = auth.user.accountId || auth.user.id;
  const rec = await upsertRecommendation({ accountId, rule: "r-actor-1", priority: "LOW", score: 10, title: "T", reason: "x", entityType: "form", entityId: "ea1" });
  const rec2 = await upsertRecommendation({ accountId, rule: "r-actor-2", priority: "LOW", score: 10, title: "T2", reason: "x", entityType: "form", entityId: "ea2" });

  const resolved = await request(app).patch(`/api/recommendations/${rec.id}/resolve`).set("Authorization", `Bearer ${auth.token}`);
  assert.equal(resolved.body.resolvedBy, "Test User");
  assert.equal(resolved.body.statusHistory.at(-1).actorName, "Test User");

  const dismissed = await request(app)
    .patch(`/api/recommendations/${rec2.id}/dismiss`)
    .set("Authorization", `Bearer ${auth.token}`)
    .send({ reason: "Known issue. Ignore." });
  assert.equal(dismissed.body.dismissedBy, "Test User");
  assert.equal(dismissed.body.dismissReason, "Known issue. Ignore.");
  assert.equal(dismissed.body.statusHistory.at(-1).reason, "Known issue. Ignore.");
});

test("a recommendation from one account is invisible and unreachable from another", async () => {
  const ownerAuth = await signup();
  const ownerAccountId = ownerAuth.user.accountId || ownerAuth.user.id;
  const rec = await upsertRecommendation({
    accountId: ownerAccountId,
    rule: "r7",
    priority: "HIGH",
    score: 90,
    title: "Owner only",
    reason: "x",
    entityType: "form",
    entityId: "e7",
  });

  const intruderAuth = await signup();
  const getRes = await request(app).get(`/api/recommendations/${rec.id}`).set("Authorization", `Bearer ${intruderAuth.token}`);
  assert.equal(getRes.status, 404);

  const resolveRes = await request(app).patch(`/api/recommendations/${rec.id}/resolve`).set("Authorization", `Bearer ${intruderAuth.token}`);
  assert.equal(resolveRes.status, 404);
});

test("recommendations carry rule-specific actions plus the universal resolve/dismiss", async () => {
  const auth = await signup();
  const accountId = auth.user.accountId || auth.user.id;
  const rec = await upsertRecommendation({
    accountId,
    rule: "approval.pending.48h",
    priority: "HIGH",
    score: 90,
    title: "Approval overdue",
    reason: "x",
    actions: [{ id: "notify-approver", label: "Notify Approver" }],
    entityType: "response",
    entityId: "resp-actions",
  });
  const res = await request(app).get(`/api/recommendations/${rec.id}`).set("Authorization", `Bearer ${auth.token}`);
  const actionIds = res.body.actions.map((a) => a.id);
  assert.deepEqual(actionIds, ["notify-approver", "resolve", "dismiss"]);
});

test("POST /:id/actions/:actionId returns 501 for an action with no handler", async () => {
  const auth = await signup();
  const accountId = auth.user.accountId || auth.user.id;
  const rec = await upsertRecommendation({
    accountId,
    rule: "approval.rejection_spike.7d",
    priority: "MEDIUM",
    score: 60,
    title: "Repeated approval rejections",
    reason: "x",
    actions: [{ id: "review-workflow", label: "Review Workflow" }],
    entityType: "form",
    entityId: "form-actions",
  });
  const res = await request(app).post(`/api/recommendations/${rec.id}/actions/review-workflow`).set("Authorization", `Bearer ${auth.token}`);
  assert.equal(res.status, 501);
});

test("POST /:id/actions/notify-approver emails the response's current approver", async () => {
  const auth = await signup();
  const accountId = auth.user.accountId || auth.user.id;

  const form = await request(app)
    .post("/api/forms")
    .set("Authorization", `Bearer ${auth.token}`)
    .send({
      name: "Vendor Onboarding",
      fields: [{ id: "f_email", type: "email", label: "Email" }],
      workflow: { enabled: true, steps: [{ id: "step-1", name: "Review", mode: "all", approvers: [{ type: "role", value: "admin" }] }] },
    });
  await request(app).put(`/api/forms/${form.body.id}/publish`).set("Authorization", `Bearer ${auth.token}`);
  const submitted = await request(app).post(`/api/forms/${form.body.id}/responses`).send({ answers: { f_email: "someone@example.com" } });

  const rec = await upsertRecommendation({
    accountId,
    rule: "approval.pending.48h",
    priority: "HIGH",
    score: 90,
    title: "Approval overdue",
    reason: "x",
    actions: [{ id: "notify-approver", label: "Notify Approver" }],
    entityType: "response",
    entityId: submitted.body.id,
    payload: { formId: form.body.id },
  });

  const res = await request(app).post(`/api/recommendations/${rec.id}/actions/notify-approver`).set("Authorization", `Bearer ${auth.token}`);
  assert.equal(res.status, 200);
  assert.equal(res.body.ok, true);
});

test("GET /api/recommendations/health scores down for each open recommendation's priority", async () => {
  const auth = await signup();
  const accountId = auth.user.accountId || auth.user.id;

  const empty = await request(app).get("/api/recommendations/health").set("Authorization", `Bearer ${auth.token}`);
  assert.equal(empty.body.score, 100);
  assert.equal(empty.body.openCount, 0);

  await upsertRecommendation({ accountId, rule: "r-health-1", priority: "CRITICAL", score: 95, title: "T", reason: "x", entityType: "form", entityId: "eh1" });
  const rec2 = await upsertRecommendation({ accountId, rule: "r-health-2", priority: "HIGH", score: 80, title: "T2", reason: "x", entityType: "form", entityId: "eh2" });
  await request(app).patch(`/api/recommendations/${rec2.id}/resolve`).set("Authorization", `Bearer ${auth.token}`);

  const after = await request(app).get("/api/recommendations/health").set("Authorization", `Bearer ${auth.token}`);
  assert.equal(after.body.score, 80); // 100 - 20 (one open CRITICAL); the resolved HIGH no longer counts against it
  assert.equal(after.body.openCount, 1);
  assert.equal(after.body.criticalCount, 1);
  assert.equal(after.body.resolvedTodayCount, 1);
});

test("GET /api/recommendations/health has no trend the first time, then compares against yesterday's snapshot", async () => {
  const auth = await signup();
  const accountId = auth.user.accountId || auth.user.id;

  const first = await request(app).get("/api/recommendations/health").set("Authorization", `Bearer ${auth.token}`);
  assert.equal(first.body.trend, null);

  // Simulate "yesterday" by writing a snapshot directly, backdated one
  // day — there's no scheduled job taking snapshots (see the route's doc
  // comment), so in production this row would have been written by
  // yesterday's first GET /health call, not seeded like this.
  const yesterday = new Date();
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  await collection("health_snapshots").insert({
    id: "snap-yesterday",
    accountId,
    date: yesterday.toISOString().slice(0, 10),
    score: 70,
    openCount: 3,
    resolvedTodayCount: 1,
    createdAt: yesterday.toISOString(),
  });

  await upsertRecommendation({ accountId, rule: "r-trend-1", priority: "LOW", score: 10, title: "T", reason: "x", entityType: "form", entityId: "et1" });
  const second = await request(app).get("/api/recommendations/health").set("Authorization", `Bearer ${auth.token}`);
  assert.equal(second.body.score, 98); // 100 - 2 (one open LOW)
  assert.equal(second.body.trend.scoreDelta, 28); // 98 - 70
  assert.equal(second.body.trend.resolvedTodayDelta, -1); // 0 today - 1 yesterday
});

test("GET /:id/details returns the event timeline and related response/workflow", async () => {
  const auth = await signup();

  const form = await request(app)
    .post("/api/forms")
    .set("Authorization", `Bearer ${auth.token}`)
    .send({
      name: "Details Drawer Test",
      fields: [{ id: "f_reason", type: "text", label: "Reason" }],
      workflow: { enabled: true, steps: [{ id: "step-1", name: "Review", mode: "all", approvers: [{ type: "role", value: "admin" }] }] },
    });
  await request(app).put(`/api/forms/${form.body.id}/publish`).set("Authorization", `Bearer ${auth.token}`);
  const submitted = await request(app).post(`/api/forms/${form.body.id}/responses`).send({ answers: { f_reason: "Testing" } });

  // response.created and approval.pending events exist for this response,
  // but no recommendation yet (nothing's overdue) — seed one directly so
  // this test doesn't depend on the 48h rule threshold.
  const accountId = auth.user.accountId || auth.user.id;
  const rec = await upsertRecommendation({
    accountId,
    rule: "approval.pending.48h",
    priority: "HIGH",
    score: 90,
    title: "Approval overdue",
    reason: "x",
    entityType: "response",
    entityId: submitted.body.id,
    payload: { formId: form.body.id },
  });

  const res = await request(app).get(`/api/recommendations/${rec.id}/details`).set("Authorization", `Bearer ${auth.token}`);
  assert.equal(res.status, 200);
  assert.equal(res.body.recommendation.id, rec.id);
  const types = res.body.timeline.map((e) => e.type).sort();
  assert.deepEqual(types, ["approval.pending", "response.created"]);
  assert.equal(res.body.related.type, "response");
  assert.equal(res.body.related.id, submitted.body.id);
  assert.equal(res.body.related.workflow.status, "pending");
});

test("GET /api/recommendations/health reports lastScanAt only after evaluateRules has actually run", async () => {
  const auth = await signup();
  const accountId = auth.user.accountId || auth.user.id;

  const before = await request(app).get("/api/recommendations/health").set("Authorization", `Bearer ${auth.token}`);
  assert.equal(before.body.lastScanAt, null);

  const { evaluateRules } = require("../src/services/ruleEngine");
  await evaluateRules(accountId);

  const after = await request(app).get("/api/recommendations/health").set("Authorization", `Bearer ${auth.token}`);
  assert.ok(after.body.lastScanAt, "lastScanAt should be set after a real evaluateRules() run");
});

test("GET /api/recommendations?sort= supports score (default), score_asc, newest, oldest, and updated", async () => {
  const auth = await signup();
  const accountId = auth.user.accountId || auth.user.id;
  const first = await upsertRecommendation({ accountId, rule: "r-sort-1", priority: "LOW", score: 10, title: "Low score, oldest", reason: "x", entityType: "form", entityId: "es1" });
  await new Promise((r) => setTimeout(r, 2));
  await upsertRecommendation({ accountId, rule: "r-sort-2", priority: "HIGH", score: 90, title: "High score, newest", reason: "x", entityType: "form", entityId: "es2" });

  const byScore = await request(app).get("/api/recommendations?sort=score").set("Authorization", `Bearer ${auth.token}`);
  assert.equal(byScore.body.items[0].title, "High score, newest");

  const byScoreAsc = await request(app).get("/api/recommendations?sort=score_asc").set("Authorization", `Bearer ${auth.token}`);
  assert.equal(byScoreAsc.body.items[0].title, "Low score, oldest");

  const newest = await request(app).get("/api/recommendations?sort=newest").set("Authorization", `Bearer ${auth.token}`);
  assert.equal(newest.body.items[0].title, "High score, newest");

  const oldest = await request(app).get("/api/recommendations?sort=oldest").set("Authorization", `Bearer ${auth.token}`);
  assert.equal(oldest.body.items[0].title, "Low score, oldest");

  // Touch the older, lower-scored one last (a resolve stamps updatedAt via
  // store.js's update()) — "Recently Updated" should surface it first even
  // though it's neither the newest nor the highest-scored.
  await request(app).patch(`/api/recommendations/${first.id}/resolve`).set("Authorization", `Bearer ${auth.token}`);
  const updated = await request(app).get("/api/recommendations?status=ALL&sort=updated").set("Authorization", `Bearer ${auth.token}`);
  assert.equal(updated.body.items[0].title, "Low score, oldest");

  const bad = await request(app).get("/api/recommendations?sort=bogus").set("Authorization", `Bearer ${auth.token}`);
  assert.equal(bad.status, 400);
});

test("PATCH /bulk/resolve and /bulk/dismiss act on multiple recommendations at once", async () => {
  const auth = await signup();
  const accountId = auth.user.accountId || auth.user.id;
  const rec1 = await upsertRecommendation({ accountId, rule: "r-bulk-1", priority: "LOW", score: 10, title: "T1", reason: "x", entityType: "form", entityId: "eb1" });
  const rec2 = await upsertRecommendation({ accountId, rule: "r-bulk-2", priority: "LOW", score: 10, title: "T2", reason: "x", entityType: "form", entityId: "eb2" });
  const rec3 = await upsertRecommendation({ accountId, rule: "r-bulk-3", priority: "LOW", score: 10, title: "T3", reason: "x", entityType: "form", entityId: "eb3" });

  const resolveRes = await request(app)
    .patch("/api/recommendations/bulk/resolve")
    .set("Authorization", `Bearer ${auth.token}`)
    .send({ ids: [rec1.id, rec2.id, "does-not-exist"] });
  assert.equal(resolveRes.status, 200);
  assert.equal(resolveRes.body.updated, 2);
  assert.equal(resolveRes.body.notFound, 1);

  const check1 = await request(app).get(`/api/recommendations/${rec1.id}`).set("Authorization", `Bearer ${auth.token}`);
  assert.equal(check1.body.status, "RESOLVED");
  assert.equal(check1.body.resolvedBy, "Test User");

  const dismissRes = await request(app)
    .patch("/api/recommendations/bulk/dismiss")
    .set("Authorization", `Bearer ${auth.token}`)
    .send({ ids: [rec3.id], reason: "Bulk cleanup" });
  assert.equal(dismissRes.body.updated, 1);
  const check3 = await request(app).get(`/api/recommendations/${rec3.id}`).set("Authorization", `Bearer ${auth.token}`);
  assert.equal(check3.body.status, "DISMISSED");
  assert.equal(check3.body.dismissReason, "Bulk cleanup");
});

test("PATCH /bulk/resolve rejects an empty or missing ids array", async () => {
  const auth = await signup();
  const res = await request(app).patch("/api/recommendations/bulk/resolve").set("Authorization", `Bearer ${auth.token}`).send({});
  assert.equal(res.status, 400);
});

test("cleanup: close DB connection", async () => {
  await ready;
  await closeDB();
  await mongod.stop();
});
