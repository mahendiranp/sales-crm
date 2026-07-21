const express = require("express");
const { randomUUID: uuid } = require("crypto");
const { collection } = require("../db/store");
const { requireManager } = require("../middleware/auth");
const { PLANS } = require("../utils/plans");
const razorpay = require("../integrations/razorpayClient");
const { topUpCreditsForPlan } = require("../utils/aiCredits");
const { recordEvent, EVENT_TYPES, EVENT_SOURCES } = require("../services/eventEngine");

const router = express.Router();
const settings = collection("settings");
const payments = collection("payments");
// Tracks what an order was actually created for (accountId, plan, the
// resolved price) so /verify can trust that instead of re-deriving it (or
// trusting whatever the client sends back) — eligibility for the launch
// offer is a snapshot at create-order time, not something to recompute
// after the fact where a race with another signup could flip the answer.
const paymentIntents = collection("payment_intents");

// Same owner check used in routes/settings.js for subscription changes —
// a teammate (even with "full" permission) shouldn't be able to spend the
// company's money or change its billing plan; only the account owner
// (authRole "admin") or the platform's master admin can.
function isOwner(req) {
  return req.user.isMasterAdmin || req.user.authRole === "admin";
}

// Launch offer: 50% off ($9) on an account's first-ever Growth payment,
// capped at the plan's launchOfferLimit accounts. Not "$9/mo for 3 months
// then $19/mo" — checkout here is a one-time charge, not a recurring
// subscription (see routes/payments.js's own doc comment on /verify), so
// this is a one-time first-payment discount rather than a multi-cycle
// mechanic this codebase has no billing engine to actually enforce.
async function resolveGrowthPrice(accountId) {
  const planConfig = PLANS.growth;
  const priorGrowthPayments = await payments.query((p) => p.accountId === accountId && p.plan === "growth");
  if (priorGrowthPayments.length > 0) {
    return { amountInMinorUnits: planConfig.priceInMinorUnits, launchOffer: false };
  }
  const launchOfferPaymentsUsed = await payments.query((p) => p.plan === "growth" && p.launchOffer === true);
  if (planConfig.launchOfferPriceInMinorUnits && launchOfferPaymentsUsed.length < planConfig.launchOfferLimit) {
    return { amountInMinorUnits: planConfig.launchOfferPriceInMinorUnits, launchOffer: true };
  }
  return { amountInMinorUnits: planConfig.priceInMinorUnits, launchOffer: false };
}

// Starts a purchase — creates a Razorpay order for the plan's price and
// hands back just enough (order id, amount, the public key id) for the
// frontend to open Razorpay's Checkout widget. Nothing about the account's
// plan changes here; that only happens once /verify confirms a real,
// signed payment (see below) — this step alone can't grant an upgrade.
// Public (see app.js's PUBLIC_ROUTES) — the landing page's pricing
// section reads this, unauthenticated, to show a real remaining-slots
// count instead of a made-up one.
router.get("/launch-offer", async (req, res) => {
  const planConfig = PLANS.growth;
  if (!planConfig.launchOfferPriceInMinorUnits) {
    return res.json({ active: false, remaining: 0 });
  }
  const used = await payments.query((p) => p.plan === "growth" && p.launchOffer === true);
  const remaining = Math.max(0, planConfig.launchOfferLimit - used.length);
  res.json({
    active: remaining > 0,
    remaining,
    limit: planConfig.launchOfferLimit,
    priceInMinorUnits: planConfig.launchOfferPriceInMinorUnits,
    regularPriceInMinorUnits: planConfig.priceInMinorUnits,
    currency: planConfig.currency,
  });
});

