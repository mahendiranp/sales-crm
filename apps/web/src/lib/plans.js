// Mirrors apps/backend/src/utils/plans.js — used here only to proactively
// disable actions and show a tooltip before a request would fail, so
// users don't get an error after the fact. The backend is still the real
// enforcement; if this ever drifts out of sync, the backend wins and just
// shows an error instead of catching it in advance.
export const PLANS = {
  starter: { label: "Starter", maxForms: 3, maxUsers: 1, workflows: false, whatsappBot: false, aiAssistant: false, aiMonthlyLimit: 0 },
  growth: { label: "Growth", maxForms: Infinity, maxUsers: 20, workflows: true, whatsappBot: true, aiAssistant: true, aiMonthlyLimit: 30 },
  enterprise: { label: "Enterprise", maxForms: Infinity, maxUsers: Infinity, workflows: true, whatsappBot: true, aiAssistant: true, aiMonthlyLimit: Infinity },
};

export function limitsFor(plan) {
  return PLANS[plan] || PLANS.starter;
}
