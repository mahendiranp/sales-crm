// Event Engine — Phase 1 of the AI Observer. This is the durable,
// append-only log every business action writes to: form/response/workflow/
// task/payment mutations each call recordEvent() right after they commit.
// Nothing reads or reacts to these events yet (that's the Observer and
// Recommendation Center, built in later phases) — today the only job is to
// make sure every meaningful action in the product produces a record of
// what happened, to whom, and when, without ever being able to break the
// action that triggered it.
const { randomUUID: uuid } = require("crypto");
const { collection } = require("../db/store");

const events = collection("events");

// Bumped only if an existing event `type`'s payload shape changes in a way
// that isn't backwards-compatible (a field renamed or repurposed, not just
// added). Lets any future consumer branch on `event.version` instead of
// guessing a payload's shape from `createdAt`.
const EVENT_SCHEMA_VERSION = 1;

// Explicit allowlist of every event type the product currently emits,
// rather than accepting an arbitrary string — a typo'd type string would
// otherwise sit unnoticed in the collection forever, silently missing from
// whatever the AI Observer later groups/counts by.
const EVENT_TYPES = Object.freeze({
  FORM_CREATED: "form.created",
  FORM_UPDATED: "form.updated",
  FORM_DELETED: "form.deleted",
  RESPONSE_CREATED: "response.created",
  RESPONSE_UPDATED: "response.updated",
  RESPONSE_DELETED: "response.deleted",
  APPROVAL_PENDING: "approval.pending",
  APPROVAL_APPROVED: "approval.approved",
  APPROVAL_REJECTED: "approval.rejected",
  TASK_CREATED: "task.created",
  TASK_UPDATED: "task.updated",
  TASK_DELETED: "task.deleted",
  LEAD_CREATED: "lead.created",
  PAYMENT_SUCCESS: "payment.success",
});

// The subsystem an event originated from — lets the AI Observer filter its
// feed to "just forms" or "just billing" without having to parse `type`
// strings. Kept as an allowlist for the same typo-safety reason as
// EVENT_TYPES; extend this as new sources (webhooks, zapier, gmail, ...)
// actually get built, not speculatively ahead of them.
const EVENT_SOURCES = Object.freeze({
  FORMS: "forms",
  TASKS: "tasks",
  CONTACTS: "contacts",
  COMPANIES: "companies",
  ACTIVITIES: "activities",
  TEMPLATES: "templates",
  USERS: "users",
  TEAMS: "teams",
  INVOICES: "invoices",
  EXPENSES: "expenses",
  DOCUMENTS: "documents",
  PAYMENTS: "payments",
  API: "api",
});

// How urgently the AI Observer (Phase 2+) should surface this event.
// Assigned once, here, at emission time — by the module that already knows
// what happened, rather than re-derived later from `type` string matching.
const SEVERITY = Object.freeze({
  INFO: "info",
  WARNING: "warning",
  CRITICAL: "critical",
});

// Records one business event. Deliberately never throws: by the time a
// caller reaches this, the real business action (the form was saved, the
// payment was verified) has already committed, so a transient Mongo hiccup
// while logging it must not turn an otherwise-successful request into a 500
// for the user. Failures are logged for ops instead and `null` is returned
// so a caller can tell logging didn't happen, without needing a try/catch
// of their own.
//
// `correlationId` links events that belong to the same business process
// (e.g. a form submission that creates a response, puts it in someone's
// approval queue, and auto-creates a lead — all three should carry the same
// correlationId so the AI Observer can reconstruct the whole chain later,
// not just each event in isolation). Defaults to `entityId` so a caller
// that isn't part of a multi-step process doesn't need to think about it;
// pass it explicitly to thread a shared id across a chain of calls.
async function recordEvent({
  accountId,
  type,
  entityType,
  entityId,
  actorId = null,
  actorName = null,
  source = EVENT_SOURCES.API,
  severity = SEVERITY.INFO,
  correlationId,
  payload = {},
  metadata = {},
}) {
  if (!accountId || !type || !entityType || !entityId) {
    // eslint-disable-next-line no-console
    console.error("recordEvent called with missing required fields", { accountId, type, entityType, entityId });
    return null;
  }
  const event = {
    id: uuid(),
    version: EVENT_SCHEMA_VERSION,
    correlationId: correlationId || entityId,
    accountId,
    type,
    source,
    severity,
    entityType,
    entityId,
    actorId,
    actorName,
    payload,
    metadata,
    createdAt: new Date().toISOString(),
  };
  try {
    await events.insert(event);
    return event;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(`Failed to record event ${type} for ${entityType} ${entityId}:`, err);
    return null;
  }
}

module.exports = { recordEvent, EVENT_TYPES, EVENT_SOURCES, SEVERITY, EVENT_SCHEMA_VERSION };
