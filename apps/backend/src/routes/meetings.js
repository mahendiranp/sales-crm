// Meetings — core module: meetings, participants (accept/decline), notes,
// and CRM/Task linking. Deliberately NOT built this pass: reminders (needs
// a scheduler this app has none of — see ruleEngine.js's doc comment on
// the same gap), recurring meetings (recurrence-rule expansion is real
// complexity with no scheduler to drive it), and attachments (a storage
// decision deferred twice already for Task Attachments).
//
// "Meeting creates Tasks" needs no new endpoint here — routes/tasks.js's
// POST /api/tasks already accepts any entityType/entityId, so the
// frontend links an action-item task to a meeting the same way it already
// links a task to a lead (entityType: "meeting", entityId: meeting.id).
// Same reasoning for the Activity Timeline: every mutation below calls
// recordEvent() with entityType "meeting", so meetings show up in
// GET /api/events and the Timeline page with zero changes to either —
// that generic pipeline was the whole point of building it that way.
const express = require("express");
const { randomUUID: uuid } = require("crypto");
const { scopedCollection } = require("../db/store");
const { requireManager, requireFullAccess } = require("../middleware/auth");
const { collection, scopedCollection } = require("../db/store");
const { requirePermission } = require("../middleware/permissions");
const { recordEvent, EVENT_TYPES, EVENT_SOURCES } = require("../services/eventEngine");
const emailClient = require("../integrations/emailClient");
const { emailLayout } = require("../utils/emailTemplate");
const { tenantAccountsFor: tenantAccountsForId } = require("../utils/tenantAccounts");

const router = express.Router();
const meetingsFor = (req) => scopedCollection("meetings", req.user.accountId);
const participantsFor = (req) => scopedCollection("meeting_participants", req.user.accountId);
const notesFor = (req) => scopedCollection("meeting_notes", req.user.accountId);

const STATUSES = ["Scheduled", "In Progress", "Completed", "Cancelled", "No Show"];
// A fixed list plus "allow custom types" (per the spec) — anything else
// the client sends is accepted as-is rather than rejected, since there's
// no real harm in an arbitrary type string and rejecting it would be
// pure friction for zero benefit.
const COMMON_TYPES = ["Sales Demo", "Customer Call", "Internal Meeting", "Interview", "Training", "Support", "Review"];
const OUTCOMES = ["Successful", "Rescheduled", "Cancelled", "No Response", "Won", "Lost"];
const LINKABLE_ENTITY_TYPES = ["lead", "deal", "contact", "company", "task"];

const tenantAccountsFor = (req) => tenantAccountsForId(req.user.accountId);

// Best-effort — a missing/invalid email shouldn't block creating the
// meeting, same reasoning as tasks.js's notifyAssignee.
async function notifyParticipants(req, meeting, participantUserIds) {
  try {
    const tenantAccounts = await tenantAccountsFor(req);
    const recipients = tenantAccounts.filter((a) => participantUserIds.includes(a.id) && a.id !== req.user.id && a.email);
    // Fire-and-forget — the meeting is already created/updated; the caller
    // shouldn't wait on SMTP latency for a set of invite emails (same
    // reasoning as recommendations.js's notifyApprover).
    Promise.all(
      recipients.map((account) =>
        emailClient
          .sendMail({
            to: account.email,
            subject: `Meeting invite: ${meeting.title}`,
            html: emailLayout({
              preheader: "You've been invited to a meeting.",
              heading: "Meeting invite",
              bodyHtml: `<p><strong>${meeting.title}</strong></p><p>${new Date(meeting.scheduledStart).toLocaleString()}${
                meeting.location ? ` — ${meeting.location}` : ""
              }</p>${meeting.agenda ? `<p>${meeting.agenda}</p>` : ""}`,
            }),
          })
          .catch(() => {})
      )
    );
  } catch {
    // Notification is a nice-to-have — meeting creation already succeeded.
  }
}

