import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import { Plus, Check, X, List as ListIcon, LayoutGrid, MessageSquare, Trash2 } from "lucide-react";
import api from "../api/client";
import { useAuth } from "../context/AuthContext";
import { Card, Button, Modal, Field, inputCls } from "../components/ui";
import { formatDate, timeAgo } from "../lib/format";
import useLiveCollection from "../lib/useLiveCollection";

const STATUSES = ["Todo", "In Progress", "Blocked", "Completed"];
const STATUS_DOT = { Todo: "bg-amber-400", "In Progress": "bg-blue-500", Blocked: "bg-red-500", Completed: "bg-emerald-500" };
const PRIORITIES = ["Low", "Medium", "High", "Critical"];
const PRIORITY_META = {
  Critical: { emoji: "🔺", cls: "bg-red-100 text-red-700" },
  High: { emoji: "🔥", cls: "bg-red-50 text-red-700" },
  Medium: { emoji: "🟡", cls: "bg-amber-50 text-amber-700" },
  Low: { emoji: "🟢", cls: "bg-emerald-50 text-emerald-700" },
};
const SORT_OPTIONS = [
  { value: "dueDate", label: "Due Date" },
  { value: "priority", label: "Priority" },
  { value: "newest", label: "Newest" },
  { value: "oldest", label: "Oldest" },
];
const emptyForm = { title: "", description: "", assigneeId: "", dueDate: "", priority: "Medium", entityId: "", labels: "", checklist: "" };

// Label + color together — "3 Days Left" in green reads very differently
// from "3 Days Left" in red, and a bare due-date string on its own doesn't
// tell you which end of that range you're looking at.
function dueMeta(dueDate, status) {
  if (!dueDate) return { label: "No due date", cls: "text-ink/40" };
  if (status === "Completed") return { label: formatDate(dueDate), cls: "text-ink/40" };

  const due = new Date(dueDate);
  const today = new Date();
  const diffDays = Math.round((new Date(due.toDateString()) - new Date(today.toDateString())) / 86400000);

  if (diffDays < 0) return { label: diffDays === -1 ? "Overdue (Yesterday)" : `Overdue by ${-diffDays} days`, cls: "text-danger font-semibold" };
  if (diffDays === 0) return { label: "Today", cls: "text-orange-600 font-medium" };
  if (diffDays === 1) return { label: "Tomorrow", cls: "text-blue-600 font-medium" };
  if (diffDays <= 7) return { label: `${diffDays} Days Left`, cls: "text-emerald-600" };
  return { label: formatDate(dueDate), cls: "text-ink/45" };
}

const EVENT_LABEL = {
  "task.created": { label: "Task Created", emoji: "📝" },
  "task.updated": { label: "Task Updated", emoji: "✏️" },
  "task.status_changed": { label: "Status Changed", emoji: "🔁" },
  "task.deleted": { label: "Task Deleted", emoji: "🗑️" },
  "comment.created": { label: "Comment Added", emoji: "💬" },
};

