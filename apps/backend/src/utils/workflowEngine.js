// Sequential multi-step approval workflow attached to form responses
// (Employee → Manager → HR style routing). Approvers are resolved
// dynamically against the tenant's current team for role-based steps, so
// promoting/demoting someone doesn't require touching in-flight responses.

// A step's `approvers` is a list of { type: "role"|"user", value }.
// "role" resolves to every tenant account with that authRole; "user"
// resolves to exactly one account id. `mode: "all"` requires every
// resolved approver to approve (parallel/unanimous); `mode: "any"`
// advances on the first approval (parallel/first-wins).
function resolveApprovers(step, tenantAccounts) {
  const ids = new Set();
  for (const a of step.approvers || []) {
    if (a.type === "user") {
      ids.add(a.value);
    } else if (a.type === "role") {
      tenantAccounts.filter((acc) => acc.authRole === a.value).forEach((acc) => ids.add(acc.id));
    }
  }
  // The tenant owner (authRole "admin") can always approve/reject, on every
  // step of every form's workflow — regardless of who was explicitly picked
  // as an approver — so they're never locked out of their own team's queue.
  tenantAccounts.filter((acc) => acc.authRole === "admin").forEach((acc) => ids.add(acc.id));
  return [...ids];
}

// Snapshotted onto the response at submission time — later edits to the
// form's workflow config don't retroactively change an in-flight approval.
function buildSnapshot(workflowConfig) {
  return {
    steps: (workflowConfig.steps || []).map((s) => ({
      id: s.id,
      name: s.name,
      mode: s.mode === "any" ? "any" : "all",
      approvers: s.approvers || [],
      autoApprove: !!s.autoApprove,
      escalateAfterHours: s.escalateAfterHours || null,
      escalateTo: s.escalateTo || null,
      escalated: false,
    })),
    currentStep: 0,
    status: "pending",
    history: [],
    stepStartedAt: new Date().toISOString(),
  };
}

// Skips leading/consecutive steps flagged autoApprove. Mutates and returns
// the snapshot; marks the workflow "approved" once every step clears.
function autoAdvance(snapshot) {
  while (snapshot.status === "pending" && snapshot.currentStep < snapshot.steps.length) {
    const step = snapshot.steps[snapshot.currentStep];
    if (!step.autoApprove) break;
    snapshot.history.push({
      stepIndex: snapshot.currentStep,
      stepName: step.name,
      actorId: null,
      actorName: "System",
      action: "auto-approve",
      comment: "",
      at: new Date().toISOString(),
    });
    snapshot.currentStep += 1;
    snapshot.stepStartedAt = new Date().toISOString();
  }
  if (snapshot.currentStep >= snapshot.steps.length) snapshot.status = "approved";
  return snapshot;
}

function currentApprovers(snapshot, tenantAccounts) {
  if (snapshot.status !== "pending") return [];
  const step = snapshot.steps[snapshot.currentStep];
  if (!step) return [];
  return resolveApprovers(step, tenantAccounts);
}

// Records a decision from `actorId` on the response's current step, then
// advances (or rejects) the workflow as needed. Mutates and returns the
// snapshot; throws (caller should turn this into a 403) if the actor isn't
// an eligible approver of the current step or already voted on it.
function applyDecision(snapshot, { actorId, actorName, action, comment }, tenantAccounts) {
  if (snapshot.status !== "pending") throw new Error("This workflow has already finished.");
  const stepIndex = snapshot.currentStep;
  const step = snapshot.steps[stepIndex];
  if (!step) throw new Error("No active step.");
  const approverIds = resolveApprovers(step, tenantAccounts);
  if (!approverIds.includes(actorId)) throw new Error("You are not an approver for this step.");

  const alreadyVoted = snapshot.history.some((h) => h.stepIndex === stepIndex && h.actorId === actorId);
  if (alreadyVoted) throw new Error("You've already recorded a decision on this step.");

  snapshot.history.push({ stepIndex, stepName: step.name, actorId, actorName, action, comment: comment || "", at: new Date().toISOString() });

  if (action === "reject") {
    snapshot.status = "rejected";
    return snapshot;
  }

  const approvesThisStep = snapshot.history.filter((h) => h.stepIndex === stepIndex && h.action === "approve");
  const shouldAdvance = step.mode === "any" ? approvesThisStep.length >= 1 : approverIds.every((id) => approvesThisStep.some((v) => v.actorId === id));

  if (shouldAdvance) {
    snapshot.currentStep += 1;
    snapshot.stepStartedAt = new Date().toISOString();
    autoAdvance(snapshot);
  }
  return snapshot;
}

// Adds the step's escalation approver into the pool once the step has sat
// idle past `escalateAfterHours`. No cron is wired up in this repo — call
// this from a scheduled trigger (Vercel Cron, etc.) or the manual
// check-escalations endpoint. Mutates and returns the snapshot; returns it
// unchanged (no-op) if nothing is overdue.
function applyEscalations(snapshot) {
  if (snapshot.status !== "pending") return snapshot;
  const step = snapshot.steps[snapshot.currentStep];
  if (!step || !step.escalateAfterHours || step.escalated || !step.escalateTo) return snapshot;
  const dueMs = step.escalateAfterHours * 3600 * 1000;
  if (Date.now() - new Date(snapshot.stepStartedAt).getTime() < dueMs) return snapshot;

  step.approvers = [...step.approvers, step.escalateTo];
  step.escalated = true;
  snapshot.history.push({
    stepIndex: snapshot.currentStep,
    stepName: step.name,
    actorId: null,
    actorName: "System",
    action: "escalate",
    comment: `No decision after ${step.escalateAfterHours}h — escalated.`,
    at: new Date().toISOString(),
  });
  return snapshot;
}

module.exports = { resolveApprovers, buildSnapshot, autoAdvance, currentApprovers, applyDecision, applyEscalations };