// GET /api/meetings?status=&meetingType=&linkedEntityType=&linkedEntityId=&search=&from=&to=&page=&limit=&sort=
router.get("/", async (req, res) => {
  const { status, meetingType, linkedEntityType, linkedEntityId, search, from, to, page, limit, sort } = req.query;

  if (status && status !== "ALL" && !STATUSES.includes(status)) {
    return res.status(400).json({ error: `status must be one of: ALL, ${STATUSES.join(", ")}` });
  }

  const filter = { deletedAt: null };
  if (status && status !== "ALL") filter.status = status;
  if (meetingType) filter.meetingType = meetingType;
  if (linkedEntityType) filter.linkedEntityType = linkedEntityType;
  if (linkedEntityId) filter.linkedEntityId = linkedEntityId;
  if (from || to) {
    filter.scheduledStart = {};
    if (from) filter.scheduledStart.$gte = from;
    if (to) filter.scheduledStart.$lt = to;
  }
  if (search) {
    const escaped = String(search).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    filter.$or = [{ title: { $regex: escaped, $options: "i" } }, { description: { $regex: escaped, $options: "i" } }];
  }

  const sortSpec = sort === "newest" ? { scheduledStart: -1 } : { scheduledStart: 1 };

  if (page) {
    const result = await meetingsFor(req).paginate({ filter, page, limit, sort: sortSpec });
    return res.json(result);
  }
  // No page param: full array (calendar views need every meeting in a
  // date range at once, not a page of them) — same opt-in pagination
  // contract as crudFactory.js and tasks.js.
  const all = await meetingsFor(req).query((m) => m.deletedAt == null);
  const matchesFilter = (m) =>
    (!filter.status || m.status === filter.status) &&
    (!meetingType || m.meetingType === meetingType) &&
    (!linkedEntityType || m.linkedEntityType === linkedEntityType) &&
    (!linkedEntityId || m.linkedEntityId === linkedEntityId) &&
    (!from || m.scheduledStart >= from) &&
    (!to || m.scheduledStart < to);
  res.json(all.filter(matchesFilter).sort((a, b) => new Date(a.scheduledStart) - new Date(b.scheduledStart)));
});

router.get("/meta/types", async (req, res) => {
  const all = await meetingsFor(req).all();
  const customTypes = [...new Set(all.map((m) => m.meetingType).filter((t) => t && !COMMON_TYPES.includes(t)))];
  res.json({ commonTypes: COMMON_TYPES, customTypes });
});

router.get("/meta/outcomes", (req, res) => res.json(OUTCOMES));

router.get("/:id", async (req, res) => {
  const meeting = await meetingsFor(req).find(req.params.id);
  if (!meeting || meeting.deletedAt) return res.status(404).json({ error: "Not found" });
  res.json(meeting);
});

