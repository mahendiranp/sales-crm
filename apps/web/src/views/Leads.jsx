import { useEffect, useState } from "react";
import { Plus, UserCheck, ArrowRightCircle, Merge, Pencil } from "lucide-react";
import api from "../api/client";
import { useAuth } from "../context/AuthContext";
import { Card, PageHeader, Button, Badge, Modal, Field, inputCls, EmptyState } from "../components/ui";
import { formatINR, timeAgo } from "../lib/format";
import useLiveCollection from "../lib/useLiveCollection";

const SOURCES = ["Website", "Facebook", "WhatsApp", "Referral", "Cold Call", "Google Ads", "Email Campaign"];
const PRODUCTS = ["ERP Suite", "CRM Pro", "Inventory Manager", "HR Toolkit", "Accounting Module"];
const PRIORITIES = ["High", "Medium", "Low"];
const STATUSES = ["New", "Contacted", "Qualified", "Converted", "Lost"];

const emptyForm = {
  name: "", mobile: "", email: "", company: "", source: "Website",
  interestedProduct: "ERP Suite", budget: "", priority: "Medium", status: "New",
};

export default function Leads() {
  const { canManage } = useAuth();
  const [leads, setLeads] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null); // 'add' | 'edit' | 'assign' | 'convert' | 'merge'
  const [activeLead, setActiveLead] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [statusFilter, setStatusFilter] = useState("All");
  const [selected, setSelected] = useState([]);

  const load = () => {
    Promise.all([api.get("/leads"), api.get("/users")]).then(([l, u]) => {
      setLeads(l.data.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));
      setUsers(u.data);
      setLoading(false);
    });
  };
  useEffect(() => {
    load();
  }, []);
  useLiveCollection(["leads", "users"], load);

  const userName = (id) => users.find((u) => u.id === id)?.name || "Unassigned";

  const filtered = statusFilter === "All" ? leads : leads.filter((l) => l.status === statusFilter);

  const openAdd = () => { setForm(emptyForm); setModal("add"); };
  const openEdit = (lead) => { setActiveLead(lead); setForm(lead); setModal("edit"); };

  const saveLead = async () => {
    const payload = { ...form, budget: Number(form.budget) || 0 };
    if (modal === "add") await api.post("/leads", payload);
    else await api.put(`/leads/${activeLead.id}`, payload);
    setModal(null);
    load();
  };

  const assignLead = async (userId) => {
    await api.post(`/leads/${activeLead.id}/assign`, { userId });
    setModal(null);
    load();
  };

  const convertLead = async () => {
    await api.post(`/leads/${activeLead.id}/convert`, {});
    setModal(null);
    load();
  };

  const mergeLeads = async () => {
    if (selected.length < 2) return;
    const [primaryId, ...duplicateIds] = selected;
    await api.post("/leads/merge", { primaryId, duplicateIds });
    setSelected([]);
    setModal(null);
    load();
  };

  const toggleSelect = (id) => {
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  };

  return (
    <div>
      <PageHeader
        title="Leads"
        subtitle={`${leads.length} total leads across all sources`}
        action={
          <div className="flex gap-2">
            {canManage && selected.length >= 2 && (
              <Button variant="secondary" onClick={() => setModal("merge")}>
                <Merge size={15} /> Merge {selected.length} leads
              </Button>
            )}
            {canManage && <Button onClick={openAdd}><Plus size={15} /> Add Lead</Button>}
          </div>
        }
      />

      <div className="flex gap-2 mb-4">
        {["All", ...STATUSES].map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border ${
              statusFilter === s ? "bg-primary text-white border-primary" : "bg-white border-border text-ink/60 hover:border-ink/20"
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      <Card>
        {loading ? (
          <div className="p-8 text-center text-ink/40 text-sm">Loading…</div>
        ) : filtered.length === 0 ? (
          <EmptyState title="No leads here" subtitle="Try a different filter or add a new lead." />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-ink/40 uppercase tracking-wide">
                <th className="p-3 w-8"></th>
                <th className="p-3">Lead</th>
                <th className="p-3">Source</th>
                <th className="p-3">Product</th>
                <th className="p-3">Budget</th>
                <th className="p-3">Priority</th>
                <th className="p-3">Status</th>
                <th className="p-3">Owner</th>
                <th className="p-3">Created</th>
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((lead) => (
                <tr key={lead.id} className="border-b border-border last:border-0 hover:bg-base/60">
                  <td className="p-3">
                    {canManage && <input type="checkbox" checked={selected.includes(lead.id)} onChange={() => toggleSelect(lead.id)} />}
                  </td>
                  <td className="p-3">
                    <div className="font-medium">{lead.name}</div>
                    <div className="text-xs text-ink/40">{lead.mobile} · {lead.email}</div>
                  </td>
                  <td className="p-3 text-ink/70">{lead.source}</td>
                  <td className="p-3 text-ink/70">{lead.interestedProduct}</td>
                  <td className="p-3 font-mono text-ink/70">{formatINR(lead.budget)}</td>
                  <td className="p-3"><Badge>{lead.priority}</Badge></td>
                  <td className="p-3"><Badge>{lead.status}</Badge></td>
                  <td className="p-3 text-ink/60">{userName(lead.assignedTo)}</td>
                  <td className="p-3 text-ink/40 text-xs">{timeAgo(lead.createdAt)}</td>
                  <td className="p-3">
                    {canManage && (
                      <div className="flex gap-1 justify-end">
                        <button title="Edit" onClick={() => openEdit(lead)} className="p-1.5 text-ink/40 hover:text-ink hover:bg-base rounded">
                          <Pencil size={14} />
                        </button>
                        <button title="Assign" onClick={() => { setActiveLead(lead); setModal("assign"); }} className="p-1.5 text-ink/40 hover:text-ink hover:bg-base rounded">
                          <UserCheck size={14} />
                        </button>
                        {lead.status !== "Converted" && (
                          <button title="Convert to customer" onClick={() => { setActiveLead(lead); setModal("convert"); }} className="p-1.5 text-ink/40 hover:text-primary hover:bg-base rounded">
                            <ArrowRightCircle size={14} />
                          </button>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      {/* Add / Edit modal */}
      <Modal open={modal === "add" || modal === "edit"} onClose={() => setModal(null)} title={modal === "add" ? "Add Lead" : "Edit Lead"} wide>
        <div className="grid grid-cols-2 gap-x-4">
          <Field label="Lead Name">
            <input className={inputCls} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </Field>
          <Field label="Mobile Number">
            <input className={inputCls} value={form.mobile} onChange={(e) => setForm({ ...form, mobile: e.target.value })} />
          </Field>
          <Field label="Email">
            <input className={inputCls} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </Field>
          <Field label="Company">
            <input className={inputCls} value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} />
          </Field>
          <Field label="Source">
            <select className={inputCls} value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })}>
              {SOURCES.map((s) => <option key={s}>{s}</option>)}
            </select>
          </Field>
          <Field label="Interested Product">
            <select className={inputCls} value={form.interestedProduct} onChange={(e) => setForm({ ...form, interestedProduct: e.target.value })}>
              {PRODUCTS.map((s) => <option key={s}>{s}</option>)}
            </select>
          </Field>
          <Field label="Budget (₹)">
            <input type="number" className={inputCls} value={form.budget} onChange={(e) => setForm({ ...form, budget: e.target.value })} />
          </Field>
          <Field label="Priority">
            <select className={inputCls} value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>
              {PRIORITIES.map((s) => <option key={s}>{s}</option>)}
            </select>
          </Field>
          <Field label="Status">
            <select className={inputCls} value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
              {STATUSES.map((s) => <option key={s}>{s}</option>)}
            </select>
          </Field>
        </div>
        <div className="flex justify-end gap-2 mt-2">
          <Button variant="secondary" onClick={() => setModal(null)}>Cancel</Button>
          <Button onClick={saveLead}>Save Lead</Button>
        </div>
      </Modal>

      {/* Assign modal */}
      <Modal open={modal === "assign"} onClose={() => setModal(null)} title="Assign Salesperson">
        <div className="space-y-1.5">
          {users.filter((u) => u.role.includes("Sales")).map((u) => (
            <button
              key={u.id}
              onClick={() => assignLead(u.id)}
              className="w-full flex items-center gap-3 p-2.5 rounded-lg hover:bg-base text-left"
            >
              <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-semibold" style={{ background: u.avatarColor }}>
                {u.name.split(" ").map((n) => n[0]).join("")}
              </div>
              <div>
                <div className="text-sm font-medium">{u.name}</div>
                <div className="text-xs text-ink/40">{u.role}</div>
              </div>
            </button>
          ))}
        </div>
      </Modal>

      {/* Convert modal */}
      <Modal open={modal === "convert"} onClose={() => setModal(null)} title="Convert to Customer">
        <p className="text-sm text-ink/60 mb-4">
          This creates a Contact record for <strong>{activeLead?.name}</strong> and marks the lead as Converted.
        </p>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setModal(null)}>Cancel</Button>
          <Button onClick={convertLead}>Confirm Conversion</Button>
        </div>
      </Modal>

      {/* Merge modal */}
      <Modal open={modal === "merge"} onClose={() => setModal(null)} title="Merge Duplicate Leads">
        <p className="text-sm text-ink/60 mb-4">
          The first selected lead will be kept as primary. The other {selected.length - 1} will be deleted.
        </p>
        <ul className="text-sm mb-4 space-y-1">
          {selected.map((id, i) => {
            const l = leads.find((x) => x.id === id);
            return <li key={id} className={i === 0 ? "font-medium" : "text-ink/50"}>{i === 0 ? "★ " : "— "}{l?.name}</li>;
          })}
        </ul>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setModal(null)}>Cancel</Button>
          <Button onClick={mergeLeads}>Merge</Button>
        </div>
      </Modal>
    </div>
  );
}
