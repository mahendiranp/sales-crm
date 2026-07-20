# Events

The Event Engine (`src/services/eventEngine.js`) is the durable, append-only
log that every business action in the backend writes to, via `recordEvent()`.
It's Phase 1 of the AI Observer — nothing reads or reacts to these events
yet; today the only job is making sure every meaningful action produces a
record of what happened, to whom, and when.

Events are stored in the `events` MongoDB collection, insert-only (nothing
ever updates or deletes an event once written).

## Schema

```jsonc
{
  "id": "uuid",
  "version": 1,                    // event schema version — see "Versioning" below
  "correlationId": "uuid",         // links events from the same business process; defaults to entityId
  "accountId": "uuid",             // tenant this event belongs to
  "type": "form.submitted",        // see "Event types" below
  "source": "forms",               // subsystem that emitted it — see EVENT_SOURCES
  "severity": "info",              // "info" | "warning" | "critical"
  "entityType": "response",        // the kind of record this event is about
  "entityId": "uuid",              // that record's id
  "actorId": "uuid | null",        // the user who triggered it, or null for unauthenticated actions
  "actorName": "string | null",
  "payload": {},                   // event-specific details — see table below
  "metadata": {},                  // request context (ip, userAgent) where available
  "createdAt": "2026-07-19T12:00:00.000Z"
}
```

## Event types

| Type | Source | Entity | Triggered by | Payload |
|---|---|---|---|---|
| `form.created` | `forms` | `form` | Creating a form | `{ name }` |
| `form.updated` | `forms` | `form` | Editing, publishing, or unpublishing a form | `{ name, status }` |
| `form.deleted` | `forms` | `form` | Deleting a form | `{ name }` |
| `response.created` | `forms` | `response` | A respondent submits a form | `{ formId, formName, referenceId }` |
| `response.deleted` | `forms` | `response` | Deleting a submitted response | `{ formId }` |
| `approval.pending` | `forms` | `response` | A submitted response enters an approval workflow | `{ formId, formName }` |
| `approval.approved` | `forms` | `response` | An approver approves a response's workflow | `{ formId, comment }` |
| `approval.rejected` | `forms` | `response` | An approver rejects a response's workflow (severity: `warning`) | `{ formId, comment }` |
| `lead.created` | `forms` | `lead` | A form configured with "create lead on submit" is submitted | `{ formId, formName, name, email }` |
| `task.created` / `.updated` / `.deleted` | `tasks` | `task` | Task CRUD (`crudFactory.js`) | — |
| `contact.created` / `.updated` / `.deleted` | `contacts` | `contact` | Contact CRUD | — |
| `company.created` / `.updated` / `.deleted` | `companies` | `company` | Company CRUD | — |
| `activity.created` / `.updated` / `.deleted` | `activities` | `activity` | Activity CRUD | — |
| `template.created` / `.updated` / `.deleted` | `templates` | `template` | Template CRUD | — |
| `user.created` / `.updated` / `.deleted` | `users` | `user` | User CRUD | — |
| `team.created` / `.updated` / `.deleted` | `teams` | `team` | Team CRUD | — |
| `invoice.created` / `.updated` / `.deleted` | `invoices` | `invoice` | Invoice CRUD | — |
| `expense.created` / `.updated` / `.deleted` | `expenses` | `expense` | Expense CRUD | — |
| `document.created` / `.updated` / `.deleted` | `documents` | `document` | Document CRUD | — |
| `payment.success` | `payments` | `payment` | A Razorpay payment is verified and the plan is upgraded | `{ plan, amountInPaise, razorpayOrderId }` |

The generic `{entity}.created/updated/deleted` types above are produced by a
single code path (`routes/crudFactory.js`) shared by every module mounted
through `routes/simpleModules.js` — new modules added there automatically
get event coverage with no extra code.

## Example

```json
{
  "id": "5b1e3c2a-...",
  "version": 1,
  "correlationId": "a7f0d9e1-...",
  "accountId": "acc_123",
  "type": "approval.pending",
  "source": "forms",
  "severity": "info",
  "entityType": "response",
  "entityId": "a7f0d9e1-...",
  "actorId": null,
  "actorName": null,
  "payload": { "formId": "f_456", "formName": "Vendor Onboarding" },
  "metadata": { "ip": "203.0.113.7", "userAgent": "Mozilla/5.0 ..." },
  "createdAt": "2026-07-19T09:12:44.001Z"
}
```

## Correlation

Events that are part of the same business process share a `correlationId`.
For example, submitting a form that both requires approval and is
configured to auto-create a lead produces three events — `response.created`,
`approval.pending`, and `lead.created` — all carrying the submitted
response's id as `correlationId`, even though the lead has a different
`entityId`. This lets a future consumer reconstruct the whole chain
(`form submitted → approval pending → lead created`) instead of seeing three
unrelated rows.

If a caller doesn't pass `correlationId` explicitly, it defaults to the
event's own `entityId` — a standalone action (e.g. creating a task) doesn't
need to think about correlation at all.

## Versioning

`version` is bumped only when an existing event `type`'s payload shape
changes in a backwards-incompatible way (a field renamed or repurposed, not
just a field added). A consumer reading old and new events from the same
collection can branch on `version` instead of guessing a payload's shape
from `createdAt`.

## Adding a new event

1. Add the type to `EVENT_TYPES` in `src/services/eventEngine.js`.
2. Add the source to `EVENT_SOURCES` if it's a new subsystem.
3. Call `recordEvent({...})` right after the action it describes commits —
   never before, and never let its failure affect the action's own response
   (it can't throw; see the function's doc comment).
4. Document it in the table above.
