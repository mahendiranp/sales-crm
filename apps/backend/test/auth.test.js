// Focused on the highest-value surface: authentication, permission
// enforcement, and tenant isolation. These three were the subject of the
// security review earlier in this project's history and were previously
// only verified by hand via curl — codified here so a regression in any of
// them fails CI instead of relying on someone remembering to check.
// This Node build's node:test only exports `test` — no before/after/describe
// hooks (added in later Node versions) — so setup/teardown are handled with
// a shared "ready" promise every test awaits first, and a final cleanup
// test that runs last (node:test runs tests in a file sequentially in
// declaration order by default).
const test = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");
const { MongoMemoryServer } = require("mongodb-memory-server");

// Tests run against an in-memory MongoDB instead of a real service — no
// external DB to spin up/health-check in CI, and every run starts from a
// guaranteed-empty database. The URI must be set before app/store are
// required, since store.js reads process.env.MONGODB_URI at module load.
let mongod;
let app;
let connectDB;
let closeDB;
let collection;

const ready = (async () => {
  mongod = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mongod.getUri("sales_crm_test");
  app = require("../src/app");
  ({ connectDB, closeDB, collection } = require("../src/db/store"));
  await connectDB();
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
  const res = await request(app)
    .post("/api/auth/signup")
    .send({ name: "Test User", email, password: "password123", company: "Test Co", ...overrides });
  return res.body;
}

test("signup requires name, email, and password", async () => {
  await ready;
  const res = await request(app).post("/api/auth/signup").send({ email: "missing@example.com" });
  assert.equal(res.status, 400);
});

test("signup rejects short passwords", async () => {
  await ready;
  const res = await request(app)
    .post("/api/auth/signup")
    .send({ name: "X", email: uniqueEmail("short"), password: "short" });
  assert.equal(res.status, 400);
});

test("login fails with wrong password", async () => {
  const { user } = await signup({ prefix: "wrongpw" });
  const res = await request(app).post("/api/auth/login").send({ email: user.email, password: "not-the-password" });
  assert.equal(res.status, 401);
});

test("protected routes reject requests with no token", async () => {
  await ready;
  const res = await request(app).get("/api/leads");
  assert.equal(res.status, 401);
});

test("protected routes reject a tampered token", async () => {
  const { token } = await signup({ prefix: "tamper" });
  const tampered = token.slice(0, -2) + "xx";
  const res = await request(app).get("/api/leads").set("Authorization", `Bearer ${tampered}`);
  assert.equal(res.status, 401);
});

test("a valid token grants access to the API", async () => {
  const { token } = await signup({ prefix: "valid" });
  const res = await request(app).get("/api/leads").set("Authorization", `Bearer ${token}`);
  assert.equal(res.status, 200);
  assert.ok(Array.isArray(res.body));
});

test("tenant isolation: a fresh signup sees none of another tenant's leads", async () => {
  const tenantA = await signup({ prefix: "tenantA" });
  const tenantB = await signup({ prefix: "tenantB" });

  const createRes = await request(app)
    .post("/api/leads")
    .set("Authorization", `Bearer ${tenantA.token}`)
    .send({ name: "Tenant A Lead", status: "New" });
  assert.equal(createRes.status, 201);
  const leadId = createRes.body.id;

  // Tenant B's own list must not include it.
  const listB = await request(app).get("/api/leads").set("Authorization", `Bearer ${tenantB.token}`);
  assert.ok(!listB.body.some((l) => l.id === leadId));

  // Tenant B guessing the exact ID directly must also fail (404, not 200).
  const directGet = await request(app).get(`/api/leads/${leadId}`).set("Authorization", `Bearer ${tenantB.token}`);
  assert.equal(directGet.status, 404);

  // ...and can't delete it either.
  const directDelete = await request(app).delete(`/api/leads/${leadId}`).set("Authorization", `Bearer ${tenantB.token}`);
  assert.equal(directDelete.status, 404);

  // Tenant A can still see/reach their own lead.
  const ownGet = await request(app).get(`/api/leads/${leadId}`).set("Authorization", `Bearer ${tenantA.token}`);
  assert.equal(ownGet.status, 200);
});

test("permission=view can read but not create", async () => {
  const owner = await signup({ prefix: "permOwner" });
  const teammateRes = await request(app)
    .post("/api/auth/team")
    .set("Authorization", `Bearer ${owner.token}`)
    .send({ name: "Viewer", email: uniqueEmail("viewer-team"), password: "password123", permission: "view" });
  assert.equal(teammateRes.status, 201);

  const login = await request(app)
    .post("/api/auth/login")
    .send({ email: teammateRes.body.email, password: "password123" });
  const viewToken = login.body.token;

  const read = await request(app).get("/api/leads").set("Authorization", `Bearer ${viewToken}`);
  assert.equal(read.status, 200);

  const write = await request(app)
    .post("/api/leads")
    .set("Authorization", `Bearer ${viewToken}`)
    .send({ name: "Should fail" });
  assert.equal(write.status, 403);
});

test("permission=edit can create but not delete", async () => {
  const owner = await signup({ prefix: "permEdit" });
  const teammateRes = await request(app)
    .post("/api/auth/team")
    .set("Authorization", `Bearer ${owner.token}`)
    .send({ name: "Editor", email: uniqueEmail("editor-team"), password: "password123", permission: "edit" });

  const login = await request(app)
    .post("/api/auth/login")
    .send({ email: teammateRes.body.email, password: "password123" });
  const editToken = login.body.token;

  const create = await request(app)
    .post("/api/leads")
    .set("Authorization", `Bearer ${editToken}`)
    .send({ name: "Edit-created lead" });
  assert.equal(create.status, 201);

  const del = await request(app).delete(`/api/leads/${create.body.id}`).set("Authorization", `Bearer ${editToken}`);
  assert.equal(del.status, 403);
});

test("a teammate cannot create other teammates (owner-only)", async () => {
  const owner = await signup({ prefix: "teamGuard" });
  const teammateRes = await request(app)
    .post("/api/auth/team")
    .set("Authorization", `Bearer ${owner.token}`)
    .send({ name: "Full", email: uniqueEmail("full-team"), password: "password123", permission: "full" });

  const login = await request(app)
    .post("/api/auth/login")
    .send({ email: teammateRes.body.email, password: "password123" });

  const res = await request(app)
    .post("/api/auth/team")
    .set("Authorization", `Bearer ${login.body.token}`)
    .send({ name: "Sneaky", email: uniqueEmail("sneaky"), password: "password123", permission: "full" });
  assert.equal(res.status, 403);
});

test("only the account owner (or master admin) can change feature flags", async () => {
  const owner = await signup({ prefix: "flagGuard" });
  const teammateRes = await request(app)
    .post("/api/auth/team")
    .set("Authorization", `Bearer ${owner.token}`)
    .send({ name: "Full", email: uniqueEmail("flag-team"), password: "password123", permission: "full" });
  const login = await request(app)
    .post("/api/auth/login")
    .send({ email: teammateRes.body.email, password: "password123" });

  const blocked = await request(app)
    .put("/api/settings")
    .set("Authorization", `Bearer ${login.body.token}`)
    .send({ apps: { invoicing: true } });
  assert.equal(blocked.status, 403);

  const allowed = await request(app)
    .put("/api/settings")
    .set("Authorization", `Bearer ${owner.token}`)
    .send({ apps: { invoicing: true } });
  assert.equal(allowed.status, 200);
  assert.equal(allowed.body.apps.invoicing, true);
});

test("password reset: wrong token is rejected, correct token works exactly once", async () => {
  const { user } = await signup({ prefix: "resetFlow" });

  const forgot = await request(app).post("/api/auth/forgot-password").send({ email: user.email });
  assert.equal(forgot.status, 200);
  const link = forgot.body.devResetLink;
  assert.ok(link, "expected devResetLink in non-production mock-email mode");
  const token = new URL(link).searchParams.get("token");

  const badReset = await request(app)
    .post("/api/auth/reset-password")
    .send({ email: user.email, token: "wrong-token", password: "brandnewpass1" });
  assert.equal(badReset.status, 400);

  const goodReset = await request(app)
    .post("/api/auth/reset-password")
    .send({ email: user.email, token, password: "brandnewpass1" });
  assert.equal(goodReset.status, 200);

  const loginNew = await request(app).post("/api/auth/login").send({ email: user.email, password: "brandnewpass1" });
  assert.equal(loginNew.status, 200);

  // Token already consumed — reusing it must fail even with the right value.
  const reuse = await request(app)
    .post("/api/auth/reset-password")
    .send({ email: user.email, token, password: "anotherpass1" });
  assert.equal(reuse.status, 400);
});

test("CSV export neutralizes formula-injection payloads", async () => {
  const { token } = await signup({ prefix: "csvGuard" });
  const formRes = await request(app)
    .post("/api/forms")
    .set("Authorization", `Bearer ${token}`)
    .send({ name: "CSV Test Form", fields: [{ id: "f1", type: "text", label: "Name" }] });
  const formId = formRes.body.id;
  await request(app).put(`/api/forms/${formId}/publish`).set("Authorization", `Bearer ${token}`);

  await request(app)
    .post(`/api/forms/${formId}/responses`)
    .send({ answers: { f1: "=cmd|'/c calc'!A1" } });

  const csv = await request(app)
    .get(`/api/forms/${formId}/responses/export/csv`)
    .set("Authorization", `Bearer ${token}`);
  assert.equal(csv.status, 200);
  assert.ok(!/,"=cmd/.test(csv.text), "raw formula must not appear unescaped in the CSV");
  assert.ok(csv.text.includes("'=cmd"), "formula-leading cell should be neutralized with a leading quote");

  await request(app).delete(`/api/forms/${formId}`).set("Authorization", `Bearer ${token}`);
});

// Runs last (node:test executes a file's tests in declaration order) —
// removes every account/settings doc this file created so repeated runs
// don't pile up test tenants in the dev database.
test("cleanup: remove test accounts created by this suite", async () => {
  await ready;
  const accounts = collection("accounts");
  const settings = collection("settings");
  const all = await accounts.all();
  let removed = 0;
  for (const acc of all) {
    if (cleanupEmails.includes(acc.email)) {
      await accounts.remove(acc.id);
      await settings.remove(`settings-${acc.accountId || acc.id}`);
      removed++;
    }
  }
  assert.ok(removed >= 0);
  await closeDB();
  await mongod.stop();
});
