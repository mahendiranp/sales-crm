// Event Engine unit tests — Phase 1 of the AI Observer. Verifies the
// service itself records well-formed, non-throwing events, and that the
// route handlers wired to it (generic CRUD, form submission) actually call
// it. Mirrors auth.test.js's in-memory Mongo + supertest setup (see that
// file for why: no external DB needed in CI, every run starts empty, and
// `node --test` isolates each test file in its own process, so this file's
// MONGODB_URI override never collides with auth.test.js's).
const test = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");
const { MongoMemoryServer } = require("mongodb-memory-server");

let mongod;
let app;
let closeDB;
let collection;
let recordEvent;
let EVENT_TYPES;

const ready = (async () => {
  mongod = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mongod.getUri("sales_crm_test_events");
  const { ensureConnected, closeDB: close, collection: col } = require("../src/db/store");
  closeDB = close;
  collection = col;
  ({ recordEvent, EVENT_TYPES } = require("../src/services/eventEngine"));
  app = require("../src/app");
  await ensureConnected();
})();

const cleanupEmails = [];
function uniqueEmail(prefix) {
  const email = `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
  cleanupEmails.push(email);
  return email;
}

// Same two-step OTP signup helper as auth.test.js.
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

test("recordEvent writes a well-formed, durable event", async () => {
  await ready;
  const event = await recordEvent({
    accountId: "acct-1",
    type: EVENT_TYPES.TASK_CREATED,
    entityType: "task",
    entityId: "task-1",
    actorId: "user-1",
    actorName: "user@example.com",
    payload: { title: "Follow up" },
  });
  assert.ok(event.id);
  assert.ok(event.createdAt);
  assert.equal(event.type, "task.created");
  // Defaults: version stamped, correlationId falls back to entityId, source
  // falls back to "api", severity falls back to "info" — a caller that
  // isn't part of a multi-step process or a specific subsystem shouldn't
  // have to think about any of these.
  assert.equal(event.version, 1);
  assert.equal(event.correlationId, "task-1");
  assert.equal(event.source, "api");
  assert.equal(event.severity, "info");

  const stored = await collection("events").find(event.id);
  assert.ok(stored, "event should be persisted");
  assert.equal(stored.accountId, "acct-1");
  assert.equal(stored.entityId, "task-1");
  assert.equal(stored.payload.title, "Follow up");
});

test("recordEvent accepts an explicit correlationId, source, and severity", async () => {
  await ready;
  const event = await recordEvent({
    accountId: "acct-1",
    type: EVENT_TYPES.LEAD_CREATED,
    entityType: "lead",
    entityId: "lead-1",
    correlationId: "response-1",
    source: "forms",
    severity: "warning",
    payload: {},
  });
  assert.equal(event.correlationId, "response-1");
  assert.equal(event.source, "forms");
  assert.equal(event.severity, "warning");
});

// The whole point of recordEvent() never throwing is that a logging
// failure can't take down the business action that triggered it — this
// asserts that contract at the missing-required-fields boundary (the one
// failure mode that's deterministic to trigger in a test, vs. a genuine
// Mongo outage).
test("recordEvent never throws — returns null when required fields are missing", async () => {
  await ready;
  const result = await recordEvent({ type: "task.created" });
  assert.equal(result, null);
});

test("creating a task via the CRUD API emits a task.created event", async () => {
  const auth = await signup();
  const res = await request(app)
    .post("/api/tasks")
    .set("Authorization", `Bearer ${auth.token}`)
    .send({ title: "Call the customer" });
  assert.equal(res.status, 201);

  const matches = await collection("events").query((e) => e.type === "task.created" && e.entityId === res.body.id);
  assert.equal(matches.length, 1);
  assert.equal(matches[0].accountId, auth.user.accountId || auth.user.id);
  assert.equal(matches[0].actorId, auth.user.id);
});

test("updating and deleting a task emits task.updated and task.deleted events", async () => {
  const auth = await signup();
  const created = await request(app)
    .post("/api/tasks")
    .set("Authorization", `Bearer ${auth.token}`)
    .send({ title: "Draft" });

  await request(app)
    .put(`/api/tasks/${created.body.id}`)
    .set("Authorization", `Bearer ${auth.token}`)
    .send({ title: "Final" });
  const updated = await collection("events").query((e) => e.type === "task.updated" && e.entityId === created.body.id);
  assert.equal(updated.length, 1);

  await request(app)
    .delete(`/api/tasks/${created.body.id}`)
    .set("Authorization", `Bearer ${auth.token}`);
  const deleted = await collection("events").query((e) => e.type === "task.deleted" && e.entityId === created.body.id);
  assert.equal(deleted.length, 1);
});

test("creating a form emits a form.created event", async () => {
  const auth = await signup();
  const res = await request(app)
    .post("/api/forms")
    .set("Authorization", `Bearer ${auth.token}`)
    .send({ name: "Contact Us", fields: [] });
  assert.equal(res.status, 201);

  const matches = await collection("events").query((e) => e.type === "form.created" && e.entityId === res.body.id);
  assert.equal(matches.length, 1);
});

// The most important path: an unauthenticated respondent submitting a
// public form must still produce a response.created event, attributed to
// the form owner's account rather than any user (there's no session).
test("submitting a form response emits a response.created event with no actor", async () => {
  const auth = await signup();
  const form = await request(app)
    .post("/api/forms")
    .set("Authorization", `Bearer ${auth.token}`)
    .send({ name: "Contact Us", fields: [] });
  await request(app)
    .put(`/api/forms/${form.body.id}/publish`)
    .set("Authorization", `Bearer ${auth.token}`);

  const submitted = await request(app).post(`/api/forms/${form.body.id}/responses`).send({ answers: {} });
  assert.equal(submitted.status, 201);

  const matches = await collection("events").query((e) => e.type === "response.created" && e.entityId === submitted.body.id);
  assert.equal(matches.length, 1);
  assert.equal(matches[0].actorId, null);
  assert.equal(matches[0].accountId, auth.user.accountId || auth.user.id);
  assert.equal(matches[0].source, "forms");
  // A response's own event is its own correlation root — nothing else in
  // this chain (no approval workflow, no auto-created lead) ran, so it
  // should correlate only with itself.
  assert.equal(matches[0].correlationId, submitted.body.id);
});

// The whole reason correlationId exists: a single form submission that both
// requires approval and auto-creates a lead should produce three events —
// response.created, approval.pending, lead.created — that all share one
// correlationId (the response's id), even though the lead has a different
// entityId, so a later consumer can reconstruct the whole chain.
test("a form submission that creates an approval and a lead correlates all three events", async () => {
  const auth = await signup();
  const form = await request(app)
    .post("/api/forms")
    .set("Authorization", `Bearer ${auth.token}`)
    .send({
      name: "Vendor Onboarding",
      fields: [{ id: "f_email", type: "email", label: "Email" }],
      workflow: { enabled: true, steps: [{ id: "step-1", name: "Review", mode: "all", approvers: [{ type: "role", value: "admin" }] }] },
    });
  await request(app)
    .put(`/api/forms/${form.body.id}/publish`)
    .set("Authorization", `Bearer ${auth.token}`);
  // createLeadOnSubmit isn't part of POST /api/forms's create allowlist —
  // it's set via a later PUT, same as the frontend's Settings tab does.
  await request(app)
    .put(`/api/forms/${form.body.id}`)
    .set("Authorization", `Bearer ${auth.token}`)
    .send({ createLeadOnSubmit: true });

  const submitted = await request(app)
    .post(`/api/forms/${form.body.id}/responses`)
    .send({ answers: { f_email: "lead@example.com" } });
  assert.equal(submitted.status, 201);

  const chain = await collection("events").query((e) => e.correlationId === submitted.body.id);
  const types = chain.map((e) => e.type).sort();
  assert.deepEqual(types, ["approval.pending", "lead.created", "response.created"]);
});

test("cleanup: close DB connection", async () => {
  await ready;
  await closeDB();
  await mongod.stop();
});
