import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import api from "../api/client";
import { useAuth } from "../context/AuthContext";
import { Card, PageHeader, Button, Modal, Field, inputCls } from "../components/ui";
import { formatINR, formatDate } from "../lib/format";
import PipelineFunnel from "../components/PipelineFunnel";

const STAGES = ["New Lead", "Qualified", "Meeting Scheduled", "Quotation Sent", "Negotiation", "Won", "Lost"];
const PRODUCTS = ["ERP Suite", "CRM Pro", "Inventory Manager", "HR Toolkit", "Accounting Module"];

const emptyForm = {
  title: "", contactName: "", stage: "New Lead", expectedRevenue: "",
  closingDate: "", products: [PRODUCTS[0]], notes: "",
};

export default function Deals() {
  const { canManage } = useAuth();
  const [deals, setDeals] = useState([]);
  const [users, setUsers] = useState([]);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [activeStage, setActiveStage] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = () => {
    Promise.all([api.get("/deals"), api.get("/users")]).then(([d, u]) => {
      setDeals(d.data);
      setUsers(u.data);
      setLoading(false);
    });
  };
  useEffect(load, []);

  const userName = (id) => users.find((u) => u.id === id)?.name || "—";

  const stageCounts = STAGES.reduce((acc, s) => {
    acc[s] = deals.filter((d) => d.stage === s).length;
    return acc;
  }, {});

  const moveStage = async (dealId, stage) => {
    await api.post(`/deals/${dealId}/stage`, { stage });
    load();
  };

  const save = async () => {
    await api.post("/deals", { ...form, expectedRevenue: Number(form.expectedRevenue) || 0, probability: 20 });
    setModal(false);
    setForm(emptyForm);
    load();
  };

  const visibleDeals = activeStage ? deals.filter((d) => d.stage === activeStage) : deals;
  const totalPipelineValue = deals.filter((d) => !["Won", "Lost"].includes(d.stage)).reduce((s, d) => s + (d.expectedRevenue || 0), 0);

  return (
    <div>
      <PageHeader
        title="Deals"
        subtitle={`${formatINR(totalPipelineValue)} in active pipeline`}
        action={canManage && <Button onClick={() => setModal(true)}><Plus size={15} /> Add Deal</Button>}
      />

      <Card className="p-5 mb-5">
        <PipelineFunnel stageCounts={stageCounts} stages={STAGES} onStageClick={(s) => setActiveStage(activeStage === s ? null : s)} activeStage={activeStage} />
      </Card>

      {loading ? (
        <div className="text-ink/40 text-sm">Loading…</div>
      ) : (
        <div className="grid grid-cols-3 gap-4">
          {visibleDeals.map((deal) => (
            <Card key={deal.id} className="p-4">
              <div className="flex justify-between items-start mb-2">
                <h4 className="font-display font-semibold text-sm leading-tight">{deal.title}</h4>
                <span className="text-xs font-mono text-ink/50 shrink-0 ml-2">{deal.probability}%</span>
              </div>
              <p className="text-xs text-ink/40 mb-3">{deal.contactName}</p>
              <div className="flex justify-between text-sm mb-3">
                <span className="font-mono font-medium">{formatINR(deal.expectedRevenue)}</span>
                <span className="text-ink/40 text-xs">Close {formatDate(deal.closingDate)}</span>
              </div>
              <div className="text-xs text-ink/40 mb-3">Owner: {userName(deal.assignedTo)}</div>
              {canManage ? (
                <select
                  className="w-full text-xs border border-border rounded-lg px-2 py-1.5 outline-none focus:border-primary"
                  value={deal.stage}
                  onChange={(e) => moveStage(deal.id, e.target.value)}
                >
                  {STAGES.map((s) => <option key={s}>{s}</option>)}
                </select>
              ) : (
                <div className="w-full text-xs text-center border border-border rounded-lg px-2 py-1.5 text-ink/50">{deal.stage}</div>
              )}
            </Card>
          ))}
        </div>
      )}

      <Modal open={modal} onClose={() => setModal(false)} title="Add Deal" wide>
        <div className="grid grid-cols-2 gap-x-4">
          <Field label="Deal Title"><input className={inputCls} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></Field>
          <Field label="Contact Name"><input className={inputCls} value={form.contactName} onChange={(e) => setForm({ ...form, contactName: e.target.value })} /></Field>
          <Field label="Expected Revenue (₹)"><input type="number" className={inputCls} value={form.expectedRevenue} onChange={(e) => setForm({ ...form, expectedRevenue: e.target.value })} /></Field>
          <Field label="Closing Date"><input type="date" className={inputCls} value={form.closingDate} onChange={(e) => setForm({ ...form, closingDate: e.target.value })} /></Field>
          <Field label="Product">
            <select className={inputCls} value={form.products[0]} onChange={(e) => setForm({ ...form, products: [e.target.value] })}>
              {PRODUCTS.map((p) => <option key={p}>{p}</option>)}
            </select>
          </Field>
          <Field label="Stage">
            <select className={inputCls} value={form.stage} onChange={(e) => setForm({ ...form, stage: e.target.value })}>
              {STAGES.map((s) => <option key={s}>{s}</option>)}
            </select>
          </Field>
        </div>
        <Field label="Notes"><textarea className={inputCls} rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></Field>
        <div className="flex justify-end gap-2 mt-2">
          <Button variant="secondary" onClick={() => setModal(false)}>Cancel</Button>
          <Button onClick={save}>Save Deal</Button>
        </div>
      </Modal>
    </div>
  );
}
