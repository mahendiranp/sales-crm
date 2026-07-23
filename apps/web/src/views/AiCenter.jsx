import { useEffect, useRef, useState } from "react";
import { PartyPopper, X, ChevronDown } from "lucide-react";
import api from "../api/client";
import { useToast } from "../components/ui/Toast";
import { Card, PageHeader, inputCls } from "../components/ui";
import Pagination from "../components/Pagination";
import useLiveCollection from "../lib/useLiveCollection";
import { timeAgo, formatDate } from "../lib/format";

const PAGE_SIZE = 20;

const STATUS_TABS = ["OPEN", "RESOLVED", "DISMISSED", "ALL"];
const STATUS_TAB_LABEL = { OPEN: "Open", RESOLVED: "Resolved", DISMISSED: "Dismissed", ALL: "All" };
const PRIORITY_FILTERS = ["ALL", "CRITICAL", "HIGH", "MEDIUM", "LOW"];
const SORT_OPTIONS = [
  { value: "score", label: "Highest Risk" },
  { value: "score_asc", label: "Lowest Risk" },
  { value: "newest", label: "Newest" },
  { value: "oldest", label: "Oldest" },
  { value: "updated", label: "Recently Updated" },
];

// Score bands the Business Health header reads off of — a bare "0/100"
// reads as "the product is broken" with no context; a labeled range gives
// it meaning at a glance. "label" is deliberately the *status*, kept
// visually separate from the score itself so "Critical" never reads as
// though it's describing the number.
const HEALTH_BANDS = [
  { min: 90, label: "Excellent", emoji: "🟢", tone: "text-emerald-600" },
  { min: 75, label: "Good", emoji: "🟢", tone: "text-emerald-600" },
  { min: 50, label: "Needs Attention", emoji: "🟡", tone: "text-amber-600" },
  { min: 25, label: "At Risk", emoji: "🟠", tone: "text-orange-600" },
  { min: 0, label: "Critical", emoji: "🔴", tone: "text-red-600" },
];
function healthBand(score) {
  return HEALTH_BANDS.find((b) => score >= b.min) || HEALTH_BANDS[HEALTH_BANDS.length - 1];
}

// A recommendation's `score` means the OPPOSITE of the Business Health
// score above — higher is worse (more overdue, more spiking), not better —
// so it needs its own, inverted color scale. Coloring it green at high
// values (an earlier version of this bar did) told users a severely
// overdue item was fine.
function riskTone(score) {
  if (score >= 80) return "bg-red-500";
  if (score >= 60) return "bg-orange-500";
  if (score >= 30) return "bg-amber-400";
  return "bg-emerald-500";
}

function TrendBadge({ delta, higherIsBetter = true }) {
  if (delta === null || delta === undefined || delta === 0) return null;
  const improving = higherIsBetter ? delta > 0 : delta < 0;
  const arrow = delta > 0 ? "↑" : "↓";
  return (
    <span className={`text-xs font-medium ${improving ? "text-emerald-600" : "text-red-600"}`}>
      {arrow} {delta > 0 ? "+" : ""}
      {delta} today
    </span>
  );
}

