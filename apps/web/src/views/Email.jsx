import { useEffect, useState } from "react";
import { Mail, Eye, MousePointerClick, Plus } from "lucide-react";
import api from "../api/client";
import { useAuth } from "../context/AuthContext";
import { Card, PageHeader, Button, Modal, Field, inputCls, EmptyState } from "../components/ui";
import { formatDate } from "../lib/format";
import useLiveCollection from "../lib/useLiveCollection";

export default function EmailPage() {
  const { canManage } = useAuth();
  const [emails, setEmails] = useState([]);
  const [stats, setStats] = useState(null);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({ to: "", subject: "", body: "" });
  const [loading, setLoading] = useState(true);

  const load = () => {
    Promise.all([api.get("/emails"), api.get("/emails/stats")]).then(([e, s]) => {
      setEmails(e.data.sort((a, b) => new Date(b.sentAt) - new Date(a.sentAt)));
      setStats(s.data);
      setLoading(false);
    });
  };
  useEffect(() => {
    load();
  }, []);
  useLiveCollection(["emails"], load);

  const send = async () => {
    await api.post("/emails/send", form);
    setModal(false);
    setForm({ to: "", subject: "", body: "" });
    load();
  };

  return (
    <div>
      <PageHeader
        title="Email"
        subtitle="Quotations, follow-ups, and campaign tracking"
        action={canManage && <Button onClick={() => setModal(true)}><Plus size={15} /> Compose</Button>}
      />

      <div className="grid grid-cols-3 gap-4 mb-5">
        <Card className="p-4">
          <p className="text-xs text-ink/50 mb-1">Total Sent</p>
          <p className="text-2xl font-display font-bold">{stats?.total ?? "—"}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-ink/50 mb-1 flex items-center gap-1"><Eye size={12} /> Open Rate</p>
          <p className="text-2xl font-display font-bold">{stats?.openRate ?? 0}%</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-ink/50 mb-1 flex items-center gap-1"><MousePointerClick size={12} /> Click Rate</p>
          <p className="text-2xl font-display font-bold">{stats?.clickRate ?? 0}%</p>
        </Card>
      </div>

      <Card>
        {loading ? (
          <div className="p-8 text-ink/40 text-sm">Loading…</div>
        ) : emails.length === 0 ? (
          <EmptyState icon={Mail} title="No emails sent yet" />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-ink/40 uppercase tracking-wide">
                <th className="p-3">To</th>
                <th className="p-3">Subject</th>
                <th className="p-3">Sent</th>
                <th className="p-3">Opened</th>
                <th className="p-3">Clicked</th>
              </tr>
            </thead>
            <tbody>
              {emails.map((e) => (
                <tr key={e.id} className="border-b border-border last:border-0">
                  <td className="p-3">{e.to}</td>
                  <td className="p-3">{e.subject}</td>
                  <td className="p-3 text-ink/40 text-xs">{formatDate(e.sentAt)}</td>
                  <td className="p-3">{e.opened ? <Eye size={14} className="text-primary" /> : "—"}</td>
                  <td className="p-3">{e.clicked ? <MousePointerClick size={14} className="text-accent" /> : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <Modal open={modal} onClose={() => setModal(false)} title="Compose Email" wide>
        <Field label="To"><input className={inputCls} value={form.to} onChange={(e) => setForm({ ...form, to: e.target.value })} /></Field>
        <Field label="Subject"><input className={inputCls} value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} /></Field>
        <Field label="Body"><textarea className={inputCls} rows={5} value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} /></Field>
        <div className="flex justify-end gap-2 mt-2">
          <Button variant="secondary" onClick={() => setModal(false)}>Cancel</Button>
          <Button onClick={send}>Send Email</Button>
        </div>
      </Modal>
    </div>
  );
}
