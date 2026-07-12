// Plan limits matching the pricing table on the public landing page
// (apps/web/src/views/Landing.jsx). There's no payment processor wired
// up yet (Razorpay is listed in settings.paymentGateway but not
// integrated) — every account defaults to "starter" and stays there
// until real billing exists to move someone to a paid tier. Enforcing
// these limits now means the pricing page isn't just marketing copy.
const PLANS = {
  starter: {
    label: "Starter",
    maxForms: 3,
    maxUsers: 1, // the owner only — no teammates
    workflows: false,
    whatsappBot: false,
    aiAssistant: false,
    // Free — never purchasable through checkout, it's just the default.
    priceInPaise: null,
  },
  growth: {
    label: "Growth",
    maxForms: Infinity,
    maxUsers: 20,
    workflows: true,
    whatsappBot: true,
    aiAssistant: true,
    // ₹999/month flat (matches the landing page's "/user/month" display
    // copy, but the checkout charges one flat monthly amount rather than
    // metering per-teammate — per-seat billing would need to recompute
    // and re-charge as the team's headcount changes, which isn't built).
    priceInPaise: 99900,
  },
  enterprise: {
    label: "Enterprise",
    maxForms: Infinity,
    maxUsers: Infinity,
    workflows: true,
    whatsappBot: true,
    aiAssistant: true,
    // "Custom" pricing — sales-assisted, not self-serve checkout.
    priceInPaise: null,
  },
};

function limitsFor(plan) {
  return PLANS[plan] || PLANS.starter;
}

module.exports = { PLANS, limitsFor };
