// Task Management — Phase 1 of the Work module (Tasks -> Comments ->
// Attachments -> Activity Timeline -> Notifications -> Meetings -> Search,
// per the agreed build order). Superseding the old generic
// crudRouter("tasks") mount (see routes/simpleModules.js) with a real
// schema: assignee, priority, status, an optional link to another record
// (entityType/entityId — a lead, deal, form response, etc.), and soft
// delete.
//
// The "Activity Timeline" and "send a WebSocket event on every change"
// requirements from the spec are already solved by infrastructure this
// codebase has: every recordEvent() call here is timeline data (see
// GET /:id/timeline), and store.js's collection()/scopedCollection()
// already broadcast a "db:change" socket event on every insert/update —
// nothing extra needed for either.
const express = require("express");
const { randomUUID: uuid } = require("crypto");
const { collection, scopedCollection } = require("../db/store");
const { requireManager, requireFullAccess } = require("../middleware/auth");
const { recordEvent, EVENT_TYPES, EVENT_SOURCES } = require("../services/eventEngine");
const emailClient = require("../integrations/emailClient");
const { emailLayout } = require("../utils/emailTemplate");

const router = express.Router();
const tasksFor = (req) => scopedCollection("tasks", req.user.accountId);
const commentsFor = (req) => scopedCollection("task_comments", req.user.accountId);
const rawEvents = collection("events");
const accounts = collection("accounts");

const STATUSES = ["Todo", "In Progress", "Blocked", "Completed"];
const PRIORITIES = ["Low", "Medium", "High", "Critical"];

// Best-effort — a missing/invalid assignee shouldn't block creating the
// task, same reasoning as forms.js's notifyApprovalIfEmailAvailable.
async function notifyAssignee(req, task) {
  try {
    if (!task.assigneeId || task.assigneeId === req.user.id) return; // no self-notification
    const tenantAccounts = (await accounts.all()).filter((a) => (a.accountId || a.id) === req.user.accountId);
    const assignee = tenantAccounts.find((a) => a.id === task.assigneeId);
    if (!assignee?.email) return;
    await emailClient.sendMail({
      to: assignee.email,
      subject: `New task assigned to you: ${task.title}`,
      html: emailLayout({
        preheader: "A task has been assigned to you.",
        heading: "New task assigned",
        bodyHtml: `<p><strong>${task.title}</strong>${task.dueDate ? ` — due ${new Date(task.dueDate).toLocaleDateString()}` : ""}</p>${
          task.description ? `<p>${task.description}</p>` : ""
        }`,
      }),
    });
  } catch {
    // Notification is a nice-to-have — task creation already succeeded.
  }
}

// GET /api/tasks?status=&priority=&assigneeId=&entityType=&entityId=&search=&view=&page=&limit=&sort=
// Soft-deleted tasks (deletedAt set) are excluded unless explicitly asked
// for via status=ALL_INCLUDING_DELETED (no UI needs this yet — it's here
// so a future "trash" view doesn't need a schema change).
router.get("/", async (req, res) => {
  const { status, priority, assigneeId, entityType, entityId, search, view, page, limit, sort } = req.query;

  if (status && status !== "ALL" && !STATUSES.includes(status)) {
    return res.status(400).json({ error: `status must be one of: ALL, ${STATUSES.join(", ")}` });
  }
  if (priority && !PRIORITIES.includes(priority)) {
    return res.status(400).json({ error: `priority must be one of: ${PRIORITIES.join(", ")}` });
  }

  const filter = { deletedAt: null };
  if (status && status !== "ALL") filter.status = status;
  if (priority) filter.priority = priority;
  if (entityType) filter.entityType = entityType;
  if (entityId) filter.entityId = entityId;
  // "My Tasks" / "Team Tasks" / "All Tasks" — view=mine is assigneeId
  // shorthand for the caller's own id; an explicit assigneeId query param
  // still wins if both are somehow passed. "team"/"all" both mean "no
  // assignee filter" here since every task in this tenant's collection is
  // already the whole team's — scopedCollection() handles the tenant
  // boundary, view=team is just documentation of intent.
  if (assigneeId) filter.assigneeId = assigneeId;
  else if (view === "mine") filter.assigneeId = req.user.id;

  if (search) {
    const escaped = String(search).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    filter.$or = [{ title: { $regex: escaped, $options: "i" } }, { description: { $regex: escaped, $options: "i" } }];
  }

  const SORT_OPTIONS = { dueDate: { dueDate: 1 }, newest: { createdAt: -1 }, oldest: { createdAt: 1 }, priority: { priority: -1, dueDate: 1 } };
  const sortSpec = SORT_OPTIONS[sort] || SORT_OPTIONS.dueDate;

  if (page) {
    const result = await tasksFor(req).paginate({ filter, page, limit, sort: sortSpec });
    return res.json(result);
  }
  // No page param: full array, same "opt-in pagination" contract as
  // crudFactory.js — existing callers (e.g. the Dashboard's task widgets)
  // that expect a bare array keep working unchanged.
  const all = await tasksFor(req).query((t) => t.deletedAt == null);
  res.json(filter.status || filter.priority || filter.assigneeId || filter.search ? all.filter(matchesFilter(filter)) : all);
});

