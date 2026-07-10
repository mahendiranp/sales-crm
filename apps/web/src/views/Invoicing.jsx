import { useEffect, useState } from "react";
import { Plus, Receipt } from "lucide-react";
import api from "../api/client";
import { useAuth } from "../context/AuthContext";
import { Card, PageHeader, Button, Badge, Modal, Field, inputCls, EmptyState } from "../components/ui";
import { formatINR, formatDate } from "../lib/format";
import useLiveCollection from "../lib/useLiveCollection";

const STATUSES = ["Draft", "Sent", "Paid", "Overdue"];

const emptyForm = { dealId: "", description: "", amount: "", dueDate: "", status: "Draft" };

export default function Invoicing() {
  const { canManage } = useAuth();
  const [invoices, setInvoices] = useState([]);
  const [deals, setDeals] = useState([]);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [filter, setFilter] = useState("All");
  const [loading, setLoading] = useState(true);

  const load = () => {
    Promise.all([api.get("/invoices"), api.get("/deals")]).then(([i, d]) => {
      setInvoices(i.data.sort((a, b) => new Date(b.issueDate) - new Date(a.issueDate)));
      setDeals(d.data);
      setLoading(false);
    });
  };
  useEffect(() => {
    load();
  }, []);
  useLiveCollection(["invoices", "deals"], load);

  const dealTitle = (id) => deals.find((d) => d.id === id)?.title || "—";
  const filtered = filter === "All" ? invoices : invoices.filter((i) => i.status === filter);
  const totalOutstanding = invoices.filter((i) => i.status === "Sent" || i.status === "Overdue").reduce((sum, i) => sum + i.total, 0);

  const save = async () => {
    const amount = Number(form.amount) || 0;
    const tax = Math.round(amount * 0.18);
    const count = invoices.length + 1;
    await api.post("/invoices", {
      invoiceNumber: `INV-2026-${String(count).padStart(4, "0")}`,
      dealId: form.dealId || null,
      lineItems: [{ description: form.description, qty: 1, unitPrice: amount }],
      amount,
      tax,
      total: amount + tax,
      status: form.status,
      issueDate: new Date().toISOString(),
      dueDate: form.dueDate,
      notes: "",
    });
    setModal(false);
    setForm(emptyForm);
    load();
  };

  return (
    <div>
      <PageHeader
        title="Invoicing"
        subtitle="Bill your customers and track what's outstanding."
        action={canManage && <Button onClick={() => setModal(true)}><Plus size={15} /> New Invoice</Button>}
      />

      <Card className="p-4 mb-4 flex items-center justify-between">
        <div>
          <p className="text-xs text-ink/50">Outstanding (Sent + Overdue)</p>
          <p className="font-mono font-semibold text-lg">{formatINR(totalOutstanding)}</p>
        </div>
      </Card>

      <div className="flex gap-2 mb-4">
        {["All", ...STATUSES].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border ${
              filter === f ? "bg-primary text-white border-primary" : "bg-white border-border text-ink/60"
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      <Card>
        {loading ? (
          <div className="p-8 text-ink/40 text-sm">Loading…</div>
        ) : filtered.length === 0 ? (
          <EmptyState icon={Receipt} title="No invoices" subtitle="Create one from a won deal or from scratch." />
        ) : (
          <div>
            {filtered.map((inv) => (
              <div key={inv.id} className="flex items-center gap-3 p-4 border-b border-border last:border-0">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{inv.invoiceNumber}</p>
                  <p className="text-xs text-ink/40">{dealTitle(inv.dealId)}</p>
                </div>
                <span className="text-xs text-ink/40 w-24">Due {formatDate(inv.dueDate)}</span>
                <span className="font-mono text-sm w-28 text-right">{formatINR(inv.total)}</span>
                <Badge>{inv.status}</Badge>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Modal open={modal} onClose={() => setModal(false)} title="New Invoice">
        <Field label="Related Deal">
          <select className={inputCls} value={form.dealId} onChange={(e) => setForm({ ...form, dealId: e.target.value })}>
            <option value="">— None —</option>
            {deals.map((d) => <option key={d.id} value={d.id}>{d.title}</option>)}
          </select>
        </Field>
        <Field label="Description"><input className={inputCls} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Field>
        <Field label="Amount (₹, before tax)"><input type="number" className={inputCls} value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></Field>
        <Field label="Due Date"><input type="date" className={inputCls} value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} /></Field>
        <Field label="Status">
          <select className={inputCls} value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
            {STATUSES.map((s) => <option key={s}>{s}</option>)}
          </select>
        </Field>
        <div className="flex justify-end gap-2 mt-2">
          <Button variant="secondary" onClick={() => setModal(false)}>Cancel</Button>
          <Button onClick={save}>Save Invoice</Button>
        </div>
      </Modal>
    </div>
  );
}