// Right-side investigation-style panel (same pattern as AI Center's
// drawer) — Status/Priority/Assignee/Due Date, Description, Checklist,
// Comments (one level of threaded replies), and Activity (the real
// Event Engine timeline, not a placeholder).
function TaskDrawer({ taskId, users, onClose, onChanged }) {
  const [task, setTask] = useState(null);
  const [comments, setComments] = useState(null);
  const [timeline, setTimeline] = useState(null);
  const [subtasks, setSubtasks] = useState(null);
  const [newComment, setNewComment] = useState("");
  const [replyTo, setReplyTo] = useState(null);
  const [newChecklistItem, setNewChecklistItem] = useState("");
  const [newSubtask, setNewSubtask] = useState("");

  const load = () => {
    api.get(`/tasks/${taskId}`).then((r) => setTask(r.data));
    api.get(`/tasks/${taskId}/comments`).then((r) => setComments(r.data));
    api.get(`/tasks/${taskId}/timeline`).then((r) => setTimeline(r.data));
    api.get(`/tasks/${taskId}/subtasks`).then((r) => setSubtasks(r.data));
  };
  useEffect(() => {
    if (taskId) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskId]);

  if (!taskId) return null;

  const patch = async (fields) => {
    await api.put(`/tasks/${taskId}`, fields);
    load();
    onChanged();
  };

  const userName = (id) => users.find((u) => u.id === id)?.name || "Unassigned";

  const toggleChecklistItem = (itemId) => {
    const updatedChecklist = task.checklist.map((c) => (c.id === itemId ? { ...c, done: !c.done } : c));
    patch({ checklist: updatedChecklist });
  };
  const addChecklistItem = () => {
    if (!newChecklistItem.trim()) return;
    patch({ checklist: [...(task.checklist || []), { text: newChecklistItem.trim(), done: false }] });
    setNewChecklistItem("");
  };

  const postComment = async (parentCommentId) => {
    const text = parentCommentId ? replyTo.text : newComment;
    if (!text?.trim()) return;
    await api.post(`/tasks/${taskId}/comments`, { comment: text, parentCommentId });
    setNewComment("");
    setReplyTo(null);
    load();
  };

  const addSubtask = async () => {
    if (!newSubtask.trim()) return;
    await api.post("/tasks", { title: newSubtask.trim(), parentTaskId: taskId });
    setNewSubtask("");
    load();
    onChanged();
  };
  const toggleSubtask = async (subtask) => {
    await api.put(`/tasks/${subtask.id}`, { status: subtask.status === "Completed" ? "Todo" : "Completed" });
    load();
    onChanged();
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-ink/40" onClick={onClose}>
      <div className="bg-white w-full max-w-[460px] h-full overflow-y-auto shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-border sticky top-0 bg-white z-10">
          <h3 className="font-display font-semibold text-lg truncate pr-4">{task ? task.title : "Task"}</h3>
          <button onClick={onClose} className="text-ink/40 hover:text-ink shrink-0">
            <X size={19} />
          </button>
        </div>

        {!task ? (
          <p className="text-ink/40 text-sm p-5">Loading…</p>
        ) : (
          <div className="p-5 space-y-5">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Status">
                <select className={inputCls} value={task.status} onChange={(e) => patch({ status: e.target.value })}>
                  {STATUSES.map((s) => <option key={s}>{s}</option>)}
                </select>
              </Field>
              <Field label="Priority">
                <select className={inputCls} value={task.priority} onChange={(e) => patch({ priority: e.target.value })}>
                  {PRIORITIES.map((p) => <option key={p}>{p}</option>)}
                </select>
              </Field>
              <Field label="Assignee">
                <select className={inputCls} value={task.assigneeId || ""} onChange={(e) => patch({ assigneeId: e.target.value || null })}>
                  <option value="">Unassigned</option>
                  {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
              </Field>
              <Field label="Due Date">
                <input type="date" className={inputCls} value={task.dueDate ? task.dueDate.slice(0, 10) : ""} onChange={(e) => patch({ dueDate: e.target.value })} />
              </Field>
            </div>

            <Field label="Description">
              <textarea
                className={inputCls}
                rows={3}
                value={task.description || ""}
                onChange={(e) => setTask({ ...task, description: e.target.value })}
                onBlur={(e) => patch({ description: e.target.value })}
              />
            </Field>

            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wide text-ink/40 mb-2">Checklist</h4>
              <div className="space-y-1.5">
                {(task.checklist || []).map((item) => (
                  <label key={item.id} className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={item.done} onChange={() => toggleChecklistItem(item.id)} className="w-4 h-4 rounded border-border" />
                    <span className={item.done ? "line-through text-ink/40" : "text-ink/80"}>{item.text}</span>
                  </label>
                ))}
              </div>
              <div className="flex gap-2 mt-2">
                <input
                  className={inputCls}
                  placeholder="Add checklist item…"
                  value={newChecklistItem}
                  onChange={(e) => setNewChecklistItem(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addChecklistItem()}
                />
                <Button variant="secondary" onClick={addChecklistItem}>Add</Button>
              </div>
            </div>

            {/* Real parent/child tasks, distinct from the checklist above —
                each subtask is its own task with its own status, not a
                checkbox line, so completing it here is a real PUT, not a
                document-field toggle. */}
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wide text-ink/40 mb-2">Subtasks</h4>
              {!subtasks ? (
                <p className="text-xs text-ink/35">Loading…</p>
              ) : (
                <div className="space-y-1.5">
                  {subtasks.map((sub) => (
                    <label key={sub.id} className="flex items-center gap-2 text-sm">
                      <input type="checkbox" checked={sub.status === "Completed"} onChange={() => toggleSubtask(sub)} className="w-4 h-4 rounded border-border" />
                      <span className={sub.status === "Completed" ? "line-through text-ink/40" : "text-ink/80"}>{sub.title}</span>
                    </label>
                  ))}
                  {subtasks.length === 0 && <p className="text-xs text-ink/35">No subtasks yet.</p>}
                </div>
              )}
              <div className="flex gap-2 mt-2">
                <input
                  className={inputCls}
                  placeholder="Add a subtask…"
                  value={newSubtask}
                  onChange={(e) => setNewSubtask(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addSubtask()}
                />
                <Button variant="secondary" onClick={addSubtask}>Add</Button>
              </div>
            </div>

            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wide text-ink/40 mb-2">Comments</h4>
              {!comments ? (
                <p className="text-xs text-ink/35">Loading…</p>
              ) : (
                <div className="space-y-3">
                  {comments
                    .filter((c) => !c.parentCommentId)
                    .map((c) => (
                      <div key={c.id}>
                        <p className="text-sm">
                          <span className="font-medium">{userName(c.userId)}</span> <span className="text-ink/70">{c.comment}</span>
                        </p>
                        <div className="flex items-center gap-2 text-xs text-ink/35 mt-0.5">
                          <span>{timeAgo(c.createdAt)}</span>
                          <button onClick={() => setReplyTo({ id: c.id, text: "" })} className="hover:underline">
                            Reply
                          </button>
                        </div>
                        {comments
                          .filter((r) => r.parentCommentId === c.id)
                          .map((r) => (
                            <p key={r.id} className="text-sm mt-1.5 ml-4 pl-2 border-l-2 border-border">
                              <span className="font-medium">{userName(r.userId)}</span> <span className="text-ink/70">{r.comment}</span>
                            </p>
                          ))}
                        {replyTo?.id === c.id && (
                          <div className="flex gap-2 mt-1.5 ml-4">
                            <input
                              className={inputCls}
                              placeholder="Reply…"
                              value={replyTo.text}
                              onChange={(e) => setReplyTo({ ...replyTo, text: e.target.value })}
                              onKeyDown={(e) => e.key === "Enter" && postComment(c.id)}
                              autoFocus
                            />
                            <Button variant="secondary" onClick={() => postComment(c.id)}>Send</Button>
                          </div>
                        )}
                      </div>
                    ))}
                  {comments.length === 0 && <p className="text-xs text-ink/35">No comments yet.</p>}
                </div>
              )}
              <div className="flex gap-2 mt-3">
                <input
                  className={inputCls}
                  placeholder="Add a comment… (@name to mention)"
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && postComment(null)}
                />
                <Button onClick={() => postComment(null)}>Send</Button>
              </div>
            </div>

            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wide text-ink/40 mb-2">Activity</h4>
              {!timeline ? (
                <p className="text-xs text-ink/35">Loading…</p>
              ) : (
                <div>
                  {timeline.map((event, i) => {
                    const meta = EVENT_LABEL[event.type] || { label: event.type, emoji: "○" };
                    return (
                      <div key={event.id} className="flex gap-3">
                        <div className="flex flex-col items-center">
                          <span className="w-6 h-6 rounded-full bg-base flex items-center justify-center text-xs shrink-0">{meta.emoji}</span>
                          {i < timeline.length - 1 && <span className="w-px flex-1 bg-border my-0.5" />}
                        </div>
                        <div className="pb-4">
                          <p className="text-sm text-ink/80 font-medium">{meta.label}</p>
                          <p className="text-xs text-ink/35 font-mono mt-0.5">{new Date(event.createdAt).toLocaleString()}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function TaskCard({ task, leadName, users, onComplete, onOpen, onDelete, commentCount, canManage }) {
  const priorityMeta = PRIORITY_META[task.priority] || PRIORITY_META.Medium;
  const due = dueMeta(task.dueDate, task.status);
  const assigneeName = users.find((u) => u.id === task.assigneeId)?.name || "Unassigned";
  const isOverdue = due.label.startsWith("Overdue") && task.status !== "Completed";

  return (
    <div
      className={`group p-4 border-b border-border last:border-0 hover:bg-base/50 cursor-pointer ${isOverdue ? "border-l-4 border-l-danger" : ""}`}
      onClick={() => onOpen(task.id)}
    >
      <div className="flex items-start gap-3">
        <button
          onClick={(e) => {
            e.stopPropagation();
            canManage && task.status !== "Completed" && onComplete(task);
          }}
          disabled={!canManage}
          className={`mt-0.5 w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
            task.status === "Completed" ? "bg-primary border-primary" : "border-ink/20 hover:border-primary disabled:hover:border-ink/20 disabled:cursor-not-allowed"
          }`}
        >
          {task.status === "Completed" && <Check size={12} className="text-white" />}
        </button>
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-medium ${task.status === "Completed" ? "line-through text-ink/40" : "text-ink"}`}>
            {task.parentTaskId && <span className="text-ink/30 mr-1">↳</span>}
            {task.title}
          </p>
          {leadName && <p className="text-xs text-ink/40 mt-0.5">Lead: {leadName}</p>}
          {task.subtaskProgress?.total > 0 && (
            <p className="text-xs text-ink/40 mt-0.5">
              ☑ {task.subtaskProgress.done}/{task.subtaskProgress.total} subtasks
            </p>
          )}
          <div className="flex items-center flex-wrap gap-x-3 gap-y-1 mt-1.5 text-xs text-ink/50">
            <span>👤 {assigneeName}</span>
            <span className={due.cls}>📅 {due.label}</span>
            <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full font-medium ${priorityMeta.cls}`}>
              {priorityMeta.emoji} {task.priority}
            </span>
            {commentCount > 0 && (
              <span className="inline-flex items-center gap-1">
                <MessageSquare size={12} /> {commentCount}
              </span>
            )}
            {(task.labels || []).map((label) => (
              <span key={label} className="px-1.5 py-0.5 rounded-full bg-base text-ink/50">
                🏷 {label}
              </span>
            ))}
          </div>
        </div>

        {/* Quick actions — only what's already real: Complete (the
            checkbox above already does this, this is a labeled duplicate
            for discoverability), Comment (opens the drawer's comment box),
            Delete (soft delete via the existing DELETE endpoint). Edit and
            Attach are left out — there's no inline edit modal and no
            attachments subsystem to wire them to. */}
        {canManage && (
          // Always visible on touch devices (there's no ":hover" to reveal
          // them on) — only fades in on hover from sm up, where a mouse
          // makes that discoverable.
          <div className="flex sm:opacity-0 sm:group-hover:opacity-100 items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
            {task.status !== "Completed" && (
              <button onClick={() => onComplete(task)} title="Complete" className="p-1.5 rounded-lg hover:bg-white text-ink/40 hover:text-emerald-600">
                <Check size={14} />
              </button>
            )}
            <button onClick={() => onOpen(task.id)} title="Comment" className="p-1.5 rounded-lg hover:bg-white text-ink/40 hover:text-primary">
              <MessageSquare size={14} />
            </button>
            <button onClick={() => onDelete(task)} title="Delete" className="p-1.5 rounded-lg hover:bg-white text-ink/40 hover:text-danger">
              <Trash2 size={14} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// `allEmpty` (no tasks anywhere yet, e.g. a brand new account) gets a more
// inviting message than a column that's empty just because everything's
// filtered into other statuses — "you're all caught up" would be an odd
// thing to tell someone who's never created a task.
function ColumnEmptyState({ onCreate, allEmpty }) {
  return (
    <div className="flex flex-col items-center justify-center py-10 text-center px-4">
      <p className="text-sm font-medium text-ink/60">{allEmpty ? "🎉 No tasks here yet" : "🎉 You're all caught up!"}</p>
      <p className="text-xs text-ink/35 mt-1">{allEmpty ? "Create your first task to keep work moving." : "No tasks in this column."}</p>
      {onCreate && (
        <button onClick={onCreate} className="text-xs font-medium text-primary mt-2 hover:underline">
          + Create Task
        </button>
      )}
    </div>
  );
}

function matchesDueFilter(task, dueFilter) {
  if (!dueFilter) return true;
  if (!task.dueDate) return false;
  const diffDays = Math.round((new Date(new Date(task.dueDate).toDateString()) - new Date(new Date().toDateString())) / 86400000);
  if (dueFilter === "overdue") return diffDays < 0;
  if (dueFilter === "today") return diffDays === 0;
  if (dueFilter === "week") return diffDays >= 0 && diffDays <= 7;
  return true;
}

const DUE_FILTERS = [
  { value: "", label: "Any Due Date" },
  { value: "overdue", label: "Overdue" },
  { value: "today", label: "Due Today" },
  { value: "week", label: "This Week" },
];

export default function Tasks() {
  const router = useRouter();
  const { canManage, user } = useAuth();
  const [tasks, setTasks] = useState([]);
  const [users, setUsers] = useState([]);
  const [leads, setLeads] = useState([]);
  const [commentCounts, setCommentCounts] = useState({});
  const [loading, setLoading] = useState(true);

  const [statusTab, setStatusTab] = useState("Todo");
  const [search, setSearch] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("");
  const [assigneeFilter, setAssigneeFilter] = useState("");
  const [dueFilter, setDueFilter] = useState("");
  const [createdByMe, setCreatedByMe] = useState(false);
  const [sort, setSort] = useState("dueDate");
  const [view, setView] = useState("list");

  const [modal, setModal] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [drawerTaskId, setDrawerTaskId] = useState(null);
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);
  const [sortSheetOpen, setSortSheetOpen] = useState(false);

  // Landed here from the global "+ Create" menu (Layout.jsx).
  useEffect(() => {
    if (router.isReady && router.query.create === "1" && canManage) {
      setModal(true);
      router.replace("/app/tasks", undefined, { shallow: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router.isReady, router.query.create, canManage]);

  // Deep link from the Activity Timeline / global search (?open=<taskId>)
  // — opens the same drawer clicking the card would.
  useEffect(() => {
    if (router.isReady && router.query.open) {
      setDrawerTaskId(router.query.open);
      router.replace("/app/tasks", undefined, { shallow: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router.isReady, router.query.open]);

  const load = () => {
    Promise.all([api.get("/tasks"), api.get("/users"), api.get("/leads").catch(() => ({ data: [] })), api.get("/tasks/comments/counts")]).then(
      ([t, u, l, c]) => {
        setTasks(t.data);
        setUsers(u.data);
        setLeads(l.data);
        setCommentCounts(c.data);
        setLoading(false);
      }
    );
  };
  useEffect(() => {
    load();
  }, []);
  useLiveCollection(["tasks", "users", "task_comments"], load);

  const leadName = (task) => (task.entityType === "lead" ? leads.find((l) => l.id === task.entityId)?.name : null);

  const filtered = useMemo(() => {
    let list = tasks.filter((t) => t.status === statusTab);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(
        (t) =>
          t.title.toLowerCase().includes(q) ||
          (t.description || "").toLowerCase().includes(q) ||
          (leadName(t) || "").toLowerCase().includes(q)
      );
    }
    if (priorityFilter) list = list.filter((t) => t.priority === priorityFilter);
    if (assigneeFilter) list = list.filter((t) => t.assigneeId === assigneeFilter);
    if (createdByMe) list = list.filter((t) => t.reporterId === user?.id);
    if (dueFilter) list = list.filter((t) => matchesDueFilter(t, dueFilter));

    const sorters = {
      dueDate: (a, b) => new Date(a.dueDate || "9999-12-31") - new Date(b.dueDate || "9999-12-31"),
      priority: (a, b) => PRIORITIES.indexOf(b.priority) - PRIORITIES.indexOf(a.priority),
      newest: (a, b) => new Date(b.createdAt) - new Date(a.createdAt),
      oldest: (a, b) => new Date(a.createdAt) - new Date(b.createdAt),
    };
    return [...list].sort(sorters[sort] || sorters.dueDate);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tasks, statusTab, search, priorityFilter, assigneeFilter, dueFilter, createdByMe, sort, leads]);

  const counts = Object.fromEntries(STATUSES.map((s) => [s, tasks.filter((t) => t.status === s).length]));
  const matchesDueTodayCount = tasks.filter((t) => t.status !== "Completed" && matchesDueFilter(t, "today")).length;
  const activeFilterCount = [priorityFilter, assigneeFilter, dueFilter, createdByMe].filter(Boolean).length;

  const complete = async (task) => {
    await api.put(`/tasks/${task.id}`, { status: "Completed" });
    load();
  };
  const changeStatus = async (task, status) => {
    await api.put(`/tasks/${task.id}`, { status });
    load();
  };
  const remove = async (task) => {
    if (!confirm(`Delete "${task.title}"? This can't be undone from here.`)) return;
    await api.delete(`/tasks/${task.id}`);
    load();
  };

  const save = async () => {
    const payload = {
      title: form.title,
      description: form.description,
      assigneeId: form.assigneeId || null,
      dueDate: form.dueDate || null,
      priority: form.priority,
      entityType: form.entityId ? "lead" : null,
      entityId: form.entityId || null,
      labels: form.labels ? form.labels.split(",").map((l) => l.trim()).filter(Boolean) : [],
      checklist: form.checklist
        ? form.checklist
            .split("\n")
            .map((l) => l.trim())
            .filter(Boolean)
            .map((text) => ({ text, done: false }))
        : [],
    };
    await api.post("/tasks", payload);
    setModal(false);
    setForm(emptyForm);
    load();
  };

  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-1">
        <h1 className="font-display font-bold text-xl sm:text-2xl text-ink">Tasks</h1>
        {canManage && (
          <Button onClick={() => setModal(true)}>
            <Plus size={15} /> <span className="sm:hidden">Add</span><span className="hidden sm:inline">Add Task</span>
          </Button>
        )}
      </div>
      {/* Compact stat line replaces the old descriptive subtitle — the
          count of what's active/due is more useful at a glance than
          "Follow-ups your team will never forget." */}
      <p className="text-sm text-secondary mb-3">
        {tasks.length - (counts.Completed || 0)} Active
        {matchesDueTodayCount > 0 && <> • {matchesDueTodayCount} Due Today</>}
      </p>

      <div className="mb-3">
        <input
          type="search"
          placeholder="Search tasks…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className={`${inputCls} w-full sm:w-64 mb-2 sm:mb-0 sm:inline-block`}
        />
        {/* Full filter row from sm up; below that, two buttons (Filter/Sort)
            open sheets instead — four+ inline selects don't fit a phone
            without crowding, and most mobile apps don't dedicate a whole
            row to sorting alone. */}
        <div className="hidden sm:inline-flex items-center gap-2 sm:float-right">
          <select className={inputCls} style={{ width: "auto" }} value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value)}>
            <option value="">All Priorities</option>
            {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
          <select className={inputCls} style={{ width: "auto" }} value={assigneeFilter} onChange={(e) => setAssigneeFilter(e.target.value)}>
            <option value="">All Assignees</option>
            {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
          <select className={inputCls} style={{ width: "auto" }} value={dueFilter} onChange={(e) => setDueFilter(e.target.value)}>
            {DUE_FILTERS.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
          </select>
          <label className="flex items-center gap-1.5 text-xs text-ink/60 px-2 whitespace-nowrap">
            <input type="checkbox" checked={createdByMe} onChange={(e) => setCreatedByMe(e.target.checked)} className="w-3.5 h-3.5 rounded border-border" />
            Created by me
          </label>
          <select className={inputCls} style={{ width: "auto" }} value={sort} onChange={(e) => setSort(e.target.value)}>
            {SORT_OPTIONS.map((o) => <option key={o.value} value={o.value}>Sort: {o.label}</option>)}
          </select>
          <div className="flex border border-border rounded-lg overflow-hidden">
            <button onClick={() => setView("list")} className={`p-2 ${view === "list" ? "bg-primary text-white" : "bg-white text-ink/50"}`} title="List view">
              <ListIcon size={15} />
            </button>
            <button onClick={() => setView("board")} className={`p-2 ${view === "board" ? "bg-primary text-white" : "bg-white text-ink/50"}`} title="Board view">
              <LayoutGrid size={15} />
            </button>
          </div>
        </div>
        <div className="flex sm:hidden items-center gap-2">
          <button onClick={() => setFilterSheetOpen(true)} className={`${inputCls} flex-1 flex items-center justify-center gap-1.5 text-sm`}>
            Filter{activeFilterCount > 0 ? ` (${activeFilterCount})` : ""}
          </button>
          <button onClick={() => setSortSheetOpen(true)} className={`${inputCls} flex-1 flex items-center justify-center gap-1.5 text-sm`}>
            Sort
          </button>
        </div>
      </div>

      {view === "list" && (
        <div className="flex gap-2 mb-4 overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0 sm:overflow-visible">
          {STATUSES.map((s) => (
            <button
              key={s}
              onClick={() => setStatusTab(s)}
              className={`shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border ${
                statusTab === s ? "bg-primary text-white border-primary" : "bg-white border-border text-ink/60"
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${statusTab === s ? "bg-white" : STATUS_DOT[s]}`} />
              {s} ({counts[s] || 0})
            </button>
          ))}
        </div>
      )}

      {/* Mobile Filter sheet — same fields the desktop inline row exposes,
          just grouped behind one button instead of four+ competing for
          space. */}
      {filterSheetOpen && (
        <div className="sm:hidden fixed inset-0 z-50 bg-ink/40" onClick={() => setFilterSheetOpen(false)}>
          <div className="absolute bottom-0 inset-x-0 bg-white rounded-t-2xl p-4 max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-display font-semibold text-lg">Filter</h2>
              <button onClick={() => setFilterSheetOpen(false)} className="text-ink/40 hover:text-ink"><X size={20} /></button>
            </div>
            <div className="space-y-3">
              <Field label="Priority">
                <select className={inputCls} value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value)}>
                  <option value="">All Priorities</option>
                  {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
              </Field>
              <Field label="Assignee">
                <select className={inputCls} value={assigneeFilter} onChange={(e) => setAssigneeFilter(e.target.value)}>
                  <option value="">All Assignees</option>
                  {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
              </Field>
              <Field label="Due Date">
                <select className={inputCls} value={dueFilter} onChange={(e) => setDueFilter(e.target.value)}>
                  {DUE_FILTERS.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
                </select>
              </Field>
              <label className="flex items-center gap-2 text-sm text-ink/70">
                <input type="checkbox" checked={createdByMe} onChange={(e) => setCreatedByMe(e.target.checked)} className="w-4 h-4 rounded border-border" />
                Created by me
              </label>
            </div>
            <Button className="w-full justify-center mt-4" onClick={() => setFilterSheetOpen(false)}>Apply</Button>
          </div>
        </div>
      )}

      {sortSheetOpen && (
        <div className="sm:hidden fixed inset-0 z-50 bg-ink/40" onClick={() => setSortSheetOpen(false)}>
          <div className="absolute bottom-0 inset-x-0 bg-white rounded-t-2xl p-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-display font-semibold text-lg">Sort</h2>
              <button onClick={() => setSortSheetOpen(false)} className="text-ink/40 hover:text-ink"><X size={20} /></button>
            </div>
            {SORT_OPTIONS.map((o) => (
              <button
                key={o.value}
                onClick={() => { setSort(o.value); setSortSheetOpen(false); }}
                className={`w-full text-left px-3 py-2.5 rounded-lg text-sm ${sort === o.value ? "bg-primary/10 text-primary font-medium" : "text-ink/70 hover:bg-base"}`}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {loading ? (
        <Card className="p-8 text-ink/40 text-sm">Loading…</Card>
      ) : view === "list" ? (
        <Card>
          {filtered.length === 0 ? (
            <ColumnEmptyState onCreate={canManage ? () => setModal(true) : null} allEmpty={tasks.length === 0} />
          ) : (
            filtered.map((t) => (
              <TaskCard
                key={t.id}
                task={t}
                leadName={leadName(t)}
                users={users}
                onComplete={complete}
                onOpen={setDrawerTaskId}
                onDelete={remove}
                commentCount={commentCounts[t.id] || 0}
                canManage={canManage}
              />
            ))
          )}
        </Card>
      ) : (
        <div className="grid grid-cols-4 gap-3 items-start">
          {STATUSES.map((status) => {
            const columnTasks = tasks
              .filter((t) => t.status === status)
              .filter((t) => !priorityFilter || t.priority === priorityFilter)
              .filter((t) => !assigneeFilter || t.assigneeId === assigneeFilter)
              .filter((t) => !createdByMe || t.reporterId === user?.id)
              .filter((t) => matchesDueFilter(t, dueFilter))
              .filter((t) => !search.trim() || t.title.toLowerCase().includes(search.trim().toLowerCase()));
            return (
              <Card key={status} className="p-3">
                <p className="text-xs font-semibold text-ink/50 mb-2 px-1">
                  {status} ({columnTasks.length})
                </p>
                {columnTasks.length === 0 ? (
                  <ColumnEmptyState onCreate={canManage ? () => setModal(true) : null} allEmpty={tasks.length === 0} />
                ) : (
                  <div className="space-y-2">
                    {columnTasks.map((t) => {
                      const priorityMeta = PRIORITY_META[t.priority] || PRIORITY_META.Medium;
                      return (
                        <div
                          key={t.id}
                          className="p-3 rounded-lg border border-border bg-white hover:shadow-sm cursor-pointer"
                          onClick={() => setDrawerTaskId(t.id)}
                        >
                          <p className="text-sm font-medium text-ink">{t.title}</p>
                          <div className="flex items-center gap-2 text-xs mt-1.5">
                            <span>{priorityMeta.emoji}</span>
                            <span className={dueMeta(t.dueDate, t.status).cls}>{dueMeta(t.dueDate, t.status).label}</span>
                          </div>
                          {canManage && (
                            <select
                              className={`${inputCls} mt-2 text-xs`}
                              value={t.status}
                              onClick={(e) => e.stopPropagation()}
                              onChange={(e) => changeStatus(t, e.target.value)}
                            >
                              {STATUSES.map((s) => <option key={s}>{s}</option>)}
                            </select>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      <Modal open={modal} onClose={() => setModal(false)} title="Add Task" wide>
        <Field label="Task"><input className={inputCls} placeholder="e.g. Call customer tomorrow" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></Field>
        <Field label="Description"><textarea className={inputCls} rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Assignee">
            <select className={inputCls} value={form.assigneeId} onChange={(e) => setForm({ ...form, assigneeId: e.target.value })}>
              <option value="">Unassigned</option>
              {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </Field>
          <Field label="Due Date"><input type="date" className={inputCls} value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} /></Field>
          <Field label="Priority">
            <select className={inputCls} value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>
              {PRIORITIES.map((p) => <option key={p}>{p}</option>)}
            </select>
          </Field>
          <Field label="Related Lead (optional)">
            <select className={inputCls} value={form.entityId} onChange={(e) => setForm({ ...form, entityId: e.target.value })}>
              <option value="">None</option>
              {leads.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
          </Field>
        </div>
        <Field label="Labels (comma-separated, optional)">
          <input className={inputCls} placeholder="Sales, Urgent" value={form.labels} onChange={(e) => setForm({ ...form, labels: e.target.value })} />
        </Field>
        <Field label="Checklist (one item per line, optional)">
          <textarea className={inputCls} rows={2} placeholder={"Call customer\nSend proposal"} value={form.checklist} onChange={(e) => setForm({ ...form, checklist: e.target.value })} />
        </Field>
        <div className="flex justify-end gap-2 mt-2">
          <Button variant="secondary" onClick={() => setModal(false)}>Cancel</Button>
          <Button onClick={save} disabled={!form.title.trim()}>Save Task</Button>
        </div>
      </Modal>

      <TaskDrawer taskId={drawerTaskId} users={users} onClose={() => setDrawerTaskId(null)} onChanged={load} />
    </div>
  );
}
