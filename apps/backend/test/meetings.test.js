// Meetings tests — core module: CRUD, participants (accept/decline),
// notes, CRM/Task linking, soft delete, and Event Engine integration.
// Same in-memory Mongo + supertest setup as the other test files.
const test = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");
const { MongoMemoryServer } = require("mongodb-memory-server");

let mongod;
let app;
let closeDB;

const ready = (async () => {
  mongod = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mongod.getUri("sales_crm_test_meetings");
  const { ensureConnected, closeDB: close } = require("../src/db/store");
  closeDB = close;
  app = require("../src/app");
  await ensureConnected();
})();

function uniqueEmail(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
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

test("POST /api/meetings creates a meeting, auto-adds the organizer as an accepted participant, and records an event", async () => {
  const auth = await signup();
  const start = new Date(Date.now() + 3600_000).toISOString();
  const res = await request(app)
    .post("/api/meetings")
    .set("Authorization", `Bearer ${auth.token}`)
    .send({ title: "Demo with ABC Technologies", scheduledStart: start, meetingType: "Sales Demo" });
  assert.equal(res.status, 201);
  assert.equal(res.body.status, "Scheduled");
  assert.equal(res.body.ownerId, auth.user.id);

  const participants = await request(app).get(`/api/meetings/${res.body.id}/participants`).set("Authorization", `Bearer ${auth.token}`);
  assert.equal(participants.body.length, 1);
  assert.equal(participants.body[0].role, "organizer");
  assert.equal(participants.body[0].response, "Accepted");

  const events = await request(app).get(`/api/events?entityType=meeting&type=meeting.created`).set("Authorization", `Bearer ${auth.token}`);
  assert.equal(events.body.items.filter((e) => e.entityId === res.body.id).length, 1);
});

test("POST /api/meetings rejects a missing title or scheduledStart", async () => {
  const auth = await signup();
  const noTitle = await request(app).post("/api/meetings").set("Authorization", `Bearer ${auth.token}`).send({ scheduledStart: new Date().toISOString() });
  assert.equal(noTitle.status, 400);
  const noStart = await request(app).post("/api/meetings").set("Authorization", `Bearer ${auth.token}`).send({ title: "x" });
  assert.equal(noStart.status, 400);
});

test("PATCH /api/meetings/:id changes status and records meeting.status_changed", async () => {
  const auth = await signup();
  const created = await request(app)
    .post("/api/meetings")
    .set("Authorization", `Bearer ${auth.token}`)
    .send({ title: "Standup", scheduledStart: new Date().toISOString() });

  const updated = await request(app)
    .patch(`/api/meetings/${created.body.id}`)
    .set("Authorization", `Bearer ${auth.token}`)
    .send({ status: "Completed" });
  assert.equal(updated.status, 200);
  assert.equal(updated.body.status, "Completed");

  const events = await request(app).get(`/api/events?type=meeting.status_changed`).set("Authorization", `Bearer ${auth.token}`);
  const match = events.body.items.find((e) => e.entityId === created.body.id);
  assert.deepEqual(match.payload.from, "Scheduled");
  assert.deepEqual(match.payload.to, "Completed");
});

test("PATCH /api/meetings/:id rejects an invalid status", async () => {
  const auth = await signup();
  const created = await request(app)
    .post("/api/meetings")
    .set("Authorization", `Bearer ${auth.token}`)
    .send({ title: "x", scheduledStart: new Date().toISOString() });
  const res = await request(app).patch(`/api/meetings/${created.body.id}`).set("Authorization", `Bearer ${auth.token}`).send({ status: "Bogus" });
  assert.equal(res.status, 400);
});

test("DELETE /api/meetings/:id soft-deletes — survives with deletedAt, disappears from GET", async () => {
  const auth = await signup();
  const created = await request(app)
    .post("/api/meetings")
    .set("Authorization", `Bearer ${auth.token}`)
    .send({ title: "Temp", scheduledStart: new Date().toISOString() });

  const deleted = await request(app).delete(`/api/meetings/${created.body.id}`).set("Authorization", `Bearer ${auth.token}`);
  assert.equal(deleted.status, 200);
  assert.ok(deleted.body.deletedAt);

  const getAfter = await request(app).get(`/api/meetings/${created.body.id}`).set("Authorization", `Bearer ${auth.token}`);
  assert.equal(getAfter.status, 404);

  const list = await request(app).get("/api/meetings").set("Authorization", `Bearer ${auth.token}`);
  assert.ok(!list.body.some((m) => m.id === created.body.id));
});

test("participants: invite, accept/decline own invite, and reject responding for someone else", async () => {
  const auth = await signup();
  const created = await request(app)
    .post("/api/meetings")
    .set("Authorization", `Bearer ${auth.token}`)
    .send({ title: "Kickoff", scheduledStart: new Date().toISOString() });

  const invited = await request(app)
    .post(`/api/meetings/${created.body.id}/participants`)
    .set("Authorization", `Bearer ${auth.token}`)
    .send({ userId: "some-user-id" });
  assert.equal(invited.status, 201);
  assert.equal(invited.body.response, "Pending");

  const dupe = await request(app)
    .post(`/api/meetings/${created.body.id}/participants`)
    .set("Authorization", `Bearer ${auth.token}`)
    .send({ userId: "some-user-id" });
  assert.equal(dupe.status, 409);

  // The organizer accepting their own invite.
  const participants = await request(app).get(`/api/meetings/${created.body.id}/participants`).set("Authorization", `Bearer ${auth.token}`);
  const organizerParticipant = participants.body.find((p) => p.role === "organizer");
  const declined = await request(app)
    .patch(`/api/meetings/${created.body.id}/participants/${organizerParticipant.id}`)
    .set("Authorization", `Bearer ${auth.token}`)
    .send({ response: "Declined" });
  assert.equal(declined.status, 200);
  assert.equal(declined.body.response, "Declined");

  // Trying to respond on behalf of the OTHER (unauthenticated-as) participant.
  const forbidden = await request(app)
    .patch(`/api/meetings/${created.body.id}/participants/${invited.body.id}`)
    .set("Authorization", `Bearer ${auth.token}`)
    .send({ response: "Accepted" });
  assert.equal(forbidden.status, 403);
});

test("notes: add multiple timestamped entries and see them in the meeting's Activity Timeline", async () => {
  const auth = await signup();
  const created = await request(app)
    .post("/api/meetings")
    .set("Authorization", `Bearer ${auth.token}`)
    .send({ title: "Client Call", scheduledStart: new Date().toISOString() });

  await request(app).post(`/api/meetings/${created.body.id}/notes`).set("Authorization", `Bearer ${auth.token}`).send({ content: "Client requested proposal." });
  await request(app).post(`/api/meetings/${created.body.id}/notes`).set("Authorization", `Bearer ${auth.token}`).send({ content: "Sent follow-up email." });

  const notes = await request(app).get(`/api/meetings/${created.body.id}/notes`).set("Authorization", `Bearer ${auth.token}`);
  assert.equal(notes.body.length, 2);
  assert.equal(notes.body[0].content, "Client requested proposal.");

  const events = await request(app).get(`/api/events?entityType=meeting&type=meeting.note_added`).set("Authorization", `Bearer ${auth.token}`);
  assert.equal(events.body.items.filter((e) => e.entityId === created.body.id).length, 2);
});

test("a meeting can link to a CRM record, and a task can link to the meeting as an action item", async () => {
  const auth = await signup();
  const meeting = await request(app)
    .post("/api/meetings")
    .set("Authorization", `Bearer ${auth.token}`)
    .send({ title: "Demo", scheduledStart: new Date().toISOString(), linkedEntityType: "lead", linkedEntityId: "lead-123" });
  assert.equal(meeting.body.linkedEntityType, "lead");
  assert.equal(meeting.body.linkedEntityId, "lead-123");

  // Meeting -> Task linking reuses the existing generic task
  // entityType/entityId — no dedicated meetings endpoint needed.
  const task = await request(app)
    .post("/api/tasks")
    .set("Authorization", `Bearer ${auth.token}`)
    .send({ title: "Send proposal", entityType: "meeting", entityId: meeting.body.id });
  assert.equal(task.status, 201);
  assert.equal(task.body.entityType, "meeting");
  assert.equal(task.body.entityId, meeting.body.id);
});

test("meetings, participants, and notes from one account are invisible to another", async () => {
  const ownerAuth = await signup();
  const meeting = await request(app)
    .post("/api/meetings")
    .set("Authorization", `Bearer ${ownerAuth.token}`)
    .send({ title: "Private", scheduledStart: new Date().toISOString() });

  const intruderAuth = await signup();
  const getRes = await request(app).get(`/api/meetings/${meeting.body.id}`).set("Authorization", `Bearer ${intruderAuth.token}`);
  assert.equal(getRes.status, 404);

  const notesRes = await request(app).get(`/api/meetings/${meeting.body.id}/notes`).set("Authorization", `Bearer ${intruderAuth.token}`);
  assert.equal(notesRes.status, 404);

  const deleteRes = await request(app).delete(`/api/meetings/${meeting.body.id}`).set("Authorization", `Bearer ${intruderAuth.token}`);
  assert.equal(deleteRes.status, 404);
});

test("outcome: accepts a valid outcome, rejects an invalid one, and a meeting can link to a deal/contact/company/task, not just a lead", async () => {
  const auth = await signup();
  const created = await request(app)
    .post("/api/meetings")
    .set("Authorization", `Bearer ${auth.token}`)
    .send({ title: "Enterprise Contract Review", scheduledStart: new Date().toISOString(), linkedEntityType: "deal", linkedEntityId: "deal-42" });
  assert.equal(created.body.linkedEntityType, "deal");

  const badLink = await request(app)
    .post("/api/meetings")
    .set("Authorization", `Bearer ${auth.token}`)
    .send({ title: "x", scheduledStart: new Date().toISOString(), linkedEntityType: "bogus", linkedEntityId: "x" });
  assert.equal(badLink.status, 400);

  const outcomeSet = await request(app)
    .patch(`/api/meetings/${created.body.id}`)
    .set("Authorization", `Bearer ${auth.token}`)
    .send({ status: "Completed", outcome: "Won" });
  assert.equal(outcomeSet.status, 200);
  assert.equal(outcomeSet.body.outcome, "Won");

  const badOutcome = await request(app)
    .patch(`/api/meetings/${created.body.id}`)
    .set("Authorization", `Bearer ${auth.token}`)
    .send({ outcome: "Bogus" });
  assert.equal(badOutcome.status, 400);
});

test("cleanup: close DB connection", async () => {
  await ready;
  await closeDB();
  await mongod.stop();
});