// Rule ids don't map onto the generic Badge component's label-keyed color
// map (components/ui — "High"/"Medium"/"Low"), since recommendations use
// the ALL-CAPS PRIORITY enum from the backend (services/recommendationStore.js).
const PRIORITY_STYLE = {
  CRITICAL: { cls: "bg-red-100 text-red-700", emoji: "🔥" },
  HIGH: { cls: "bg-red-50 text-red-700", emoji: "🔥" },
  MEDIUM: { cls: "bg-amber-50 text-amber-700", emoji: "⚠️" },
  LOW: { cls: "bg-slate-100 text-slate-600", emoji: "ℹ️" },
  INFO: { cls: "bg-blue-50 text-blue-700", emoji: "ℹ️" },
};
function PriorityPill({ priority }) {
  const style = PRIORITY_STYLE[priority] || PRIORITY_STYLE.LOW;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${style.cls}`}>
      <span>{style.emoji}</span>
      {priority}
    </span>
  );
}

// A visual read of `score` (0-100) is faster to scan than a bare number —
// labeled "Risk Score" so what it means is never ambiguous.
function RiskScoreBar({ score }) {
  if (typeof score !== "number") return null;
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="text-xs text-ink/40">Risk Score</span>
      <span className="w-16 h-1.5 rounded-full bg-base overflow-hidden">
        <span className={`block h-full rounded-full ${riskTone(score)}`} style={{ width: `${Math.min(100, score)}%` }} />
      </span>
      <span className="text-xs font-mono text-ink/40">{score}/100</span>
    </span>
  );
}

function HealthStat({ icon, label, value, tone, trend }) {
  return (
    <div>
      <div className="flex items-baseline gap-2">
        <p className={`text-lg sm:text-xl font-display font-bold ${tone || "text-ink"}`}>{value}</p>
        {trend}
      </div>
      <p className="text-xs text-ink/45 mt-0.5">
        {icon} {label}
      </p>
    </div>
  );
}

// A status badge + "who/why" for a decided recommendation — without this,
// the Resolved and Dismissed tabs looked identical to Open, just with the
// buttons removed.
const STATUS_BADGE = {
  RESOLVED: { cls: "bg-emerald-50 text-emerald-700", emoji: "✅", label: "RESOLVED" },
  DISMISSED: { cls: "bg-slate-100 text-slate-600", emoji: "🚫", label: "DISMISSED" },
};
function DecisionBadge({ recommendation }) {
  const badge = STATUS_BADGE[recommendation.status];
  if (!badge) return null;
  const at = recommendation.status === "RESOLVED" ? recommendation.resolvedAt : recommendation.dismissedAt;
  const by = recommendation.status === "RESOLVED" ? recommendation.resolvedBy : recommendation.dismissedBy;
  const reason = recommendation.status === "RESOLVED" ? recommendation.resolveReason : recommendation.dismissReason;
  return (
    <div className="mt-3 border-t border-border pt-3">
      <div className="flex items-center gap-2">
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${badge.cls}`}>
          {badge.emoji} {badge.label}
        </span>
        <span className="text-xs text-ink/45">{at ? timeAgo(at) : ""}</span>
      </div>
      {by && (
        <p className="text-xs text-ink/50 mt-1">
          {badge.label === "RESOLVED" ? "Resolved" : "Dismissed"} by {by}
        </p>
      )}
      {reason && (
        <p className="text-xs text-ink/50 mt-1">
          <span className="font-medium text-ink/60">Reason:</span> {reason}
        </p>
      )}
    </div>
  );
}

// Deterministic, derived entirely from data the page already loaded — no
// AI call. Written so a later AI Observer phase can replace the string
// building with a real generated summary without touching the layout
// around it.
function buildSummary(openItems, health) {
  const bullets = [];
  const overdue = openItems.filter((r) => r.rule === "approval.pending.48h");
  if (overdue.length > 0) {
    bullets.push(`${overdue.length} approval${overdue.length === 1 ? "" : "s"} require attention`);
  }
  const longestWait = overdue.slice().sort((a, b) => (b.payload?.ageHours || 0) - (a.payload?.ageHours || 0))[0];
  if (longestWait?.payload?.ageHours) {
    bullets.push(`Oldest approval waiting ${longestWait.payload.ageHours} hours`);
  }
  if (health) {
    if (health.criticalCount > 0) {
      bullets.push(`${health.criticalCount} critical issue${health.criticalCount === 1 ? "" : "s"} need immediate attention`);
    }
    if (health.trend && health.trend.scoreDelta !== 0) {
      bullets.push(`Business Health ${health.trend.scoreDelta > 0 ? "improved" : "dropped"} to ${health.score}`);
    }
  }
  return bullets;
}

const EVENT_TIMELINE_LABEL = {
  "response.created": { label: "Submitted", emoji: "📝" },
  "approval.pending": { label: "Approval Created", emoji: "📋" },
  "approval.approved": { label: "Approved", emoji: "✅" },
  "approval.rejected": { label: "Rejected", emoji: "❌" },
  "lead.created": { label: "Lead Created", emoji: "👤" },
};

// One dot-and-line row shared by both the Timeline and History sections
// below — a vertical connector reads faster than a flat list once there
// are more than two or three steps.
function TimelineStep({ emoji = "○", title, subtitle, at, exact, last }) {
  return (
    <div className="flex gap-3">
      <div className="flex flex-col items-center">
        <span className="w-6 h-6 rounded-full bg-base flex items-center justify-center text-xs shrink-0">{emoji}</span>
        {!last && <span className="w-px flex-1 bg-border my-0.5" />}
      </div>
      <div className="pb-4">
        <p className="text-sm text-ink/80 font-medium">{title}</p>
        {subtitle && <p className="text-xs text-ink/45">{subtitle}</p>}
        {at && <p className="text-xs text-ink/35 font-mono mt-0.5">{exact ? new Date(at).toLocaleString() : formatDate(at)}</p>}
      </div>
    </div>
  );
}

