import { useEffect, useState } from "react";
import { Plus, Wallet, Check, X } from "lucide-react";
import api from "../api/client";
import { useAuth } from "../context/AuthContext";
import { Card, PageHeader, Button, Badge, Modal, Field, inputCls, EmptyState } from "../components/ui";
import { formatINR, formatDate } from "../lib/format";
import useLiveCollection from "../lib/useLiveCollection";

const CATEGORIES = ["Travel", "Client Meals", "Software", "Office Supplies", "Marketing", "Other"];

const emptyForm = { title: "", category: CATEGORIES[0], amount: "", date: new Date().toISOString().slice(0, 10), note: "" };

export default function Expenses() {
  const { canManage, user } = useAuth();
  const [expenses, setExpenses] = useState([]);
  const [users, setUsers] = useState([]);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [filter, setFilter] = useState("Pending");
  const [loading, setLoading] = useState(true);

  const load = () => {
    Promise.all([api.get("/expenses"), api.get("/users")]).then(([e, u]) => {
      setExpenses(e.data.sort((a, b) => new Date(b.date) - new Date(a.date)));
      setUsers(u.data);
      setLoading(false);
    });
  };
  useEffect(() => {
    load();
  }, []);
  useLiveCollection(["expenses", "users"], load);

  const userName = (id) => users.find((u) => u.id === id)?.name || "—";
  const filtered = filter === "All" ? expenses : expenses.filter((e) => e.status === filter);

  const setStatus = async (exp, status) => {
    await api.put(`/expenses/${exp.id}`, { status });
    load();
  };

  const save = async () => {
    await api.post("/expenses", {
      title: form.title,
      category: form.category,
      amount: Number(form.amount) || 0,
      date: form.date,
      submittedBy: user?.id || users[0]?.id,
      status: "Pending",
      note: form.note,
    });
    setModal(false);
    setForm(emptyForm);
    load();
  };

  return (
    <div>
      <PageHeader
        title="Expenses"
        subtitle="Submit and approve team expense claims."
        action={canManage && <Button onClick={() => setModal(true)}><Plus size={15} /> Submit Expense</Button>}
      />

      <div className="flex gap-2 mb-4">
        {["Pending", "Approved", "Rejected", "All"].map((f) => (
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
          <EmptyState icon={Wallet} title={`No ${filter.toLowerCase()} expenses`} />
        ) : (
          <div>
            {filtered.map((e) => (
              <div key={e.id} className="flex items-center gap-3 p-4 border-b border-border last:border-0">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{e.title}</p>
                  <p className="text-xs text-ink/40">{e.category} · {userName(e.submittedBy)} · {formatDate(e.date)}</p>
                </div>
                <span className="font-mono text-sm w-24 text-right">{formatINR(e.amount)}</span>
                <Badge>{e.status}</Badge>
                {canManage && e.status === "Pending" && (
                  <div className="flex gap-1">
                    <button onClick={() => setStatus(e, "Approved")} className="p-1.5 rounded-lg hover:bg-emerald-50 text-emerald-600">
                      <Check size={15} />
                    </button>
                    <button onClick={() => setStatus(e, "Rejected")} className="p-1.5 rounded-lg hover:bg-red-50 text-danger">
                      <X size={15} />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>

      <Modal open={modal} onClose={() => setModal(false)} title="Submit Expense">
        <Field label="Title"><input className={inputCls} placeholder="e.g. Client dinner" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></Field>
        <Field label="Category">
          <select className={inputCls} value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
            {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
          </select>
        </Field>
        <Field label="Amount (₹)"><input type="number" className={inputCls} value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></Field>
        <Field label="Date"><input type="date" className={inputCls} value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></Field>
        <Field label="Note"><input className={inputCls} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} /></Field>
        <div className="flex justify-end gap-2 mt-2">
          <Button variant="secondary" onClick={() => setModal(false)}>Cancel</Button>
          <Button onClick={save}>Submit</Button>
        </div>
      </Modal>
    </div>
  );
}
