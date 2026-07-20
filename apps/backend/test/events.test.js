// Events read API tests — backs the Activity Timeline page. Same
// in-memory Mongo + supertest setup as the other test files.
const test = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");
const { MongoMemoryServer } = require("mongodb-memory-server");

let mongod;
let app;
let closeDB;

const ready = (async () => {
  mongod = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mongod.getUri("sales_crm_test_events_api");
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

test("GET /api/events lists real events across entity types, newest first", async () => {
  const auth = await signup();
  const task1 = await request(app).post("/api/tasks").set("Authorization", `Bearer ${auth.token}`).send({ title: "First" });
  await new Promise((r) => setTimeout(r, 2));
  const task2 = await request(app).post("/api/tasks").set("Authorization", `Bearer ${auth.token}`).send({ title: "Second" });

  const res = await request(app).get("/api/events").set("Authorization", `Bearer ${auth.token}`);
  assert.equal(res.status, 200);
  const taskEvents = res.body.items.filter((e) => e.entityType === "task" && e.type === "task.created");
  assert.equal(taskEvents.length, 2);
  assert.equal(taskEvents[0].entityId, task2.body.id); // newest first
  assert.equal(taskEvents[1].entityId, task1.body.id);
});

test("GET /api/events filters by type, entityType, source, and date range", async () => {
  const auth = await signup();
  const task = await request(app).post("/api/tasks").set("Authorization", `Bearer ${auth.token}`).send({ title: "Filtered" });
  await request(app).post(`/api/tasks/${task.body.id}/comments`).set("Authorization", `Bearer ${auth.token}`).send({ comment: "note" });

  const byType = await request(app).get("/api/events?type=comment.created").set("Authorization", `Bearer ${auth.token}`);
  assert.ok(byType.body.items.every((e) => e.type === "comment.created"));
  assert.ok(byType.body.items.length >= 1);

  const byEntityType = await request(app).get("/api/events?entityType=task").set("Authorization", `Bearer ${auth.token}`);
  assert.ok(byEntityType.body.items.every((e) => e.entityType === "task"));

  const bySource = await request(app).get("/api/events?source=tasks").set("Authorization", `Bearer ${auth.token}`);
  assert.ok(bySource.body.items.length >= 1);

  const future = new Date(Date.now() + 60_000).toISOString();
  const noneYet = await request(app).get(`/api/events?from=${future}`).set("Authorization", `Bearer ${auth.token}`);
  assert.equal(noneYet.body.items.length, 0);
});

test("GET /api/events?search matches payload name/title fields", async () => {
  const auth = await signup();
  await request(app).post("/api/tasks").set("Authorization", `Bearer ${auth.token}`).send({ title: "Unique Searchable Title" });

  const res = await request(app).get("/api/events?search=Searchable").set("Authorization", `Bearer ${auth.token}`);
  assert.ok(res.body.items.some((e) => e.payload?.title === "Unique Searchable Title"));
});

test("GET /api/events/meta/sources only lists sources this account actually has events for", async () => {
  const auth = await signup();
  await request(app).post("/api/tasks").set("Authorization", `Bearer ${auth.token}`).send({ title: "x" });

  const res = await request(app).get("/api/events/meta/sources").set("Authorization", `Bearer ${auth.token}`);
  assert.ok(res.body.sources.includes("tasks"));
  assert.ok(!res.body.sources.includes("meetings")); // doesn't exist as a source anywhere in the app
});

test("GET /api/events?actorId filters to one user's actions, and public/anonymous events (no actor) are excluded", async () => {
  const auth = await signup();
  const form = await request(app)
    .post("/api/forms")
    .set("Authorization", `Bearer ${auth.token}`)
    .send({ name: "Actor Filter Test", fields: [] });
  await request(app).put(`/api/forms/${form.body.id}/publish`).set("Authorization", `Bearer ${auth.token}`);
  // Public, unauthenticated submission — its response.created event has
  // actorId: null.
  await request(app).post(`/api/forms/${form.body.id}/responses`).send({ answers: {} });
  await request(app).post("/api/tasks").set("Authorization", `Bearer ${auth.token}`).send({ title: "Mine" });

  const mine = await request(app).get(`/api/events?actorId=${auth.user.id}`).set("Authorization", `Bearer ${auth.token}`);
  assert.ok(mine.body.items.every((e) => e.actorId === auth.user.id));
  assert.ok(mine.body.items.some((e) => e.type === "task.created"));
  assert.ok(!mine.body.items.some((e) => e.type === "response.created"), "the anonymous submission has no actor and shouldn't match");
});

test("GET /api/events/meta/sources lists real actors, never someone who hasn't acted", async () => {
  const auth = await signup();
  await request(app).post("/api/tasks").set("Authorization", `Bearer ${auth.token}`).send({ title: "x" });

  const res = await request(app).get("/api/events/meta/sources").set("Authorization", `Bearer ${auth.token}`);
  assert.ok(res.body.actors.some((a) => a.id === auth.user.id));
});

test("events from one account are invisible to another", async () => {
  const ownerAuth = await signup();
  await request(app).post("/api/tasks").set("Authorization", `Bearer ${ownerAuth.token}`).send({ title: "Private" });

  const intruderAuth = await signup();
  const res = await request(app).get("/api/events").set("Authorization", `Bearer ${intruderAuth.token}`);
  assert.ok(!res.body.items.some((e) => e.payload?.title === "Private"));
});

test("cleanup: close DB connection", async () => {
  await ready;
  await closeDB();
  await mongod.stop();
});
