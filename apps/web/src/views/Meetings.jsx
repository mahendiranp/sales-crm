import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import { Plus, X, List as ListIcon, CalendarRange, ChevronLeft, ChevronRight, MapPin, Clock, Video } from "lucide-react";
import api from "../api/client";
import { useAuth } from "../context/AuthContext";
import { Card, PageHeader, Button, Modal, Field, inputCls, EmptyState } from "../components/ui";
import { formatDate, timeAgo } from "../lib/format";
import useLiveCollection from "../lib/useLiveCollection";

const STATUSES = ["Scheduled", "In Progress", "Completed", "Cancelled", "No Show"];
const STATUS_CLS = {
  Scheduled: "bg-blue-50 text-blue-700",
  "In Progress": "bg-amber-50 text-amber-700",
  Completed: "bg-emerald-50 text-emerald-700",
  Cancelled: "bg-ink/10 text-ink/50",
  "No Show": "bg-red-50 text-red-700",
};
const COMMON_TYPES = ["Sales Demo", "Customer Call", "Internal Meeting", "Interview", "Training", "Support", "Review"];
const OUTCOMES = ["Successful", "Rescheduled", "Cancelled", "No Response", "Won", "Lost"];
const OUTCOME_CLS = {
  Successful: "bg-emerald-50 text-emerald-700",
  Won: "bg-emerald-50 text-emerald-700",
  Rescheduled: "bg-amber-50 text-amber-700",
  Cancelled: "bg-ink/10 text-ink/50",
  "No Response": "bg-ink/10 text-ink/50",
  Lost: "bg-red-50 text-red-700",
};
// "Related To" — a meeting isn't always about a Lead; sales demos link to
// Deals, internal reviews to nothing, interviews sometimes to a Contact.
// Each entry names the collection (for the picker) and how to read a
// record's display name back out of it.
const RELATABLE_TYPES = [
  { value: "lead", label: "Lead", nameKey: "name" },
  { value: "deal", label: "Deal", nameKey: "title" },
  { value: "contact", label: "Contact", nameKey: "name" },
  { value: "company", label: "Company", nameKey: "name" },
  { value: "task", label: "Task", nameKey: "title" },
];
const emptyForm = {
  title: "",
  description: "",
  agenda: "",
  scheduledStart: "",
  scheduledEnd: "",
  location: "",
  meetingUrl: "",
  meetingType: "Internal Meeting",
  participantIds: [],
  linkedEntityType: "",
  linkedEntityId: "",
};

function fmtTime(dateStr) {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}
function toLocalInput(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function sameDay(a, b) {
  return new Date(a).toDateString() === new Date(b).toDateString();
}
function initials(name) {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] || "") + (parts[1]?.[0] || "")).toUpperCase() || name[0].toUpperCase();
}
const AVATAR_COLORS = ["bg-blue-100 text-blue-700", "bg-emerald-100 text-emerald-700", "bg-amber-100 text-amber-700", "bg-purple-100 text-purple-700", "bg-pink-100 text-pink-700"];
function avatarColor(seed) {
  let hash = 0;
  for (const ch of seed || "") hash = (hash * 31 + ch.charCodeAt(0)) % AVATAR_COLORS.length;
  return AVATAR_COLORS[hash];
}
const ACTIVITY_LABEL = {
  "meeting.created": { label: "Meeting scheduled", emoji: "📅" },
  "meeting.updated": { label: "Meeting updated", emoji: "✏️" },
  "meeting.status_changed": { label: "Status changed", emoji: "🔁" },
  "meeting.deleted": { label: "Meeting deleted", emoji: "🗑️" },
  "meeting.participant_responded": { label: "Participant responded", emoji: "🙋" },
  "meeting.note_added": { label: "Note added", emoji: "📝" },
};
function relatedRecordName(relatedRecords, entityType, entityId) {
  const type = RELATABLE_TYPES.find((t) => t.value === entityType);
  if (!type) return null;
  const record = (relatedRecords[entityType] || []).find((r) => r.id === entityId);
  return record ? record[type.nameKey] || record.name || record.title : null;
}

