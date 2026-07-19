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

// Same owner check used in routes/settings.js for subscription changes —
// a teammate (even with "full" permission) shouldn't be able to spend the
// company's money or change its billing plan; only the account owner
// (authRole "admin") or the platform's master admin can.
function isOwner(req) {
  return req.user.isMasterAdmin || req.user.authRole === "admin";
}

// Starts a purchase — creates a Razorpay order for the plan's price and
// hands back just enough (order id, amount, the public key id) for the
// frontend to open Razorpay's Checkout widget. Nothing about the account's
// plan changes here; that only happens once /verify confirms a real,
// signed payment (see below) — this step alone can't grant an upgrade.
router.post("/create-order", requireManager, async (req, res) => {
  if (!isOwner(req)) {
    return res.status(403).json({ error: "Only the account owner can change the billing plan." });
  }
  if (!razorpay.isConfigured()) {
    return res.status(503).json({ error: "Payment processing isn't configured yet — contact support." });
  }
  const { plan } = req.body;
  const planConfig = PLANS[plan];
  if (!planConfig || !planConfig.priceInPaise) {
    return res.status(400).json({ error: "That plan isn't available for self-serve purchase." });
  }

  // Razorpay caps `receipt` at 40 characters — the full accountId (a UUID)
  // plus plan and timestamp blows past that, so this is just a short,
  // unique-enough reference; the actual accountId/plan/actor live in
  // `notes` below, which has no such length limit.
  const receipt = `${plan}_${Date.now().toString(36)}_${uuid().slice(0, 8)}`;
  try {
    const order = await razorpay.createOrder({
      amountInPaise: planConfig.priceInPaise,
      receipt,
      notes: { accountId: req.user.accountId, plan, requestedBy: req.user.id },
    });
    res.json({
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId: process.env.RAZORPAY_KEY_ID,
      plan,
      planLabel: planConfig.label,
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
  if (!planConfig || !planConfig.priceInPaise) {
    return res.status(400).json({ error: "That plan isn't available for self-serve purchase." });
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
      amountInPaise: planConfig.priceInPaise,
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
      payload: { plan, amountInPaise: planConfig.priceInPaise, razorpayOrderId: orderId },
    });

    res.json({ success: true, plan });
  } catch (err) {
    // The payment itself is real and already verified at this point — a DB
    // hiccup here shouldn't be reported as "payment failed" to the payer.
    // eslint-disable-next-line no-console
    console.error(`Payment verified (order ${orderId}, payment ${paymentId}) but plan update failed:`, err);
    res.status(500).json({ error: "Payment succeeded but upgrading your plan failed — contact support with this reference: " + paymentId });
  }
});

module.exports = router;
