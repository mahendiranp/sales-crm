import { useEffect, useState } from "react";
import { Plus, Globe, Building2, MapPin } from "lucide-react";
import api from "../api/client";
import { useAuth } from "../context/AuthContext";
import { Card, PageHeader, Button, Modal, Field, inputCls, EmptyState } from "../components/ui";
import { formatINR } from "../lib/format";
import useLiveCollection from "../lib/useLiveCollection";

const emptyForm = { name: "", industry: "", employees: "1-10", gst: "", website: "", accountManager: "", address: "", annualRevenue: "" };

export default function Companies() {
  const { canManage } = useAuth();
  const [companies, setCompanies] = useState([]);
  const [users, setUsers] = useState([]);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(true);

  const load = () => {
    Promise.all([api.get("/companies"), api.get("/users")]).then(([c, u]) => {
      setCompanies(c.data);
      setUsers(u.data);
      setLoading(false);
    });
  };
  useEffect(() => {
    load();
  }, []);
  useLiveCollection(["companies", "users"], load);

  const userName = (id) => users.find((u) => u.id === id)?.name || "Unassigned";

  const save = async () => {
    await api.post("/companies", { ...form, annualRevenue: Number(form.annualRevenue) || 0 });
    setModal(false);
    setForm(emptyForm);
    load();
  };

  return (
    <div>
      <PageHeader
        title="Companies"
        subtitle="B2B accounts and organization records"
        action={canManage && <Button onClick={() => setModal(true)}><Plus size={15} /> Add Company</Button>}
      />

      {loading ? (
        <div className="text-ink/40 text-sm">Loading…</div>
      ) : companies.length === 0 ? (
        <Card>
          <EmptyState
            icon={Building2}
            title="No companies yet"
            subtitle="Manage your customers and organizations in one place."
            primaryAction={canManage && <Button onClick={() => setModal(true)}><Plus size={15} /> Add Company</Button>}
            tip="Tip — Companies let you organize contacts, track multiple deals, and see full account history in one place."
          />
        </Card>
      ) : (
        <div className="grid grid-cols-3 gap-4">
          {companies.map((c) => (
            <Card key={c.id} className="p-4">
              <div className="flex items-start justify-between mb-2">
                <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                  <Building2 size={17} />
                </div>
              </div>
              <h4 className="font-display font-semibold">{c.name}</h4>
              <p className="text-xs text-ink/40 mb-3">{c.industry} · {c.employees} employees</p>
              <div className="text-xs text-ink/60 space-y-1">
                <div>GST: {c.gst}</div>
                <div className="flex items-center gap-1"><Globe size={11} /> {c.website}</div>
                <div>Account Manager: {userName(c.accountManager)}</div>
                {c.annualRevenue > 0 && <div>Annual Revenue: {formatINR(c.annualRevenue)}</div>}
                {c.address && (
                  <div className="flex items-start gap-1"><MapPin size={11} className="mt-0.5 shrink-0" /> {c.address}</div>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal open={modal} onClose={() => setModal(false)} title="Add Company">
        <Field label="Company Name"><input className={inputCls} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
        <Field label="Industry"><input className={inputCls} value={form.industry} onChange={(e) => setForm({ ...form, industry: e.target.value })} /></Field>
        <Field label="Employees">
          <select className={inputCls} value={form.employees} onChange={(e) => setForm({ ...form, employees: e.target.value })}>
            {["1-10", "11-50", "51-200", "200-500", "500+"].map((e) => <option key={e}>{e}</option>)}
          </select>
        </Field>
        <Field label="GST Number"><input className={inputCls} value={form.gst} onChange={(e) => setForm({ ...form, gst: e.target.value })} /></Field>
        <Field label="Website"><input className={inputCls} value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} /></Field>
        <Field label="Address"><input className={inputCls} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></Field>
        <Field label="Annual Revenue (₹)"><input type="number" className={inputCls} value={form.annualRevenue} onChange={(e) => setForm({ ...form, annualRevenue: e.target.value })} /></Field>
        <Field label="Account Manager">
          <select className={inputCls} value={form.accountManager} onChange={(e) => setForm({ ...form, accountManager: e.target.value })}>
            <option value="">Select…</option>
            {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
        </Field>
        <div className="flex justify-end gap-2 mt-2">
          <Button variant="secondary" onClick={() => setModal(false)}>Cancel</Button>
          <Button onClick={save}>Save Company</Button>
        </div>
      </Modal>
    </div>
  );
}
