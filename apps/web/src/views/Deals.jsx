import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { Plus, Search, ChevronDown, Phone, Mail } from "lucide-react";
import api from "../api/client";
import { useAuth } from "../context/AuthContext";
import { Card, Button, Modal, Field, inputCls, EmptyState } from "../components/ui";
import { formatINR, formatDate, timeAgo } from "../lib/format";
import PipelineFunnel from "../components/PipelineFunnel";
import useLiveCollection from "../lib/useLiveCollection";

const STAGES = ["New Lead", "Qualified", "Meeting Scheduled", "Quotation Sent", "Negotiation", "Won", "Lost"];
const PRODUCTS = ["ERP Suite", "CRM Pro", "Inventory Manager", "HR Toolkit", "Accounting Module"];
const STAGE_META = {
  "New Lead": { cls: "bg-slate-100 text-slate-700", emoji: "⚪" },
  Qualified: { cls: "bg-cyan-50 text-cyan-700", emoji: "🔵" },
  "Meeting Scheduled": { cls: "bg-blue-50 text-blue-700", emoji: "📅" },
  "Quotation Sent": { cls: "bg-amber-50 text-amber-700", emoji: "🟡" },
  Negotiation: { cls: "bg-orange-50 text-orange-700", emoji: "🟠" },
  Won: { cls: "bg-emerald-50 text-emerald-700", emoji: "🟢" },
  Lost: { cls: "bg-red-50 text-red-700", emoji: "🔴" },
};

const emptyForm = {
  title: "", contactId: "", companyId: "", stage: "New Lead", expectedRevenue: "",
  probability: 20, closingDate: "", products: [PRODUCTS[0]], competitors: "", notes: "",
};

function DealCard({ deal, contact, companyName, ownerName, canManage, onMoveStage }) {
  const stageMeta = STAGE_META[deal.stage] || { cls: "bg-base text-ink/60", emoji: "⚪" };
  return (
    <Card className="p-5" style={{ borderColor: "#E5E7EB", boxShadow: "0 2px 8px rgba(0,0,0,.05)" }}>
      {/* Stage first — where a deal sits in the pipeline is the thing
          worth knowing before anything else about it. A real <select>
          layered invisibly on top keeps it tappable/native while looking
          like a chip. */}
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="relative inline-block">
          <span className={`inline-flex items-center gap-1.5 pl-2.5 pr-6 py-1 rounded-full text-xs font-medium ${stageMeta.cls}`}>
            {stageMeta.emoji} {deal.stage}
            {canManage && <ChevronDown size={11} className="absolute right-2 top-1/2 -translate-y-1/2" />}
          </span>
          {canManage && (
            <select
              className="absolute inset-0 opacity-0 cursor-pointer"
              value={deal.stage}
              onChange={(e) => onMoveStage(e.target.value)}
            >
              {STAGES.map((s) => <option key={s}>{s}</option>)}
            </select>
          )}
        </div>
        {/* One-tap Call/Email — Meeting/More live behind the existing
            "More details" disclosure below rather than a 3rd/4th icon
            here, since not every deal has a scheduling action to take. */}
        <div className="flex items-center gap-1 shrink-0">
          {contact?.mobile && (
            <a href={`tel:${contact.mobile}`} title="Call" className="p-1.5 text-ink/40 hover:text-primary hover:bg-base rounded-lg">
              <Phone size={14} />
            </a>
          )}
          {contact?.email && (
            <a href={`mailto:${contact.email}`} title="Email" className="p-1.5 text-ink/40 hover:text-primary hover:bg-base rounded-lg">
              <Mail size={14} />
            </a>
          )}
        </div>
      </div>

      {/* Deal name, then company (more weight — it's the account, not the
          person), then the contact with an icon so it doesn't read as a
          second company name. */}
      {/* Explicit text-[15px]/text-ink, not text-base — this repo's
          Tailwind config names a color "base" too, which collides with
          the text-base font-size utility and silently renders near-white
          text instead of setting the font size (see Layout.jsx). */}
      <h4 className="font-display font-semibold text-[15px] text-ink leading-tight">{deal.title}</h4>
      {companyName && <p className="text-sm text-ink/60 mt-1">{companyName}</p>}
      {contact?.name && (
        <p className="text-xs text-ink/40 mt-1 flex items-center gap-1">
          <span aria-hidden>👤</span> {contact.name}
        </p>
      )}

      <p className="text-2xl font-display font-bold text-ink leading-tight mt-4">{formatINR(deal.expectedRevenue)}</p>
      <p className="text-xs text-ink/40 mb-3">Deal Value</p>

      <div className="flex items-center gap-2 mb-4">
        <div className="flex-1 h-1.5 rounded-full bg-base overflow-hidden">
          <div className="h-full rounded-full bg-primary" style={{ width: `${deal.probability}%` }} />
        </div>
        <span className="text-xs text-ink/50 shrink-0">{deal.probability}% Win Probability</span>
      </div>

      <div className="flex items-center justify-between text-xs text-ink/40 pt-3 border-t border-border">
        <span>{deal.updatedAt ? `Updated ${timeAgo(deal.updatedAt)}` : `Close ${formatDate(deal.closingDate)}`}</span>
        {(deal.competitors || ownerName !== "—" || deal.closingDate) && (
          <details className="relative">
            <summary className="cursor-pointer select-none text-primary font-medium list-none">Details →</summary>
            <div className="absolute right-0 top-full mt-1 w-56 bg-white border border-border rounded-lg shadow-card p-3 z-20 text-left space-y-1">
              {ownerName !== "—" && <p><span className="text-ink/50">Owner:</span> {ownerName}</p>}
              {deal.closingDate && <p><span className="text-ink/50">Close date:</span> {formatDate(deal.closingDate)}</p>}
              {deal.competitors && <p><span className="text-ink/50">Competing against:</span> {deal.competitors}</p>}
            </div>
          </details>
        )}
      </div>
    </Card>
  );
}

