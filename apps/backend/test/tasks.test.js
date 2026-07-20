// Task Management tests — Phase 1 of the Work module. Covers CRUD,
// status-change events, soft delete, filtering, and the timeline endpoint.
// Same in-memory Mongo + supertest setup as the other test files.
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
  process.env.MONGODB_URI = mongod.getUri("sales_crm_test_tasks");
  const { ensureConnected, closeDB: close, collection: col } = require("../src/db/store");
  closeDB = close;
  collection = col;
  app = require("../src/app");
  await ensureConnected();
})();

function uniqueEmail(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
}

// Fresh signups default to Starter (maxUsers: 1) — writes directly to the
// settings collection rather than through PUT /api/settings, same as
// auth.test.js's upgradeToGrowth, since only master admin can change plans
// through the real endpoint.
async function upgradeToGrowth(accountId) {
  await ready;
  const settings = collection("settings");
  const id = `settings-${accountId}`;
  const current = await settings.find(id);
  await settings.update(id, { subscription: { ...(current?.subscription || {}), plan: "growth" } });
}

// Creates a teammate within `ownerAuth`'s own tenant and logs in as them —
// needed to test "can't edit/delete someone else's comment" for real,
// since a comment from a genuinely different tenant 404s before the
// ownership check is ever reached (tenant isolation takes priority, same
// as everywhere else in this codebase).
async function loginAsTeammate(ownerAuth) {
  await ready;
  await upgradeToGrowth(ownerAuth.user.accountId || ownerAuth.user.id);
  const email = uniqueEmail("teammate");
  const password = "password123";
  await request(app)
    .post("/api/auth/team")
    .set("Authorization", `Bearer ${ownerAuth.token}`)
    .send({ name: "Teammate", email, password, permission: "full" });
  const res = await request(app).post("/api/auth/login").send({ email, password });
  return res.body;
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

test("POST /api/tasks creates a task with defaults and records a task.created event", async () => {
  const auth = await signup();
  const res = await request(app)
    .post("/api/tasks")
    .set("Authorization", `Bearer ${auth.token}`)
    .send({ title: "Follow up with customer" });
  assert.equal(res.status, 201);
  assert.equal(res.body.status, "Todo");
  assert.equal(res.body.priority, "Medium");
  assert.equal(res.body.deletedAt, null);
  assert.equal(res.body.reporterId, auth.user.id);

  const timeline = await request(app).get(`/api/tasks/${res.body.id}/timeline`).set("Authorization", `Bearer ${auth.token}`);
  assert.equal(timeline.body.length, 1);
  assert.equal(timeline.body[0].type, "task.created");
});

test("POST /api/tasks rejects a missing title or invalid priority", async () => {
  const auth = await signup();
  const noTitle = await request(app).post("/api/tasks").set("Authorization", `Bearer ${auth.token}`).send({});
  assert.equal(noTitle.status, 400);

  const badPriority = await request(app)
    .post("/api/tasks")
    .set("Authorization", `Bearer ${auth.token}`)
    .send({ title: "x", priority: "Urgent" });
  assert.equal(badPriority.status, 400);
});

test("PUT /api/tasks/:id changes status and records task.status_changed with from/to", async () => {
  const auth = await signup();
  const created = await request(app).post("/api/tasks").set("Authorization", `Bearer ${auth.token}`).send({ title: "Ship it" });

  const updated = await request(app)
    .put(`/api/tasks/${created.body.id}`)
    .set("Authorization", `Bearer ${auth.token}`)
    .send({ status: "In Progress" });
  assert.equal(updated.status, 200);
  assert.equal(updated.body.status, "In Progress");

  const timeline = await request(app).get(`/api/tasks/${created.body.id}/timeline`).set("Authorization", `Bearer ${auth.token}`);
  const statusEvent = timeline.body.find((e) => e.type === "task.status_changed");
  assert.ok(statusEvent, "should record a status-change event");
  assert.deepEqual(statusEvent.payload, { from: "Todo", to: "In Progress" });
});

test("PUT /api/tasks/:id rejects an invalid status", async () => {
  const auth = await signup();
  const created = await request(app).post("/api/tasks").set("Authorization", `Bearer ${auth.token}`).send({ title: "x" });
  const res = await request(app)
    .put(`/api/tasks/${created.body.id}`)
    .set("Authorization", `Bearer ${auth.token}`)
    .send({ status: "Bogus" });
  assert.equal(res.status, 400);
});

test("DELETE /api/tasks/:id soft-deletes — the record survives with deletedAt set, and disappears from GET", async () => {
  const auth = await signup();
  const created = await request(app).post("/api/tasks").set("Authorization", `Bearer ${auth.token}`).send({ title: "Temp task" });

  const deleted = await request(app).delete(`/api/tasks/${created.body.id}`).set("Authorization", `Bearer ${auth.token}`);
  assert.equal(deleted.status, 200);
  assert.ok(deleted.body.deletedAt);

  const getAfterDelete = await request(app).get(`/api/tasks/${created.body.id}`).set("Authorization", `Bearer ${auth.token}`);
  assert.equal(getAfterDelete.status, 404);

  const list = await request(app).get("/api/tasks").set("Authorization", `Bearer ${auth.token}`);
  assert.ok(!list.body.some((t) => t.id === created.body.id), "soft-deleted task should not appear in the list");
});

test("GET /api/tasks filters by status, priority, and assigneeId, and paginates when page is passed", async () => {
  const auth = await signup();
  await request(app).post("/api/tasks").set("Authorization", `Bearer ${auth.token}`).send({ title: "High one", priority: "High" });
  await request(app).post("/api/tasks").set("Authorization", `Bearer ${auth.token}`).send({ title: "Low one", priority: "Low" });
  const assigned = await request(app)
    .post("/api/tasks")
    .set("Authorization", `Bearer ${auth.token}`)
    .send({ title: "Assigned to me", assigneeId: auth.user.id });

  const byPriority = await request(app).get("/api/tasks?priority=High").set("Authorization", `Bearer ${auth.token}`);
  assert.ok(byPriority.body.every((t) => t.priority === "High"));
  assert.ok(byPriority.body.some((t) => t.title === "High one"));

  const mine = await request(app).get(`/api/tasks?assigneeId=${auth.user.id}`).set("Authorization", `Bearer ${auth.token}`);
  assert.ok(mine.body.some((t) => t.id === assigned.body.id));

  const paged = await request(app).get("/api/tasks?page=1&limit=2").set("Authorization", `Bearer ${auth.token}`);
  assert.equal(paged.body.items.length, 2);
  assert.equal(typeof paged.body.total, "number");
});

test("a task from one account is invisible and unreachable from another", async () => {
  const ownerAuth = await signup();
  const created = await request(app).post("/api/tasks").set("Authorization", `Bearer ${ownerAuth.token}`).send({ title: "Private task" });

  const intruderAuth = await signup();
  const getRes = await request(app).get(`/api/tasks/${created.body.id}`).set("Authorization", `Bearer ${intruderAuth.token}`);
  assert.equal(getRes.status, 404);

  const deleteRes = await request(app).delete(`/api/tasks/${created.body.id}`).set("Authorization", `Bearer ${intruderAuth.token}`);
  assert.equal(deleteRes.status, 404);
});

test("status/priority accept the expanded enum (Blocked, Critical)", async () => {
  const auth = await signup();
  const created = await request(app)
    .post("/api/tasks")
    .set("Authorization", `Bearer ${auth.token}`)
    .send({ title: "x", priority: "Critical" });
  assert.equal(created.status, 201);
  assert.equal(created.body.priority, "Critical");

  const blocked = await request(app)
    .put(`/api/tasks/${created.body.id}`)
    .set("Authorization", `Bearer ${auth.token}`)
    .send({ status: "Blocked" });
  assert.equal(blocked.status, 200);
  assert.equal(blocked.body.status, "Blocked");
});

test("PUT /api/tasks/:id accepts a checklist and sanitizes malformed items", async () => {
  const auth = await signup();
  const created = await request(app).post("/api/tasks").set("Authorization", `Bearer ${auth.token}`).send({ title: "x" });

  const updated = await request(app)
    .put(`/api/tasks/${created.body.id}`)
    .set("Authorization", `Bearer ${auth.token}`)
    .send({ checklist: [{ text: "Call customer", done: false }, { text: "  " }, { notText: "garbage" }, { text: "Send proposal", done: true }] });
  assert.equal(updated.status, 200);
  assert.equal(updated.body.checklist.length, 2);
  assert.equal(updated.body.checklist[0].text, "Call customer");
  assert.equal(updated.body.checklist[1].done, true);
  assert.ok(updated.body.checklist[0].id);
});

test("task comments: create, thread a reply, edit own, and reject editing someone else's", async () => {
  const auth = await signup();
  const created = await request(app).post("/api/tasks").set("Authorization", `Bearer ${auth.token}`).send({ title: "Discuss this" });

  const top = await request(app)
    .post(`/api/tasks/${created.body.id}/comments`)
    .set("Authorization", `Bearer ${auth.token}`)
    .send({ comment: "Please call after 3PM." });
  assert.equal(top.status, 201);
  assert.equal(top.body.userId, auth.user.id);
  assert.equal(top.body.parentCommentId, null);

  const reply = await request(app)
    .post(`/api/tasks/${created.body.id}/comments`)
    .set("Authorization", `Bearer ${auth.token}`)
    .send({ comment: "Sure.", parentCommentId: top.body.id });
  assert.equal(reply.status, 201);
  assert.equal(reply.body.parentCommentId, top.body.id);

  const list = await request(app).get(`/api/tasks/${created.body.id}/comments`).set("Authorization", `Bearer ${auth.token}`);
  assert.equal(list.body.length, 2);

  const edited = await request(app)
    .put(`/api/tasks/${created.body.id}/comments/${top.body.id}`)
    .set("Authorization", `Bearer ${auth.token}`)
    .send({ comment: "Please call after 4PM." });
  assert.equal(edited.status, 200);
  assert.equal(edited.body.comment, "Please call after 4PM.");

  // Activity timeline should now include the comment.
  const timeline = await request(app).get(`/api/tasks/${created.body.id}/timeline`).set("Authorization", `Bearer ${auth.token}`);
  assert.equal(timeline.body.filter((e) => e.type === "comment.created").length, 2);

  const teammate = await loginAsTeammate(auth);
  const forbiddenEdit = await request(app)
    .put(`/api/tasks/${created.body.id}/comments/${top.body.id}`)
    .set("Authorization", `Bearer ${teammate.token}`)
    .send({ comment: "hijacked" });
  assert.equal(forbiddenEdit.status, 403);
});

test("task comments: delete own comment, reject deleting someone else's, and comment counts endpoint", async () => {
  const auth = await signup();
  const created = await request(app).post("/api/tasks").set("Authorization", `Bearer ${auth.token}`).send({ title: "x" });
  const comment = await request(app)
    .post(`/api/tasks/${created.body.id}/comments`)
    .set("Authorization", `Bearer ${auth.token}`)
    .send({ comment: "note" });

  const counts = await request(app).get("/api/tasks/comments/counts").set("Authorization", `Bearer ${auth.token}`);
  assert.equal(counts.body[created.body.id], 1);

  const teammate = await loginAsTeammate(auth);
  const forbiddenDelete = await request(app)
    .delete(`/api/tasks/${created.body.id}/comments/${comment.body.id}`)
    .set("Authorization", `Bearer ${teammate.token}`);
  assert.equal(forbiddenDelete.status, 403);

  const deleted = await request(app)
    .delete(`/api/tasks/${created.body.id}/comments/${comment.body.id}`)
    .set("Authorization", `Bearer ${auth.token}`);
  assert.equal(deleted.status, 204);

  const listAfter = await request(app).get(`/api/tasks/${created.body.id}/comments`).set("Authorization", `Bearer ${auth.token}`);
  assert.equal(listAfter.body.length, 0);
});

test("task comments: @mention resolves to a tenant account by first name", async () => {
  const auth = await signup({ name: "Mahendran Kumar" });
  const created = await request(app).post("/api/tasks").set("Authorization", `Bearer ${auth.token}`).send({ title: "x" });
  const comment = await request(app)
    .post(`/api/tasks/${created.body.id}/comments`)
    .set("Authorization", `Bearer ${auth.token}`)
    .send({ comment: "@Mahendran please review" });
  assert.equal(comment.status, 201);
  // Mentioning yourself resolves (the matching logic doesn't special-case
  // it), but notifyMentions skips emailing the actor themselves — the
  // observable, testable contract here is that resolution found the
  // account at all.
  assert.deepEqual(comment.body.mentions, [auth.user.id]);
});

test("subtasks: create with parentTaskId, list via /:id/subtasks, and progress on the parent", async () => {
  const auth = await signup();
  const parent = await request(app).post("/api/tasks").set("Authorization", `Bearer ${auth.token}`).send({ title: "Website Redesign" });

  const sub1 = await request(app)
    .post("/api/tasks")
    .set("Authorization", `Bearer ${auth.token}`)
    .send({ title: "Header", parentTaskId: parent.body.id });
  assert.equal(sub1.status, 201);
  assert.equal(sub1.body.parentTaskId, parent.body.id);

  const sub2 = await request(app)
    .post("/api/tasks")
    .set("Authorization", `Bearer ${auth.token}`)
    .send({ title: "Footer", parentTaskId: parent.body.id });
  assert.equal(sub2.status, 201);

  const subtasks = await request(app).get(`/api/tasks/${parent.body.id}/subtasks`).set("Authorization", `Bearer ${auth.token}`);
  assert.equal(subtasks.body.length, 2);

  const parentBeforeComplete = await request(app).get(`/api/tasks/${parent.body.id}`).set("Authorization", `Bearer ${auth.token}`);
  assert.deepEqual(parentBeforeComplete.body.subtaskProgress, { total: 2, done: 0 });

  await request(app).put(`/api/tasks/${sub1.body.id}`).set("Authorization", `Bearer ${auth.token}`).send({ status: "Completed" });

  const parentAfterComplete = await request(app).get(`/api/tasks/${parent.body.id}`).set("Authorization", `Bearer ${auth.token}`);
  assert.deepEqual(parentAfterComplete.body.subtaskProgress, { total: 2, done: 1 });
});

test("POST /api/tasks rejects a parentTaskId that doesn't exist in this account", async () => {
  const auth = await signup();
  const res = await request(app)
    .post("/api/tasks")
    .set("Authorization", `Bearer ${auth.token}`)
    .send({ title: "x", parentTaskId: "does-not-exist" });
  assert.equal(res.status, 400);
});

test("a soft-deleted subtask no longer counts toward the parent's progress", async () => {
  const auth = await signup();
  const parent = await request(app).post("/api/tasks").set("Authorization", `Bearer ${auth.token}`).send({ title: "Parent" });
  const sub = await request(app)
    .post("/api/tasks")
    .set("Authorization", `Bearer ${auth.token}`)
    .send({ title: "Child", parentTaskId: parent.body.id });

  await request(app).delete(`/api/tasks/${sub.body.id}`).set("Authorization", `Bearer ${auth.token}`);

  const parentAfter = await request(app).get(`/api/tasks/${parent.body.id}`).set("Authorization", `Bearer ${auth.token}`);
  assert.deepEqual(parentAfter.body.subtaskProgress, { total: 0, done: 0 });
});

test("cleanup: close DB connection", async () => {
  await ready;
  await closeDB();
  await mongod.stop();
});
