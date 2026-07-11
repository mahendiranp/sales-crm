import { useEffect, useState } from "react";
import { Search, FileSpreadsheet, FileText as FileTextIcon, Trash2, Eye, FormInput } from "lucide-react";
import api from "../api/client";
import { useAuth } from "../context/AuthContext";
import { Card, PageHeader, Button, Badge, Modal, inputCls, EmptyState, ConfirmDialog } from "../components/ui";
import Pagination from "../components/Pagination";
import { formatDate } from "../lib/format";
import useLiveCollection from "../lib/useLiveCollection";

const PAGE_SIZE = 25;

function workflowStatusLabel(status) {
  return status === "approved" ? "Approved" : status === "rejected" ? "Rejected" : "Pending";
}

// Approval history + (if the current user is an eligible approver of the
// current step) Approve/Reject actions for a single response. Fetches the
// workflow detail on demand (it includes currentApproverIds, which the
// list endpoint doesn't compute for every row) rather than eagerly for
// every response in the table.
function WorkflowPanel({ formId, response, onDecided }) {
  const { user } = useAuth();
  const [detail, setDetail] = useState(null);
  const [busy, setBusy] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setDetail(null);
    if (response?.workflow) {
      api.get(`/forms/${formId}/responses/${response.id}/workflow`).then((r) => setDetail(r.data));
    }
  }, [formId, response?.id]);

  if (!response?.workflow || !detail) return null;

  const canDecide = detail.status === "pending" && detail.currentApproverIds.includes(user?.id);

  const decide = async (action, comment = "") => {
    setBusy(true);
    setError("");
    try {
      const { data } = await api.post(`/forms/${formId}/responses/${response.id}/workflow/decide`, { action, comment });
      setDetail(data);
      onDecided?.();
    } catch (err) {
      setError(err.response?.data?.error || "Failed to record decision.");
    } finally {
      setBusy(false);
      setRejecting(false);
    }
  };

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
      {error && <p className="text-xs text-danger mb-2">{error}</p>}
      {canDecide && (
        <div className="flex gap-2">
          <Button onClick={() => decide("approve")} disabled={busy}>Approve</Button>
          <Button variant="danger" onClick={() => setRejecting(true)} disabled={busy}>Reject</Button>
        </div>
      )}

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
  );
}

function ResponseDetailModal({ formId, form, response, onClose, onDecided }) {
  return (
    <Modal open={!!response} onClose={onClose} title="Response Details">
      {response && (
        <div className="space-y-4">
          <p className="text-xs text-ink/40">Submitted {formatDate(response.submittedAt)}</p>
          {form.fields.map((f) => (
            <div key={f.id}>
              <p className="text-xs font-medium text-ink/50 mb-0.5">{f.label}</p>
              <p className="text-sm whitespace-pre-wrap">
                {Array.isArray(response.answers?.[f.id])
                  ? response.answers[f.id].join(", ") || "—"
                  : String(response.answers?.[f.id] ?? "—")}
              </p>
            </div>
          ))}
          <WorkflowPanel formId={formId} response={response} onDecided={onDecided} />
        </div>
      )}
    </Modal>
  );
}

// Reusable responses table (search/filter/export/view/delete) for a single
// form. Used both inline (Forms.jsx builder page's Responses tab) and as a
// standalone page (/app/forms/[id]/responses) so there's one implementation.
export default function FormResponses({ formId, headerless, highlightResponseId }) {
  const { canManage } = useAuth();
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
      </div>

      {responses.length === 0 ? (
        <EmptyState icon={FormInput} title="No responses" subtitle="Responses will show up here once submitted." />
      ) : (
        <div className="overflow-x-auto border border-border rounded-lg">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-base text-left">
                <th className="p-2.5 font-medium text-ink/50 text-xs">Submitted</th>
                {form.fields.map((f) => (
                  <th key={f.id} className="p-2.5 font-medium text-ink/50 text-xs">{f.label}</th>
                ))}
                {form.workflow?.enabled && <th className="p-2.5 font-medium text-ink/50 text-xs">Approval</th>}
                <th className="p-2.5" />
              </tr>
            </thead>
            <tbody>
              {responses.map((r) => (
                <tr key={r.id} className={`border-b border-border last:border-0 ${r.id === highlightResponseId ? "bg-primary/5" : ""}`}>
                  <td className="p-2.5 text-ink/50 text-xs whitespace-nowrap">{formatDate(r.submittedAt)}</td>
                  {form.fields.map((f) => (
                    <td key={f.id} className="p-2.5 max-w-[200px] truncate">
                      {Array.isArray(r.answers?.[f.id]) ? r.answers[f.id].join(", ") || "—" : String(r.answers?.[f.id] ?? "—")}
                    </td>
                  ))}
                  {form.workflow?.enabled && (
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
