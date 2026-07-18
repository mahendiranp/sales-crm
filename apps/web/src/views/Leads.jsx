import { useEffect, useRef, useState } from "react";
import {
  Plus, UserCheck, ArrowRightCircle, Merge, Pencil, Phone, MessageCircle, Mail, Sparkles, MoreVertical,
  Globe, Share2, Link2, PhoneCall, Megaphone,
} from "lucide-react";
import api from "../api/client";
import { useAuth } from "../context/AuthContext";
import { Card, PageHeader, Button, Modal, Field, SectionHeading, inputCls, EmptyState } from "../components/ui";
import { timeAgo } from "../lib/format";
import useLiveCollection from "../lib/useLiveCollection";

const SOURCES = ["Website", "Facebook", "WhatsApp", "Referral", "Cold Call", "Google Ads", "Email Campaign"];
const PRODUCTS = ["ERP Suite", "CRM Pro", "Inventory Manager", "HR Toolkit", "Accounting Module"];
const PRIORITIES = ["High", "Medium", "Low"];
const STATUSES = ["New", "Contacted", "Qualified", "Converted", "Lost"];

const emptyForm = {
  name: "", mobile: "", email: "", company: "", source: "Website",
  interestedProduct: "", budget: "", priority: "Medium", status: "New",
  assignedTo: "", notes: "",
};

const PHONE_RE = /^[0-9+\-\s]{7,15}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// wa.me needs digits only (country code + number, no +/spaces/dashes) — a
// best-effort strip since leads can have phone numbers typed any which way.
const waLink = (mobile) => `https://wa.me/${(mobile || "").replace(/[^0-9]/g, "")}`;

// Lucide doesn't ship brand logos (no literal Facebook/Google mark) — these
// are neutral stand-ins for scanning by source at a glance, not literal
// brand icons.
const SOURCE_ICON = {
  Website: Globe,
  Facebook: Share2,
  WhatsApp: MessageCircle,
  Referral: Link2,
  "Cold Call": PhoneCall,
  "Google Ads": Megaphone,
  "Email Campaign": Mail,
};

const STATUS_STYLE = {
  New: "bg-blue-50 text-blue-700",
  Contacted: "bg-amber-50 text-amber-700",
  Qualified: "bg-emerald-50 text-emerald-700",
  Converted: "bg-violet-50 text-violet-700",
  Lost: "bg-red-50 text-red-700",
};

const PRIORITY_DOT = { High: "bg-red-500", Medium: "bg-amber-500", Low: "bg-ink/25" };