// Slides in from the right rather than a centered modal — meant to feel
// like an investigation panel kept open while working the list behind it.
function DetailsDrawer({ recommendationId, onClose }) {
  const [data, setData] = useState(null);

  useEffect(() => {
    if (!recommendationId) return;
    setData(null);
    api.get(`/recommendations/${recommendationId}/details`).then((r) => setData(r.data));
  }, [recommendationId]);

  if (!recommendationId) return null;
  const rec = data?.recommendation;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-ink/40" onClick={onClose}>
      <div className="bg-white w-full max-w-[440px] h-full overflow-y-auto shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-border sticky top-0 bg-white z-10">
          <h3 className="font-display font-semibold text-lg">{rec ? rec.title : "Investigation"}</h3>
          <button onClick={onClose} className="text-ink/40 hover:text-ink">
            <X size={19} />
          </button>
        </div>

        {!data ? (
          <p className="text-ink/40 text-sm p-5">Loading…</p>
        ) : (
          <div className="p-5 space-y-6">
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wide text-ink/40 mb-1.5">Priority</h4>
              <PriorityPill priority={rec.priority} />
            </div>

            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wide text-ink/40 mb-1.5">Business Impact</h4>
              <p className="text-sm text-ink/70">{rec.reason}</p>
            </div>

            {/* Relative time is enough on the card in the list; here in the
                drawer — where someone's actually investigating — the exact
                timestamp matters too. */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wide text-ink/40 mb-1.5">Created</h4>
                <p className="text-sm text-ink/70">{timeAgo(rec.createdAt)}</p>
                <p className="text-xs text-ink/40 font-mono mt-0.5">{new Date(rec.createdAt).toLocaleString()}</p>
              </div>
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wide text-ink/40 mb-1.5">Updated</h4>
                <p className="text-sm text-ink/70">{timeAgo(rec.updatedAt || rec.createdAt)}</p>
                <p className="text-xs text-ink/40 font-mono mt-0.5">{new Date(rec.updatedAt || rec.createdAt).toLocaleString()}</p>
              </div>
            </div>

            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wide text-ink/40 mb-2">Timeline</h4>
              <div>
                {data.timeline.map((event) => {
                  const meta = EVENT_TIMELINE_LABEL[event.type] || { label: event.type, emoji: "○" };
                  return <TimelineStep key={event.id} emoji={meta.emoji} title={meta.label} at={event.createdAt} exact last={false} />;
                })}
                <TimelineStep emoji="✨" title="Recommendation Generated" at={rec.createdAt} exact last={rec.status === "OPEN"} />
                {rec.status !== "OPEN" && (
                  <TimelineStep
                    emoji={STATUS_BADGE[rec.status]?.emoji || "○"}
                    title={STATUS_BADGE[rec.status]?.label || rec.status}
                    at={rec.status === "RESOLVED" ? rec.resolvedAt : rec.dismissedAt}
                    exact
                    last
                  />
                )}
              </div>
            </div>

            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wide text-ink/40 mb-2">History</h4>
              <div>
                {(rec.statusHistory || []).map((h, i, arr) => (
                  <TimelineStep key={i} title={h.status} subtitle={h.actorName || undefined} at={h.at} last={i === arr.length - 1} />
                ))}
              </div>
            </div>

            {rec.status === "OPEN" && rec.actions?.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wide text-ink/40 mb-2">Actions</h4>
                <div className="flex flex-wrap gap-2">
                  {rec.actions.map((action) => (
                    <span key={action.id} className="px-2.5 py-1 rounded-lg text-xs font-medium bg-base text-ink/60">
                      {action.label}
                    </span>
                  ))}
                </div>
                <p className="text-xs text-ink/35 mt-1.5">Close this panel and use the card's buttons to act.</p>
              </div>
            )}

            {rec.generatedBy && (
              <span className="inline-block text-xs text-ink/40 bg-base px-2 py-0.5 rounded-full">
                Generated by {rec.generatedBy === "RULE_ENGINE" ? "Rule Engine" : rec.generatedBy}
              </span>
            )}

            {data.related?.type === "response" && (
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wide text-ink/40 mb-1.5">Related Response</h4>
                <p className="text-sm text-ink/60 mb-1.5">Reference {data.related.referenceId}</p>
                <a href={`/app/forms/${data.related.formId}/responses`} className="text-sm text-primary font-medium hover:underline">
                  Open Response →
                </a>
              </div>
            )}
            {data.related?.type === "form" && (
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wide text-ink/40 mb-1.5">Related Form</h4>
                <a href={`/app/forms/${data.related.id}/responses`} className="text-sm text-primary font-medium hover:underline">
                  Open {data.related.name} →
                </a>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

const ACTION_STYLE = {
  "notify-approver": { emoji: "📧 ", cls: "bg-primary text-white hover:bg-primary-dark" },
  resolve: { emoji: "", cls: "bg-white text-blue-700 border border-blue-300 hover:bg-blue-50" },
};
const DEFAULT_ACTION_STYLE = { emoji: "", cls: "bg-white text-ink border border-border hover:bg-base" };
const CONFIRMED_LABEL = { resolve: "✔ Resolved", dismiss: "✔ Dismissed" };

// A short, human heading for a failed action's feedback — turns a bare
// error sentence into a scannable badge instead of a stray line of text
// that reads as disconnected from the rest of the card.
function feedbackHeading(message) {
  const lower = (message || "").toLowerCase();
  if (lower.includes("deleted")) return "Response Deleted";
  if (lower.includes("no longer")) return "No Longer Available";
  if (lower.includes("no approver")) return "No Approver Found";
  return "Action Failed";
}

// A recommendation's `actions` (see services/rules/*.js) drive its buttons —
// nothing here is hardcoded per rule, so a new rule can introduce a new
// action id and it renders automatically. resolve/dismiss briefly show a
// "✔ Resolved"/"✔ Dismissed" confirmation in place of the button before
// the list reloads (and the card disappears from the Open tab) — without
// that beat, clicking Resolve just made the card vanish with no feedback.
function RecommendationCard({ recommendation, onChanged, onViewDetails, selectable, selected, onToggleSelect }) {
  const [busyAction, setBusyAction] = useState(null);
  const [confirmedAction, setConfirmedAction] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const isOpen = recommendation.status === "OPEN";
  const { payload = {} } = recommendation;

  const runAction = async (actionId) => {
    setBusyAction(actionId);
    setFeedback(null);
    try {
      if (actionId === "resolve") {
        await api.patch(`/recommendations/${recommendation.id}/resolve`);
        setConfirmedAction("resolve");
        setTimeout(onChanged, 700);
      } else if (actionId === "dismiss") {
        await api.patch(`/recommendations/${recommendation.id}/dismiss`);
        setConfirmedAction("dismiss");
        setTimeout(onChanged, 700);
      } else {
        const res = await api.post(`/recommendations/${recommendation.id}/actions/${actionId}`);
        if (res.data?.ok === false) {
          setFeedback({ type: "warning", message: res.data.message || "That action couldn't be completed." });
        } else {
          setFeedback({ type: "success", message: res.data?.message || "Done." });
        }
        // Same delay as resolve/dismiss above, for the same reason:
        // onChanged() (reloadAll) sets the parent's listLoading true,
        // which swaps the whole card grid for a loading placeholder —
        // unmounting this card and wiping the feedback message just set
        // above before it was ever actually visible, if reloaded
        // immediately.
        setTimeout(onChanged, 700);
      }
    } catch (err) {
      setFeedback({ type: "warning", message: err.response?.data?.error || "That action couldn't be completed." });
    } finally {
      setBusyAction(null);
    }
  };

  const primaryActions = recommendation.actions?.filter((a) => a.id !== "resolve" && a.id !== "dismiss") || [];
  const resolveAction = recommendation.actions?.find((a) => a.id === "resolve");
  const dismissAction = recommendation.actions?.find((a) => a.id === "dismiss");
  const actionsDisabled = busyAction !== null || confirmedAction !== null;

  return (
    <Card className="p-4 sm:p-5 hover:shadow-md hover:border-ink/10 transition-shadow">
      <div className="flex flex-col sm:flex-row items-start justify-between gap-4">
        <div className="flex items-start gap-3 min-w-0 flex-1 w-full">
          {selectable && (
            <input
              type="checkbox"
              checked={selected}
              onChange={() => onToggleSelect(recommendation.id)}
              className="mt-0.5 w-4 h-4 rounded border-border shrink-0"
            />
          )}
          <div className="min-w-0 flex-1">
          <div className="flex items-center gap-3 mb-1 flex-wrap">
            <PriorityPill priority={recommendation.priority} />
            <RiskScoreBar score={recommendation.score} />
          </div>
          <h3 className="font-display font-semibold text-ink">{recommendation.title}</h3>
          {typeof payload.ageHours === "number" && <p className="text-sm text-ink/60 mt-1">⏱ Waiting {payload.ageHours} hours</p>}

          {(payload.formName || recommendation.createdAt) && (
            <div className="mt-3 pt-3 border-t border-border grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3 text-sm">
              {payload.formName && (
                <div>
                  <p className="text-xs text-ink/40">📋 Workflow</p>
                  <p className="text-ink/70 mt-0.5">{payload.formName}</p>
                  {payload.waitingFor && (
                    <>
                      <p className="text-xs text-ink/40 mt-2">Assigned Approver</p>
                      <p className="text-ink/70 mt-0.5">{payload.waitingFor}</p>
                    </>
                  )}
                </div>
              )}
              <div>
                <p className="text-xs text-ink/40">🕐 Created</p>
                <p className="text-ink/70 mt-0.5">{timeAgo(recommendation.createdAt)}</p>
              </div>
              <div>
                <p className="text-xs text-ink/40">🔄 Updated</p>
                <p className="text-ink/70 mt-0.5">{timeAgo(recommendation.updatedAt || recommendation.createdAt)}</p>
              </div>
            </div>
          )}

          {isOpen && recommendation.suggestedAction && (
            <div className="mt-3 flex gap-2.5 border-l-4 border-amber-400 bg-amber-50 rounded-r-lg px-3 py-2.5">
              <span className="text-sm shrink-0">💡</span>
              <div>
                <span className="text-xs font-semibold text-amber-900">Recommended Action</span>
                <p className="text-xs text-amber-900 mt-0.5">{recommendation.suggestedAction}</p>
              </div>
            </div>
          )}

          <DecisionBadge recommendation={recommendation} />

          {feedback &&
            (feedback.type === "warning" ? (
              <div className="mt-3 flex gap-2.5 border-l-4 border-red-300 bg-red-50 rounded-r-lg px-3 py-2.5">
                <span className="text-sm shrink-0">⚠️</span>
                <div>
                  <span className="text-xs font-semibold text-red-800">{feedbackHeading(feedback.message)}</span>
                  <p className="text-xs text-red-700 mt-0.5">{feedback.message}</p>
                </div>
              </div>
            ) : (
              <p className="text-xs text-primary mt-2">{feedback.message}</p>
            ))}

          <div className="mt-3 pt-3 border-t border-border flex items-center gap-3">
            <button onClick={() => onViewDetails(recommendation.id)} className="text-xs text-primary font-medium hover:underline">
              View Details →
            </button>
            {recommendation.generatedBy && (
              <span className="text-xs text-ink/40 bg-base px-2 py-0.5 rounded-full">
                Generated by {recommendation.generatedBy === "RULE_ENGINE" ? "Rule Engine" : recommendation.generatedBy}
              </span>
            )}
          </div>
          </div>
        </div>
        {isOpen && (recommendation.actions?.length ?? 0) > 0 && (
          <div className="flex flex-col items-stretch gap-1.5 shrink-0 w-full sm:w-36">
            {primaryActions.map((action) => {
              const style = ACTION_STYLE[action.id] || DEFAULT_ACTION_STYLE;
              return (
                <button
                  key={action.id}
                  disabled={actionsDisabled}
                  onClick={() => runAction(action.id)}
                  className={`w-full text-center px-3 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 ${style.cls}`}
                >
                  {busyAction === action.id ? "..." : `${style.emoji}${action.label}`}
                </button>
              );
            })}
            {primaryActions.length > 0 && (resolveAction || dismissAction) && <div className="border-t border-border my-1" />}
            {resolveAction &&
              (confirmedAction === "resolve" ? (
                <span className="w-full text-center px-3 py-2 rounded-lg text-sm font-medium bg-emerald-50 text-emerald-700">{CONFIRMED_LABEL.resolve}</span>
              ) : (
                <button
                  disabled={actionsDisabled}
                  onClick={() => runAction("resolve")}
                  className="w-full text-center px-3 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 bg-white text-blue-700 border border-blue-300 hover:bg-blue-50"
                >
                  {busyAction === "resolve" ? "..." : resolveAction.label}
                </button>
              ))}
            {dismissAction &&
              (confirmedAction === "dismiss" ? (
                <span className="w-full text-center px-3 py-1.5 text-xs font-medium text-emerald-700">{CONFIRMED_LABEL.dismiss}</span>
              ) : (
                <button
                  disabled={actionsDisabled}
                  onClick={() => runAction("dismiss")}
                  className="w-full text-center px-3 py-1.5 text-xs text-ink/40 hover:text-ink/60 hover:underline transition-colors disabled:opacity-50"
                >
                  {busyAction === "dismiss" ? "..." : dismissAction.label}
                </button>
              ))}
          </div>
        )}
      </div>
    </Card>
  );
}

const MONITORED_AREAS = ["Forms", "Responses", "Approvals", "Payments", "Tasks"];
const FUTURE_SECTIONS = [
  { label: "Business Memory", icon: "🧠" },
  { label: "Daily Brief", icon: "📄" },
  { label: "AI Search", icon: "🔍" },
];

function CardSkeleton() {
  return (
    <Card className="p-5 animate-pulse">
      <div className="h-4 w-20 bg-base rounded-full mb-3" />
      <div className="h-5 w-2/3 bg-base rounded mb-2" />
      <div className="h-3 w-1/3 bg-base rounded" />
    </Card>
  );
}

export default function AiCenter() {
  const toast = useToast();
  const [health, setHealth] = useState(null);
  const [openItems, setOpenItems] = useState([]);
  const [status, setStatus] = useState("OPEN");
  const [priority, setPriority] = useState("ALL");
  const [sort, setSort] = useState("score");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [list, setList] = useState(null);
  const [tabCounts, setTabCounts] = useState({});
  const [detailsId, setDetailsId] = useState(null);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const [listLoading, setListLoading] = useState(true);

  const loadHealth = () => api.get("/recommendations/health").then((r) => setHealth(r.data));
  const loadOpenItems = () => api.get("/recommendations?status=OPEN&limit=100").then((r) => setOpenItems(r.data.items));
  // Fires on every keystroke in the search box (via the `search` state
  // dependency below) plus every bulk action / live db:change event, with
  // several requests routinely in flight at once — nothing here cancels
  // an earlier one when a newer one starts. Without a staleness guard, an
  // old, slow request (e.g. an early partial search string that still
  // happens to match) can resolve *after* a newer one and silently
  // overwrite the current, correct list with stale data — e.g. a bulk
  // resolve's fresh (now-empty) result getting clobbered by an in-flight
  // leftover keystroke request that still shows the item as open. Only
  // ever apply the response if it's still the most recently issued call.
  const loadListRequestId = useRef(0);
  const loadList = () => {
    const requestId = ++loadListRequestId.current;
    setListLoading(true);
    const params = new URLSearchParams({ status, page, limit: PAGE_SIZE, sort });
    if (priority !== "ALL") params.set("priority", priority);
    if (search.trim()) params.set("search", search.trim());
    return api
      .get(`/recommendations?${params.toString()}`)
      .then((r) => {
        if (requestId === loadListRequestId.current) setList(r.data);
      })
      .finally(() => {
        if (requestId === loadListRequestId.current) setListLoading(false);
      });
  };
  const loadTabCounts = () =>
    Promise.all(STATUS_TABS.map((tab) => api.get(`/recommendations?status=${tab}&limit=1`).then((r) => [tab, r.data.total]))).then((entries) =>
      setTabCounts(Object.fromEntries(entries))
    );

  useEffect(() => {
    setPage(1);
    setSelectedIds(new Set());
  }, [status, priority, sort, search]);

  useEffect(() => {
    loadList();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, priority, sort, search, page]);

  useEffect(() => {
    loadHealth();
    loadOpenItems();
    loadTabCounts();
  }, []);

  const reloadAll = () => {
    loadList();
    loadHealth();
    loadOpenItems();
    loadTabCounts();
    setSelectedIds(new Set());
  };
  useLiveCollection(["recommendations"], reloadAll);

  const toggleSelect = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const runBulk = async (action) => {
    setBulkBusy(true);
    try {
      await api.patch(`/recommendations/bulk/${action}`, { ids: [...selectedIds] });
      reloadAll();
    } catch (err) {
      toast.error(err.response?.data?.error || `Couldn't ${action} the selected recommendations.`);
    } finally {
      setBulkBusy(false);
    }
  };

  const band = health ? healthBand(health.score) : null;
  const summary = health ? buildSummary(openItems, health) : [];

  return (
    <div>
      {/* No PageHeader subtitle/action row — "Last analyzed" moved into
          the Business Health card below and the long descriptive subtitle
          dropped; between this and the compressed health card, the whole
          header goes from ~200px to roughly half that. */}
      <h1 className="font-display font-bold text-xl sm:text-2xl text-ink mb-3">✨ AI Center</h1>

      {/* Scrollable chip row instead of wrapping — the three locked,
          future-release tabs are secondary; letting them run off-screen
          rather than wrap keeps Overview from being pushed down a line. */}
      <div className="flex gap-2 mb-4 overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0 sm:overflow-visible">
        <span className="shrink-0 px-3 py-1.5 rounded-full text-xs font-medium border bg-primary text-white border-primary">🏠 Overview</span>
        {FUTURE_SECTIONS.map(({ label, icon }) => (
          <span
            key={label}
            title="Available in a future release"
            className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border bg-white border-border text-ink/35 opacity-50 cursor-not-allowed"
          >
            🔒 {icon} {label}
          </span>
        ))}
      </div>

      {/* Stays pinned while the recommendation list scrolls below it — <main>
          (components/Layout.jsx) is its own overflow-y-auto container, so
          sticky here anchors to that, not the window. */}
      <div className="sticky top-0 z-10 bg-base pb-3">
        <Card className="p-4 sm:p-5">
          {!health ? (
            <p className="text-ink/40 text-sm">Loading business health…</p>
          ) : (
            <>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs text-ink/45 mb-1">Business Health</p>
                  <div className="flex items-baseline gap-2">
                    <p className="text-2xl sm:text-3xl font-display font-bold text-ink">{health.score}/100</p>
                    {health.trend && <TrendBadge delta={health.trend.scoreDelta} />}
                  </div>
                  <p className={`text-xs font-medium mt-1 ${band.tone}`}>
                    {band.emoji} {band.label}
                  </p>
                </div>
                {health.lastScanAt && (
                  <p className="text-xs text-ink/40 text-right shrink-0">Last analyzed<br />{timeAgo(health.lastScanAt)}</p>
                )}
              </div>
              <div className="grid grid-cols-3 gap-3 mt-3 pt-3 border-t border-border">
                <HealthStat icon="⚠️" label="Open" value={health.openCount} />
                <HealthStat icon="🔥" label="Critical" value={health.criticalCount} tone={health.criticalCount > 0 ? "text-red-600" : "text-ink"} />
                <HealthStat icon="✅" label="Resolved Today" value={health.resolvedTodayCount} tone="text-emerald-600" trend={health.trend && <TrendBadge delta={health.trend.resolvedTodayDelta} />} />
              </div>
            </>
          )}
        </Card>
      </div>

      {summary.length > 0 && (
        <Card className="p-4 mb-4">
          <div className="flex items-center justify-between gap-2">
            <h3 className="font-display font-semibold text-sm">✨ Today</h3>
            <button onClick={() => setStatus("OPEN")} className="text-xs text-primary font-medium hover:underline shrink-0">
              See details →
            </button>
          </div>
          <ul className="space-y-1 mt-2">
            {summary.map((line, i) => (
              <li key={i} className="text-sm text-ink/65 truncate">
                • {line}
              </li>
            ))}
          </ul>
        </Card>
      )}

      {list && (
        <p className="text-xs text-ink/35 mb-2">
          Showing {list.items.length} of {list.total} recommendation{list.total === 1 ? "" : "s"}
        </p>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-3 mb-2">
        {/* Horizontal scroll instead of wrapping — four tabs plus counts
            can run wider than a phone screen, and wrapping them wastes a
            second row for what's still just navigation. */}
        <div className="flex gap-2 overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0 sm:overflow-visible">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => setStatus(tab)}
              className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium border ${
                status === tab ? "bg-primary text-white border-primary" : "bg-white border-border text-ink/60 hover:border-ink/20"
              }`}
            >
              {STATUS_TAB_LABEL[tab]}
              {tabCounts[tab] !== undefined ? ` (${tabCounts[tab]})` : ""}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <input
            type="search"
            placeholder="Search by title, workflow, or reason…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={`${inputCls} flex-1 sm:w-56`}
          />
          {/* Native <select> chrome (border-radius, arrow) ignores most of
              inputCls's styling on its own — appearance-none strips it back
              to plain box styling matching the search input, and the
              chevron here replaces the native dropdown arrow that
              appearance-none also removes. */}
          <div className="relative shrink-0">
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value)}
              className={`${inputCls} appearance-none pr-8`}
              style={{ width: "auto" }}
            >
              {SORT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  Sort: {opt.label}
                </option>
              ))}
            </select>
            <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-ink/35 pointer-events-none" />
          </div>
        </div>
      </div>

      {(() => {
        // Nothing to filter when the current status tab itself has zero
        // items — greyed out rather than removed, so the layout doesn't
        // jump when the tab does have items again.
        const tabIsEmpty = tabCounts[status] === 0;
        return (
          <div className={`flex items-center gap-2 mb-4 ${tabIsEmpty ? "opacity-40 pointer-events-none" : ""}`}>
            <span className="text-xs font-medium text-ink/40 mr-1">Priority:</span>
            {PRIORITY_FILTERS.map((p) => (
              <button
                key={p}
                onClick={() => setPriority(p)}
                className={`px-2.5 py-1 rounded-full text-xs font-medium border ${
                  priority === p ? "bg-ink text-white border-ink" : "bg-white border-border text-ink/50 hover:border-ink/20"
                }`}
              >
                {p === "ALL" ? "All" : `${PRIORITY_STYLE[p]?.emoji || ""} ${p}`}
              </button>
            ))}
          </div>
        );
      })()}

      {status === "OPEN" && selectedIds.size > 0 && (
        <div className="flex items-center gap-3 mb-3 bg-base rounded-lg px-3 py-2">
          <span className="text-xs text-ink/60">{selectedIds.size} selected</span>
          <button disabled={bulkBusy} onClick={() => runBulk("resolve")} className="text-xs font-medium text-blue-700 hover:underline disabled:opacity-50">
            Resolve Selected
          </button>
          <button disabled={bulkBusy} onClick={() => runBulk("dismiss")} className="text-xs font-medium text-ink/50 hover:underline disabled:opacity-50">
            Dismiss Selected
          </button>
        </div>
      )}

      {!list || listLoading ? (
        <div className="space-y-5">
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
        </div>
      ) : list.items.length === 0 ? (
        <Card>
          {(() => {
            const filtersActive = priority !== "ALL" || search.trim() !== "";
            // Search/priority narrowing this exact tab down to zero is a
            // different situation from the tab genuinely having nothing —
            // "clear your filters" reads very differently from "you're all
            // caught up", so it takes priority over the tab-specific copy
            // below even on the Open tab.
            if (filtersActive) {
              return (
                <div className="flex flex-col items-center justify-center py-8 text-center px-6">
                  <span className="text-xl mb-2" aria-hidden>
                    🔍
                  </span>
                  <p className="font-medium text-ink/70">No recommendations match your filters.</p>
                  <p className="text-sm text-ink/40 mt-1">Try clearing search or changing filters.</p>
                </div>
              );
            }
            if (status === "OPEN") {
              return (
                <div className="flex flex-col items-center justify-center py-8 text-center px-6">
                  <div className="w-10 h-10 rounded-full bg-base flex items-center justify-center mb-2.5">
                    <PartyPopper size={18} className="text-emerald-500" />
                  </div>
                  <p className="font-medium text-ink/70">🎉 Great! No open recommendations.</p>
                  <p className="text-sm text-ink/40 mt-1">Your business is operating normally.</p>
                  {health && <p className="text-xl font-display font-bold text-emerald-600 mt-2">{health.score}/100</p>}
                  {health?.lastScanAt && <p className="text-xs text-ink/35 mt-1">Last evaluated {timeAgo(health.lastScanAt)}</p>}
                  <p className="text-xs text-ink/35 mt-3">Flowora AI is actively monitoring:</p>
                  <div className="flex items-center gap-1.5 flex-wrap justify-center mt-1.5">
                    {MONITORED_AREAS.map((area) => (
                      <span key={area} className="px-2 py-0.5 rounded-full text-xs bg-base text-ink/50">
                        {area}
                      </span>
                    ))}
                  </div>
                </div>
              );
            }
            if (status === "RESOLVED") {
              return (
                <div className="flex flex-col items-center justify-center py-8 text-center px-6">
                  <span className="text-xl mb-2" aria-hidden>
                    ✅
                  </span>
                  <p className="font-medium text-ink/70">Nothing resolved yet.</p>
                  <p className="text-sm text-ink/40 mt-1">Resolved recommendations will appear here.</p>
                </div>
              );
            }
            if (status === "DISMISSED") {
              return (
                <div className="flex flex-col items-center justify-center py-8 text-center px-6">
                  <span className="text-xl mb-2" aria-hidden>
                    🚫
                  </span>
                  <p className="font-medium text-ink/70">No dismissed recommendations.</p>
                  <p className="text-sm text-ink/40 mt-1">Dismissed recommendations will appear here.</p>
                </div>
              );
            }
            return (
              <div className="flex flex-col items-center justify-center py-8 text-center px-6">
                <span className="text-xl mb-2" aria-hidden>
                  📄
                </span>
                <p className="font-medium text-ink/70">Nothing here yet.</p>
                <p className="text-sm text-ink/40 mt-1">Recommendations will appear here as they're generated.</p>
              </div>
            );
          })()}
        </Card>
      ) : (
        <div className="space-y-5">
          {list.items.map((recommendation) => (
            <RecommendationCard
              key={recommendation.id}
              recommendation={recommendation}
              onChanged={reloadAll}
              onViewDetails={setDetailsId}
              selectable={status === "OPEN"}
              selected={selectedIds.has(recommendation.id)}
              onToggleSelect={toggleSelect}
            />
          ))}
        </div>
      )}

      {list && <Pagination page={list.page} totalPages={list.totalPages} total={list.total} limit={list.limit} onPageChange={setPage} />}

      <DetailsDrawer recommendationId={detailsId} onClose={() => setDetailsId(null)} />
    </div>
  );
}