function MeetingDrawer({ meetingId, users, relatedRecords, onClose, onChanged }) {
  const { user } = useAuth();
  const [meeting, setMeeting] = useState(null);
  const [participants, setParticipants] = useState(null);
  const [notes, setNotes] = useState(null);
  const [activity, setActivity] = useState(null);
  const [newNote, setNewNote] = useState("");
  const [newActionItem, setNewActionItem] = useState("");

  const load = () => {
    api.get(`/meetings/${meetingId}`).then((r) => setMeeting(r.data));
    api.get(`/meetings/${meetingId}/participants`).then((r) => setParticipants(r.data));
    api.get(`/meetings/${meetingId}/notes`).then((r) => setNotes(r.data));
    api.get(`/events`, { params: { entityType: "meeting", entityId: meetingId } }).then((r) => setActivity(r.data.items || r.data));
  };
  useEffect(() => {
    if (meetingId) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meetingId]);

  if (!meetingId) return null;

  const patch = async (fields) => {
    await api.patch(`/meetings/${meetingId}`, fields);
    load();
    onChanged();
  };

  const userOf = (id) => users.find((u) => u.id === id);
  const userName = (id) => userOf(id)?.name || userOf(id)?.email || "Former teammate";
  const relatedName = meeting ? relatedRecordName(relatedRecords, meeting.linkedEntityType, meeting.linkedEntityId) : null;
  const relatedLabel = RELATABLE_TYPES.find((t) => t.value === meeting?.linkedEntityType)?.label;

  const respond = async (participantId, response) => {
    await api.patch(`/meetings/${meetingId}/participants/${participantId}`, { response });
    load();
  };

  const addNote = async () => {
    if (!newNote.trim()) return;
    await api.post(`/meetings/${meetingId}/notes`, { content: newNote.trim() });
    setNewNote("");
    load();
  };

  const addActionItem = async () => {
    if (!newActionItem.trim()) return;
    await api.post("/tasks", { title: newActionItem.trim(), entityType: "meeting", entityId: meetingId });
    setNewActionItem("");
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-ink/40" onClick={onClose}>
      <div className="bg-white w-full max-w-[460px] h-full overflow-y-auto shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-border sticky top-0 bg-white z-10">
          <h3 className="font-display font-semibold text-lg truncate pr-4">{meeting ? meeting.title : "Meeting"}</h3>
          <button onClick={onClose} title="Close" className="text-ink/40 hover:text-ink shrink-0">
            <X size={19} />
          </button>
        </div>

        {!meeting ? (
          <p className="text-ink/40 text-sm p-5">Loading…</p>
        ) : (
          <div className="p-5 space-y-5">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Status">
                <select className={inputCls} value={meeting.status} onChange={(e) => patch({ status: e.target.value })}>
                  {STATUSES.map((s) => <option key={s}>{s}</option>)}
                </select>
              </Field>
              <Field label="Type">
                <select className={inputCls} value={meeting.meetingType} onChange={(e) => patch({ meetingType: e.target.value })}>
                  {COMMON_TYPES.map((t) => <option key={t}>{t}</option>)}
                </select>
              </Field>
              <Field label="Start">
                <input type="datetime-local" className={inputCls} value={toLocalInput(meeting.scheduledStart)} onChange={(e) => patch({ scheduledStart: new Date(e.target.value).toISOString() })} />
              </Field>
              <Field label="End">
                <input type="datetime-local" className={inputCls} value={toLocalInput(meeting.scheduledEnd)} onChange={(e) => patch({ scheduledEnd: new Date(e.target.value).toISOString() })} />
              </Field>
            </div>

            {/* Outcome is independent of status — a Completed meeting can
                be Won or Lost, and a Cancelled one has no outcome at all
                worth recording, so it's opt-in rather than tied to a
                status transition. */}
            <Field label="Outcome">
              <select className={inputCls} value={meeting.outcome || ""} onChange={(e) => patch({ outcome: e.target.value || null })}>
                <option value="">Not set</option>
                {OUTCOMES.map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Location">
                <input className={inputCls} value={meeting.location || ""} onChange={(e) => setMeeting({ ...meeting, location: e.target.value })} onBlur={(e) => patch({ location: e.target.value })} />
              </Field>
              <Field label="Meeting Link">
                <input className={inputCls} placeholder="https://meet.google.com/…" value={meeting.meetingUrl || ""} onChange={(e) => setMeeting({ ...meeting, meetingUrl: e.target.value })} onBlur={(e) => patch({ meetingUrl: e.target.value })} />
              </Field>
            </div>
            {meeting.meetingUrl && (
              <a href={meeting.meetingUrl} target="_blank" rel="noopener noreferrer">
                <Button variant="secondary" className="w-full justify-center">
                  <Video size={14} /> Join Meeting
                </Button>
              </a>
            )}

            {relatedName && (
              <p className="text-xs text-ink/40">
                Related {relatedLabel}: <span className="font-medium text-ink/60">{relatedName}</span>
              </p>
            )}

            {meeting.agenda && (
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wide text-ink/40 mb-1">Agenda</h4>
                <p className="text-sm text-ink/70 whitespace-pre-wrap">{meeting.agenda}</p>
              </div>
            )}

            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wide text-ink/40 mb-2">Participants</h4>
              {!participants ? (
                <p className="text-xs text-ink/35">Loading…</p>
              ) : (
                <div className="space-y-1.5">
                  {participants.map((p) => (
                    <div key={p.id} className="flex items-center gap-2 text-sm">
                      <span className={`shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-semibold ${avatarColor(p.userId)}`}>
                        {initials(userName(p.userId))}
                      </span>
                      <span className="text-ink/80 flex-1 min-w-0 truncate">
                        {userName(p.userId)} {p.role === "organizer" && <span className="text-ink/35 text-xs">(organizer)</span>}
                      </span>
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          p.response === "Accepted" ? "bg-emerald-50 text-emerald-700" : p.response === "Declined" ? "bg-red-50 text-red-700" : "bg-ink/10 text-ink/50"
                        }`}
                      >
                        {p.response}
                      </span>
                    </div>
                  ))}
                  {participants.length === 0 && <p className="text-xs text-ink/35">No participants.</p>}
                </div>
              )}
              {(() => {
                const self = participants?.find((p) => p.userId === user?.id);
                if (!self) return null;
                return (
                  <div className="flex gap-2 mt-2">
                    <Button variant="secondary" onClick={() => respond(self.id, "Accepted")}>Accept</Button>
                    <Button variant="secondary" onClick={() => respond(self.id, "Declined")}>Decline</Button>
                  </div>
                );
              })()}
            </div>

            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wide text-ink/40 mb-2">Notes</h4>
              {!notes ? (
                <p className="text-xs text-ink/35">Loading…</p>
              ) : (
                <div className="space-y-2">
                  {notes.map((n) => (
                    <div key={n.id} className="text-sm bg-base/50 rounded-lg p-2.5">
                      <p className="text-ink/80 whitespace-pre-wrap">{n.content}</p>
                      <p className="text-xs text-ink/35 mt-1">{timeAgo(n.createdAt)}</p>
                    </div>
                  ))}
                  {notes.length === 0 && <p className="text-xs text-ink/35">No notes yet.</p>}
                </div>
              )}
              <div className="flex gap-2 mt-2">
                <input className={inputCls} placeholder="Add a note…" value={newNote} onChange={(e) => setNewNote(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addNote()} />
                <Button variant="secondary" onClick={addNote}>Add</Button>
              </div>
            </div>

            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wide text-ink/40 mb-2">Action Items</h4>
              <p className="text-xs text-ink/35 mb-2">Creates a task linked to this meeting.</p>
              <div className="flex gap-2">
                <input className={inputCls} placeholder="e.g. Send proposal" value={newActionItem} onChange={(e) => setNewActionItem(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addActionItem()} />
                <Button variant="secondary" onClick={addActionItem}>Add</Button>
              </div>
            </div>

            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wide text-ink/40 mb-2">Activity</h4>
              {!activity ? (
                <p className="text-xs text-ink/35">Loading…</p>
              ) : (
                <div>
                  {activity.map((event, i) => {
                    const meta = ACTIVITY_LABEL[event.type] || { label: event.type, emoji: "○" };
                    return (
                      <div key={event.id} className="flex gap-3">
                        <div className="flex flex-col items-center">
                          <span className="w-6 h-6 rounded-full bg-base flex items-center justify-center text-xs shrink-0">{meta.emoji}</span>
                          {i < activity.length - 1 && <span className="w-px flex-1 bg-border my-0.5" />}
                        </div>
                        <div className="pb-4">
                          <p className="text-sm text-ink/80 font-medium">{meta.label}</p>
                          <p className="text-xs text-ink/35 font-mono mt-0.5">{new Date(event.createdAt).toLocaleString()}</p>
                        </div>
                      </div>
                    );
                  })}
                  {activity.length === 0 && <p className="text-xs text-ink/35">No activity yet.</p>}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function MeetingListItem({ meeting, relatedRecords, onOpen }) {
  const relatedLabel = RELATABLE_TYPES.find((t) => t.value === meeting.linkedEntityType)?.label;
  const relatedName = relatedRecordName(relatedRecords, meeting.linkedEntityType, meeting.linkedEntityId);
  return (
    <div className="p-4 border-b border-border last:border-0 hover:bg-base/50 cursor-pointer" onClick={() => onOpen(meeting.id)}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-ink truncate">{meeting.title}</p>
          {relatedName && <p className="text-xs text-ink/40 mt-0.5">{relatedLabel}: {relatedName}</p>}
          <div className="flex items-center flex-wrap gap-x-3 gap-y-1 mt-1.5 text-xs text-ink/50">
            <span className="inline-flex items-center gap-1">
              <Clock size={12} /> {formatDate(meeting.scheduledStart)} · {fmtTime(meeting.scheduledStart)}
            </span>
            {meeting.location && (
              <span className="inline-flex items-center gap-1">
                <MapPin size={12} /> {meeting.location}
              </span>
            )}
            <span className="text-ink/40">{meeting.meetingType}</span>
          </div>
        </div>
        <span className={`shrink-0 text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_CLS[meeting.status] || "bg-ink/10 text-ink/50"}`}>{meeting.status}</span>
      </div>
    </div>
  );
}

function CalendarView({ meetings, onOpen }) {
  const [mode, setMode] = useState("month");
  const [anchor, setAnchor] = useState(new Date());

  const shift = (dir) => {
    const d = new Date(anchor);
    if (mode === "month") d.setMonth(d.getMonth() + dir);
    else if (mode === "week") d.setDate(d.getDate() + dir * 7);
    else d.setDate(d.getDate() + dir);
    setAnchor(d);
  };

  const meetingsOn = (day) => meetings.filter((m) => sameDay(m.scheduledStart, day));

  const label = useMemo(() => {
    if (mode === "month") return anchor.toLocaleDateString(undefined, { month: "long", year: "numeric" });
    if (mode === "day") return anchor.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" });
    const start = new Date(anchor);
    start.setDate(start.getDate() - start.getDay());
    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    return `${start.toLocaleDateString(undefined, { month: "short", day: "numeric" })} – ${end.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}`;
  }, [anchor, mode]);

  const monthGrid = useMemo(() => {
    const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
    const gridStart = new Date(first);
    gridStart.setDate(gridStart.getDate() - gridStart.getDay());
    const days = [];
    for (let i = 0; i < 42; i++) {
      const d = new Date(gridStart);
      d.setDate(d.getDate() + i);
      days.push(d);
    }
    return days;
  }, [anchor]);

  const weekDays = useMemo(() => {
    const start = new Date(anchor);
    start.setDate(start.getDate() - start.getDay());
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      return d;
    });
  }, [anchor]);

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <button onClick={() => shift(-1)} className="p-1.5 rounded-lg hover:bg-base text-ink/50">
            <ChevronLeft size={16} />
          </button>
          <span className="text-sm font-semibold text-ink w-56">{label}</span>
          <button onClick={() => shift(1)} className="p-1.5 rounded-lg hover:bg-base text-ink/50">
            <ChevronRight size={16} />
          </button>
          <button onClick={() => setAnchor(new Date())} className="text-xs font-medium text-primary hover:underline ml-1">
            Today
          </button>
        </div>
        <div className="flex border border-border rounded-lg overflow-hidden">
          {["month", "week", "day"].map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`px-3 py-1.5 text-xs font-medium capitalize ${mode === m ? "bg-primary text-white" : "bg-white text-ink/50"}`}
            >
              {m}
            </button>
          ))}
        </div>
      </div>

      {mode === "month" && (
        <div>
          <div className="grid grid-cols-7 text-xs font-semibold text-ink/40 mb-1">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
              <div key={d} className="px-1 py-1 text-center">{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {monthGrid.map((day, i) => {
              const inMonth = day.getMonth() === anchor.getMonth();
              const dayMeetings = meetingsOn(day);
              const isToday = sameDay(day, new Date());
              return (
                <div key={i} className={`min-h-[84px] rounded-lg border border-border p-1.5 ${inMonth ? "bg-white" : "bg-base/40"}`}>
                  <p className={`text-xs mb-1 ${isToday ? "font-bold text-primary" : inMonth ? "text-ink/50" : "text-ink/25"}`}>{day.getDate()}</p>
                  <div className="space-y-0.5">
                    {dayMeetings.slice(0, 3).map((m) => (
                      <button
                        key={m.id}
                        onClick={() => onOpen(m.id)}
                        className="w-full text-left text-[11px] leading-tight px-1 py-0.5 rounded bg-primary/10 text-primary truncate hover:bg-primary/20"
                        title={m.title}
                      >
                        {fmtTime(m.scheduledStart)} {m.title}
                      </button>
                    ))}
                    {dayMeetings.length > 3 && <p className="text-[10px] text-ink/35 px-1">+{dayMeetings.length - 3} more</p>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {mode === "week" && (
        <div className="grid grid-cols-7 gap-1">
          {weekDays.map((day, i) => {
            const dayMeetings = meetingsOn(day).sort((a, b) => new Date(a.scheduledStart) - new Date(b.scheduledStart));
            const isToday = sameDay(day, new Date());
            return (
              <div key={i} className="min-h-[220px] rounded-lg border border-border p-1.5 bg-white">
                <p className={`text-xs mb-1 font-medium ${isToday ? "text-primary font-bold" : "text-ink/50"}`}>
                  {day.toLocaleDateString(undefined, { weekday: "short", day: "numeric" })}
                </p>
                <div className="space-y-1">
                  {dayMeetings.map((m) => (
                    <button key={m.id} onClick={() => onOpen(m.id)} className="w-full text-left text-[11px] leading-tight px-1.5 py-1 rounded bg-primary/10 text-primary hover:bg-primary/20">
                      <div className="font-medium truncate">{m.title}</div>
                      <div className="text-[10px] opacity-70">{fmtTime(m.scheduledStart)}</div>
                    </button>
                  ))}
                  {dayMeetings.length === 0 && <p className="text-[11px] text-ink/25">—</p>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {mode === "day" && (
        <div className="space-y-2">
          {meetingsOn(anchor)
            .sort((a, b) => new Date(a.scheduledStart) - new Date(b.scheduledStart))
            .map((m) => (
              <div key={m.id} className="flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-base/50 cursor-pointer" onClick={() => onOpen(m.id)}>
                <span className="text-xs font-mono text-ink/50 w-16 shrink-0">{fmtTime(m.scheduledStart)}</span>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-ink truncate">{m.title}</p>
                  <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${STATUS_CLS[m.status] || "bg-ink/10 text-ink/50"}`}>{m.status}</span>
                </div>
              </div>
            ))}
          {meetingsOn(anchor).length === 0 && <p className="text-sm text-ink/35 py-6 text-center">No meetings on this day.</p>}
        </div>
      )}
    </Card>
  );
}