function StatusPill({ status }) {
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLE[status] || "bg-base text-ink/60"}`}>{status}</span>;
}

function PriorityDot({ priority }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-sm text-ink/70">
      <span className={`w-2 h-2 rounded-full shrink-0 ${PRIORITY_DOT[priority] || "bg-ink/25"}`} />
      {priority}
    </span>
  );
}

// Compact Indian-numbering currency: ₹25K, ₹1.2L, ₹3.4Cr — a raw ₹250000
// forces the eye to count digits every row; the standard Lakh/Crore
// shorthand is what the budget field's own values are meant to be read in.
function formatCompactINR(n) {
  const num = Number(n) || 0;
  if (num === 0) return "₹0";
  const abs = Math.abs(num);
  if (abs >= 1e7) return `₹${(num / 1e7).toFixed(num % 1e7 === 0 ? 0 : 1)}Cr`;
  if (abs >= 1e5) return `₹${(num / 1e5).toFixed(num % 1e5 === 0 ? 0 : 1)}L`;
  if (abs >= 1e3) return `₹${(num / 1e3).toFixed(num % 1e3 === 0 ? 0 : 1)}K`;
  return `₹${num}`;
}

function ScoreBadge({ score }) {
  if (score === undefined || score === null || score === "") return <span className="text-ink/30">—</span>;
  const n = Number(score);
  const color = n >= 70 ? "text-emerald-600 bg-emerald-50" : n >= 40 ? "text-amber-600 bg-amber-50" : "text-ink/50 bg-base";
  return <span className={`inline-flex items-center justify-center w-8 h-6 rounded-md text-xs font-semibold ${color}`}>{n}</span>;
}

// Reuses the existing leadScore/aiScoreReasoning (from the "AI-score this
// lead" action) as a short work-queue-style insight line, rather than a
// bare number — this is what turns the score into something worth reading
// at a glance instead of just a badge.
function AiInsight({ score, reasoning }) {
  if (score === undefined || score === null || score === "") return null;
  const n = Number(score);
  const emoji = n >= 70 ? "⭐" : n >= 40 ? "🤔" : "⚠️";
  return (
    <p className="text-xs text-ink/50 mt-1 max-w-[220px] truncate" title={reasoning || undefined}>
      {emoji} {reasoning || `${n}% conversion likelihood`}
    </p>
  );
}

const AVATAR_COLORS = ["#6366f1", "#0891b2", "#d97706", "#db2777", "#059669", "#7c3aed"];

function AvatarInitials({ user }) {
  if (!user) return <span className="text-ink/40">Unassigned</span>;
  const initials = user.name.split(" ").map((n) => n[0]).join("").slice(0, 2);
  const colorIdx = user.name.split("").reduce((sum, c) => sum + c.charCodeAt(0), 0) % AVATAR_COLORS.length;
  return (
    <span className="inline-flex items-center gap-2">
      <span
        className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-semibold shrink-0"
        style={{ background: AVATAR_COLORS[colorIdx] }}
      >
        {initials}
      </span>
      {user.name}
    </span>
  );
}

const PRIORITY_EMOJI = { High: "🔴", Medium: "🟡", Low: "🟢" };

// Free-text search over the fixed product catalog instead of a plain
// <select> — useful once the catalog grows past a handful of items and
// scrolling a dropdown stops being the fastest way to find one.
function ProductSearch({ value, onChange }) {
  const [query, setQuery] = useState(value || "");
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => setQuery(value || ""), [value]);
  useEffect(() => {
    if (!open) return;
    const closeIfOutside = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", closeIfOutside);
    return () => document.removeEventListener("mousedown", closeIfOutside);
  }, [open]);

  const matches = PRODUCTS.filter((p) => p.toLowerCase().includes(query.toLowerCase()));
  return (
    <div className="relative" ref={ref}>
      <input
        className={inputCls}
        placeholder="Search product…"
        value={query}
        onFocus={() => setOpen(true)}
        onChange={(e) => {
          setQuery(e.target.value);
          onChange(e.target.value);
          setOpen(true);
        }}
      />
      {open && matches.length > 0 && (
        <div className="absolute z-10 top-full left-0 right-0 mt-1 bg-white border border-border rounded-lg shadow-card max-h-48 overflow-y-auto">
          {matches.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => { onChange(p); setQuery(p); setOpen(false); }}
              className="w-full text-left px-3 py-2 text-sm hover:bg-base"
            >
              {p}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// Every row action (call, WhatsApp, email, edit, assign, convert) used to
// be its own icon in the row — with 6 possible actions that pushed the
// table wider than its card and spilled past the edge. One "⋯" menu keeps
// the row a fixed width regardless of how many actions a given lead has.
function RowActionsMenu({ lead, canManage, onEdit, onAssign, onConvert }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const closeIfOutside = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", closeIfOutside);
    return () => document.removeEventListener("mousedown", closeIfOutside);
  }, [open]);

  const itemCls = "flex items-center gap-2.5 w-full px-3 py-2 text-sm text-left text-ink/70 hover:bg-base rounded-md";

  return (
    <div className="relative inline-block" ref={ref}>
      <button title="More actions" onClick={() => setOpen((o) => !o)} className="p-1.5 text-ink/40 hover:text-ink hover:bg-base rounded">
        <MoreVertical size={14} />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 w-48 bg-white border border-border rounded-lg shadow-card p-1 z-20">
          {lead.mobile && (
            <a href={`tel:${lead.mobile}`} title="Call" className={itemCls}>
              <Phone size={14} /> Call
            </a>
          )}
          {lead.mobile && (
            <a href={waLink(lead.mobile)} target="_blank" rel="noreferrer" title="WhatsApp" className={itemCls}>
              <MessageCircle size={14} /> WhatsApp
            </a>
          )}
          {lead.email && (
            <a href={`mailto:${lead.email}`} title="Email" className={itemCls}>
              <Mail size={14} /> Email
            </a>
          )}
          {canManage && (
            <>
              {(lead.mobile || lead.email) && <div className="h-px bg-border my-1" />}
              <button onClick={() => { setOpen(false); onEdit(); }} className={itemCls}>
                <Pencil size={14} /> Edit
              </button>
              <button onClick={() => { setOpen(false); onAssign(); }} className={itemCls}>
                <UserCheck size={14} /> Assign
              </button>
              {lead.status !== "Converted" && (
                <button onClick={() => { setOpen(false); onConvert(); }} className={itemCls}>
                  <ArrowRightCircle size={14} /> Convert to customer
                </button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

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
  const [scoringId, setScoringId] = useState(null);
  const [scoreError, setScoreError] = useState("");
  const [triedSave, setTriedSave] = useState(false);
  const [showAiPaste, setShowAiPaste] = useState(false);
  const [aiPasteText, setAiPasteText] = useState("");
  const [aiParsing, setAiParsing] = useState(false);
  const [aiParseError, setAiParseError] = useState("");

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

  const userById = (id) => users.find((u) => u.id === id) || null;

  const filtered = statusFilter === "All" ? leads : leads.filter((l) => l.status === statusFilter);

  // Quick-scan summary — computed straight from what's already loaded, no
  // extra request. Gives a sense of the pipeline before scrolling the list.
  const todayStr = new Date().toDateString();
  const stats = {
    total: leads.length,
    today: leads.filter((l) => new Date(l.createdAt).toDateString() === todayStr).length,
    qualified: leads.filter((l) => l.status === "Qualified").length,
    conversion: leads.length ? Math.round((leads.filter((l) => l.status === "Converted").length / leads.length) * 100) : 0,
  };

  const openAdd = () => { setForm(emptyForm); setShowAiPaste(false); setAiPasteText(""); setAiParseError(""); setTriedSave(false); setModal("add"); };
  const openEdit = (lead) => { setActiveLead(lead); setForm(lead); setTriedSave(false); setModal("edit"); };

  // Simple duplicate detection: same phone or email as an existing lead.
  // Flags it inline while adding rather than silently letting duplicates
  // pile up — doesn't block saving, since a genuine repeat inquiry from
  // the same person is a real, valid lead too.
  const duplicateOf = (() => {
    if (modal !== "add") return null;
    const mobile = form.mobile?.trim();
    const email = form.email?.trim().toLowerCase();
    if (!mobile && !email) return null;
    return leads.find((l) => (mobile && l.mobile?.trim() === mobile) || (email && l.email?.trim().toLowerCase() === email)) || null;
  })();

  // Name plus at least one of mobile/email — everything else is optional.
  // A single message instead of a bare boolean so clicking Save with
  // something missing tells you exactly what, rather than just silently
  // not doing anything.
  const leadValidationError = !form.name.trim()
    ? "Lead Name is required."
    : !(form.mobile?.trim() || form.email?.trim())
    ? "A Mobile Number or Email is required."
    : form.mobile && !PHONE_RE.test(form.mobile)
    ? "Mobile Number doesn't look valid."
    : form.email && !EMAIL_RE.test(form.email)
    ? "Email doesn't look valid."
    : null;

  // Lead score is never entered manually anymore — it's set by the AI-score
  // action (see aiScoreLead below), which we fire automatically right after
  // a lead is created so the score just shows up in the table on its own.
  const saveLead = async ({ addAnother } = {}) => {
    if (leadValidationError) {
      setTriedSave(true);
      return;
    }
    const payload = { ...form, budget: Number(form.budget) || 0 };
    if (modal === "add") {
      const { data: created } = await api.post("/leads", payload);
      aiScoreLead(created);
      if (addAnother) {
        setForm(emptyForm);
        setShowAiPaste(false);
        setAiPasteText("");
      } else {
        setModal(null);
      }
    } else {
      await api.put(`/leads/${activeLead.id}`, payload);
      setModal(null);
    }
    load();
  };

  const openExisting = () => {
    if (!duplicateOf) return;
    setActiveLead(duplicateOf);
    setForm(duplicateOf);
    setModal("edit");
  };

  const fillWithAI = async () => {
    if (!aiPasteText.trim()) return;
    setAiParsing(true);
    setAiParseError("");
    try {
      const { data } = await api.post("/leads/parse-ai", { text: aiPasteText });
      setForm((f) => ({
        ...f,
        ...(data.name && { name: data.name }),
        ...(data.mobile && { mobile: data.mobile }),
        ...(data.email && { email: data.email }),
        ...(data.company && { company: data.company }),
        ...(data.budget && { budget: data.budget }),
        ...(data.interestedProduct && { interestedProduct: data.interestedProduct }),
        ...(PRIORITIES.includes(data.priority) && { priority: data.priority }),
        ...(data.notes && { notes: data.notes }),
      }));
      setShowAiPaste(false);
      setAiPasteText("");
    } catch (err) {
      setAiParseError(err.response?.data?.error || "Couldn't parse that — try filling the fields in manually.");
    } finally {
      setAiParsing(false);
    }
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

  const aiScoreLead = async (lead) => {
    setScoringId(lead.id);
    setScoreError("");
    try {
      await api.post(`/leads/${lead.id}/ai-score`);
      load();
    } catch (err) {
      setScoreError(err.response?.data?.error || "Couldn't score this lead right now.");
    } finally {
      setScoringId(null);
    }
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

      {scoreError && <p className="text-xs text-danger bg-danger/5 border border-danger/20 rounded-lg px-3 py-2 mb-3">{scoreError}</p>}

      <div className="grid grid-cols-4 gap-3 mb-4">
        <Card className="p-3.5">
          <div className="text-xs text-ink/40">Total Leads</div>
          <div className="text-xl font-display font-bold mt-0.5">{stats.total}</div>
        </Card>
        <Card className="p-3.5">
          <div className="text-xs text-ink/40">Added Today</div>
          <div className="text-xl font-display font-bold mt-0.5">{stats.today}</div>
        </Card>
        <Card className="p-3.5">
          <div className="text-xs text-ink/40">Qualified</div>
          <div className="text-xl font-display font-bold mt-0.5">{stats.qualified}</div>
        </Card>
        <Card className="p-3.5">
          <div className="text-xs text-ink/40">Conversion Rate</div>
          <div className="text-xl font-display font-bold mt-0.5">{stats.conversion}%</div>
        </Card>
      </div>

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
          <EmptyState
            title="No leads here"
            subtitle="Try a different filter or add a new lead."
            action={canManage && <Button onClick={openAdd}><Plus size={15} /> Add Lead</Button>}
          />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-ink/40 uppercase tracking-wide">
                <th className="p-3 w-8"></th>
                <th className="p-3">Lead</th>
                <th className="p-3">Source</th>
                <th className="p-3">Product</th>
                <th className="p-3">Budget</th>
                <th className="p-3">Score</th>
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
                  <td className="p-3 text-ink/70">
                    <span className="inline-flex items-center gap-1.5">
                      {(() => {
                        const SourceIcon = SOURCE_ICON[lead.source];
                        return SourceIcon ? <SourceIcon size={13} className="text-ink/35 shrink-0" /> : null;
                      })()}
                      {lead.source}
                    </span>
                  </td>
                  <td className="p-3 text-ink/70">{lead.interestedProduct}</td>
                  <td className="p-3 font-mono text-ink/70">{formatCompactINR(lead.budget)}</td>
                  <td className="p-3">
                    <div className="flex items-center gap-1.5" title={lead.aiScoreReasoning || undefined}>
                      <ScoreBadge score={lead.leadScore} />
                      {canManage && (
                        <button
                          title="AI-score this lead"
                          disabled={scoringId === lead.id}
                          onClick={() => aiScoreLead(lead)}
                          className="p-1 text-ink/30 hover:text-primary disabled:opacity-40 rounded"
                        >
                          <Sparkles size={12} className={scoringId === lead.id ? "animate-pulse" : ""} />
                        </button>
                      )}
                    </div>
                    <AiInsight score={lead.leadScore} reasoning={lead.aiScoreReasoning} />
                  </td>
                  <td className="p-3"><PriorityDot priority={lead.priority} /></td>
                  <td className="p-3"><StatusPill status={lead.status} /></td>
                  <td className="p-3 text-ink/60"><AvatarInitials user={userById(lead.assignedTo)} /></td>
                  <td className="p-3 text-ink/40 text-xs">{timeAgo(lead.createdAt)}</td>
                  <td className="p-3 text-right">
                    <RowActionsMenu
                      lead={lead}
                      canManage={canManage}
                      onEdit={() => openEdit(lead)}
                      onAssign={() => { setActiveLead(lead); setModal("assign"); }}
                      onConvert={() => { setActiveLead(lead); setModal("convert"); }}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      {/* Add / Edit modal */}
      <Modal
        open={modal === "add" || modal === "edit"}
        onClose={() => setModal(null)}
        title={modal === "add" ? "Add New Lead" : "Edit Lead"}
        subtitle={modal === "add" ? "Capture a new prospect for your sales pipeline. Only name and a mobile or email are required." : undefined}
        wide
      >
        {modal === "add" && (
          <div className="mb-4">
            {!showAiPaste ? (
              <button
                type="button"
                onClick={() => setShowAiPaste(true)}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:text-primary-dark"
              >
                <Sparkles size={13} /> Fill with AI — paste a message
              </button>
            ) : (
              <div className="bg-base rounded-lg p-3">
                <textarea
                  className={`${inputCls} bg-white`}
                  rows={3}
                  autoFocus
                  placeholder={'e.g. "Hi, I\'m John from ABC. Need ERP software for 200 employees. Budget 15 lakh. Call me tomorrow."'}
                  value={aiPasteText}
                  onChange={(e) => setAiPasteText(e.target.value)}
                />
                {aiParseError && <p className="text-xs text-danger mt-1.5">{aiParseError}</p>}
                <div className="flex justify-end gap-2 mt-2">
                  <Button variant="secondary" onClick={() => { setShowAiPaste(false); setAiPasteText(""); setAiParseError(""); }}>
                    Cancel
                  </Button>
                  <Button onClick={fillWithAI} disabled={aiParsing || !aiPasteText.trim()}>
                    <Sparkles size={13} className={aiParsing ? "animate-pulse" : ""} /> {aiParsing ? "Reading…" : "Autofill"}
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        <SectionHeading>Contact Information</SectionHeading>
        <div className="grid grid-cols-2 gap-x-4">
          <Field label="Lead Name" required>
            <input className={inputCls} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </Field>
          <Field label="Mobile Number" required={!form.email}>
            <input
              className={inputCls}
              placeholder="+91 98765 43210"
              value={form.mobile}
              onChange={(e) => setForm({ ...form, mobile: e.target.value })}
            />
            {form.mobile && !PHONE_RE.test(form.mobile) && (
              <span className="block text-xs text-danger mt-1">Doesn't look like a valid phone number.</span>
            )}
          </Field>
          <Field label="Email" required={!form.mobile}>
            <input className={inputCls} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            {form.email && !EMAIL_RE.test(form.email) && (
              <span className="block text-xs text-danger mt-1">Doesn't look like a valid email.</span>
            )}
          </Field>
          <Field label="Company">
            <input className={inputCls} value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} />
          </Field>
        </div>
        {!form.mobile && !form.email && !triedSave && (
          <p className="text-xs text-ink/40 -mt-2 mb-3">At least one of Mobile Number or Email is required.</p>
        )}
        {triedSave && leadValidationError && (
          <p className="text-xs text-danger bg-danger/5 border border-danger/20 rounded-lg px-3 py-2 mb-3">
            {leadValidationError}
          </p>
        )}

        {duplicateOf && (
          <p className="text-xs text-accent-dark bg-accent/10 border border-accent/25 rounded-lg px-3 py-2 mb-3 flex items-center justify-between gap-3">
            <span>
              ⚠️ A lead with this phone or email already exists: <strong>{duplicateOf.name}</strong> ({duplicateOf.status}).
            </span>
            <button type="button" onClick={openExisting} className="shrink-0 font-medium text-primary hover:text-primary-dark underline">
              Open Existing
            </button>
          </p>
        )}

        <SectionHeading>Sales Information</SectionHeading>
        <div className="grid grid-cols-2 gap-x-4">
          <Field label="Source">
            <select className={inputCls} value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })}>
              {SOURCES.map((s) => <option key={s}>{s}</option>)}
            </select>
          </Field>
          <Field label="Interested Product">
            <ProductSearch value={form.interestedProduct} onChange={(v) => setForm({ ...form, interestedProduct: v })} />
          </Field>
          <Field label="Budget (₹)">
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-ink/40 text-sm">₹</span>
              <input
                type="number"
                className={`${inputCls} pl-7`}
                value={form.budget}
                onChange={(e) => setForm({ ...form, budget: e.target.value })}
              />
            </div>
          </Field>
          <Field label="Priority">
            <select className={inputCls} value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>
              {PRIORITIES.map((p) => <option key={p} value={p}>{PRIORITY_EMOJI[p]} {p}</option>)}
            </select>
          </Field>
          <Field label="Status">
            <select className={inputCls} value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
              {STATUSES.map((s) => <option key={s}>{s}</option>)}
            </select>
          </Field>
          <Field label="Owner">
            <select className={inputCls} value={form.assignedTo || ""} onChange={(e) => setForm({ ...form, assignedTo: e.target.value })}>
              <option value="">Unassigned</option>
              {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </Field>
        </div>

        <SectionHeading>Notes</SectionHeading>
        <textarea
          className={`${inputCls} mb-1`}
          rows={2}
          placeholder="e.g. Looking for ERP implementation, needs demo next week, budget approved"
          value={form.notes || ""}
          onChange={(e) => setForm({ ...form, notes: e.target.value })}
        />

        <div className="flex justify-end gap-2 mt-4">
          <Button variant="secondary" onClick={() => setModal(null)}>Cancel</Button>
          <Button onClick={() => saveLead()}>Save Lead</Button>
          {modal === "add" && (
            <Button variant="secondary" onClick={() => saveLead({ addAnother: true })}>Save & Add Another</Button>
          )}
        </div>
      </Modal>

      {/* Assign modal */}
      <Modal open={modal === "assign"} onClose={() => setModal(null)} title="Assign Salesperson">
        <div className="space-y-1.5">
          {users.length === 0 && (
            <p className="text-sm text-ink/40 text-center py-6">No team members yet — add one from Settings → Users.</p>
          )}
          {users.map((u) => (
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
          This creates a Contact record for <strong>{activeLead?.name}</strong>
          {activeLead?.company ? (
            <>
              , linked to <strong>{activeLead.company}</strong> (created as a new Company if it doesn't already exist),
            </>
          ) : (
            ""
          )}{" "}
          and marks the lead as Converted.
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