// Mirrors the Mongo filter built above, applied client-side — only used by
// the no-pagination branch above so a caller relying on the old bare-array
// contract still gets filtering, not just soft-delete exclusion.
function matchesFilter(filter) {
  return (t) =>
    (!filter.status || t.status === filter.status) &&
    (!filter.priority || t.priority === filter.priority) &&
    (!filter.assigneeId || t.assigneeId === filter.assigneeId) &&
    (!filter.entityType || t.entityType === filter.entityType) &&
    (!filter.entityId || t.entityId === filter.entityId);
}

router.get("/:id", async (req, res) => {
  const task = await tasksFor(req).find(req.params.id);
  if (!task || task.deletedAt) return res.status(404).json({ error: "Not found" });
  // Real parent/child tasks (parentTaskId), distinct from the checklist
  // field — a subtask is its own task with its own assignee/status/etc.,
  // not a checkbox line. Progress is computed here rather than stored
  // denormalized on the parent, so it's never stale.
  const subtasks = await tasksFor(req).query((t) => t.parentTaskId === req.params.id && t.deletedAt == null);
  res.json({ ...task, subtaskProgress: { total: subtasks.length, done: subtasks.filter((t) => t.status === "Completed").length } });
});

// GET /api/tasks/:id/timeline — the Activity Timeline for one task: every
// event recorded against it (created, updated, status changes, deleted),
// oldest first. Reuses the Event Engine (services/eventEngine.js) rather
// than a parallel activities table — a task's events already carry
// entityType/entityId, which is exactly what a timeline query needs.
router.get("/:id/timeline", async (req, res) => {
  const task = await tasksFor(req).find(req.params.id);
  if (!task) return res.status(404).json({ error: "Not found" });
  const timeline = (
    await rawEvents.query((e) => e.accountId === req.user.accountId && e.entityType === "task" && e.entityId === req.params.id)
  ).sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  res.json(timeline);
});

router.get("/:id/subtasks", async (req, res) => {
  const task = await tasksFor(req).find(req.params.id);
  if (!task) return res.status(404).json({ error: "Not found" });
  const subtasks = await tasksFor(req).query((t) => t.parentTaskId === req.params.id && t.deletedAt == null);
  res.json(subtasks);
});

// A checklist item only needs an id (stable react key + toggle target),
// text, and done — anything else sent by the client is dropped rather than
// trusted verbatim into the document.
function sanitizeChecklist(checklist) {
  if (!Array.isArray(checklist)) return [];
  return checklist
    .filter((item) => item && typeof item.text === "string" && item.text.trim())
    .map((item) => ({ id: item.id || uuid(), text: item.text.trim(), done: !!item.done }));
}

