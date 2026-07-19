// Read/lifecycle API for recommendations produced by the Rule Engine
// (services/ruleEngine.js) — the surface the AI Center dashboard calls.
// There's no POST here: recommendations are only ever created by
// evaluateRules(), never directly by a client.
const express = require("express");
const { randomUUID: uuid } = require("crypto");
const { collection, scopedCollection } = require("../db/store");
const { resolveRecommendation, dismissRecommendation, getLastScan, STATUS, PRIORITY } = require("../services/ruleEngine");
const { currentApprovers } = require("../utils/workflowEngine");
const emailClient = require("../integrations/emailClient");
const { emailLayout } = require("../utils/emailTemplate");

const router = express.Router();
const recommendationsFor = (req) => scopedCollection("recommendations", req.user.accountId);
const rawForms = collection("forms");
const rawResponses = collection("form_responses");
const rawEvents = collection("events");
const accounts = collection("accounts");
const healthSnapshots = collection("health_snapshots");

// How much each open recommendation's priority costs the score, out of a
// 100 starting point. Deliberately simple (a fixed per-priority penalty,
// not weighted by age/count) — this is meant to be a fast, legible signal
// ("what's roughly on fire today"), not a precise model; it can grow more
// dimensions (failed payments, overdue tasks, form completion) once rules
// covering those actually exist, same reasoning as ruleEngine.js not
// building rules for events that don't exist yet.
const HEALTH_PENALTY = Object.freeze({ CRITICAL: 20, HIGH: 10, MEDIUM: 5, LOW: 2, INFO: 0 });

const dateStr = (d) => d.toISOString().slice(0, 10); // "YYYY-MM-DD", UTC — a fixed reference point, same reasoning as ISO-string timestamps elsewhere in this codebase (see eventEngine.js).
const todayStr = () => dateStr(new Date());
const yesterdayStr = () => {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - 1);
  return dateStr(d);
};

// Records today's score/counts as a durable point-in-time snapshot — the
// only way to answer "did this improve since yesterday" without an
// external metrics store. There's no scheduled job (see ruleEngine.js's
// doc comment on the same gap): today's snapshot is written/refreshed on
// whichever request happens to be the first GET /health of the day, and
// stays fixed for the rest of that day since later calls just update the
// same date-keyed row. One snapshot per (accountId, date) — never
// deleted, so a trend for any past day this feature has existed can later
// be computed the same way.
async function recordHealthSnapshot(accountId, snapshot) {
  const today = todayStr();
  const existing = (await healthSnapshots.query((s) => s.accountId === accountId && s.date === today))[0];
  if (existing) {
    return healthSnapshots.update(existing.id, snapshot);
  }
  return healthSnapshots.insert({ id: uuid(), accountId, date: today, ...snapshot, createdAt: new Date().toISOString() });
}

// GET /api/recommendations/health — the number the AI Center's header
// widget and the main dashboard's "AI Insights" card both read. Mounted
// ahead of GET /:id so "health" is never mistaken for a recommendation id.
router.get("/health", async (req, res) => {
  const all = await recommendationsFor(req).all();
  const open = all.filter((r) => r.status === STATUS.OPEN);
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const resolvedToday = all.filter((r) => r.status === STATUS.RESOLVED && r.resolvedAt && new Date(r.resolvedAt) >= startOfToday);

  const penalty = open.reduce((sum, r) => sum + (HEALTH_PENALTY[r.priority] || 0), 0);
  const score = Math.max(0, 100 - penalty);
  const resolvedTodayCount = resolvedToday.length;

  await recordHealthSnapshot(req.user.accountId, { score, openCount: open.length, resolvedTodayCount });
  const yesterday = (await healthSnapshots.query((s) => s.accountId === req.user.accountId && s.date === yesterdayStr()))[0];
  // null (not zeros) when there's no snapshot from yesterday yet — the
  // frontend treats that as "no trend to show" rather than a real "+N"
  // improvement from a baseline that never actually existed.
  const trend = yesterday
    ? { scoreDelta: score - yesterday.score, resolvedTodayDelta: resolvedTodayCount - (yesterday.resolvedTodayCount || 0) }
    : null;

  res.json({
    score,
    openCount: open.length,
    criticalCount: open.filter((r) => r.priority === PRIORITY.CRITICAL).length,
    highCount: open.filter((r) => r.priority === PRIORITY.HIGH).length,
    resolvedTodayCount,
    trend,
    lastScanAt: await getLastScan(req.user.accountId),
  });
});

