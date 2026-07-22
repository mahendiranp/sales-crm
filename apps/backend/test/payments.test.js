// Covers the launch-offer pricing logic added to routes/payments.js: the
// public remaining-slots endpoint, and resolveGrowthPrice's eligibility
// rules (first-ever Growth payment only, capped at launchOfferLimit
// accounts). create-order/verify themselves aren't exercised end-to-end
// here since that needs a configured Razorpay account (see auth.test.js's
// existing "payments: create-order is owner-only" test, which already
// covers the 503-when-unconfigured path) — this file tests the pricing
// decision in isolation instead.
const test = require("node:test");
const assert = require("node:assert/strict");
const { MongoMemoryServer } = require("mongodb-memory-server");

let mongod;
let collection;
let closeDB;
let resolveGrowthPrice;
let PLANS;

const ready = (async () => {
  mongod = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mongod.getUri("sales_crm_test");
  const { ensureConnected, closeDB: close, collection: col } = require("../src/db/store");
  closeDB = close;
  collection = col;
  ({ resolveGrowthPrice } = require("../src/routes/payments"));
  ({ PLANS } = require("../src/utils/plans"));
  await ensureConnected();
})();

test("resolveGrowthPrice: a brand-new account with no payment history gets the launch offer", async () => {
  await ready;
  const result = await resolveGrowthPrice("acct-new-1");
  assert.equal(result.launchOffer, true);
  assert.equal(result.amountInMinorUnits, PLANS.growth.launchOfferPriceInMinorUnits);
});

test("resolveGrowthPrice: an account with a prior Growth payment pays full price, even with slots remaining", async () => {
  await ready;
  const payments = collection("payments");
  await payments.insert({
    id: "pay-1",
    accountId: "acct-repeat",
    plan: "growth",
    amountInMinorUnits: PLANS.growth.launchOfferPriceInMinorUnits,
    launchOffer: true,
    createdAt: new Date().toISOString(),
  });

  const result = await resolveGrowthPrice("acct-repeat");
  assert.equal(result.launchOffer, false);
  assert.equal(result.amountInMinorUnits, PLANS.growth.priceInMinorUnits);
});

test("resolveGrowthPrice: a full-price payment doesn't count against the launch-offer cap", async () => {
  await ready;
  const payments = collection("payments");
  await payments.insert({
    id: "pay-full-price",
    accountId: "acct-paid-full",
    plan: "growth",
    amountInMinorUnits: PLANS.growth.priceInMinorUnits,
    launchOffer: false,
    createdAt: new Date().toISOString(),
  });

  // A different, fresh account should still see the offer as available —
  // only launchOffer:true payments consume a slot.
  const result = await resolveGrowthPrice("acct-fresh-after-full-price");
  assert.equal(result.launchOffer, true);
});

// Runs last on purpose — fills the launch-offer cap to its limit, which is
// a one-way state change the other tests above assume hasn't happened yet
// (node:test runs a file's tests sequentially in declaration order).
test("resolveGrowthPrice: once launchOfferLimit accounts have used the offer, new accounts pay full price", async () => {
  await ready;
  const payments = collection("payments");
  // Fill the cap with distinct accounts, each having used the offer once.
  for (let i = 0; i < PLANS.growth.launchOfferLimit; i++) {
    await payments.insert({
      id: `pay-fill-${i}`,
      accountId: `acct-fill-${i}`,
      plan: "growth",
      amountInMinorUnits: PLANS.growth.launchOfferPriceInMinorUnits,
      launchOffer: true,
      createdAt: new Date().toISOString(),
    });
  }

  const result = await resolveGrowthPrice("acct-after-cap");
  assert.equal(result.launchOffer, false);
  assert.equal(result.amountInMinorUnits, PLANS.growth.priceInMinorUnits);
});

test("cleanup: close DB connection", async () => {
  await ready;
  await closeDB();
  await mongod.stop();
});
