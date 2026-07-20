import { useEffect, useState } from "react";
import Link from "next/link";
import { Search, Trash2, Eye, Inbox } from "lucide-react";
import api from "../api/client";
import { useAuth } from "../context/AuthContext";
import { Card, PageHeader, Badge, inputCls, EmptyState, ConfirmDialog, ErrorModal } from "../components/ui";
import Pagination from "../components/Pagination";
import { formatDate } from "../lib/format";
import useLiveCollection from "../lib/useLiveCollection";

const PAGE_SIZE = 25;

function workflowStatusLabel(status) {
  return status === "approved" ? "Approved" : status === "rejected" ? "Rejected" : "Pending";
}

// A cross-form response has no fixed set of fields to render as columns
// (every form defines its own) — so instead of a per-field column table
// (that's what /app/forms/[id]/responses is for, one form at a time),
// this shows one preview cell of the first couple of answers, and "View"
// hands off to that per-form page (?highlight=<id>) for the real field
// labels and full detail, rather than re-deriving them here.
function answerPreview(response) {
  const values = Object.values(response.answers || {})
    .map((v) => (v && typeof v === "object" ? v.name || "" : v))
    .filter((v) => v !== "" && v != null);
  return values.length ? values.slice(0, 3).join(" · ") : "—";
}

export default function AllResponses() {
  const { canManage } = useAuth();
  const [forms, setForms] = useState([]);
  const [responses, setResponses] = useState([]);
  const [pageInfo, setPageInfo] = useState({ page: 1, totalPages: 1, total: 0, limit: PAGE_SIZE });
  const [q, setQ] = useState("");
  const [formFilter, setFormFilter] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  const loadForms = () => api.get("/forms").then((r) => setForms(r.data));
  const loadResponses = () => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (formFilter) params.set("formId", formFilter);
    params.set("page", page);
    params.set("limit", PAGE_SIZE);
    api.get(`/forms/responses/all?${params.toString()}`).then((r) => {
      setResponses(r.data.items);
      setPageInfo(r.data);
      setLoading(false);
    });
  };

  useEffect(() => {
    loadForms();
  }, []);
  // Search/filter changes should always jump back to page 1 — staying on
  // page 4 of a narrower result set would just show an empty page.
  useEffect(() => {
    setPage(1);
  }, [q, formFilter]);
  useEffect(() => {
    loadResponses();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, formFilter, page]);
  useLiveCollection(["form_responses"], loadResponses);

  const removeResponse = async () => {
    setDeleting(true);
    try {
      await api.delete(`/forms/${deleteTarget.formId}/responses/${deleteTarget.id}`);
      setDeleteTarget(null);
      loadResponses();
    } catch (err) {
      setDeleteError(err.response?.data?.error || "Couldn't delete that response.");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div>
      <PageHeader title="Responses" subtitle="Every form submission across your account, in one place." />

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
        <select className={`${inputCls} w-56`} style={{ width: "auto" }} value={formFilter} onChange={(e) => setFormFilter(e.target.value)}>
          <option value="">All Forms</option>
          {forms.map((f) => (
            <option key={f.id} value={f.id}>{f.name}</option>
          ))}
        </select>
      </div>

      <Card className="p-5">
        {loading ? (
          <div className="text-ink/40 text-sm">Loading…</div>
        ) : responses.length === 0 ? (
          <EmptyState icon={Inbox} title="No responses" subtitle="Responses to any of your forms will show up here once submitted." />
        ) : (
          <div className="overflow-x-auto border border-border rounded-lg">
            <table className="w-full text-sm table-fixed">
              <thead>
                <tr className="border-b border-border bg-base text-left">
                  <th className="p-2.5 font-medium text-ink/50 text-xs w-48">Form</th>
                  <th className="p-2.5 font-medium text-ink/50 text-xs w-32">Submitted</th>
                  <th className="p-2.5 font-medium text-ink/50 text-xs">Preview</th>
                  <th className="p-2.5 font-medium text-ink/50 text-xs w-24">Approval</th>
                  <th className="p-2.5 w-16" />
                </tr>
              </thead>
              <tbody>
                {responses.map((r) => (
                  <tr key={r.id} className="border-b border-border last:border-0">
                    <td className="p-2.5 truncate">{r.formName}</td>
                    <td className="p-2.5 text-ink/50 text-xs whitespace-nowrap">{formatDate(r.submittedAt)}</td>
                    <td data-private className="p-2.5 max-w-[280px] truncate text-ink/70">{answerPreview(r)}</td>
                    <td className="p-2.5">{r.workflow ? <Badge>{workflowStatusLabel(r.workflow.status)}</Badge> : "—"}</td>
                    <td className="p-2.5 whitespace-nowrap">
                      <Link href={`/app/forms/${r.formId}/responses?highlight=${r.id}`} className="text-ink/30 hover:text-primary mr-2 inline-flex">
                        <Eye size={14} />
                      </Link>
                      {canManage && (
                        <button onClick={() => setDeleteTarget(r)} className="text-ink/30 hover:text-danger">
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
      </Card>

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
    </div>
  );
}