router.post("/", requireManager, async (req, res) => {
  const { title, description, assigneeId, priority, dueDate, entityType, entityId, labels, checklist, parentTaskId } = req.body;
  if (!title || !title.trim()) return res.status(400).json({ error: "Title is required." });
  if (priority && !PRIORITIES.includes(priority)) {
    return res.status(400).json({ error: `priority must be one of: ${PRIORITIES.join(", ")}` });
  }
  if (parentTaskId) {
    const parent = await tasksFor(req).find(parentTaskId);
    if (!parent || parent.deletedAt) return res.status(400).json({ error: "parentTaskId must be an existing task in this account." });
  }

  const task = {
    id: uuid(),
    title: title.trim(),
    description: description || "",
    status: "Todo",
    priority: priority || "Medium",
    assigneeId: assigneeId || null,
    reporterId: req.user.id,
    entityType: entityType || null,
    entityId: entityId || null,
    parentTaskId: parentTaskId || null,
    dueDate: dueDate || null,
    labels: Array.isArray(labels) ? labels : [],
    checklist: sanitizeChecklist(checklist),
    deletedAt: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  await tasksFor(req).insert(task);

  await recordEvent({
    accountId: req.user.accountId,
    type: EVENT_TYPES.TASK_CREATED,
    entityType: "task",
    entityId: task.id,
    actorId: req.user.id,
    actorName: req.user.email,
    source: EVENT_SOURCES.TASKS,
    payload: { title: task.title, assigneeId: task.assigneeId, priority: task.priority },
  });
  await notifyAssignee(req, task);

  res.status(201).json({ ...task, accountId: req.user.accountId });
});

router.put("/:id", requireManager, async (req, res) => {
  const existing = await tasksFor(req).find(req.params.id);
  if (!existing || existing.deletedAt) return res.status(404).json({ error: "Not found" });

  const { title, description, assigneeId, status, priority, dueDate, labels, checklist } = req.body;
  if (status && !STATUSES.includes(status)) {
    return res.status(400).json({ error: `status must be one of: ${STATUSES.join(", ")}` });
  }
  if (priority && !PRIORITIES.includes(priority)) {
    return res.status(400).json({ error: `priority must be one of: ${PRIORITIES.join(", ")}` });
  }

  const patch = {};
  if (title !== undefined) patch.title = title;
  if (description !== undefined) patch.description = description;
  if (assigneeId !== undefined) patch.assigneeId = assigneeId;
  if (status !== undefined) patch.status = status;
  if (priority !== undefined) patch.priority = priority;
  if (dueDate !== undefined) patch.dueDate = dueDate;
  if (labels !== undefined) patch.labels = Array.isArray(labels) ? labels : existing.labels;
  if (checklist !== undefined) patch.checklist = sanitizeChecklist(checklist);

  const updated = await tasksFor(req).update(req.params.id, patch);

  // A status change is worth its own event type (distinct from a generic
  // field edit) — it's the one thing the spec calls out with its own
  // timeline example ("Todo -> In Progress -> Completed"), and it's what a
  // future notification rule ("task completed") would key off of.
  if (status !== undefined && status !== existing.status) {
    await recordEvent({
      accountId: req.user.accountId,
      type: EVENT_TYPES.TASK_STATUS_CHANGED,
      entityType: "task",
      entityId: req.params.id,
      actorId: req.user.id,
      actorName: req.user.email,
      source: EVENT_SOURCES.TASKS,
      payload: { from: existing.status, to: status },
    });
  }
  const changedOtherFields = Object.keys(patch).some((k) => k !== "status" && patch[k] !== existing[k]);
  if (changedOtherFields) {
    await recordEvent({
      accountId: req.user.accountId,
      type: EVENT_TYPES.TASK_UPDATED,
      entityType: "task",
      entityId: req.params.id,
      actorId: req.user.id,
      actorName: req.user.email,
      source: EVENT_SOURCES.TASKS,
      payload: { fields: Object.keys(patch).filter((k) => k !== "status") },
    });
  }
  if (assigneeId !== undefined && assigneeId !== existing.assigneeId) {
    await notifyAssignee(req, updated);
  }

  res.json(updated);
});

// Soft delete — deletedAt is set, the record stays. List/get/timeline
// endpoints all filter it out; nothing hard-deletes a task.
router.delete("/:id", requireFullAccess, async (req, res) => {
  const existing = await tasksFor(req).find(req.params.id);
  if (!existing || existing.deletedAt) return res.status(404).json({ error: "Not found" });

  const updated = await tasksFor(req).update(req.params.id, { deletedAt: new Date().toISOString() });
  await recordEvent({
    accountId: req.user.accountId,
    type: EVENT_TYPES.TASK_DELETED,
    entityType: "task",
    entityId: req.params.id,
    actorId: req.user.id,
    actorName: req.user.email,
    source: EVENT_SOURCES.TASKS,
    payload: { title: existing.title },
  });
  res.json(updated);
});

// ---------------- COMMENTS ----------------
// Nested under a task (same reasoning as forms.js nesting responses under
// a form) rather than a separate top-level resource — a comment never
// exists independent of its task. `parentCommentId` gives one level of
// threading (a "reply"), matching the spec's example; there's no need for
// arbitrary-depth nesting for a task discussion.

// "@word" tokens matched against each tenant account's first name,
// case-insensitively — good enough for a small team's task comments
// without needing a rich-text editor with real @-autocomplete (that's a
// frontend concern for later, not a backend prerequisite).
function resolveMentions(commentText, tenantAccounts) {
  const tokens = [...commentText.matchAll(/@(\w+)/g)].map((m) => m[1].toLowerCase());
  if (tokens.length === 0) return [];
  const matched = new Set();
  for (const account of tenantAccounts) {
    const firstName = (account.name || "").split(" ")[0]?.toLowerCase();
    if (firstName && tokens.includes(firstName)) matched.add(account.id);
  }
  return [...matched];
}

async function notifyMentions(req, task, comment, mentionedIds, tenantAccounts) {
  const recipients = tenantAccounts.filter((a) => mentionedIds.includes(a.id) && a.id !== req.user.id && a.email);
  await Promise.all(
    recipients.map((account) =>
      emailClient
        .sendMail({
          to: account.email,
          subject: `You were mentioned on a task: ${task.title}`,
          html: emailLayout({
            preheader: "You were mentioned in a task comment.",
            heading: "You were mentioned",
            bodyHtml: `<p><strong>${req.user.email}</strong> mentioned you on <strong>${task.title}</strong>:</p><p>${comment.comment}</p>`,
          }),
        })
        .catch(() => {})
    )
  );
}

router.get("/:taskId/comments", async (req, res) => {
  const task = await tasksFor(req).find(req.params.taskId);
  if (!task) return res.status(404).json({ error: "Not found" });
  const all = await commentsFor(req).query((c) => c.taskId === req.params.taskId);
  res.json(all.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt)));
});

