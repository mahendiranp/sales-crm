import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, FileText, MapPin, ShoppingBag, Cake, CalendarClock, Phone, Mail, Users, Clock } from "lucide-react";
import api from "../api/client";
import { useAuth } from "../context/AuthContext";
import { Card, PageHeader, EmptyState, Button, Modal, Field, inputCls } from "../components/ui";
import { formatINR, formatDate, timeAgo } from "../lib/format";
import useLiveCollection from "../lib/useLiveCollection";

const emptyForm = { name: "", mobile: "", email: "", companyId: "", address: "", notes: "" };

const LOG_TYPES = [
  { type: "Phone Call", icon: Phone, color: "#3E6FA3" },
  { type: "Email", icon: Mail, color: "#8B5FBF" },
  { type: "Meeting", icon: Users, color: "#E8A33D" },
];

export default function Contacts() {
  const { user, canManage } = useAuth();
  const [contacts, setContacts] = useState([]);
  const [activities, setActivities] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [active, setActive] = useState(null);
  const [loading, setLoading] = useState(true);
  const [logType, setLogType] = useState(null);
  const [logSummary, setLogSummary] = useState("");
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const load = () => {
    Promise.all([api.get("/contacts"), api.get("/activities"), api.get("/companies")]).then(([c, a, co]) => {
      setContacts(c.data);
      setActivities(a.data);
      setCompanies(co.data);
      setActive((prev) => c.data.find((x) => x.id === prev?.id) || c.data[0] || null);
      setLoading(false);
    });
  };
  useEffect(() => {
    load();
  }, []);
  useLiveCollection(["contacts", "activities", "companies"], load);

  const openAdd = () => { setForm(emptyForm); setModal(true); };

  const saveContact = async () => {
    if (!form.name.trim()) return;
    await api.post("/contacts", { ...form, purchaseHistory: [], documents: [] });
    setModal(false);
    setForm(emptyForm);
    load();
  };

  const contactActivities = active
    ? activities
        .filter((a) => a.contactId === active.id)
        .sort((x, y) => new Date(y.timestamp) - new Date(x.timestamp))
    : [];

  const openLog = (type) => {
    setLogType(type);
    setLogSummary("");
  };

  const saveLog = async () => {
    if (!logSummary.trim()) return;
    await api.post("/activities", {
      type: logType,
      summary: logSummary.trim(),
      contactId: active.id,
      relatedTo: active.name,
      performedBy: user.id,
      timestamp: new Date().toISOString(),
    });
    setLogType(null);
    setLogSummary("");
    load();
  };

  return (
    <div>
      <PageHeader
        title="Contacts"
        subtitle="Customers who were once leads — full history, one place."
        action={canManage && <Button onClick={openAdd}><Plus size={15} /> Add Contact</Button>}
      />

      {loading ? (
        <div className="text-ink/40 text-sm">Loading…</div>
      ) : contacts.length === 0 ? (
        <Card>
          <EmptyState
            icon={Users}
            title="No contacts yet"
            subtitle="Contacts are people you've qualified and want to build relationships with — created by converting a lead, or added directly."
            primaryAction={canManage && <Button onClick={openAdd}><Plus size={15} /> Add Contact</Button>}
            secondaryAction={
              <Link href="/app/leads">
                <Button variant="secondary">View Leads</Button>
              </Link>
            }
            tip="Tip — Convert a qualified lead into a contact to start tracking their full call, email, and meeting history in one place."
          />
        </Card>
      ) : (
        <div className="grid grid-cols-3 gap-4">
          <Card className="p-2 h-fit max-h-[70vh] overflow-y-auto">
            {contacts.map((c) => (
              <button
                key={c.id}
                onClick={() => setActive(c)}
                className={`w-full text-left p-3 rounded-lg mb-1 ${active?.id === c.id ? "bg-primary/8" : "hover:bg-base"}`}
              >
                <div className="font-medium text-sm">{c.name}</div>
                <div className="text-xs text-ink/40">{c.mobile}</div>
              </button>
            ))}
          </Card>

          {active && (
            <div className="col-span-2 space-y-4">
              <Card className="p-5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 mb-1">
                    <div className="w-11 h-11 rounded-full bg-primary text-white flex items-center justify-center font-display font-semibold">
                      {active.name.split(" ").map((n) => n[0]).join("")}
                    </div>
                    <div>
                      <h3 className="font-display font-semibold text-lg">{active.name}</h3>
                      <p className="text-xs text-ink/40">{active.mobile} · {active.email}</p>
                    </div>
                  </div>
                  <div className="flex gap-1.5">
                    {LOG_TYPES.map(({ type, icon: Icon, color }) => (
                      <button
                        key={type}
                        title={`Log ${type}`}
                        onClick={() => openLog(type)}
                        className="w-8 h-8 rounded-lg flex items-center justify-center hover:opacity-80"
                        style={{ background: `${color}18`, color }}
                      >
                        <Icon size={14} />
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex items-start gap-2 mt-4 text-sm text-ink/60">
                  <MapPin size={15} className="mt-0.5 shrink-0" />
                  {active.address || "No address on file"}
                </div>
                <div className="flex items-center gap-2 mt-2 text-sm text-ink/60">
                  <Cake size={15} className="shrink-0" />
                  Birthday: {active.birthday ? formatDate(active.birthday) : "Not on file"}
                </div>
                <div className="flex items-center gap-2 mt-2 text-sm text-ink/60">
                  <CalendarClock size={15} className="shrink-0" />
                  Contract renewal: {active.contractRenewalDate ? formatDate(active.contractRenewalDate) : "Not on file"}
                </div>

                {logType && (
                  <div className="mt-4 pt-4 border-t border-border">
                    <p className="text-xs font-medium text-ink/50 mb-1.5">Log {logType}</p>
                    <textarea
                      className={inputCls}
                      rows={2}
                      autoFocus
                      placeholder={`What happened on this ${logType.toLowerCase()}?`}
                      value={logSummary}
                      onChange={(e) => setLogSummary(e.target.value)}
                    />
                    <div className="flex justify-end gap-2 mt-2">
                      <Button variant="secondary" onClick={() => setLogType(null)}>Cancel</Button>
                      <Button onClick={saveLog}>Save</Button>
                    </div>
                  </div>
                )}
              </Card>

              <Card className="p-5">
                <div className="flex items-center gap-2 mb-3">
                  <Clock size={16} className="text-primary" />
                  <h4 className="font-display font-semibold">Call, Email & Meeting History</h4>
                </div>
                {contactActivities.length === 0 ? (
                  <p className="text-sm text-ink/40">No calls, emails, or meetings logged yet.</p>
                ) : (
                  <div className="space-y-0.5">
                    {contactActivities.map((a) => {
                      const meta = LOG_TYPES.find((l) => l.type === a.type);
                      const Icon = meta?.icon || Clock;
                      return (
                        <div key={a.id} className="flex gap-3 py-2.5 border-b border-border last:border-0">
                          <div
                            className="w-7 h-7 rounded-full flex items-center justify-center shrink-0"
                            style={{ background: `${meta?.color || "#999"}18`, color: meta?.color || "#999" }}
                          >
                            <Icon size={12} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm">{a.summary}</p>
                            <p className="text-xs text-ink/40 mt-0.5">{a.type} · {timeAgo(a.timestamp)}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </Card>

              <Card className="p-5">
                <div className="flex items-center gap-2 mb-3">
                  <ShoppingBag size={16} className="text-primary" />
                  <h4 className="font-display font-semibold">Purchase History</h4>
                </div>
                {(active.purchaseHistory || []).length === 0 ? (
                  <p className="text-sm text-ink/40">No purchases recorded.</p>
                ) : (
                  <div className="space-y-2">
                    {active.purchaseHistory.map((p) => (
                      <div key={p.id} className="flex justify-between text-sm border-b border-border last:border-0 pb-2 last:pb-0">
                        <span>{p.product}</span>
                        <span className="font-mono text-ink/60">{formatINR(p.amount)} · {formatDate(p.date)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </Card>

              <Card className="p-5">
                <h4 className="font-display font-semibold mb-2">Notes</h4>
                <p className="text-sm text-ink/60">{active.notes || "No notes yet."}</p>
              </Card>

              <Card className="p-5">
                <div className="flex items-center gap-2 mb-3">
                  <FileText size={16} className="text-primary" />
                  <h4 className="font-display font-semibold">Documents</h4>
                </div>
                {(active.documents || []).length === 0 ? (
                  <p className="text-sm text-ink/40">No documents uploaded.</p>
                ) : (
                  <div className="space-y-1.5">
                    {active.documents.map((d) => (
                      <div key={d.id} className="text-sm text-primary hover:underline cursor-pointer">{d.name}</div>
                    ))}
                  </div>
                )}
              </Card>
            </div>
          )}
        </div>
      )}

      <Modal open={modal} onClose={() => setModal(false)} title="Add Contact" subtitle="Add someone directly, without going through the Leads pipeline.">
        <Field label="Name" required>
          <input className={inputCls} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </Field>
        <Field label="Mobile Number">
          <input className={inputCls} value={form.mobile} onChange={(e) => setForm({ ...form, mobile: e.target.value })} />
        </Field>
        <Field label="Email">
          <input className={inputCls} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </Field>
        <Field label="Company">
          <select className={inputCls} value={form.companyId} onChange={(e) => setForm({ ...form, companyId: e.target.value })}>
            <option value="">None</option>
            {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </Field>
        <Field label="Address">
          <input className={inputCls} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
        </Field>
        <Field label="Notes">
          <textarea className={inputCls} rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
        </Field>
        <div className="flex justify-end gap-2 mt-2">
          <Button variant="secondary" onClick={() => setModal(false)}>Cancel</Button>
          <Button onClick={saveContact} disabled={!form.name.trim()}>Save Contact</Button>
        </div>
      </Modal>
    </div>
  );
}
