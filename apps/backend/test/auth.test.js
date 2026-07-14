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
let closeDB;
let collection;

const ready = (async () => {
  mongod = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mongod.getUri("sales_crm_test");
  // Requiring app.js triggers its own ensureConnected() middleware on the
  // first request, which shares this same cached connection — using
  // connectDB() directly here would open a second, separate MongoClient
  // that closeDB() (which only tracks the most recently opened one) would
  // never close, leaving the process hanging after tests finish.
  const { ensureConnected, closeDB: close, collection: col } = require("../src/db/store");
  closeDB = close;
  collection = col;
  app = require("../src/app");
  await ensureConnected();
})();

const cleanupEmails = [];

function uniqueEmail(prefix) {
  const email = `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
  cleanupEmails.push(email);
  return email;
}

// Signup is now two-step (email OTP — see routes/auth.js): request-otp
// validates + emails a code without creating anything, verify-otp checks it
// and creates the account. In test env (no SMTP configured) request-otp
// echoes the code back as devOtp instead of actually sending mail, so this
// helper can complete both steps in one call the same way tests used to
// call the old single-step /api/auth/signup.
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

// New tenants default to the "starter" plan, which only allows a single
// user (see utils/plans.js) — most permission tests below need to add
// teammates, so they need Growth first. Writes directly to the settings
// collection rather than through PUT /api/settings, since that route now
// (correctly) refuses to let anyone but the master admin change plans.
async function upgradeToGrowth(accountId) {
  await ready;
  const settings = collection("settings");
  const id = `settings-${accountId}`;
  const current = await settings.find(id);
  await settings.update(id, { subscription: { ...(current?.subscription || {}), plan: "growth" } });
}

test("signup requires name, email, and password", async () => {
  await ready;
  const res = await request(app).post("/api/auth/signup/request-otp").send({ email: "missing@example.com" });
  assert.equal(res.status, 400);
});

test("signup rejects short passwords", async () => {
  await ready;
  const res = await request(app)
    .post("/api/auth/signup/request-otp")
    .send({ name: "X", email: uniqueEmail("short"), password: "short" });
  assert.equal(res.status, 400);
});

test("signup OTP: wrong code is rejected, correct code creates the account exactly once", async () => {
  await ready;
  const email = uniqueEmail("otpflow");
  const requested = await request(app)
    .post("/api/auth/signup/request-otp")
    .send({ name: "OTP Test", email, password: "password123" });
  assert.equal(requested.status, 200);
  assert.ok(requested.body.devOtp, "test env with no SMTP should echo the code back");

  const wrong = await request(app).post("/api/auth/signup/verify-otp").send({ email, otp: "000000" });
  assert.equal(wrong.status, 400);

  const right = await request(app).post("/api/auth/signup/verify-otp").send({ email, otp: requested.body.devOtp });
  assert.equal(right.status, 201);
  assert.equal(right.body.user.email, email);

  // The code is single-use — a second verify with the same (now-consumed) code must fail.
  const reused = await request(app).post("/api/auth/signup/verify-otp").send({ email, otp: requested.body.devOtp });
  assert.equal(reused.status, 400);
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
  await upgradeToGrowth(owner.user.id); // the owner's own id IS the tenant's accountId
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
  await upgradeToGrowth(owner.user.id);
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
  await upgradeToGrowth(owner.user.id);
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
  await upgradeToGrowth(owner.user.id);
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

test("starter plan blocks a 4th form, a 2nd teammate, and Growth-only features", async () => {
  const owner = await signup({ prefix: "planLimit" });

  // 3 forms is the starter cap — the first 3 succeed.
  let lastFormId;
  for (let i = 0; i < 3; i++) {
    const res = await request(app)
      .post("/api/forms")
      .set("Authorization", `Bearer ${owner.token}`)
      .send({ name: `Form ${i}`, fields: [] });
    assert.equal(res.status, 201);
    lastFormId = res.body.id;
  }
  const fourth = await request(app)
    .post("/api/forms")
    .set("Authorization", `Bearer ${owner.token}`)
    .send({ name: "Form 4", fields: [] });
  assert.equal(fourth.status, 403);

  // Starter is a single-user plan — can't add even one teammate.
  const teammate = await request(app)
    .post("/api/auth/team")
    .set("Authorization", `Bearer ${owner.token}`)
    .send({ name: "Nope", email: uniqueEmail("starter-teammate"), password: "password123", permission: "view" });
  assert.equal(teammate.status, 403);

  // Approval workflows are Growth+.
  const workflow = await request(app)
    .put(`/api/forms/${lastFormId}`)
    .set("Authorization", `Bearer ${owner.token}`)
    .send({ workflow: { enabled: true, steps: [{ id: "s1", name: "Approve", mode: "all", approvers: [{ type: "role", value: "admin" }] }] } });
  assert.equal(workflow.status, 403);

  // The WhatsApp survey bot toggle is Growth+.
  const whatsappBot = await request(app)
    .put("/api/settings")
    .set("Authorization", `Bearer ${owner.token}`)
    .send({ apps: { whatsappBot: true } });
  assert.equal(whatsappBot.status, 403);

  // An owner can't grant themselves a higher plan through the same endpoint.
  const selfUpgrade = await request(app)
    .put("/api/settings")
    .set("Authorization", `Bearer ${owner.token}`)
    .send({ subscription: { plan: "enterprise" } });
  assert.equal(selfUpgrade.status, 403);
});

test("growth plan unlocks the exact features starter blocks: 4th form, 2nd teammate, workflows, WhatsApp bot", async () => {
  const owner = await signup({ prefix: "growthUnlock" });
  await upgradeToGrowth(owner.user.id);

  // 4 forms — starter's cap was 3, this must now succeed.
  let lastFormId;
  for (let i = 0; i < 4; i++) {
    const res = await request(app)
      .post("/api/forms")
      .set("Authorization", `Bearer ${owner.token}`)
      .send({ name: `Growth Form ${i}`, fields: [] });
    assert.equal(res.status, 201);
    lastFormId = res.body.id;
  }

  const teammate = await request(app)
    .post("/api/auth/team")
    .set("Authorization", `Bearer ${owner.token}`)
    .send({ name: "Teammate", email: uniqueEmail("growth-teammate"), password: "password123", permission: "view" });
  assert.equal(teammate.status, 201);

  const workflow = await request(app)
    .put(`/api/forms/${lastFormId}`)
    .set("Authorization", `Bearer ${owner.token}`)
    .send({ workflow: { enabled: true, steps: [{ id: "s1", name: "Approve", mode: "all", approvers: [{ type: "role", value: "admin" }] }] } });
  assert.equal(workflow.status, 200);

  const whatsappBot = await request(app)
    .put("/api/settings")
    .set("Authorization", `Bearer ${owner.token}`)
    .send({ apps: { whatsappBot: true } });
  assert.equal(whatsappBot.status, 200);
});

test("monthly response limit: starter's 101st response across all its forms is rejected", async () => {
  await ready;
  const owner = await signup({ prefix: "responseLimit" });
  const formRes = await request(app)
    .post("/api/forms")
    .set("Authorization", `Bearer ${owner.token}`)
    .send({ name: "Limit Test Form", fields: [] });
  const formId = formRes.body.id;
  await request(app).put(`/api/forms/${formId}/publish`).set("Authorization", `Bearer ${owner.token}`);

  // Seed 100 responses directly (starter's cap) rather than making 100 real
  // HTTP submissions — this test cares about the limit boundary, not
  // re-proving that a normal submission works (already covered elsewhere).
  const formResponses = collection("form_responses");
  const now = new Date().toISOString();
  for (let i = 0; i < 100; i++) {
    // An owner's own id IS their tenant's accountId (only teammates get an
    // explicit accountId field pointing back at the owner) — see
    // middleware/auth.js's signToken.
    await formResponses.insert({ id: `seed-${owner.user.id}-${i}`, formId, accountId: owner.user.id, answers: {}, submittedAt: now });
  }

  const overLimit = await request(app).post(`/api/forms/${formId}/responses`).send({ answers: {} });
  assert.equal(overLimit.status, 403);
  assert.match(overLimit.body.error, /monthly response limit/);
});

test("payments: signature verification rejects a forged signature and accepts a correctly-signed one", async () => {
  // Pure-function check, independent of whether Razorpay is "configured" —
  // this is the actual security boundary for /payments/verify (a client
  // can't just claim a payment succeeded; the signature has to be one only
  // someone holding RAZORPAY_KEY_SECRET could have produced). Deliberately
  // not exercised through the live route/HTTP call, matching this app's
  // rule of never sending real requests to a payment provider in tests.
  const crypto = require("node:crypto");
  const { verifySignature } = require("../src/integrations/razorpayClient");
  const secret = process.env.RAZORPAY_KEY_SECRET || "test-secret-for-this-assertion-only";
  const orderId = "order_test123";
  const paymentId = "pay_test456";

  // verifySignature reads RAZORPAY_KEY_SECRET from the environment itself,
  // which may be unset entirely (e.g. CI, no .env) — must be set for the
  // whole assertion, not just the "real signature" half, or the forged-
  // signature check throws instead of returning false.
  const previousSecret = process.env.RAZORPAY_KEY_SECRET;
  process.env.RAZORPAY_KEY_SECRET = secret;
  try {
    const forged = verifySignature({ orderId, paymentId, signature: "not-the-real-signature" });
    assert.equal(forged, false);

    const real = crypto.createHmac("sha256", secret).update(`${orderId}|${paymentId}`).digest("hex");
    assert.equal(verifySignature({ orderId, paymentId, signature: real }), true);
  } finally {
    process.env.RAZORPAY_KEY_SECRET = previousSecret;
  }
});

test("payments: create-order is owner-only, and 503s until Razorpay is configured", async () => {
  const owner = await signup({ prefix: "payOwner" });
  await upgradeToGrowth(owner.user.id); // starter plan caps teammates at 1 — need Growth to add one for this test
  const teammateRes = await request(app)
    .post("/api/auth/team")
    .set("Authorization", `Bearer ${owner.token}`)
    .send({ name: "Teammate", email: uniqueEmail("pay-teammate"), password: "password123", permission: "full" });
  const teammateLogin = await request(app)
    .post("/api/auth/login")
    .send({ email: teammateRes.body.email, password: "password123" });

  // A non-owner teammate (even with full permission) can't start a purchase.
  const teammateAttempt = await request(app)
    .post("/api/payments/create-order")
    .set("Authorization", `Bearer ${teammateLogin.body.token}`)
    .send({ plan: "growth" });
  assert.equal(teammateAttempt.status, 403);

  // The owner can attempt it, but test env has no RAZORPAY_KEY_ID/SECRET —
  // must fail closed (503), never silently pretend to succeed.
  const ownerAttempt = await request(app)
    .post("/api/payments/create-order")
    .set("Authorization", `Bearer ${owner.token}`)
    .send({ plan: "growth" });
  assert.equal(ownerAttempt.status, 503);

  // Plans with no self-serve price (enterprise) are rejected outright,
  // independent of whether Razorpay happens to be configured.
  const badPlan = await request(app)
    .post("/api/payments/create-order")
    .set("Authorization", `Bearer ${owner.token}`)
    .send({ plan: "enterprise" });
  assert.equal(badPlan.status, 503); // still 503 first, since isConfigured() is checked before plan validity in test env
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
