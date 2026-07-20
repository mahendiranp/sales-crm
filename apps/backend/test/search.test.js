// Global search — backs the header search box and the ⌘K command palette.
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
  process.env.MONGODB_URI = mongod.getUri("sales_crm_test_search");
  const { ensureConnected, closeDB: close } = require("../src/db/store");
  closeDB = close;
  app = require("../src/app");
  await ensureConnected();
})();

function uniqueEmail(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
}

async function signup() {
  await ready;
  const email = uniqueEmail("search");
  const requested = await request(app)
    .post("/api/auth/signup/request-otp")
    .send({ name: "Search Test", email, password: "password123", company: "Search Co" });
  const res = await request(app).post("/api/auth/signup/verify-otp").send({ email, otp: requested.body.devOtp });
  return res.body;
}

test("returns empty groups for an empty query", async () => {
  const auth = await signup();
  const res = await request(app).get("/api/search?q=").set("Authorization", `Bearer ${auth.token}`);
  assert.equal(res.status, 200);
  assert.deepEqual(res.body, { leads: [], contacts: [], companies: [], deals: [], tasks: [], meetings: [], forms: [] });
});

test("finds a lead, task, and meeting by a case-insensitive substring match, and nothing else", async () => {
  const auth = await signup();
  const unique = `Zephyr${Date.now()}`;

  await request(app).post("/api/leads").set("Authorization", `Bearer ${auth.token}`).send({ name: `${unique} Corp`, mobile: "9800000010" });
  await request(app).post("/api/tasks").set("Authorization", `Bearer ${auth.token}`).send({ title: `Call ${unique}` });
  await request(app)
    .post("/api/meetings")
    .set("Authorization", `Bearer ${auth.token}`)
    .send({ title: `${unique} demo`, scheduledStart: new Date().toISOString() });

  const res = await request(app).get(`/api/search?q=${unique.toLowerCase()}`).set("Authorization", `Bearer ${auth.token}`);
  assert.equal(res.status, 200);
  assert.equal(res.body.leads.length, 1);
  assert.equal(res.body.leads[0].label, `${unique} Corp`);
  assert.equal(res.body.leads[0].href, "/app/leads");
  assert.equal(res.body.tasks.length, 1);
  assert.equal(res.body.meetings.length, 1);
  assert.equal(res.body.contacts.length, 0);
  assert.equal(res.body.deals.length, 0);
});

test("a soft-deleted task doesn't show up in results", async () => {
  const auth = await signup();
  const unique = `Deleted${Date.now()}`;
  const task = await request(app).post("/api/tasks").set("Authorization", `Bearer ${auth.token}`).send({ title: unique });
  await request(app).delete(`/api/tasks/${task.body.id}`).set("Authorization", `Bearer ${auth.token}`);

  const res = await request(app).get(`/api/search?q=${unique.toLowerCase()}`).set("Authorization", `Bearer ${auth.token}`);
  assert.equal(res.body.tasks.length, 0);
});

test("results are scoped to the searching tenant, not visible cross-account", async () => {
  const ownerAuth = await signup();
  const unique = `TenantScoped${Date.now()}`;
  await request(app).post("/api/leads").set("Authorization", `Bearer ${ownerAuth.token}`).send({ name: unique, mobile: "9800000011" });

  const intruderAuth = await signup();
  const res = await request(app).get(`/api/search?q=${unique.toLowerCase()}`).set("Authorization", `Bearer ${intruderAuth.token}`);
  assert.equal(res.body.leads.length, 0);
});

test("cleanup: close DB connection", async () => {
  await ready;
  await closeDB();
  await mongod.stop();
});