router.post("/", requirePermission("meetings.create"), async (req, res) => {
  const {
    title,
    description,
    agenda,
    scheduledStart,
    scheduledEnd,
    timezone,
    location,
    meetingUrl,
    meetingType,
    linkedEntityType,
    linkedEntityId,
    participantIds,
  } = req.body;
  if (!title || !title.trim()) return res.status(400).json({ error: "Title is required." });
  if (!scheduledStart) return res.status(400).json({ error: "scheduledStart is required." });
  if (linkedEntityType && !LINKABLE_ENTITY_TYPES.includes(linkedEntityType)) {
    return res.status(400).json({ error: `linkedEntityType must be one of: ${LINKABLE_ENTITY_TYPES.join(", ")}` });
  }

  const meeting = {
    id: uuid(),
    title: title.trim(),
    description: description || "",
    agenda: agenda || "",
    status: "Scheduled",
    outcome: null,
    scheduledStart,
    scheduledEnd: scheduledEnd || scheduledStart,
    timezone: timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
    location: location || "",
    meetingUrl: meetingUrl || "",
    meetingType: meetingType || "Internal Meeting",
    ownerId: req.user.id,
    createdBy: req.user.id,
    linkedEntityType: linkedEntityType || null,
    linkedEntityId: linkedEntityId || null,
    deletedAt: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  await meetingsFor(req).insert(meeting);

  // Organizer is always a participant, already "Accepted" (they scheduled
  // it) — everyone else invited starts "Pending" until they respond.
  const uniqueParticipantIds = [...new Set([req.user.id, ...(Array.isArray(participantIds) ? participantIds : [])])];
  await Promise.all(
    uniqueParticipantIds.map((userId) =>
      participantsFor(req).insert({
        id: uuid(),
        meetingId: meeting.id,
        userId,
        role: userId === req.user.id ? "organizer" : "attendee",
        response: userId === req.user.id ? "Accepted" : "Pending",
        createdAt: new Date().toISOString(),
      })
    )
  );

  await recordEvent({
    accountId: req.user.accountId,
    type: EVENT_TYPES.MEETING_CREATED,
    entityType: "meeting",
    entityId: meeting.id,
    actorId: req.user.id,
    actorName: req.user.email,
    source: EVENT_SOURCES.MEETINGS,
    payload: {
      title: meeting.title,
      scheduledStart: meeting.scheduledStart,
      linkedEntityType: meeting.linkedEntityType,
      linkedEntityId: meeting.linkedEntityId,
    },
  });
  await notifyParticipants(req, meeting, uniqueParticipantIds);

  res.status(201).json({ ...meeting, accountId: req.user.accountId });
});

router.patch("/:id", requirePermission("meetings.edit"), async (req, res) => {
  const existing = await meetingsFor(req).find(req.params.id);
  if (!existing || existing.deletedAt) return res.status(404).json({ error: "Not found" });

  const {
    title,
    description,
    agenda,
    status,
    outcome,
    scheduledStart,
    scheduledEnd,
    timezone,
    location,
    meetingUrl,
    meetingType,
    linkedEntityType,
    linkedEntityId,
  } = req.body;
  if (status && !STATUSES.includes(status)) {
    return res.status(400).json({ error: `status must be one of: ${STATUSES.join(", ")}` });
  }
  if (outcome && !OUTCOMES.includes(outcome)) {
    return res.status(400).json({ error: `outcome must be one of: ${OUTCOMES.join(", ")}` });
  }
  if (linkedEntityType && !LINKABLE_ENTITY_TYPES.includes(linkedEntityType)) {
    return res.status(400).json({ error: `linkedEntityType must be one of: ${LINKABLE_ENTITY_TYPES.join(", ")}` });
  }

  const patch = {};
  if (title !== undefined) patch.title = title;
  if (description !== undefined) patch.description = description;
  if (agenda !== undefined) patch.agenda = agenda;
  if (status !== undefined) patch.status = status;
  if (outcome !== undefined) patch.outcome = outcome;
  if (scheduledStart !== undefined) patch.scheduledStart = scheduledStart;
  if (scheduledEnd !== undefined) patch.scheduledEnd = scheduledEnd;
  if (timezone !== undefined) patch.timezone = timezone;
  if (location !== undefined) patch.location = location;
  if (meetingUrl !== undefined) patch.meetingUrl = meetingUrl;
  if (meetingType !== undefined) patch.meetingType = meetingType;
  if (linkedEntityType !== undefined) patch.linkedEntityType = linkedEntityType;
  if (linkedEntityId !== undefined) patch.linkedEntityId = linkedEntityId;

  const updated = await meetingsFor(req).update(req.params.id, patch);

  if (status !== undefined && status !== existing.status) {
    await recordEvent({
      accountId: req.user.accountId,
      type: EVENT_TYPES.MEETING_STATUS_CHANGED,
      entityType: "meeting",
      entityId: req.params.id,
      actorId: req.user.id,
      actorName: req.user.email,
      source: EVENT_SOURCES.MEETINGS,
      payload: { from: existing.status, to: status, title: existing.title },
    });
  }
  const changedOtherFields = Object.keys(patch).some((k) => k !== "status" && patch[k] !== existing[k]);
  if (changedOtherFields) {
    await recordEvent({
      accountId: req.user.accountId,
      type: EVENT_TYPES.MEETING_UPDATED,
      entityType: "meeting",
      entityId: req.params.id,
      actorId: req.user.id,
      actorName: req.user.email,
      source: EVENT_SOURCES.MEETINGS,
      payload: { title: updated.title, fields: Object.keys(patch).filter((k) => k !== "status") },
    });
  }

  res.json(updated);
});

router.delete("/:id", requirePermission("meetings.delete"), async (req, res) => {
  const existing = await meetingsFor(req).find(req.params.id);
  if (!existing || existing.deletedAt) return res.status(404).json({ error: "Not found" });

  const updated = await meetingsFor(req).update(req.params.id, { deletedAt: new Date().toISOString() });
  await recordEvent({
    accountId: req.user.accountId,
    type: EVENT_TYPES.MEETING_DELETED,
    entityType: "meeting",
    entityId: req.params.id,
    actorId: req.user.id,
    actorName: req.user.email,
    source: EVENT_SOURCES.MEETINGS,
    payload: { title: existing.title },
  });
  res.json(updated);
});

// ---------------- PARTICIPANTS ----------------

router.get("/:id/participants", async (req, res) => {
  const meeting = await meetingsFor(req).find(req.params.id);
  if (!meeting) return res.status(404).json({ error: "Not found" });
  const list = await participantsFor(req).query((p) => p.meetingId === req.params.id);
  res.json(list);
});

router.post("/:id/participants", requirePermission("meetings.edit"), async (req, res) => {
  const meeting = await meetingsFor(req).find(req.params.id);
  if (!meeting) return res.status(404).json({ error: "Not found" });
  const { userId } = req.body;
  if (!userId) return res.status(400).json({ error: "userId is required." });

  const existingParticipants = await participantsFor(req).query((p) => p.meetingId === req.params.id);
  if (existingParticipants.some((p) => p.userId === userId)) {
    return res.status(409).json({ error: "That person is already invited." });
  }

  const participant = {
    id: uuid(),
    meetingId: req.params.id,
    userId,
    role: "attendee",
    response: "Pending",
    createdAt: new Date().toISOString(),
  };
  await participantsFor(req).insert(participant);
  await notifyParticipants(req, meeting, [userId]);
  res.status(201).json(participant);
});

// A participant accepting/declining their own invite — organizer-only
// actions (adding/removing people) go through requirePermission above;
// responding to your own invite doesn't need that permission level.
router.patch("/:id/participants/:participantId", async (req, res) => {
  const participant = await participantsFor(req).find(req.params.participantId);
  if (!participant || participant.meetingId !== req.params.id) return res.status(404).json({ error: "Not found" });
  if (participant.userId !== req.user.id && !req.user.isMasterAdmin) {
    return res.status(403).json({ error: "You can only respond to your own invite." });
  }
  const { response } = req.body;
  if (!["Accepted", "Declined", "Pending"].includes(response)) {
    return res.status(400).json({ error: "response must be Accepted, Declined, or Pending." });
  }

  const updated = await participantsFor(req).update(req.params.participantId, { response });
  await recordEvent({
    accountId: req.user.accountId,
    type: EVENT_TYPES.MEETING_PARTICIPANT_RESPONDED,
    entityType: "meeting",
    entityId: req.params.id,
    actorId: req.user.id,
    actorName: req.user.email,
    source: EVENT_SOURCES.MEETINGS,
    payload: { response },
  });
  res.json(updated);
});

// ---------------- NOTES ----------------
// Multiple timestamped entries (a running log), not one editable doc —
// matches the spec's user flow ("Notes Added" as its own timeline step)
// and the same append-only reasoning as task comments.

router.get("/:id/notes", async (req, res) => {
  const meeting = await meetingsFor(req).find(req.params.id);
  if (!meeting) return res.status(404).json({ error: "Not found" });
  const notes = await notesFor(req).query((n) => n.meetingId === req.params.id);
  res.json(notes.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt)));
});

router.post("/:id/notes", async (req, res) => {
  const meeting = await meetingsFor(req).find(req.params.id);
  if (!meeting) return res.status(404).json({ error: "Not found" });
  const { content } = req.body;
  if (!content || !content.trim()) return res.status(400).json({ error: "Note content is required." });

  const note = {
    id: uuid(),
    meetingId: req.params.id,
    content: content.trim(),
    createdBy: req.user.id,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  await notesFor(req).insert(note);
  await recordEvent({
    accountId: req.user.accountId,
    type: EVENT_TYPES.MEETING_NOTE_ADDED,
    entityType: "meeting",
    entityId: req.params.id,
    actorId: req.user.id,
    actorName: req.user.email,
    source: EVENT_SOURCES.MEETINGS,
    payload: { title: meeting.title },
  });
  res.status(201).json(note);
});

module.exports = router;
