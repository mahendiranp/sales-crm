// Plan limits matching the pricing table on the public landing page
// (apps/web/src/views/Landing.jsx). Razorpay is wired up (see
// routes/payments.js) for Growth's self-serve checkout; Enterprise stays
// sales-assisted (no priceInMinorUnits, no checkout button).
//
// Growth is priced in USD ($19/month = 1900 cents) — note this only
// actually charges in USD if the connected Razorpay account has
// international payments enabled. That's a business-side approval
// (KYC/FEMA compliance for an Indian merchant account), not something
// togglable from here — an account without it will get a real error back
// from Razorpay's API on checkout despite this code being "correct."
//
// AI features need both `aiAssistant: true` on the plan AND a positive AI
// credit balance (utils/aiCredits.js) — Starter (and any account currently
// downgraded to it) can't use AI at all regardless of remaining credits;
// Growth/Enterprise can, until their balance runs out. `monthlyAiCredits`
// is what a paid plan additionally tops up by on each successful billing
// cycle (routes/payments.js's /verify) — unused credits roll over, this
// isn't a reset-to-cap allowance like the old monthly-limit model was.
const PLANS = {
  starter: {
    label: "Starter",
    maxForms: 3,
    maxUsers: 1, // the owner only — no teammates
    maxResponsesPerMonth: 100,
    workflows: false,
    whatsappBot: false,
    aiAssistant: false,
    monthlyAiCredits: 0,
    // Free — never purchasable through checkout, it's just the default.
    currency: null,
    priceInMinorUnits: null,
  },
  growth: {
    label: "Growth",
    maxForms: Infinity,
    maxUsers: 20,
    maxResponsesPerMonth: 2000,
    workflows: true,
    whatsappBot: true,
    aiAssistant: true,
    monthlyAiCredits: 500,
    // $19/month flat (matches the landing page's "/month" display copy).
    currency: "USD",
    priceInMinorUnits: 1900,
    // Launch offer: 50% off ($9) on an account's first-ever Growth
    // payment, capped at the first 100 accounts to actually use it (see
    // routes/payments.js's resolvePrice — checkout is a one-time charge,
    // not a recurring subscription, so this is a one-time first-payment
    // discount, not "$9/mo for 3 months then $19/mo").
    launchOfferPriceInMinorUnits: 900,
    launchOfferLimit: 100,
  },
  enterprise: {
    label: "Enterprise",
    maxForms: Infinity,
    maxUsers: Infinity,
    maxResponsesPerMonth: Infinity,
    workflows: true,
    whatsappBot: true,
    aiAssistant: true,
    monthlyAiCredits: 2000,
    // "Custom" pricing — sales-assisted, not self-serve checkout.
    currency: null,
    priceInMinorUnits: null,
  },
};

function limitsFor(plan) {
  return PLANS[plan] || PLANS.starter;
}

module.exports = { PLANS, limitsFor };
