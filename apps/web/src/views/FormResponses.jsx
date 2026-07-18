import { useEffect, useState } from "react";
import { Search, FileSpreadsheet, FileText as FileTextIcon, Trash2, Eye, FormInput, Sparkles } from "lucide-react";
import api from "../api/client";
import { useAuth } from "../context/AuthContext";
import { Card, PageHeader, Button, Badge, Modal, inputCls, EmptyState, ConfirmDialog, ErrorModal } from "../components/ui";
import Pagination from "../components/Pagination";
import { formatDate } from "../lib/format";
import useLiveCollection from "../lib/useLiveCollection";
import useResizableColumns from "../lib/useResizableColumns";
import ResizableTh from "../components/ResizableTh";
import UpgradeCreditsDialog from "../components/UpgradeCreditsDialog";
import { limitsFor } from "../lib/plans";

const INSIGHTS_MIN_RESPONSES = 3;

const PAGE_SIZE = 25;

function workflowStatusLabel(status) {
  return status === "approved" ? "Approved" : status === "rejected" ? "Rejected" : "Pending";
}

// Booking answers are stored as a raw ISO datetime string — display them
// as a real date/time instead of e.g. "2026-07-13T09:00:00.000Z". File
// answers are a { name, type, dataUrl } object (see FormFieldInput.jsx) —
// this plain-text version (used in the table cell) just shows the filename.
function formatAnswer(field, value) {
  if (field?.type === "file" && value?.name) return value.name;
  if (Array.isArray(value)) return value.join(", ") || "—";
  if (field?.type === "booking" && value) {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? String(value) : d.toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
  }
  return String(value ?? "—");
}

// Richer version for the response detail modal — an uploaded image renders
// inline, any other file type gets a download link, everything else falls
// back to the plain-text formatAnswer.
function AnswerValue({ field, value }) {
  if (field?.type === "file" && value?.dataUrl) {
    const isImage = (value.type || "").startsWith("image/");
    return (
      <div>
        {isImage && (
          <a href={value.dataUrl} target="_blank" rel="noreferrer">
            <img src={value.dataUrl} alt={value.name} className="max-h-64 rounded-lg border border-border mb-1.5" />
          </a>
        )}
        <a href={value.dataUrl} download={value.name} className="text-sm text-primary hover:underline">
          Download {value.name}
        </a>
      </div>
    );
  }
  return <p className="text-sm whitespace-pre-wrap">{formatAnswer(field, value)}</p>;
}

