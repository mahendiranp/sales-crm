// Rule: 3+ rejected approvals for the same form within a rolling 7-day
// window — a signal the form/workflow itself needs attention (unclear
// instructions, wrong approver assigned, a policy change), not just one
// isolated rejection.
const { collection } = require("../../db/store");
const { upsertRecommendation, resolveRecommendation, findOpenByRule, PRIORITY } = require("../recommendationStore");

const events = collection("events");
const forms = collection("forms");

const ID = "approval.rejection_spike.7d";
const THRESHOLD = 3;
const WINDOW_DAYS = 7;

async function run(accountId, now = Date.now()) {
  const all = await events.query((e) => e.accountId === accountId);
  const windowStart = now - WINDOW_DAYS * 24 * 60 * 60 * 1000;
  const recentRejections = all.filter((e) => e.type === "approval.rejected" && new Date(e.createdAt).getTime() >= windowStart);

  const byForm = new Map();
  for (const rejection of recentRejections) {
    const formId = rejection.payload?.formId || "unknown";
    if (!byForm.has(formId)) byForm.set(formId, []);
    byForm.get(formId).push(rejection);
  }

  // Same reasoning as approvalPending48h.js: nothing re-runs this rule on a
  // timer, so the next time it does run is the right moment to notice a
  // form's rejection count has aged back below the threshold (the window
  // rolled past the rejections that caused it) and close the recommendation.
  const openRecommendations = await findOpenByRule(accountId, ID);
  for (const rec of openRecommendations) {
    const stillSpiking = (byForm.get(rec.entityId) || []).length >= THRESHOLD;
    if (!stillSpiking) {
      await resolveRecommendation(accountId, rec.id, { actorName: "System", reason: "Rejection rate returned to normal." });
    }
  }

  const results = [];
  for (const [formId, rejections] of byForm.entries()) {
    if (rejections.length < THRESHOLD) continue;
    const score = Math.min(100, 40 + rejections.length * 15);
    // Same reasoning as approvalPending48h.js: without naming the form,
    // two simultaneous rejection-spike recommendations read identically.
    const form = formId !== "unknown" ? await forms.find(formId) : null;
    results.push(
      await upsertRecommendation({
        accountId,
        rule: ID,
        priority: PRIORITY.MEDIUM,
        score,
        title: form ? `Repeated approval rejections — ${form.name}` : "Repeated approval rejections",
        reason: `${rejections.length} responses to this form were rejected in the last ${WINDOW_DAYS} days.`,
        suggestedAction: "Review the form's questions and the approver assigned to this workflow step.",
        actions: [{ id: "review-workflow", label: "Review Workflow" }],
        entityType: "form",
        entityId: formId,
        payload: { formId, count: rejections.length },
      })
    );
  }
  return results;
}

module.exports = { id: ID, run };
