import { useEffect, useState } from "react";
import { Plus, FolderOpen, FileText } from "lucide-react";
import api from "../api/client";
import { useAuth } from "../context/AuthContext";
import { Card, PageHeader, Button, Badge, Modal, Field, inputCls, EmptyState } from "../components/ui";
import { formatDate } from "../lib/format";
import useLiveCollection from "../lib/useLiveCollection";
import { useToast } from "../components/ui/Toast";

const CATEGORIES = ["Contract", "Invoice Copy", "Proposal", "ID Proof", "Other"];

const emptyForm = { name: "", category: CATEGORIES[0], relatedTo: "", note: "" };

export default function Documents() {
  const { canManage, user } = useAuth();
  const toast = useToast();
  const [documents, setDocuments] = useState([]);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(true);

  const load = () => {
    api.get("/documents").then((r) => {
      setDocuments(r.data.sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt)));
      setLoading(false);
    });
  };
  useEffect(() => {
    load();
  }, []);
  useLiveCollection(["documents"], load);

  const save = async () => {
    try {
      await api.post("/documents", {
        name: form.name,
        category: form.category,
        relatedTo: form.relatedTo,
        note: form.note,
        uploadedBy: user?.id,
        uploadedAt: new Date().toISOString(),
      });
      setModal(false);
      setForm(emptyForm);
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || "Couldn't save that document.");
    }
  };

  return (
    <div>
      <PageHeader
        title="Documents"
        subtitle="Contracts, proposals, and other files linked to your customers."
        action={canManage && <Button onClick={() => setModal(true)}><Plus size={15} /> Add Document</Button>}
      />

      <Card>
        {loading ? (
          <div className="p-8 text-ink/40 text-sm">Loading…</div>
        ) : documents.length === 0 ? (
          <EmptyState icon={FolderOpen} title="No documents yet" />
        ) : (
          <div>
            {documents.map((d) => (
              <div key={d.id} className="flex items-center gap-3 p-4 border-b border-border last:border-0">
                <FileText size={16} className="text-ink/30 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{d.name}</p>
                  <p className="text-xs text-ink/40">{d.relatedTo || "—"} · {formatDate(d.uploadedAt)}</p>
                </div>
                <Badge>{d.category}</Badge>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Modal open={modal} onClose={() => setModal(false)} title="Add Document">
        <Field label="File Name"><input className={inputCls} placeholder="e.g. Signed_Agreement.pdf" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
        <Field label="Category">
          <select className={inputCls} value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
            {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
          </select>
        </Field>
        <Field label="Related To (customer / company)"><input className={inputCls} value={form.relatedTo} onChange={(e) => setForm({ ...form, relatedTo: e.target.value })} /></Field>
        <Field label="Note"><input className={inputCls} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} /></Field>
        <div className="flex justify-end gap-2 mt-2">
          <Button variant="secondary" onClick={() => setModal(false)}>Cancel</Button>
          <Button onClick={save}>Save</Button>
        </div>
      </Modal>
    </div>
  );
}