router.post("/:taskId/comments", async (req, res) => {
  const task = await tasksFor(req).find(req.params.taskId);
  if (!task) return res.status(404).json({ error: "Not found" });
  const { comment, parentCommentId } = req.body;
  if (!comment || !comment.trim()) return res.status(400).json({ error: "Comment text is required." });
  if (parentCommentId) {
    const parent = await commentsFor(req).find(parentCommentId);
    if (!parent || parent.taskId !== req.params.taskId) return res.status(400).json({ error: "parentCommentId must be a comment on the same task." });
  }

  const tenantAccounts = (await accounts.all()).filter((a) => (a.accountId || a.id) === req.user.accountId);
  const mentions = resolveMentions(comment, tenantAccounts);

  const record = {
    id: uuid(),
    taskId: req.params.taskId,
    userId: req.user.id,
    comment: comment.trim(),
    parentCommentId: parentCommentId || null,
    mentions,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  await commentsFor(req).insert(record);

  // Recorded against the task (entityType/entityId), not the comment — so
  // it shows up in the task's own timeline (GET /:id/timeline), matching
  // the spec's "Task Created -> Comment Added -> ..." example.
  await recordEvent({
    accountId: req.user.accountId,
    type: EVENT_TYPES.COMMENT_CREATED,
    entityType: "task",
    entityId: req.params.taskId,
    actorId: req.user.id,
    actorName: req.user.email,
    source: EVENT_SOURCES.TASKS,
    payload: { commentId: record.id, mentions },
  });
  await notifyMentions(req, task, record, mentions, tenantAccounts);

  res.status(201).json(record);
});

router.put("/:taskId/comments/:commentId", async (req, res) => {
  const existing = await commentsFor(req).find(req.params.commentId);
  if (!existing || existing.taskId !== req.params.taskId) return res.status(404).json({ error: "Not found" });
  if (existing.userId !== req.user.id) return res.status(403).json({ error: "You can only edit your own comments." });
  const { comment } = req.body;
  if (!comment || !comment.trim()) return res.status(400).json({ error: "Comment text is required." });

  const updated = await commentsFor(req).update(req.params.commentId, { comment: comment.trim() });
  res.json(updated);
});

router.delete("/:taskId/comments/:commentId", async (req, res) => {
  const existing = await commentsFor(req).find(req.params.commentId);
  if (!existing || existing.taskId !== req.params.taskId) return res.status(404).json({ error: "Not found" });
  if (existing.userId !== req.user.id) return res.status(403).json({ error: "You can only delete your own comments." });

  await commentsFor(req).remove(req.params.commentId);
  res.status(204).end();
});

// GET /api/tasks/comments/counts — one round trip for the list view's 💬
// badges instead of an N+1 fetch per visible task. Query param `taskIds`
// is a comma-separated list; omit it to get counts for every task in the
// account (small-team scale, same reasoning as the no-pagination branch
// of GET / above).
router.get("/comments/counts", async (req, res) => {
  const all = await commentsFor(req).all();
  const taskIds = req.query.taskIds ? String(req.query.taskIds).split(",") : null;
  const counts = {};
  for (const c of all) {
    if (taskIds && !taskIds.includes(c.taskId)) continue;
    counts[c.taskId] = (counts[c.taskId] || 0) + 1;
  }
  res.json(counts);
});

module.exports = router;
