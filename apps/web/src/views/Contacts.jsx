import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { Plus, FileText, MapPin, ShoppingBag, Cake, CalendarClock, Phone, Mail, Users, Clock, ArrowLeft } from "lucide-react";
import api from "../api/client";
import { useToast } from "../components/ui/Toast";
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

const DETAIL_TABS = ["Overview", "Timeline", "Notes", "Documents"];

export default function Contacts() {
  const router = useRouter();
  const toast = useToast();
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
  // Mobile only — list and detail are two separate screens there (tapping
  // a card navigates in, "Back" navigates out) instead of the permanent
  // side-by-side split desktop keeps, which wastes ~35% of a phone's width
  // on a list that's only useful before you've picked someone.
  const [mobileDetailOpen, setMobileDetailOpen] = useState(false);
  const [detailTab, setDetailTab] = useState("Overview");

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

  // Landed here from the global "+ Create" menu (Layout.jsx).
  useEffect(() => {
    if (router.isReady && router.query.create === "1" && canManage) {
      openAdd();
      router.replace("/app/contacts", undefined, { shallow: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router.isReady, router.query.create, canManage]);

  const saveContact = async () => {
    if (!form.name.trim()) return;
    try {
      await api.post("/contacts", { ...form, purchaseHistory: [], documents: [] });
      setModal(false);
      setForm(emptyForm);
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || "Couldn't save that contact.");
    }
  };

  const contactActivities = active
    ? activities
        .filter((a) => a.contactId === active.id)
        .sort((x, y) => new Date(y.timestamp) - new Date(x.timestamp))
    : [];

  const companyName = (id) => companies.find((c) => c.id === id)?.name || "";
  const lastActivityFor = (contactId) => {
    const latest = activities
      .filter((a) => a.contactId === contactId)
      .sort((x, y) => new Date(y.timestamp) - new Date(x.timestamp))[0];
    return latest ? timeAgo(latest.timestamp) : null;
  };

  const openContact = (c) => {
    setActive(c);
    setDetailTab("Overview");
    setMobileDetailOpen(true);
  };

  const openLog = (type) => {
    setLogType(type);
    setLogSummary("");
  };

  const saveLog = async () => {
    if (!logSummary.trim()) return;
    try {
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
    } catch (err) {
      toast.error(err.response?.data?.error || "Couldn't save that activity log.");
    }
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
        <div className="lg:grid lg:grid-cols-3 lg:gap-4">
          {/* List — full screen on mobile until a contact is tapped (a
              permanent side-by-side split wastes ~35% of a phone's width
              on a list that's only useful before you've picked someone);
              always visible alongside the detail pane from lg up. */}
          <div className={`${mobileDetailOpen ? "hidden lg:block" : "block"}`}>
            <Card className="p-2 hidden lg:block h-fit max-h-[70vh] overflow-y-auto">
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

            {/* Mobile-only richer cards — same tap target, more context
                up front (company, phone, last contacted) since there's no
                detail pane visible alongside to fall back on here. */}
            <div className="lg:hidden space-y-3">
              {contacts.map((c) => {
                const last = lastActivityFor(c.id);
                return (
                  <button key={c.id} onClick={() => openContact(c)} className="w-full text-left">
                    <Card className="p-4">
                      <p className="font-medium text-sm">{c.name}</p>
                      {companyName(c.companyId) && <p className="text-xs text-ink/50 mt-0.5">{companyName(c.companyId)}</p>}
                      <div className="flex items-center flex-wrap gap-x-3 gap-y-1 mt-2 text-xs text-ink/50">
                        {c.mobile && <span className="inline-flex items-center gap-1"><Phone size={11} /> {c.mobile}</span>}
                        {c.email && <span className="inline-flex items-center gap-1 truncate"><Mail size={11} /> {c.email}</span>}
                      </div>
                      {last && <p className="text-xs text-ink/35 mt-1.5">Last contacted {last}</p>}
                    </Card>
                  </button>
                );
              })}
            </div>
          </div>

          {active && (
            <div className={`lg:col-span-2 lg:space-y-4 ${mobileDetailOpen ? "block" : "hidden lg:block"}`}>
              <button onClick={() => setMobileDetailOpen(false)} className="lg:hidden flex items-center gap-1.5 text-sm text-ink/60 mb-3">
                <ArrowLeft size={16} /> Back
              </button>

              <Card className="p-5 mb-4 lg:mb-0">
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

              {/* Tabs — mobile only. Purchase History/Timeline/Notes/
                  Documents all stacked one after another was nearly 60%
                  more scrolling than showing one section at a time. */}
              <div className="lg:hidden flex gap-2 mb-3 overflow-x-auto">
                {DETAIL_TABS.map((t) => (
                  <button
                    key={t}
                    onClick={() => setDetailTab(t)}
                    className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium border ${
                      detailTab === t ? "bg-primary text-white border-primary" : "bg-white border-border text-ink/60"
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>

              <div className={`${detailTab === "Overview" ? "block" : "hidden"} lg:block mb-4 lg:mb-0`}>
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
              </div>

              <div className={`${detailTab === "Timeline" ? "block" : "hidden"} lg:block mb-4 lg:mb-0`}>
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
              </div>

              <div className={`${detailTab === "Notes" ? "block" : "hidden"} lg:block mb-4 lg:mb-0`}>
                <Card className="p-5">
                  <h4 className="font-display font-semibold mb-2">Notes</h4>
                  <p className="text-sm text-ink/60">{active.notes || "No notes yet."}</p>
                </Card>
              </div>

              <div className={`${detailTab === "Documents" ? "block" : "hidden"} lg:block`}>
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