router.post("/create-order", requireManager, async (req, res) => {
  if (!isOwner(req)) {
    return res.status(403).json({ error: "Only the account owner can change the billing plan." });
  }
  if (!razorpay.isConfigured()) {
    return res.status(503).json({ error: "Payment processing isn't configured yet — contact support." });
  }
  const { plan } = req.body;
  const planConfig = PLANS[plan];
  if (!planConfig || !planConfig.priceInMinorUnits) {
    return res.status(400).json({ error: "That plan isn't available for self-serve purchase." });
  }

  const { amountInMinorUnits, launchOffer } = plan === "growth"
    ? await resolveGrowthPrice(req.user.accountId)
    : { amountInMinorUnits: planConfig.priceInMinorUnits, launchOffer: false };

  // Razorpay caps `receipt` at 40 characters — the full accountId (a UUID)
  // plus plan and timestamp blows past that, so this is just a short,
  // unique-enough reference; the actual accountId/plan/actor live in
  // `notes` below, which has no such length limit.
  const receipt = `${plan}_${Date.now().toString(36)}_${uuid().slice(0, 8)}`;
  try {
    const order = await razorpay.createOrder({
      amountInMinorUnits,
      currency: planConfig.currency,
      receipt,
      notes: { accountId: req.user.accountId, plan, requestedBy: req.user.id, launchOffer },
    });
    // Snapshot what this order is actually for — /verify trusts this
    // record instead of re-deriving eligibility (which could have shifted
    // if another account claimed the last launch-offer slot in between)
    // or trusting a client-supplied amount.
    await paymentIntents.insert({
      id: order.id,
      accountId: req.user.accountId,
      plan,
      amountInMinorUnits,
      currency: planConfig.currency,
      launchOffer,
      createdAt: new Date().toISOString(),
    });
    res.json({
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId: process.env.RAZORPAY_KEY_ID,
      plan,
      planLabel: planConfig.label,
      launchOffer,
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("Razorpay order creation failed:", err);
    res.status(502).json({ error: "Couldn't start checkout with the payment provider — please try again." });
  }
});

// Razorpay Checkout calls back to the frontend with these three fields on
// a completed payment — the frontend forwards them here rather than
// trusting its own "payment succeeded" callback, since that callback could
// be reached without ever actually paying (e.g. by calling it directly).
// Only a signature that verifies against RAZORPAY_KEY_SECRET (which the
// browser never has) proves the payment is real.
router.post("/verify", requireManager, async (req, res) => {
  if (!isOwner(req)) {
    return res.status(403).json({ error: "Only the account owner can change the billing plan." });
  }
  if (!razorpay.isConfigured()) {
    return res.status(503).json({ error: "Payment processing isn't configured yet — contact support." });
  }
  const { razorpay_order_id: orderId, razorpay_payment_id: paymentId, razorpay_signature: signature, plan } = req.body;
  if (!orderId || !paymentId || !signature || !plan) {
    return res.status(400).json({ error: "Missing payment confirmation details." });
  }
  const planConfig = PLANS[plan];
  if (!planConfig || !planConfig.priceInMinorUnits) {
    return res.status(400).json({ error: "That plan isn't available for self-serve purchase." });
  }

  // Trust the intent snapshot from create-order, not planConfig's default
  // price — this order may have been created at the launch-offer price.
  // Also confirms the order actually belongs to this account, so one
  // account can't verify a payment intent created for another.
  const intent = await paymentIntents.find(orderId);
  if (!intent || intent.accountId !== req.user.accountId || intent.plan !== plan) {
    return res.status(400).json({ error: "This order doesn't match your account or plan — contact support before retrying." });
  }

  const valid = razorpay.verifySignature({ orderId, paymentId, signature });
  if (!valid) {
    return res.status(400).json({ error: "Payment verification failed — please contact support before retrying." });
  }

  try {
    const id = `settings-${req.user.accountId}`;
    const renewsOn = new Date();
    renewsOn.setMonth(renewsOn.getMonth() + 1);
    await settings.update(id, { subscription: { plan, renewsOn: renewsOn.toISOString() } });
    // Top up (not reset) AI credits by this plan's monthly allotment —
    // unused credits from before this billing cycle roll over rather than
    // being wiped, same reasoning as a mobile carrier's data rollover.
    await topUpCreditsForPlan(req.user.accountId, planConfig.monthlyAiCredits);

    // Audit trail — separate from `settings` (which only ever holds current
    // state) so there's a durable record of what was actually paid, by whom,
    // and when, independent of later plan changes.
    await payments.insert({
      id: uuid(),
      accountId: req.user.accountId,
      plan,
      amountInMinorUnits: intent.amountInMinorUnits,
      currency: intent.currency,
      launchOffer: intent.launchOffer,
      razorpayOrderId: orderId,
      razorpayPaymentId: paymentId,
      createdAt: new Date().toISOString(),
    });
    await recordEvent({
      accountId: req.user.accountId,
      type: EVENT_TYPES.PAYMENT_SUCCESS,
      entityType: "payment",
      entityId: paymentId,
      actorId: req.user.id,
      actorName: req.user.email,
      source: EVENT_SOURCES.PAYMENTS,
      payload: { plan, amountInMinorUnits: intent.amountInMinorUnits, currency: intent.currency, launchOffer: intent.launchOffer, razorpayOrderId: orderId },
    });

    res.json({ success: true, plan, launchOffer: intent.launchOffer });
  } catch (err) {
    // The payment itself is real and already verified at this point — a DB
    // hiccup here shouldn't be reported as "payment failed" to the payer.
    // eslint-disable-next-line no-console
    console.error(`Payment verified (order ${orderId}, payment ${paymentId}) but plan update failed:`, err);
    res.status(500).json({ error: "Payment succeeded but upgrading your plan failed — contact support with this reference: " + paymentId });
  }
});

module.exports = router;
// Exposed for testing only (test/payments.test.js) — Express routers are
// plain functions, so attaching this doesn't change how app.js mounts it.
module.exports.resolveGrowthPrice = resolveGrowthPrice;