// "score"/"score_asc" (highest/lowest risk) surface the most or least
// severe thing first — what an AI Center landing view wants by default.
// "newest"/"oldest" triage by when something happened instead of how
// severe it is. "updated" surfaces whatever's had the most recent
// activity (a refresh from the rule engine, a decision) — useful for
// "what changed since I last looked" rather than "what's oldest/riskiest".
const SORT_OPTIONS = Object.freeze({
  score: { score: -1, createdAt: -1 },
  score_asc: { score: 1, createdAt: -1 },
  newest: { createdAt: -1 },
  oldest: { createdAt: 1 },
  updated: { updatedAt: -1, createdAt: -1 },
});

// GET /api/recommendations?page=&limit=&status=&priority=&search=&sort=
// Defaults to OPEN recommendations, highest score first — that's the list
// an "AI Center" landing view wants by default. Pass status=ALL to see
// everything (resolved/dismissed included), or a specific status.
router.get("/", async (req, res) => {
  const { page = 1, limit = 50, status = STATUS.OPEN, priority, search, sort = "score" } = req.query;

  if (status && status !== "ALL" && !Object.values(STATUS).includes(status)) {
    return res.status(400).json({ error: `status must be one of: ALL, ${Object.values(STATUS).join(", ")}` });
  }
  if (priority && !Object.values(PRIORITY).includes(priority)) {
    return res.status(400).json({ error: `priority must be one of: ${Object.values(PRIORITY).join(", ")}` });
  }
  if (sort && !SORT_OPTIONS[sort]) {
    return res.status(400).json({ error: `sort must be one of: ${Object.keys(SORT_OPTIONS).join(", ")}` });
  }

  const filter = {};
  if (status !== "ALL") filter.status = status;
  if (priority) filter.priority = priority;
  // Store's Mongo filter is passed straight through by paginate(), so a
  // case-insensitive regex works the same way search does elsewhere in
  // this codebase (e.g. leads/deals search) — no extra query-building
  // layer needed for a single free-text field.
  if (search) {
    const escaped = String(search).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    filter.$or = [{ title: { $regex: escaped, $options: "i" } }, { reason: { $regex: escaped, $options: "i" } }];
  }

  const result = await recommendationsFor(req).paginate({ filter, page, limit, sort: SORT_OPTIONS[sort] });
  res.json(result);
});

router.get("/:id", async (req, res) => {
  const recommendation = await recommendationsFor(req).find(req.params.id);
  if (!recommendation) return res.status(404).json({ error: "Not found" });
  res.json(recommendation);
});

// GET /api/recommendations/:id/details — backs the AI Center's "View
// Details" drawer: the event timeline for this recommendation's business
// process (every event sharing its entityId's correlationId — see
// eventEngine.js), the recommendation's own status history, and whatever
// related record it's actually about (a response's workflow/audit trail,
// or a form's basic info). Deliberately a separate endpoint rather than
// bloating GET /:id's response — the list view never needs this, only the
// drawer does.
router.get("/:id/details", async (req, res) => {
  const recommendation = await recommendationsFor(req).find(req.params.id);
  if (!recommendation) return res.status(404).json({ error: "Not found" });

  const timeline = (await rawEvents.query((e) => e.accountId === req.user.accountId && e.correlationId === recommendation.entityId)).sort(
    (a, b) => new Date(a.createdAt) - new Date(b.createdAt)
  );

  let related = null;
  if (recommendation.entityType === "response") {
    const response = await rawResponses.find(recommendation.entityId);
    if (response) {
      related = {
        type: "response",
        id: response.id,
        formId: response.formId,
        referenceId: response.referenceId,
        submittedAt: response.submittedAt,
        // Audit trail of who approved/rejected what and when — never the
        // encrypted answers themselves, which this drawer has no need for.
        workflow: response.workflow
          ? { status: response.workflow.status, currentStep: response.workflow.currentStep, history: response.workflow.history }
          : null,
      };
    }
  } else if (recommendation.entityType === "form") {
    const form = await rawForms.find(recommendation.entityId);
    if (form) related = { type: "form", id: form.id, name: form.name, status: form.status };
  }

  res.json({ recommendation, timeline, related });
});

// req.user (the JWT payload) only carries id/email/authRole/etc — no
// display name — so this looks the account up for one, falling back to
// email if for some reason the account record doesn't have a name set.
async function actorDisplayName(req) {
  const account = await accounts.find(req.user.id);
  return account?.name || req.user.email;
}

// PATCH /api/recommendations/bulk/resolve and /bulk/dismiss — must be
// registered before the /:id/resolve and /:id/dismiss routes below, since
// Express matches "/bulk/resolve" against "/:id/resolve" just as readily
// (id="bulk") — registration order decides which one wins.
router.patch("/bulk/resolve", async (req, res) => {
  const ids = Array.isArray(req.body?.ids) ? req.body.ids : [];
  if (ids.length === 0) return res.status(400).json({ error: "ids must be a non-empty array." });
  const actorName = await actorDisplayName(req);
  const results = await Promise.all(ids.map((id) => resolveRecommendation(req.user.accountId, id, { actorName })));
  res.json({ updated: results.filter(Boolean).length, notFound: results.filter((r) => !r).length });
});