export default function Deals() {
  const router = useRouter();
  const { canManage, user } = useAuth();
  const [deals, setDeals] = useState([]);
  const [users, setUsers] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [search, setSearch] = useState("");
  const [mineOnly, setMineOnly] = useState(false);

  // Landed here from the global "+ Create" menu (Layout.jsx).
  useEffect(() => {
    if (router.isReady && router.query.create === "1" && canManage) {
      setModal(true);
      router.replace("/app/deals", undefined, { shallow: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router.isReady, router.query.create, canManage]);
  const [activeStage, setActiveStage] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = () => {
    Promise.all([api.get("/deals"), api.get("/users"), api.get("/contacts"), api.get("/companies")]).then(([d, u, c, co]) => {
      setDeals(d.data);
      setUsers(u.data);
      setContacts(c.data);
      setCompanies(co.data);
      setLoading(false);
    });
  };
  useEffect(() => {
    load();
  }, []);
  useLiveCollection(["deals", "users", "contacts", "companies"], load);

  const userName = (id) => users.find((u) => u.id === id)?.name || "—";
  const contactName = (id) => contacts.find((c) => c.id === id)?.name || "—";
  const companyName = (id) => companies.find((c) => c.id === id)?.name || "";

  const stageCounts = STAGES.reduce((acc, s) => {
    acc[s] = deals.filter((d) => d.stage === s).length;
    return acc;
  }, {});

  const moveStage = async (dealId, stage) => {
    await api.post(`/deals/${dealId}/stage`, { stage });
    load();
  };

  // Picking a Contact auto-fills their Company, if they have one — a deal
  // almost always belongs to whichever org the contact works for, and
  // re-picking it by hand every time would just be repetitive busywork.
  const pickContact = (contactId) => {
    const contact = contacts.find((c) => c.id === contactId);
    setForm((f) => ({ ...f, contactId, companyId: contact?.companyId || f.companyId }));
  };

  const save = async () => {
    await api.post("/deals", {
      ...form,
      expectedRevenue: Number(form.expectedRevenue) || 0,
      probability: Math.min(100, Math.max(0, Number(form.probability) || 0)),
    });
    setModal(false);
    setForm(emptyForm);
    load();
  };

  const stageFiltered = activeStage ? deals.filter((d) => d.stage === activeStage) : deals;
  const ownerFiltered = mineOnly ? stageFiltered.filter((d) => d.assignedTo === user?.id) : stageFiltered;
  const q = search.trim().toLowerCase();
  const visibleDeals = q
    ? ownerFiltered.filter((d) =>
        [d.title, contactName(d.contactId), companyName(d.companyId)].some((v) => (v || "").toLowerCase().includes(q))
      )
    : ownerFiltered;
  const activeDeals = deals.filter((d) => !["Won", "Lost"].includes(d.stage));
  const totalPipelineValue = activeDeals.reduce((s, d) => s + (d.expectedRevenue || 0), 0);
  // Probability-weighted forecast — a deal at 20% probability doesn't count
  // the same as one at 80%, so the raw pipeline sum above overstates what's
  // actually likely to close. This is the more honest "what to expect" number.
  const weightedForecast = activeDeals.reduce((s, d) => s + (d.expectedRevenue || 0) * ((d.probability ?? 0) / 100), 0);

  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-3">
        <h1 className="font-display font-bold text-xl sm:text-2xl text-ink">Deals</h1>
        {/* The global bottom-nav "+" (and header Create menu at sm+) already
            reach "New Deal" from anywhere — a second, page-local Add button
            just for mobile duplicates that and costs vertical space. */}
        {canManage && (
          <Button onClick={() => setModal(true)} className="hidden sm:inline-flex">
            <Plus size={15} /> Add Deal
          </Button>
        )}
      </div>

      {/* Metric cards instead of a text subtitle — scannable at a glance,
          same three numbers ("active pipeline", "forecast", now also open
          deal count) the old subtitle string packed into one dense line. */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <Card className="p-3 sm:p-4">
          <p className="text-lg sm:text-xl font-display font-bold leading-tight">{formatINR(totalPipelineValue)}</p>
          <p className="text-[11px] text-ink/50 mt-0.5">Active Pipeline</p>
        </Card>
        <Card className="p-3 sm:p-4">
          <p className="text-lg sm:text-xl font-display font-bold leading-tight">{formatINR(weightedForecast)}</p>
          <p className="text-[11px] text-ink/50 mt-0.5">Forecast</p>
        </Card>
        <Card className="p-3 sm:p-4">
          <p className="text-lg sm:text-xl font-display font-bold leading-tight">{activeDeals.length}</p>
          <p className="text-[11px] text-ink/50 mt-0.5">Open Deals</p>
        </Card>
      </div>

      {/* Funnel chart is a desktop-only extra — it was costing ~30% of a
          phone's viewport for something users check far less often than
          the deal list itself. Mobile gets a compact, horizontally
          scrollable, tap-to-filter stage-count row instead. */}
      <Card className="p-5 mb-5 hidden sm:block">
        <PipelineFunnel stageCounts={stageCounts} stages={STAGES} onStageClick={(s) => setActiveStage(activeStage === s ? null : s)} activeStage={activeStage} />
      </Card>
      <div className="sm:hidden flex gap-2 mb-4 overflow-x-auto -mx-4 px-4">
        {STAGES.map((s) => (
          <button
            key={s}
            onClick={() => setActiveStage(activeStage === s ? null : s)}
            className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium border ${
              activeStage === s ? "bg-primary text-white border-primary" : "bg-white border-border text-ink/60"
            }`}
          >
            {s} ({stageCounts[s] || 0})
          </button>
        ))}
      </div>

      {/* Sticky search bar — reachable without scrolling back to the top
          on a long deal list. */}
      <div className="sticky top-0 z-10 bg-base pb-3 -mt-1 pt-1 flex items-center gap-2">
        <div className="flex-1 flex items-center gap-2 bg-white border border-border rounded-lg px-3 py-2">
          <Search size={15} className="text-ink/40 shrink-0" />
          <input
            placeholder="Search deals…"
            className="bg-transparent outline-none text-sm w-full"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <button
          onClick={() => setMineOnly((m) => !m)}
          className={`shrink-0 px-3 py-2 rounded-lg text-sm font-medium border ${
            mineOnly ? "bg-primary text-white border-primary" : "bg-white border-border text-ink/60"
          }`}
        >
          Mine
        </button>
      </div>

      {loading ? (
        <div className="text-ink/40 text-sm">Loading…</div>
      ) : deals.length === 0 ? (
        <Card>
          <EmptyState
            title="No deals yet"
            subtitle="Create your first deal to start tracking pipeline."
            action={canManage && <Button onClick={() => setModal(true)}><Plus size={15} /> Create Deal</Button>}
          />
        </Card>
      ) : visibleDeals.length === 0 ? (
        <Card><EmptyState title="No deals match your filters" subtitle="Try a different search term or clear the filters." /></Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {visibleDeals.map((deal) => (
            <DealCard
              key={deal.id}
              deal={deal}
              contact={contacts.find((c) => c.id === deal.contactId)}
              companyName={companyName(deal.companyId)}
              ownerName={userName(deal.assignedTo)}
              canManage={canManage}
              onMoveStage={(stage) => moveStage(deal.id, stage)}
            />
          ))}
        </div>
      )}

      <Modal open={modal} onClose={() => setModal(false)} title="Add Deal" wide>
        <div className="grid grid-cols-2 gap-x-4">
          <Field label="Deal Title"><input className={inputCls} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></Field>
          <Field label="Contact">
            <select className={inputCls} value={form.contactId} onChange={(e) => pickContact(e.target.value)}>
              <option value="">Select…</option>
              {contacts.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </Field>
          <Field label="Company">
            <select className={inputCls} value={form.companyId} onChange={(e) => setForm({ ...form, companyId: e.target.value })}>
              <option value="">None</option>
              {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </Field>
          <Field label="Expected Revenue (₹)"><input type="number" className={inputCls} value={form.expectedRevenue} onChange={(e) => setForm({ ...form, expectedRevenue: e.target.value })} /></Field>
          <Field label="Probability (%)">
            <input type="number" min="0" max="100" className={inputCls} value={form.probability} onChange={(e) => setForm({ ...form, probability: e.target.value })} />
          </Field>
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
          <Field label="Competitors"><input className={inputCls} placeholder="e.g. Zoho, Salesforce" value={form.competitors} onChange={(e) => setForm({ ...form, competitors: e.target.value })} /></Field>
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
