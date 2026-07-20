// Rule: an approval that's been sitting in "pending" for more than 48
// hours with no decision yet. A decision is recognized by an
// approval.approved/rejected event sharing the pending event's
// correlationId (they're the same response — see eventEngine.js's
// correlationId doc comment), so a since-resolved approval never gets
// flagged even though its approval.pending event is still sitting in the
// log (events are never deleted).
const { collection } = require("../../db/store");
const { currentApprovers } = require("../../utils/workflowEngine");
const { upsertRecommendation, resolveRecommendation, findOpenByRule, PRIORITY } = require("../recommendationStore");

const events = collection("events");
const responses = collection("form_responses");
const accounts = collection("accounts");

const ID = "approval.pending.48h";
const OVERDUE_HOURS = 48;

// Who the AI Center card should say is being waited on. Best-effort: a
// response or its workflow may already be gone by the time this runs (the
// response was deleted, or the workflow finished between the pending event
// firing and this rule evaluating) — in either case this just omits the
// name rather than failing the whole rule run over one recommendation's
// cosmetic detail.
async function resolveWaitingFor(accId, entityId) {
  const response = await responses.find(entityId);
  if (!response?.workflow) return null;
  const tenantAccounts = (await accounts.all()).filter((a) => (a.accountId || a.id) === accId);
  const approverIds = currentApprovers(response.workflow, tenantAccounts);
  const names = tenantAccounts.filter((a) => approverIds.includes(a.id)).map((a) => a.name || a.email);
  return names.length ? names.join(", ") : null;
}

async function run(accountId, now = Date.now()) {
  const all = await events.query((e) => e.accountId === accountId);
  const pendingEvents = all.filter((e) => e.type === "approval.pending");
  const approvedCorrelationIds = new Set(all.filter((e) => e.type === "approval.approved").map((e) => e.correlationId));
  const rejectedCorrelationIds = new Set(all.filter((e) => e.type === "approval.rejected").map((e) => e.correlationId));
  const decidedCorrelationIds = new Set([...approvedCorrelationIds, ...rejectedCorrelationIds]);

  // There's no scheduled job re-running rules on a timer (see ruleEngine.js) —
  // evaluateRules() only runs when a relevant event happens. So the moment a
  // decision is finally recorded is also the first opportunity to notice an
  // earlier "overdue" recommendation for that same response no longer
  // applies, and close it — otherwise it would sit OPEN forever once
  // resolved, since nothing else ever re-checks it.
  const openRecommendations = await findOpenByRule(accountId, ID);
  for (const rec of openRecommendations) {
    if (decidedCorrelationIds.has(rec.entityId)) {
      const reason = approvedCorrelationIds.has(rec.entityId) ? "Manager approved the request." : "Manager rejected the request.";
      await resolveRecommendation(accountId, rec.id, { actorName: "System", reason });
    }
  }

  const results = [];
  for (const pending of pendingEvents) {
    if (decidedCorrelationIds.has(pending.correlationId)) continue;
    const ageHours = (now - new Date(pending.createdAt).getTime()) / (1000 * 60 * 60);
    if (ageHours < OVERDUE_HOURS) continue;
    // Grows with age past the threshold so two overdue approvals can be
    // ranked against each other, not just bucketed into the same "HIGH"
    // priority — capped at 100 so a months-old approval doesn't dwarf
    // everything else the dashboard ever sorts it against.
    const score = Math.min(100, 50 + Math.floor(ageHours - OVERDUE_HOURS));
    const formName = pending.payload?.formName;
    const waitingFor = await resolveWaitingFor(accountId, pending.entityId);
    results.push(
      await upsertRecommendation({
        accountId,
        rule: ID,
        priority: PRIORITY.HIGH,
        score,
        // Naming the form is what makes two simultaneously-overdue
        // approvals distinguishable in the AI Center list — without it
        // every card reads identically ("Approval overdue" / "Waiting N
        // hours for a decision") no matter which response it's actually
        // about.
        title: formName ? `Approval overdue — ${formName}` : "Approval overdue",
        reason: `Waiting ${Math.floor(ageHours)} hours for a decision.`,
        suggestedAction: "Notify the assigned approver, or reassign the approval to someone available.",
        actions: [{ id: "notify-approver", label: "Notify Approver" }],
        entityType: "response",
        entityId: pending.entityId,
        payload: { formId: pending.payload?.formId, formName: pending.payload?.formName, ageHours: Math.floor(ageHours), waitingFor },
      })
    );
  }
  return results;
}

module.exports = { id: ID, run };
