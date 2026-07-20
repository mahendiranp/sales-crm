// Thin wrapper around the Razorpay SDK. Unlike emailClient.js, payments
// are never mocked into a fake "success" when unconfigured — silently
// pretending a payment succeeded would let anyone upgrade their plan for
// free. Instead, isConfigured() gates the routes that use this client and
// they respond with a clear 503 until real RAZORPAY_KEY_ID/RAZORPAY_KEY_SECRET
// are set.
const crypto = require("crypto");
const Razorpay = require("razorpay");

let client = null;

function isConfigured() {
  // Automated tests must never depend on (or trigger) a real call to
  // Razorpay's API, even if real keys are present in .env for local dev —
  // same reasoning as emailClient.js under NODE_ENV=test. Always treated
  // as unconfigured in test, so payment routes consistently 503 there.
  if (process.env.NODE_ENV === "test") return false;
  return !!(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET);
}

function getClient() {
  if (!client) {
    client = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET,
    });
  }
  return client;
}

// `amountInMinorUnits` — Razorpay's API works in the smallest currency
// unit (cents for USD, paise for INR), same convention used in
// utils/plans.js's priceInMinorUnits. `currency` must match what the
// connected Razorpay account is actually approved to charge in — see the
// note on utils/plans.js's Growth plan about USD requiring international
// payments to be enabled on that account.
async function createOrder({ amountInMinorUnits, currency = "USD", receipt, notes }) {
  return getClient().orders.create({
    amount: amountInMinorUnits,
    currency,
    receipt,
    notes,
  });
}

// Razorpay's checkout callback hands back an order id, payment id, and an
// HMAC signature — verifying it (rather than trusting the callback's
// "success" at face value) is what actually confirms the payment is real
// and wasn't forged by a client just POSTing fake IDs.
function verifySignature({ orderId, paymentId, signature }) {
  const expected = crypto
    .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
    .update(`${orderId}|${paymentId}`)
    .digest("hex");
  return expected === signature;
}

module.exports = { isConfigured, createOrder, verifySignature };