router.patch("/bulk/dismiss", async (req, res) => {
  const ids = Array.isArray(req.body?.ids) ? req.body.ids : [];
  if (ids.length === 0) return res.status(400).json({ error: "ids must be a non-empty array." });
  const actorName = await actorDisplayName(req);
  const reason = typeof req.body?.reason === "string" && req.body.reason.trim() ? req.body.reason.trim() : null;
  const results = await Promise.all(ids.map((id) => dismissRecommendation(req.user.accountId, id, { actorName, reason })));
  res.json({ updated: results.filter(Boolean).length, notFound: results.filter((r) => !r).length });
});

router.patch("/:id/resolve", async (req, res) => {
  const actorName = await actorDisplayName(req);
  const updated = await resolveRecommendation(req.user.accountId, req.params.id, { actorName });
  if (!updated) return res.status(404).json({ error: "Not found" });
  res.json(updated);
});

router.patch("/:id/dismiss", async (req, res) => {
  const actorName = await actorDisplayName(req);
  // Optional free-text reason, e.g. "Known issue, ignore." — shown on the
  // Dismissed tab's card so a dismissal reads as a decision, not just a
  // vanished recommendation.
  const reason = typeof req.body?.reason === "string" && req.body.reason.trim() ? req.body.reason.trim() : null;
  const updated = await dismissRecommendation(req.user.accountId, req.params.id, { actorName, reason });
  if (!updated) return res.status(404).json({ error: "Not found" });
  res.json(updated);
});

// Emails every current approver of the response's active workflow step a
// reminder — reuses the same approver-resolution (currentApprovers) and
// email layout the workflow decide/notify path already uses in
// routes/forms.js, just aimed at the approvers instead of the submitter.
async function notifyApprover(req, recommendation) {
  const response = await rawResponses.find(recommendation.entityId);
  // Two different situations were previously conflated behind one message
  // ("no longer exists"), which made a real deletion indistinguishable
  // from a response whose workflow was already resolved/cleared — worth
  // telling apart when debugging why a Notify Approver click did nothing.
  if (!response) return { ok: false, message: "This response has been deleted." };
  if (!response.workflow) return { ok: false, message: "This response no longer has an active approval workflow." };
  const form = await rawForms.find(recommendation.payload?.formId || response.formId);
  const tenantAccounts = (await accounts.all()).filter((a) => (a.accountId || a.id) === req.user.accountId);
  const approverIds = currentApprovers(response.workflow, tenantAccounts);
  const approvers = tenantAccounts.filter((a) => approverIds.includes(a.id) && a.email);

  if (approvers.length === 0) return { ok: false, message: "No approver with an email address was found for this step." };

  await Promise.all(
    approvers.map((approver) =>
      emailClient.sendMail({
        to: approver.email,
        subject: `Reminder: an approval is waiting on you${form ? ` — ${form.name}` : ""}`,
        html: emailLayout({
          preheader: "An approval has been waiting for a decision.",
          heading: "Approval reminder",
          bodyHtml: `<p>A response${form ? ` to <strong>${form.name}</strong>` : ""} has been waiting for your review for a while. Please take a look when you can.</p>`,
        }),
      })
    )
  );
  return { ok: true, message: `Notified ${approvers.length} approver(s).` };
}

// Rule-specific actions live here, keyed by the `id` each rule attaches to
// its recommendation's `actions` array (services/rules/*.js) — a new rule
// can introduce a new action id without this file changing, as long as it
// either maps to a handler here or is left for the frontend to render as
// informational-only (no handler needed for e.g. "review-workflow", which
// is just a prompt for a human to go look at something).
const ACTION_HANDLERS = { "notify-approver": notifyApprover };

// POST /api/recommendations/:id/actions/:actionId — executes one of a
// recommendation's rule-specific actions (see ACTION_HANDLERS). resolve/
// dismiss are NOT routed through here — they have their own REST verbs
// above since they mutate the recommendation itself, not the business
// record it's about.
router.post("/:id/actions/:actionId", async (req, res) => {
  const recommendation = await recommendationsFor(req).find(req.params.id);
  if (!recommendation) return res.status(404).json({ error: "Not found" });

  const handler = ACTION_HANDLERS[req.params.actionId];
  if (!handler) {
    return res.status(501).json({ error: `Action "${req.params.actionId}" isn't implemented yet.` });
  }
  try {
    const result = await handler(req, recommendation);
    res.json(result);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(`Recommendation action "${req.params.actionId}" failed for ${recommendation.id}:`, err);
    res.status(502).json({ error: "That action couldn't be completed — please try again." });
  }
});

module.exports = router;
