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
    maxResponsesPerMonth: 100,
    workflows: false,
    whatsappBot: false,
    // AI Generate is a premium (Team/Enterprise) capability — Free plan
    // users don't get it at all, not even a trial.
    aiAssistant: false,
    aiMonthlyLimit: 0,
    // Free — never purchasable through checkout, it's just the default.
    priceInPaise: null,
  },
  growth: {
    label: "Growth",
    maxForms: Infinity,
    maxUsers: 20,
    maxResponsesPerMonth: 2000,
    workflows: true,
    whatsappBot: true,
    aiAssistant: true,
    aiMonthlyLimit: 30,
    // ₹999/month flat (matches the landing page's "/month" display copy).
    priceInPaise: 99900,
  },
  enterprise: {
    label: "Enterprise",
    maxForms: Infinity,
    maxUsers: Infinity,
    maxResponsesPerMonth: Infinity,
    workflows: true,
    whatsappBot: true,
    aiAssistant: true,
    aiMonthlyLimit: Infinity,
    // "Custom" pricing — sales-assisted, not self-serve checkout.
    priceInPaise: null,
  },
};

function limitsFor(plan) {
  return PLANS[plan] || PLANS.starter;
}

module.exports = { PLANS, limitsFor };