// Approval history + (if the current user is an eligible approver of the
// current step) Approve/Reject actions for a single response. Fetches the
// workflow detail on demand (it includes currentApproverIds, which the
// list endpoint doesn't compute for every row) rather than eagerly for
// every response in the table.
// Read-only approval status + history for a response. Whether the current
// viewer is an eligible approver (and can therefore act) is reported up to
// ResponseDetailModal via onCanDecideChange — the actual Approve/Reject
// buttons live in the modal's footer alongside Close, not here, so there's
// exactly one action row instead of two.
function WorkflowPanel({ formId, response, refreshKey, onCanDecideChange }) {
  const { user } = useAuth();
  const [detail, setDetail] = useState(null);

  useEffect(() => {
    setDetail(null);
    if (response?.workflow) {
      api.get(`/forms/${formId}/responses/${response.id}/workflow`).then((r) => setDetail(r.data));
    } else {
      onCanDecideChange?.(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formId, response?.id, refreshKey]);

  useEffect(() => {
    if (!detail) return;
    onCanDecideChange?.(detail.status === "pending" && detail.currentApproverIds.includes(user?.id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detail]);

  if (!response?.workflow || !detail) return null;

  return (
    <div className="border-t border-border pt-4 mt-4">
      <div className="flex items-center justify-between mb-2">
        <h4 className="font-display font-semibold text-sm">Approval Workflow</h4>
        <Badge>{workflowStatusLabel(detail.status)}</Badge>
      </div>
      {detail.status === "pending" && (
        <p className="text-xs text-ink/50 mb-2">Current step: {detail.steps[detail.currentStep]?.name}</p>
      )}
      {detail.history.length > 0 && (
        <div className="space-y-1 mb-3">
          {detail.history.map((h, i) => (
            <div key={i} className="text-xs text-ink/50">
              <span className="font-medium text-ink/70">{h.stepName}</span> — {h.actorName} {h.action}
              {h.comment ? `: "${h.comment}"` : ""}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// The modal footer is intentionally always "Close" plus, only when the
// current viewer is an eligible approver of the pending step, "Reject"/
// "Approve" — non-approvers (or anyone once a decision's been made) get a
// plain read-only view with no action buttons to click.
function ResponseDetailModal({ formId, form, response, onClose, onDecided }) {
  const [canDecide, setCanDecide] = useState(false);
  const [busy, setBusy] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [error, setError] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    setCanDecide(false);
    setError("");
  }, [response?.id]);

  const decide = async (action, comment = "") => {
    setBusy(true);
    setError("");
    try {
      await api.post(`/forms/${formId}/responses/${response.id}/workflow/decide`, { action, comment });
      onDecided?.();
      setRefreshKey((k) => k + 1);
    } catch (err) {
      setError(err.response?.data?.error || "Failed to record decision.");
    } finally {
      setBusy(false);
      setRejecting(false);
    }
  };

  return (
    <Modal open={!!response} onClose={onClose} title="Response Details">
      {response && (
        <div className="space-y-4">
          <p className="text-xs text-ink/40">Submitted {formatDate(response.submittedAt)}</p>
          {form.fields.map((f) => (
            <div key={f.id}>
              <p className="text-xs font-medium text-ink/50 mb-0.5">{f.label}</p>
              <AnswerValue field={f} value={response.answers?.[f.id]} />
            </div>
          ))}
          <WorkflowPanel formId={formId} response={response} refreshKey={refreshKey} onCanDecideChange={setCanDecide} />

          {error && <p className="text-xs text-danger">{error}</p>}

          <div className="flex justify-end gap-2 border-t border-border pt-4">
            <Button variant="secondary" onClick={onClose}>Close</Button>
            {canDecide && (
              <>
                <Button variant="danger" onClick={() => setRejecting(true)} disabled={busy}>Reject</Button>
                <Button onClick={() => decide("approve")} disabled={busy}>Approve</Button>
              </>
            )}
          </div>

          <ConfirmDialog
            open={rejecting}
            title="Reject this submission?"
            withReason
            reasonLabel="Reason for rejecting (optional)"
            confirmLabel="Reject"
            danger
            onCancel={() => setRejecting(false)}
            onConfirm={(reason) => decide("reject", reason)}
          />
        </div>
      )}
    </Modal>
  );
}

// Reusable responses table (search/filter/export/view/delete) for a single
// form. Used both inline (Forms.jsx builder page's Responses tab) and as a
// standalone page (/app/forms/[id]/responses) so there's one implementation.
export default function FormResponses({ formId, headerless, highlightResponseId }) {
  const { canManage, isMasterAdmin } = useAuth();
  const [form, setForm] = useState(null);
  const [responses, setResponses] = useState([]);
  const [pageInfo, setPageInfo] = useState({ page: 1, totalPages: 1, total: 0, limit: PAGE_SIZE });
  const [q, setQ] = useState("");
  const [filterFieldId, setFilterFieldId] = useState("");
  const [filterValue, setFilterValue] = useState("");
  const [viewing, setViewing] = useState(null);
  const [page, setPage] = useState(1);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [accountPlan, setAccountPlan] = useState(null);
  const [insightsOpen, setInsightsOpen] = useState(false);
  const [insightsLoading, setInsightsLoading] = useState(false);
  const [insightsResult, setInsightsResult] = useState(null);
  const [insightsError, setInsightsError] = useState("");
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [upgradeMessage, setUpgradeMessage] = useState("");

  // Same "hide, don't show-then-block" pattern as Forms.jsx/Leads.jsx's AI
  // features — a Starter account never sees this button at all.
  const aiAllowed = isMasterAdmin || !accountPlan || limitsFor(accountPlan).aiAssistant;

  const runInsights = async () => {
    setInsightsOpen(true);
    setInsightsLoading(true);
    setInsightsError("");
    setInsightsResult(null);
    try {
      const { data } = await api.post(`/forms/${formId}/insights`);
      setInsightsResult(data);
    } catch (err) {
      if (["insufficient_credits", "plan_required"].includes(err.response?.data?.code)) {
        setInsightsOpen(false);
        setUpgradeMessage(err.response.data.error);
        setUpgradeOpen(true);
      } else {
        setInsightsError(err.response?.data?.error || "Couldn't generate insights right now.");
      }
    } finally {
      setInsightsLoading(false);
    }
  };

  // Field ids are unique per-form, so a "Submitted"/"Approval" column from
  // one form's response table can't collide with another's — but the
  // storage key is still scoped per formId so each form's table remembers
  // its own widths as a separate, not-ever-growing blob.
  const responseColumns = form
    ? [
        { key: "submitted", label: "Submitted", defaultWidth: 140 },
        ...form.fields.map((f) => ({ key: f.id, label: f.label, defaultWidth: 160 })),
        { key: "approval", label: "Approval", defaultWidth: 120 },
      ]
    : [];
  const { widthFor, setWidth, commitWidths } = useResizableColumns(`form-responses:${formId}`, responseColumns);

  const loadForm = () => api.get(`/forms/${formId}`).then((r) => setForm(r.data));
  const loadResponses = () => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (filterFieldId && filterValue) {
      params.set("fieldId", filterFieldId);
      params.set("value", filterValue);
    }
    params.set("page", page);
    params.set("limit", PAGE_SIZE);
    api.get(`/forms/${formId}/responses?${params.toString()}`).then((r) => {
      setResponses(r.data.items);
      setPageInfo(r.data);
      if (highlightResponseId) {
        const match = r.data.items.find((x) => x.id === highlightResponseId);
        if (match) setViewing(match);
      }
    });
  };

  useEffect(() => {
    if (!formId) return;
    loadForm();
    api.get("/settings").then((r) => setAccountPlan(r.data.subscription?.plan)).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formId]);
  // Search/filter changes should always jump back to page 1 — staying on
  // page 4 of a narrower result set would just show an empty page.
  useEffect(() => {
    setPage(1);
  }, [q, filterFieldId, filterValue]);
  useEffect(() => {
    if (!formId) return;
    loadResponses();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formId, q, filterFieldId, filterValue, page]);
  useLiveCollection(["form_responses"], loadResponses);

  const removeResponse = async () => {
    setDeleting(true);
    try {
      await api.delete(`/forms/${formId}/responses/${deleteTarget}`);
      setDeleteTarget(null);
      loadResponses();
    } catch (err) {
      setDeleteError(err.response?.data?.error || "Couldn't delete that response.");
    } finally {
      setDeleting(false);
    }
  };

  if (!form) return <div className="text-ink/40 text-sm">Loading…</div>;

  const table = (
    <div>
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <div className="flex items-center gap-2 bg-base rounded-lg px-3 py-2 flex-1 min-w-[180px]">
          <Search size={15} className="text-ink/40" />
          <input
            placeholder="Search responses…"
            className="bg-transparent outline-none text-sm w-full"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <select className={`${inputCls} w-40`} value={filterFieldId} onChange={(e) => { setFilterFieldId(e.target.value); setFilterValue(""); }}>
          <option value="">Filter by field…</option>
          {form.fields.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
        </select>
        {filterFieldId && (
          <input
            className={`${inputCls} w-36`}
            placeholder="Value"
            value={filterValue}
            onChange={(e) => setFilterValue(e.target.value)}
          />
        )}
        <Button variant="secondary" onClick={() => window.open(`/api/forms/${formId}/responses/export/csv`, "_blank")}>
          <FileTextIcon size={15} /> CSV
        </Button>
        <Button variant="secondary" onClick={() => window.open(`/api/forms/${formId}/responses/export/excel`, "_blank")}>
          <FileSpreadsheet size={15} /> Excel
        </Button>
        {aiAllowed && (
          <Button
            variant="secondary"
            onClick={runInsights}
            disabled={pageInfo.total < INSIGHTS_MIN_RESPONSES}
            title={pageInfo.total < INSIGHTS_MIN_RESPONSES ? `Needs at least ${INSIGHTS_MIN_RESPONSES} responses` : undefined}
          >
            <Sparkles size={15} /> AI Insights
          </Button>
        )}
      </div>

      {responses.length === 0 ? (
        <EmptyState icon={FormInput} title="No responses" subtitle="Responses will show up here once submitted." />
      ) : (
        <div className="overflow-x-auto border border-border rounded-lg">
          <table className="w-full text-sm table-fixed">
            <thead>
              <tr className="border-b border-border bg-base text-left">
                <ResizableTh
                  className="p-2.5 font-medium text-ink/50 text-xs"
                  width={widthFor("submitted", 140)}
                  onResize={(w) => setWidth("submitted", w)}
                  onResizeEnd={commitWidths}
                >
                  Submitted
                </ResizableTh>
                {form.fields.map((f) => (
                  <ResizableTh
                    key={f.id}
                    className="p-2.5 font-medium text-ink/50 text-xs"
                    width={widthFor(f.id, 160)}
                    onResize={(w) => setWidth(f.id, w)}
                    onResizeEnd={commitWidths}
                  >
                    {f.label}
                  </ResizableTh>
                ))}
                {/* Not just form.workflow?.enabled — a booking field gets an
                    implicit approval workflow (see routes/forms.js) even
                    when the owner never explicitly turned the workflow
                    toggle on, so check the actual responses too. */}
                {(form.workflow?.enabled || responses.some((r) => r.workflow)) && (
                  <ResizableTh
                    className="p-2.5 font-medium text-ink/50 text-xs"
                    width={widthFor("approval", 120)}
                    onResize={(w) => setWidth("approval", w)}
                    onResizeEnd={commitWidths}
                  >
                    Approval
                  </ResizableTh>
                )}
                <th className="p-2.5 w-10" />
              </tr>
            </thead>
            <tbody>
              {responses.map((r) => (
                <tr key={r.id} className={`border-b border-border last:border-0 ${r.id === highlightResponseId ? "bg-primary/5" : ""}`}>
                  <td className="p-2.5 text-ink/50 text-xs whitespace-nowrap">{formatDate(r.submittedAt)}</td>
                  {form.fields.map((f) => (
                    <td key={f.id} className="p-2.5 max-w-[200px] truncate">
                      {formatAnswer(f, r.answers?.[f.id])}
                    </td>
                  ))}
                  {(form.workflow?.enabled || responses.some((x) => x.workflow)) && (
                    <td className="p-2.5">{r.workflow ? <Badge>{workflowStatusLabel(r.workflow.status)}</Badge> : "—"}</td>
                  )}
                  <td className="p-2.5 whitespace-nowrap">
                    <button onClick={() => setViewing(r)} className="text-ink/30 hover:text-primary mr-2">
                      <Eye size={14} />
                    </button>
                    {canManage && (
                      <button onClick={() => setDeleteTarget(r.id)} className="text-ink/30 hover:text-danger">
                        <Trash2 size={14} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Pagination {...pageInfo} onPageChange={setPage} />

      <ResponseDetailModal formId={formId} form={form} response={viewing} onClose={() => setViewing(null)} onDecided={loadResponses} />

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete this response?"
        message="This can't be undone."
        confirmLabel={deleting ? "Deleting…" : "Delete"}
        danger
        onCancel={() => setDeleteTarget(null)}
        onConfirm={removeResponse}
      />

      <ErrorModal open={!!deleteError} message={deleteError} onClose={() => setDeleteError("")} />

      <Modal open={insightsOpen} onClose={() => setInsightsOpen(false)} title="AI Insights" wide>
        {insightsLoading ? (
          <p className="text-sm text-ink/50 py-4">Analyzing responses…</p>
        ) : insightsError ? (
          <p className="text-sm text-danger">{insightsError}</p>
        ) : insightsResult ? (
          <div>
            <p className="text-xs text-ink/40 mb-3">
              Based on the {insightsResult.responseCount} most recent of {insightsResult.totalResponses} response
              {insightsResult.totalResponses === 1 ? "" : "s"}.
            </p>
            {insightsResult.summary.split("\n\n").map((para, i) => (
              <p key={i} className="text-sm text-ink/80 mb-3 last:mb-0 whitespace-pre-wrap">{para}</p>
            ))}
          </div>
        ) : null}
      </Modal>

      <UpgradeCreditsDialog open={upgradeOpen} onClose={() => setUpgradeOpen(false)} message={upgradeMessage} />
    </div>
  );

  if (headerless) return table;

  return (
    <div>
      <PageHeader title={form.name} subtitle={`${pageInfo.total} submitted response${pageInfo.total === 1 ? "" : "s"}`} />
      <Card className="p-5">{table}</Card>
    </div>
  );
}
