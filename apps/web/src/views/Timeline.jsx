import { useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import api from "../api/client";
import { Card, PageHeader, inputCls } from "../components/ui";
import useLiveCollection from "../lib/useLiveCollection";

const PAGE_SIZE = 50;

const DATE_PRESETS = ["Today", "Yesterday", "This Week", "Last Month", "All"];

function presetRange(preset) {
  const now = new Date();
  const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  if (preset === "Today") {
    const from = startOfDay(now);
    return { from: from.toISOString(), to: null };
  }
  if (preset === "Yesterday") {
    const from = new Date(startOfDay(now));
    from.setDate(from.getDate() - 1);
    const to = startOfDay(now);
    return { from: from.toISOString(), to: to.toISOString() };
  }
  if (preset === "This Week") {
    const from = new Date(startOfDay(now));
    from.setDate(from.getDate() - from.getDay());
    return { from: from.toISOString(), to: null };
  }
  if (preset === "Last Month") {
    const from = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const to = new Date(now.getFullYear(), now.getMonth(), 1);
    return { from: from.toISOString(), to: to.toISOString() };
  }
  return { from: null, to: null };
}

// Friendly label + icon per event type — falls back to the raw type string
// for anything not explicitly named here, so a new event type added later
// (a new rule, a new module) shows up immediately instead of being hidden.
const TYPE_META = {
  "task.created": { label: "Task created", emoji: "✅" },
  "task.updated": { label: "Task updated", emoji: "✏️" },
  "task.status_changed": { label: "Task status changed", emoji: "🔁" },
  "task.deleted": { label: "Task deleted", emoji: "🗑️" },
  "comment.created": { label: "Comment added", emoji: "💬" },
  "form.created": { label: "Form created", emoji: "📄" },
  "form.updated": { label: "Form updated", emoji: "📄" },
  "form.deleted": { label: "Form deleted", emoji: "📄" },
  "response.created": { label: "Form submitted", emoji: "📥" },
  "response.deleted": { label: "Response deleted", emoji: "📥" },
  "approval.pending": { label: "Approval pending", emoji: "⏳" },
  "approval.approved": { label: "Approval approved", emoji: "✅" },
  "approval.rejected": { label: "Approval rejected", emoji: "❌" },
  "lead.created": { label: "Lead created", emoji: "🧲" },
  "lead.updated": { label: "Lead updated", emoji: "🧲" },
  "lead.deleted": { label: "Lead deleted", emoji: "🧲" },
  "lead.assigned": { label: "Lead assigned", emoji: "🧲" },
  "deal.created": { label: "Deal created", emoji: "🤝" },
  "deal.updated": { label: "Deal updated", emoji: "🤝" },
  "deal.deleted": { label: "Deal deleted", emoji: "🤝" },
  "contact.created": { label: "Contact created", emoji: "👤" },
  "company.created": { label: "Company created", emoji: "🏢" },
  "payment.success": { label: "Payment received", emoji: "💳" },
  "meeting.created": { label: "Meeting scheduled", emoji: "📅" },
  "meeting.updated": { label: "Meeting updated", emoji: "📅" },
  "meeting.status_changed": { label: "Meeting status changed", emoji: "🔁" },
  "meeting.deleted": { label: "Meeting deleted", emoji: "🗑️" },
  "meeting.participant_responded": { label: "Meeting response", emoji: "🙋" },
  "meeting.note_added": { label: "Meeting note added", emoji: "📝" },
};

function typeMeta(type) {
  return TYPE_META[type] || { label: type, emoji: "•" };
}

// The entity types this account has real events for, matched against the
// list/detail page each type's records live on — used to make an
// activity's title a real link. Falls back to no link when there's
// nowhere sensible to send someone (e.g. a payment, or an entity type
// with no dedicated page).
const ENTITY_LINK = {
  task: (event) => `/app/tasks?open=${event.entityId}`,
  form: (event) => `/app/forms/${event.entityId}/build`,
  response: (event) => (event.payload?.formId ? `/app/forms/${event.payload.formId}/responses` : null),
  lead: () => "/app/leads",
  deal: () => "/app/deals",
  contact: () => "/app/contacts",
  company: () => "/app/companies",
  meeting: (event) => `/app/meetings?open=${event.entityId}`,
};

function eventTitle(event) {
  const p = event.payload || {};
  const name = p.name || p.title || p.formName;
  const meta = typeMeta(event.type);
  return name ? `${meta.label}: ${name}` : meta.label;
}

function groupByDay(events) {
  const groups = [];
  let currentKey = null;
  const today = new Date().toDateString();
  const yesterday = new Date(Date.now() - 86400000).toDateString();
  for (const event of events) {
    const day = new Date(event.createdAt).toDateString();
    const key = day === today ? "Today" : day === yesterday ? "Yesterday" : new Date(event.createdAt).toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" });
    if (key !== currentKey) {
      groups.push({ key, events: [] });
      currentKey = key;
    }
    groups[groups.length - 1].events.push(event);
  }
  return groups;
}

export default function Timeline() {
  const [meta, setMeta] = useState(null);
  const [sourceFilter, setSourceFilter] = useState("");
  const [actorFilter, setActorFilter] = useState("");
  const [datePreset, setDatePreset] = useState("Today");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [list, setList] = useState(null);

  const loadMeta = () => api.get("/events/meta/sources").then((r) => setMeta(r.data));
  const loadList = () => {
    const { from, to } = presetRange(datePreset);
    const params = new URLSearchParams({ page, limit: PAGE_SIZE });
    if (sourceFilter) params.set("source", sourceFilter);
    if (actorFilter) params.set("actorId", actorFilter);
    if (search.trim()) params.set("search", search.trim());
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    return api.get(`/events?${params.toString()}`).then((r) => setList(r.data));
  };

  useEffect(() => {
    loadMeta();
  }, []);
  useEffect(() => {
    setPage(1);
  }, [sourceFilter, actorFilter, datePreset, search]);
  useEffect(() => {
    loadList();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sourceFilter, actorFilter, datePreset, search, page]);
  useLiveCollection(["events"], () => {
    loadList();
    loadMeta();
  });

  const grouped = useMemo(() => (list ? groupByDay(list.items) : []), [list]);

  return (
    <div>
      <PageHeader title="Activity Timeline" subtitle="Every task, form, approval, and pipeline change — one chronological audit trail." />

      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <div className="relative">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink/30" />
          <input
            type="search"
            placeholder="Search activity…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={`${inputCls} w-64 pl-8`}
          />
        </div>
        <div className="flex items-center gap-2">
          {meta?.actors?.length > 0 && (
            <select className={inputCls} style={{ width: "auto" }} value={actorFilter} onChange={(e) => setActorFilter(e.target.value)}>
              <option value="">Everyone</option>
              {meta.actors.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          )}
          {DATE_PRESETS.map((p) => (
            <button
              key={p}
              onClick={() => setDatePreset(p)}
              className={`px-2.5 py-1 rounded-full text-xs font-medium border ${
                datePreset === p ? "bg-ink text-white border-ink" : "bg-white border-border text-ink/50 hover:border-ink/20"
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {meta && meta.sources.length > 0 && (
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          <button
            onClick={() => setSourceFilter("")}
            className={`px-2.5 py-1 rounded-full text-xs font-medium border ${
              sourceFilter === "" ? "bg-primary text-white border-primary" : "bg-white border-border text-ink/50 hover:border-ink/20"
            }`}
          >
            All Activities
          </button>
          {meta.sources.map((s) => (
            <button
              key={s}
              onClick={() => setSourceFilter(s)}
              className={`px-2.5 py-1 rounded-full text-xs font-medium border capitalize ${
                sourceFilter === s ? "bg-primary text-white border-primary" : "bg-white border-border text-ink/50 hover:border-ink/20"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {!list ? (
        <Card className="p-8 text-ink/40 text-sm">Loading…</Card>
      ) : list.items.length === 0 ? (
        <Card className="p-10 flex flex-col items-center text-center">
          <p className="font-medium text-ink/70">No activity in this range.</p>
          <p className="text-sm text-ink/40 mt-1">Try a wider date range or clearing filters.</p>
        </Card>
      ) : (
        <div className="space-y-6">
          {grouped.map((group) => (
            <div key={group.key}>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-ink/40 mb-2">{group.key}</h3>
              <Card>
                {group.events.map((event) => {
                  const meta2 = typeMeta(event.type);
                  const linkFn = ENTITY_LINK[event.entityType];
                  const href = linkFn ? linkFn(event) : null;
                  const content = (
                    <div className="flex items-start gap-3 p-3.5 border-b border-border last:border-0 hover:bg-base/50">
                      <span className="w-7 h-7 rounded-full bg-base flex items-center justify-center text-sm shrink-0">{meta2.emoji}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-ink/85">{eventTitle(event)}</p>
                        <div className="flex items-center gap-2 text-xs text-ink/35 mt-0.5">
                          <span className="capitalize">{event.source}</span>
                          <span>·</span>
                          <span>{new Date(event.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                          {event.actorName && (
                            <>
                              <span>·</span>
                              <span>{event.actorName}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                  return href ? (
                    <a key={event.id} href={href} className="block">
                      {content}
                    </a>
                  ) : (
                    <div key={event.id}>{content}</div>
                  );
                })}
              </Card>
            </div>
          ))}
          {list.totalPages > 1 && (
            <div className="flex items-center justify-center gap-3 text-xs text-ink/40">
              <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="disabled:opacity-40">
                ← Newer
              </button>
              <span>
                Page {list.page} of {list.totalPages}
              </span>
              <button disabled={page >= list.totalPages} onClick={() => setPage((p) => p + 1)} className="disabled:opacity-40">
                Older →
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
