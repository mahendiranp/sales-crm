# Feature Status

Ground truth for what each module actually does today, so specs, tests, and roadmap discussions stay anchored to the real product instead of drifting toward what a mockup implies. Split into three tiers per module:

- **Implemented** — real, working, covered by tests.
- **Planned** — named, scoped, not built. Safe to write specs *against a design*, not tests against code.
- **Out of Scope** — explicitly not on the roadmap; don't propose it as "next."

Update this file whenever a module's status changes — it's the single source of truth for "does X exist," not a mockup or a Gherkin scenario.

---

## CRM (Leads, Contacts, Companies, Deals)

**Implemented**
- Lead CRUD, duplicate detection (phone/email), AI scoring, convert to Contact (+ auto/linked Company)
- Contacts, Companies, Deals CRUD
- Lead search (table's own search box, name/mobile substring)
- Lead assignment: select a **User** (directory record, see below), Save, Timeline entry, owner updated, assignee notified by email

**Planned**
- User `Status` (Active/Inactive) — assignment picker should only list Active users once this exists
- Deal linked directly to a Lead (currently: convert Lead → Contact, then create Deal against that Contact — there's no `leadId` field on Deal)
- Company detail/relationship view (Contacts/Leads/Deals/Meetings tied to one company) — Companies is currently a flat card grid with no detail page

**Out of Scope**
- CRM workflow automation (see Workflow section below)
- AI recommendation for unassigned leads (see AI Center section below)
- Email campaigns, telephony, marketing automation

---

## Users vs Team Access

Two genuinely separate modules, easy to conflate:

| Module | Backend | Purpose | Login? |
|---|---|---|---|
| **Users** (`/app/users`, `/api/users`) | `crudRouter("users")` | Lightweight directory — name, email, phone, role. Used for lead assignment and (in Meetings/Tasks) as the assignee/participant picker. | No — not an account, can't log in. |
| **Team Access** (`/app/team`, `/api/auth/team`) | `routes/auth.js`, owner-only | Real workspace members — email + password, `permission` (view/edit/full), can log in and act in the app. | Yes. |

**Requirement wording going forward:** *"Lead owner must reference a record from Users."* Not "must reference Team Access" — those are different collections with independently-generated ids; nothing links them today.

---

## Tasks

**Implemented**
- CRUD, soft delete, List + Kanban views, due-date coloring, quick actions
- Comments (threaded, @mention by first name), Checklist, Subtasks
- Assignee picker sourced from Users (same directory as Lead assignment)
- Timeline integration (task.created/updated/status_changed/deleted, comment.created)

**Planned**
- (none currently scoped)

**Out of Scope**
- Recurring tasks, task dependencies, time tracking, attachments, AI assistant — all previously requested, all need infrastructure this app doesn't have yet (scheduler, file storage, or an LLM integration)

---

## Meetings

**Implemented**
- CRUD, soft delete, List + Agenda view, full Month/Week/Day calendar UI
- Participants (invite, accept/decline own invite)
- Notes, action items (creates a real linked Task)
- "Related To" — Lead, Deal, Contact, Company, or Task (not Lead-only)
- Meeting Outcome field, online meeting URL + Join button
- Timeline integration for every mutation

**Planned**
- (none currently scoped)

**Out of Scope**
- Reminders (no scheduler/cron in this app)
- Recurring meetings (no recurrence-rule engine, same scheduler gap)
- Attachments (file storage decision deferred, same as Task Attachments)
- AI meeting summary / AI-suggested action items (no LLM wired into this flow)
- Calendar sync (Google/Outlook/ICS) — needs OAuth + external API integration

---

## Timeline

**Implemented**
- Central `events` collection, generic `GET /api/events` (type/entityType/source/actorId/date-range/search filters, pagination)
- Every module above writes real events on mutation — nothing simulated
- Newest-first ordering, day-grouped UI, entity links back to the source record

**Planned**
- (none currently scoped — this module is essentially complete for its current purpose)

**Out of Scope**
- AI-generated summaries of a timeline/thread

---

## AI Center (Rule Engine + Recommendations)

**Implemented**
- Deterministic Rule Engine (explicitly not AI/LLM-based) — one rule module per check
- Existing rules: `approvalPending48h`, `approvalRejectionSpike` (both Forms/workflow-approval related)
- Recommendation API: open/resolve/dismiss, bulk actions, business health score with trend

**Planned**
- Rule: *unassigned leads older than N days → recommend assigning an owner, auto-resolves once assigned.* Named and scoped, not built — don't write tests against it until a rule file exists in `services/rules/`.

**Out of Scope**
- Any actual AI/LLM-driven recommendation generation (the name "AI Center" is aspirational branding; the engine itself is rule-based, not model-based)

---

## Workflow

**Implemented**
- Form approval workflows only (`workflowEngine.js`) — a form submission can require sequential/parallel approval steps, tracked via events

**Planned**
- (none currently scoped)

**Out of Scope**
- CRM automation of any kind (e.g. "Lead Assigned → Send Notification → Create Task → Notify Manager"). There is no CRM workflow/automation module — don't describe a CRM action as "triggers a workflow" until this exists.