export default function Meetings() {
  const router = useRouter();
  const { canManage } = useAuth();
  const [meetings, setMeetings] = useState([]);
  const [users, setUsers] = useState([]);
  const [relatedRecords, setRelatedRecords] = useState({ lead: [], deal: [], contact: [], company: [], task: [] });
  const [loading, setLoading] = useState(true);

  const [tab, setTab] = useState("upcoming");
  const [view, setView] = useState("list");
  const [statusFilter, setStatusFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [search, setSearch] = useState("");

  const [modal, setModal] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [drawerId, setDrawerId] = useState(null);

  // Landed here from the global "+ Create" menu (Layout.jsx).
  useEffect(() => {
    if (router.isReady && router.query.create === "1" && canManage) {
      setModal(true);
      router.replace("/app/meetings", undefined, { shallow: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router.isReady, router.query.create, canManage]);

  // Deep link from the Activity Timeline / global search (?open=<meetingId>)
  // — opens the same drawer clicking the card would.
  useEffect(() => {
    if (router.isReady && router.query.open) {
      setDrawerId(router.query.open);
      router.replace("/app/meetings", undefined, { shallow: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router.isReady, router.query.open]);

  const load = () => {
    // meetings/users have no .catch() of their own (unlike the five
    // "related record" lookups below, which are allowed to come back
    // empty) — a real failure on either used to reject the whole
    // Promise.all with nothing downstream to catch it, so setLoading(false)
    // never ran and the page was stuck showing "Loading…" indefinitely,
    // with no error and no way out short of a hard refresh. The .finally()
    // guarantees loading always clears; the .catch() keeps that failure
    // from also being an unhandled promise rejection.
    Promise.all([
      api.get("/meetings"),
      api.get("/users"),
      api.get("/leads").catch(() => ({ data: [] })),
      api.get("/deals").catch(() => ({ data: [] })),
      api.get("/contacts").catch(() => ({ data: [] })),
      api.get("/companies").catch(() => ({ data: [] })),
      api.get("/tasks").catch(() => ({ data: [] })),
    ])
      .then(([m, u, lead, deal, contact, company, task]) => {
        setMeetings(m.data);
        setUsers(u.data);
        setRelatedRecords({ lead: lead.data, deal: deal.data, contact: contact.data, company: company.data, task: task.data });
      })
      .catch((err) => {
        // eslint-disable-next-line no-console
        console.error("Failed to load meetings:", err);
      })
      .finally(() => setLoading(false));
  };
  useEffect(() => {
    load();
  }, []);
  useLiveCollection(["meetings", "meeting_participants", "meeting_notes"], load);

  // A meeting resolved early (or logged after the fact with a future
  // scheduledStart) shouldn't linger in "Upcoming" once it's Completed,
  // Cancelled, or a No Show — those are done regardless of the clock.
  const isSettled = (m) => ["Completed", "Cancelled", "No Show"].includes(m.status);

  const filtered = useMemo(() => {
    const now = new Date();
    let list = meetings.filter((m) => (tab === "upcoming" ? new Date(m.scheduledStart) >= now && !isSettled(m) : new Date(m.scheduledStart) < now || isSettled(m)));
    if (statusFilter) list = list.filter((m) => m.status === statusFilter);
    if (typeFilter) list = list.filter((m) => m.meetingType === typeFilter);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter((m) => m.title.toLowerCase().includes(q) || (m.description || "").toLowerCase().includes(q));
    }
    return [...list].sort((a, b) => (tab === "upcoming" ? 1 : -1) * (new Date(a.scheduledStart) - new Date(b.scheduledStart)));
  }, [meetings, tab, statusFilter, typeFilter, search]);

  const save = async () => {
    const payload = {
      title: form.title,
      description: form.description,
      agenda: form.agenda,
      scheduledStart: new Date(form.scheduledStart).toISOString(),
      scheduledEnd: form.scheduledEnd ? new Date(form.scheduledEnd).toISOString() : undefined,
      location: form.location,
      meetingUrl: form.meetingUrl,
      meetingType: form.meetingType,
      participantIds: form.participantIds,
      linkedEntityType: form.linkedEntityType && form.linkedEntityId ? form.linkedEntityType : null,
      linkedEntityId: form.linkedEntityType && form.linkedEntityId ? form.linkedEntityId : null,
    };
    await api.post("/meetings", payload);
    setModal(false);
    setForm(emptyForm);
    load();
  };

  const toggleParticipant = (userId) => {
    setForm((f) => ({
      ...f,
      participantIds: f.participantIds.includes(userId) ? f.participantIds.filter((id) => id !== userId) : [...f.participantIds, userId],
    }));
  };

  return (
    <div>
      <PageHeader
        title="Meetings"
        subtitle="Schedule, track, and follow up on every meeting."
        action={canManage && <Button onClick={() => setModal(true)}><Plus size={15} /> Add Meeting</Button>}
      />

      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <div className="flex items-center gap-2">
          <div className="flex border border-border rounded-lg overflow-hidden">
            <button onClick={() => setView("list")} className={`p-2 ${view === "list" ? "bg-primary text-white" : "bg-white text-ink/50"}`} title="List view">
              <ListIcon size={15} />
            </button>
            <button onClick={() => setView("calendar")} className={`p-2 ${view === "calendar" ? "bg-primary text-white" : "bg-white text-ink/50"}`} title="Calendar view">
              <CalendarRange size={15} />
            </button>
          </div>
          {view === "list" && (
            <div className="flex gap-2">
              {[
                { value: "upcoming", label: "Upcoming" },
                { value: "past", label: "Past" },
              ].map((t) => (
                <button
                  key={t.value}
                  onClick={() => setTab(t.value)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium border ${
                    tab === t.value ? "bg-primary text-white border-primary" : "bg-white border-border text-ink/60"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          )}
        </div>
        {view === "list" && (
          <div className="flex items-center gap-2">
            <input type="search" placeholder="Search meetings…" value={search} onChange={(e) => setSearch(e.target.value)} className={`${inputCls} w-56`} />
            <select className={inputCls} style={{ width: "auto" }} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="">All Statuses</option>
              {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <select className={inputCls} style={{ width: "auto" }} value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
              <option value="">All Types</option>
              {COMMON_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
        )}
      </div>

      {loading ? (
        <Card className="p-8 text-ink/40 text-sm">Loading…</Card>
      ) : view === "calendar" ? (
        <CalendarView meetings={meetings} onOpen={setDrawerId} />
      ) : (
        <Card>
          {filtered.length === 0 ? (
            <EmptyState
              icon={CalendarRange}
              title={tab === "upcoming" ? "No upcoming meetings" : "No past meetings"}
              subtitle={tab === "upcoming" ? "Schedule a meeting to get started." : "Meetings you've had will show up here."}
              primaryAction={canManage && tab === "upcoming" && <Button onClick={() => setModal(true)}><Plus size={15} /> Add Meeting</Button>}
            />
          ) : (
            filtered.map((m) => <MeetingListItem key={m.id} meeting={m} relatedRecords={relatedRecords} onOpen={setDrawerId} />)
          )}
        </Card>
      )}

      <Modal open={modal} onClose={() => setModal(false)} title="Add Meeting" wide>
        <Field label="Title"><input className={inputCls} placeholder="e.g. Demo with ABC Technologies" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></Field>
        <Field label="Description"><textarea className={inputCls} rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Field>
        <Field label="Agenda"><textarea className={inputCls} rows={2} value={form.agenda} onChange={(e) => setForm({ ...form, agenda: e.target.value })} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Start"><input type="datetime-local" className={inputCls} value={form.scheduledStart} onChange={(e) => setForm({ ...form, scheduledStart: e.target.value })} /></Field>
          <Field label="End"><input type="datetime-local" className={inputCls} value={form.scheduledEnd} onChange={(e) => setForm({ ...form, scheduledEnd: e.target.value })} /></Field>
          <Field label="Type">
            <select className={inputCls} value={form.meetingType} onChange={(e) => setForm({ ...form, meetingType: e.target.value })}>
              {COMMON_TYPES.map((t) => <option key={t}>{t}</option>)}
            </select>
          </Field>
          <Field label="Location"><input className={inputCls} placeholder="Zoom, office, etc." value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} /></Field>
          <Field label="Meeting Link (optional)"><input className={inputCls} placeholder="https://meet.google.com/…" value={form.meetingUrl} onChange={(e) => setForm({ ...form, meetingUrl: e.target.value })} /></Field>
        </div>
        <Field label="Related To (optional)">
          <div className="flex flex-wrap gap-2 mb-2">
            {RELATABLE_TYPES.map((t) => (
              <button
                key={t.value}
                type="button"
                onClick={() => setForm({ ...form, linkedEntityType: form.linkedEntityType === t.value ? "" : t.value, linkedEntityId: "" })}
                className={`text-xs px-2.5 py-1 rounded-full border ${
                  form.linkedEntityType === t.value ? "bg-primary text-white border-primary" : "bg-white border-border text-ink/60"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
          {form.linkedEntityType && (
            <select className={inputCls} value={form.linkedEntityId} onChange={(e) => setForm({ ...form, linkedEntityId: e.target.value })}>
              <option value="">
                Select a {RELATABLE_TYPES.find((t) => t.value === form.linkedEntityType)?.label.toLowerCase()}…
              </option>
              {(relatedRecords[form.linkedEntityType] || []).map((r) => {
                const nameKey = RELATABLE_TYPES.find((t) => t.value === form.linkedEntityType).nameKey;
                return (
                  <option key={r.id} value={r.id}>
                    {r[nameKey] || r.name || r.title}
                  </option>
                );
              })}
            </select>
          )}
        </Field>
        <Field label="Participants">
          <div className="flex flex-wrap gap-2">
            {users.map((u) => (
              <button
                key={u.id}
                type="button"
                onClick={() => toggleParticipant(u.id)}
                className={`text-xs px-2.5 py-1 rounded-full border ${
                  form.participantIds.includes(u.id) ? "bg-primary text-white border-primary" : "bg-white border-border text-ink/60"
                }`}
              >
                {u.name}
              </button>
            ))}
          </div>
        </Field>
        <div className="flex justify-end gap-2 mt-2">
          <Button variant="secondary" onClick={() => setModal(false)}>Cancel</Button>
          <Button onClick={save} disabled={!form.title.trim() || !form.scheduledStart}>Save Meeting</Button>
        </div>
      </Modal>

      <MeetingDrawer meetingId={drawerId} users={users} relatedRecords={relatedRecords} onClose={() => setDrawerId(null)} onChanged={load} />
    </div>
  );
}
