// End-to-end test for the "employee leave request" scenario walked through
// in product review: HR creates a form -> employee submits -> approval goes
// pending -> manager sits on it 48+ hours -> the Rule Engine flags it ->
// HR notifies the approver -> the manager approves -> the recommendation
// auto-resolves -> Business Health improves. This exercises the real HTTP
// API end to end (not the services directly), through the same in-memory
// Mongo + supertest setup as the other test files.
//
// One thing this test cannot fully exercise: recordEvent()/evaluateRules()
// always stamp `createdAt` as "now" — there's no way to submit a response
// via the public API and have it already be 48+ hours old. So step 6
// ("manager does not approve for 48+ hours") is simulated by backdating the
// approval.pending event directly in the `events` collection after a real
// submission, then triggering a second, unrelated event in the same
// account (per forms.js's evaluateRulesQuietly — there's no scheduled job,
// only event-triggered evaluation) to represent "some time later, activity
// happens and the rule finally gets a chance to run".
const test = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");
const { MongoMemoryServer } = require("mongodb-memory-server");

let mongod;
let app;
let closeDB;
let collection;

const ready = (async () => {
  mongod = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mongod.getUri("sales_crm_test_e2e_leave");
  const { ensureConnected, closeDB: close, collection: col } = require("../src/db/store");
  closeDB = close;
  collection = col;
  app = require("../src/app");
  await ensureConnected();
})();

function uniqueEmail(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
}

// HR is the account owner in this scenario — the only account that exists
// once signup completes — and is also the workflow's approver, since the
// "role: admin" approver step (used throughout this codebase's other
// workflow tests) always resolves to the account owner.
async function signupHr() {
  await ready;
  const email = uniqueEmail("hr");
  const requested = await request(app)
    .post("/api/auth/signup/request-otp")
    .send({ name: "HR Manager", email, password: "password123", company: "Acme HR" });
  const res = await request(app).post("/api/auth/signup/verify-otp").send({ email, otp: requested.body.devOtp });
  return res.body;
}

test("employee leave request: overdue approval is flagged, notified, decided, and auto-resolved", async () => {
  const hr = await signupHr();
  const accountId = hr.user.accountId || hr.user.id;
  const authHeader = `Bearer ${hr.token}`;

  // 1. HR creates a Leave Request Form, with an approval workflow whose
  // sole approver is the account owner (the "manager" role, in this
  // single-user test tenant).
  const formRes = await request(app)
    .post("/api/forms")
    .set("Authorization", authHeader)
    .send({
      name: "Leave Request",
      fields: [{ id: "f_reason", type: "text", label: "Reason" }],
      workflow: { enabled: true, steps: [{ id: "step-1", name: "Manager Review", mode: "all", approvers: [{ type: "role", value: "admin" }] }] },
    });
  assert.equal(formRes.status, 201);
  await request(app).put(`/api/forms/${formRes.body.id}/publish`).set("Authorization", authHeader);

  // 2-3. Employee submits the form -> response.created event.
  const submitRes = await request(app).post(`/api/forms/${formRes.body.id}/responses`).send({ answers: { f_reason: "Family event" } });
  assert.equal(submitRes.status, 201);
  const responseId = submitRes.body.id;

  const events = collection("events");
  const submittedEvent = (await events.query((e) => e.type === "response.created" && e.entityId === responseId))[0];
  assert.ok(submittedEvent, "response.created event should exist");

  // 4-5. Approval workflow starts -> approval.pending event.
  const pendingEvent = (await events.query((e) => e.type === "approval.pending" && e.entityId === responseId))[0];
  assert.ok(pendingEvent, "approval.pending event should exist");

  // 6. Manager does not approve for 48+ hours — simulated by backdating
  // the approval.pending event, since the API always stamps "now".
  await collection("events").update(pendingEvent.id, { createdAt: new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString() });

  // 7-8. Rule Engine runs — triggered by another approval-related event
  // happening in the same account (a second employee's leave request),
  // since nothing re-runs rules on a timer (see forms.js's
  // evaluateRulesQuietly doc comment).
  await request(app).post(`/api/forms/${formRes.body.id}/responses`).send({ answers: { f_reason: "Second request" } });

  // 9-10. "Approval Overdue" recommendation exists, and AI Center's list
  // (GET /api/recommendations, defaults to OPEN) shows it as 1 HIGH item.
  const listRes = await request(app).get("/api/recommendations").set("Authorization", authHeader);
  const overdue = listRes.body.items.find((r) => r.rule === "approval.pending.48h" && r.entityId === responseId);
  assert.ok(overdue, "an Approval overdue recommendation should exist for this response");
  assert.equal(overdue.priority, "HIGH");
  assert.equal(overdue.status, "OPEN");
  // The card should name who it's waiting on — the approver is "role:
  // admin", which resolves to the HR/manager account itself (see
  // workflowEngine.js), so its own name should show up here.
  assert.equal(overdue.payload.waitingFor, "HR Manager");

  const healthBefore = await request(app).get("/api/recommendations/health").set("Authorization", authHeader);
  assert.equal(healthBefore.body.openCount, 1);
  assert.ok(healthBefore.body.score < 100);

  // 11-12. HR clicks "Notify Approver" -> manager gets an email (best-effort
  // mock email client in test env — asserting the action reports success is
  // the observable contract here, same as forms.js's own notification
  // tests elsewhere in this codebase).
  const notifyRes = await request(app).post(`/api/recommendations/${overdue.id}/actions/notify-approver`).set("Authorization", authHeader);
  assert.equal(notifyRes.status, 200);
  assert.equal(notifyRes.body.ok, true);

  // 13-14. Manager approves -> approval.approved event -> recommendation
  // auto-resolves (evaluateRulesQuietly runs after the decision is recorded).
  const decideRes = await request(app)
    .post(`/api/forms/${formRes.body.id}/responses/${responseId}/workflow/decide`)
    .set("Authorization", authHeader)
    .send({ action: "approve" });
  assert.equal(decideRes.status, 200);
  assert.equal(decideRes.body.status, "approved");

  const resolvedRec = await request(app).get(`/api/recommendations/${overdue.id}`).set("Authorization", authHeader);
  assert.equal(resolvedRec.body.status, "RESOLVED");

  // 15. Business Health score increases now that the open HIGH-priority
  // recommendation is gone.
  const healthAfter = await request(app).get("/api/recommendations/health").set("Authorization", authHeader);
  assert.equal(healthAfter.body.openCount, 0);
  assert.ok(healthAfter.body.score > healthBefore.body.score);
  assert.equal(healthAfter.body.score, 100);

  // 16. "AI Center updates automatically without a page refresh" is the
  // frontend's live-update wiring (useLiveCollection(["recommendations"])
  // reacting to store.js's db:change socket broadcast, which every
  // collection() write already emits) — not something this HTTP-level test
  // can observe directly, but it rides on the same resolveRecommendation()
  // write asserted above; no separate backend plumbing was needed for it.
});

test("cleanup: close DB connection", async () => {
  await ready;
  await closeDB();
  await mongod.stop();
});
