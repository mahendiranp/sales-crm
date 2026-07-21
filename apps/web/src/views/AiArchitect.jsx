import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/router";
import {
  Sparkles, Send, Wand2, Pin, PinOff, X, Eye, RefreshCw, UploadCloud, Check, Loader2,
  Type, AlignLeft, Mail, Phone, Hash, Calendar, ChevronDownSquare, CircleDot, CheckSquare,
  Star, ToggleLeft, File as FileIcon, MessageSquare, ChevronRight, Mic,
  FileText as PdfIcon, Image as ImageIcon, FileType, PartyPopper,
} from "lucide-react";
import api from "../api/client";
import { useToast } from "../components/ui/Toast";
import { Button, inputCls } from "../components/ui";
import { FieldEditor } from "./Forms";

// Same field-type → icon mapping the form builder uses (Forms.jsx's
// FIELD_TYPES), kept as its own small map here rather than importing the
// full FIELD_TYPES array — this page only ever needs the icon for a
// handful of AI-generated field types, not the whole palette.
const FIELD_ICON = {
  text: Type, longtext: AlignLeft, email: Mail, phone: Phone, number: Hash, date: Calendar,
  time: Calendar, dropdown: ChevronDownSquare, radio: CircleDot, checkbox: CheckSquare,
  file: FileIcon, rating: Star, yesno: ToggleLeft, booking: Calendar,
};
const fieldIcon = (type) => FIELD_ICON[type] || Type;

const EXAMPLE_PROMPTS = [
  { emoji: "✨", label: "Employee Leave", prompt: "Create an employee leave request form with manager approval." },
  { emoji: "💰", label: "Expense Claim", prompt: "Create an expense reimbursement form with receipt upload and finance approval." },
  { emoji: "🧑‍💼", label: "Job Application", prompt: "Create a job application form with resume upload." },
  { emoji: "📦", label: "Vendor Registration", prompt: "Create a vendor registration form for onboarding a new supplier." },
];

// Contextual chips shown right under a just-generated form — reuses the
// same follow-up-prompt mechanism as the bottom input (no new endpoint),
// just surfacing the most common next asks so a user doesn't have to type
// them out.
const FOLLOWUP_SUGGESTIONS = [
  "Make Department optional",
  "Add an emergency contact field",
  "Translate this form to Spanish",
  "Add an HR approval step",
];

// Real templates from data/formTemplates.js (fetched at mount) — these six
// keys are what's shown when they exist in the account's template list;
// no fabricated templates ("Vendor Registration" etc. that don't actually
// exist on the backend) so every card here genuinely opens a working flow.
const POPULAR_TEMPLATE_KEYS = ["leave-request", "expense-reimbursement", "job-application", "customer-feedback", "order-form", "contact-lead"];

const CHECKLIST_STEPS = [
  "Identify form type",
  "Create fields",
  "Configure validation",
  "Configure approval workflow",
  "Optimize for mobile",
  "Create thank you page",
];

const QUICK_ACTIONS = [
  { label: "Add Half Day", prompt: "Add a Half Day option to the leave type field." },
  { label: "Translate", prompt: "Add Spanish translations for every field label." },
  { label: "Make Multi Step", prompt: "Split this form into multiple steps/pages." },
  { label: "Add Conditional Logic", prompt: "Add conditional logic so follow-up fields only show when relevant." },
  { label: "Improve Accessibility", prompt: "Improve accessibility — clearer labels and help text for screen readers." },
  { label: "Optimize Mobile", prompt: "Optimize this form's layout for mobile screens." },
];

// Grouped by department so the Prompt Library reads as a menu, not a flat
// list — the app's global sidebar (Layout.jsx) already owns navigation
// (Dashboard/Forms/Reports/Settings), so this panel deliberately carries
// none of that; it's AI context only (conversations, prompts, templates,
// credits), not a second nav.
const PROMPT_LIBRARY = [
  { category: "HR", prompts: ["Employee Leave", "Job Application"] },
  { category: "Finance", prompts: ["Expense Form"] },
  { category: "Sales", prompts: ["Vendor Registration"] },
  { category: "Marketing", prompts: ["Customer Feedback"] },
];

const PINNED_PROMPTS_KEY = "flowora_pinned_prompts";
const loadPinned = () => {
  try {
    return JSON.parse(localStorage.getItem(PINNED_PROMPTS_KEY) || "[]");
  } catch {
    return [];
  }
};

// ChatGPT-style day buckets for Recent Conversations.
function bucketByDay(items, dateKey) {
  const now = new Date();
  const startOf = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const today = startOf(now);
  const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
  const weekAgo = new Date(today); weekAgo.setDate(today.getDate() - 7);

  const buckets = { Today: [], Yesterday: [], "Last 7 Days": [], Older: [] };
  for (const item of items) {
    const d = startOf(new Date(item[dateKey]));
    if (d.getTime() === today.getTime()) buckets.Today.push(item);
    else if (d.getTime() === yesterday.getTime()) buckets.Yesterday.push(item);
    else if (d.getTime() > weekAgo.getTime()) buckets["Last 7 Days"].push(item);
    else buckets.Older.push(item);
  }
  return Object.entries(buckets).filter(([, items]) => items.length > 0);
}

function computeSummary(fields, form) {
  return {
    title: form.name,
    fieldCount: fields.length,
    sections: Math.max(1, Math.ceil(fields.length / 4)),
    approval: form.workflow?.enabled ? "Manager" : "None",
    eta: "2 minutes",
  };
}

// ---------- Header: Prompt Library popover ----------
// No dedicated left "AI Workspace" column — Layout.jsx's global sidebar is
// the only nav/context rail on this page. Recent conversations, grouped
// prompts, and popular templates all live behind this one header button
// instead of a second permanent panel competing with it for width.

function PromptLibraryPopover({ recent, pinned, onTogglePin, onPickPrompt, templates }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const recentBuckets = bucketByDay(recent, "createdAt");

  useEffect(() => {
    if (!open) return;
    const closeIfOutside = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", closeIfOutside);
    return () => document.removeEventListener("mousedown", closeIfOutside);
  }, [open]);

  const pick = (text, recentForm) => {
    onPickPrompt(text, recentForm);
    setOpen(false);
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 text-sm font-medium text-ink/70 border border-border rounded-lg px-3 py-1.5 hover:bg-base hover:border-primary/30 transition-colors"
      >
        <MessageSquare size={14} /> Prompt Library
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1.5 w-80 max-h-[70vh] overflow-y-auto bg-white border border-border rounded-xl shadow-card z-30 p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-ink/35 mb-2">Recent Conversations</p>
          {recentBuckets.length === 0 ? (
            <p className="text-xs text-ink/35 mb-3">Nothing generated yet.</p>
          ) : (
            <div className="space-y-2.5 mb-3">
              {recentBuckets.map(([label, items]) => (
                <div key={label}>
                  <p className="text-[10px] font-medium text-ink/40 mb-1">{label}</p>
                  <ul className="space-y-0.5">
                    {items.map((f) => (
                      <li key={f.id}>
                        <button
                          onClick={() => pick(null, f)}
                          className="w-full flex items-center gap-2 text-left text-sm text-ink/70 hover:text-ink hover:bg-base rounded-md px-1.5 py-1.5 -mx-1.5"
                        >
                          <MessageSquare size={13} className="text-ink/30 shrink-0" />
                          <span className="flex-1 truncate">{f.name}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}

          <div className="h-px bg-border mb-3" />

          <p className="text-[11px] font-semibold uppercase tracking-wider text-ink/35 mb-2">Prompt Library</p>
          <div className="space-y-2.5 mb-3">
            {PROMPT_LIBRARY.map(({ category, prompts }) => (
              <div key={category}>
                <p className="text-[10px] font-medium text-ink/40 mb-1">{category}</p>
                <div className="flex flex-wrap gap-1.5">
                  {prompts.map((p) => (
                    <button
                      key={p}
                      onClick={() => pick(p)}
                      className="text-xs font-medium text-ink/65 border border-border rounded-full px-2.5 py-1 hover:border-primary/40 hover:text-primary transition-colors"
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {pinned.length > 0 && (
            <>
              <div className="h-px bg-border mb-3" />
              <p className="text-[11px] font-semibold uppercase tracking-wider text-ink/35 mb-2">Pinned</p>
              <ul className="space-y-1 mb-3">
                {pinned.map((p) => (
                  <li key={p} className="group flex items-center gap-1.5">
                    <button onClick={() => pick(p)} className="flex-1 text-left text-sm text-ink/70 hover:text-ink truncate py-0.5">
                      {p}
                    </button>
                    <button onClick={() => onTogglePin(p)} className="opacity-0 group-hover:opacity-100 text-ink/30 hover:text-danger shrink-0" title="Unpin">
                      <PinOff size={12} />
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}

          <div className="h-px bg-border mb-3" />

          <p className="text-[11px] font-semibold uppercase tracking-wider text-ink/35 mb-2">Popular Templates</p>
          <ul className="space-y-1">
            {templates.map((t) => (
              <li key={t.key}>
                <button
                  onClick={() => pick(`Create a ${t.name.toLowerCase()} form.`)}
                  className="w-full flex items-center gap-2 text-left text-sm text-ink/70 hover:text-ink hover:bg-base rounded-md px-1.5 py-1.5 -mx-1.5"
                >
                  <ChevronRight size={12} className="text-ink/30 shrink-0" />
                  <span className="truncate">{t.name}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// ---------- Center: chat ----------

function ChatMessage({ role, children }) {
  return (
    <div className={`flex ${role === "user" ? "justify-end" : "justify-start"} animate-[fadeIn_0.3s_ease-out_forwards]`}>
      <div
        className={`${role === "user" ? "max-w-[70%]" : "max-w-[85%]"} rounded-xl px-4 py-3 text-sm leading-relaxed ${
          role === "user" ? "bg-primary text-white" : "bg-white border border-border text-ink"
        }`}
      >
        {children}
      </div>
    </div>
  );
}

function ThinkingMessage() {
  return (
    <ChatMessage role="ai">
      <span className="flex items-center gap-2 text-ink/60">
        <Loader2 size={15} className="animate-spin text-primary" /> Thinking…
      </span>
    </ChatMessage>
  );
}

function ChecklistMessage({ stepsReached, generating }) {
  const percent = Math.round(((stepsReached + 1) / CHECKLIST_STEPS.length) * 100);
  return (
    <ChatMessage role="ai">
      <p className="font-medium mb-1">I'll build that for you.</p>
      <p className="text-ink/60 mb-3">Here's my plan:</p>
      <ul className="space-y-1.5">
        {CHECKLIST_STEPS.map((step, i) => (
          <li
            key={step}
            className={`flex items-center gap-2 transition-opacity duration-300 ${i <= stepsReached ? "opacity-100" : "opacity-25"}`}
          >
            {i <= stepsReached ? (
              <Check size={14} className="text-emerald-600 shrink-0" />
            ) : (
              <span className="w-3.5 h-3.5 rounded-full border border-ink/20 shrink-0" />
            )}
            {step}
          </li>
        ))}
      </ul>
      {generating && (
        <div className="mt-3.5 pt-3 border-t border-border/70">
          <div className="flex items-center justify-between text-xs text-ink/50 mb-1.5">
            <span>Generating your form draft…</span>
            <span className="font-medium text-ink/70">{percent}%</span>
          </div>
          <div className="h-1.5 rounded-full bg-base overflow-hidden">
            <div className="h-full bg-primary rounded-full transition-all duration-300" style={{ width: `${percent}%` }} />
          </div>
        </div>
      )}
    </ChatMessage>
  );
}

function SummaryMessage({ summary, onPreview, onRegenerate, onPublish, onEditWithAi, onFollowup, publishing }) {
  return (
    <ChatMessage role="ai">
      <p className="font-semibold text-[15px] mb-3 flex items-center gap-1.5">
        <PartyPopper size={16} className="text-accent-dark shrink-0" /> {summary.title} created
      </p>
      <div className="flex flex-wrap gap-1.5 mb-3.5">
        <span className="text-xs font-medium text-ink/70 bg-base border border-border rounded-full px-2.5 py-1">{summary.fieldCount} fields</span>
        <span className="text-xs font-medium text-ink/70 bg-base border border-border rounded-full px-2.5 py-1">{summary.approval === "None" ? "No approval step" : `${summary.approval} approval`}</span>
        <span className="text-xs font-medium text-ink/70 bg-base border border-border rounded-full px-2.5 py-1">{summary.eta} completion</span>
      </div>
      <div className="flex flex-wrap gap-2 mb-4">
        <Button variant="secondary" onClick={onPreview} className="hover:scale-[1.02] active:scale-[0.98] transition-transform">
          <Eye size={14} /> Preview
        </Button>
        <Button variant="secondary" onClick={onEditWithAi} className="hover:scale-[1.02] active:scale-[0.98] transition-transform">
          <Wand2 size={14} /> Edit with AI
        </Button>
        <Button variant="secondary" onClick={onRegenerate} className="hover:scale-[1.02] active:scale-[0.98] transition-transform">
          <RefreshCw size={14} /> Generate Again
        </Button>
        <Button onClick={onPublish} disabled={publishing} className="hover:scale-[1.02] active:scale-[0.98] transition-transform">
          <UploadCloud size={14} /> {publishing ? "Publishing…" : "Publish"}
        </Button>
      </div>
      <p className="text-[11px] font-semibold uppercase tracking-wider text-ink/35 mb-1.5">Ask AI to…</p>
      <div className="flex flex-wrap gap-1.5">
        {FOLLOWUP_SUGGESTIONS.map((s) => (
          <button
            key={s}
            onClick={() => onFollowup(s)}
            className="text-xs font-medium text-ink/60 border border-border rounded-full px-2.5 py-1 hover:border-primary/40 hover:text-primary transition-colors"
          >
            {s}
          </button>
        ))}
      </div>
    </ChatMessage>
  );
}

// ---------- Right panel: live preview ----------

function PreviewField({ field, onClick }) {
  const Icon = fieldIcon(field.type);
  return (
    <button
      onClick={onClick}
      className="w-full text-left border border-border rounded-lg px-3 py-2.5 hover:border-primary/40 hover:bg-primary/[0.03] transition-colors group"
    >
      <div className="flex items-center gap-2 mb-1">
        <Icon size={13} className="text-ink/35 shrink-0" />
        <span className="text-sm font-medium text-ink">{field.label}</span>
        {field.required && <span className="text-danger text-xs">*</span>}
      </div>
      <div className="h-8 rounded-md bg-base border border-border/70 flex items-center px-2.5">
        <span className="text-xs text-ink/30">{field.placeholder || "…"}</span>
      </div>
    </button>
  );
}

function LivePreview({ form, fields, onFieldClick, onQuickAction, quickActionBusy }) {
  if (!form) {
    return (
      <div className="flex-1 flex items-center justify-center text-center px-8">
        <div>
          <div className="w-12 h-12 rounded-xl bg-primary/8 flex items-center justify-center mx-auto mb-3">
            <Eye size={20} className="text-primary" />
          </div>
          <p className="text-sm font-medium text-ink">Live preview</p>
          <p className="text-xs text-ink/40 mt-1 max-w-[220px]">Describe a form and its preview will show up here as it's built.</p>
        </div>
      </div>
    );
  }

  const required = fields.filter((f) => f.required).length;

  return (
    <div className="flex-1 overflow-y-auto p-5">
      <p className="font-display font-bold text-ink text-xl mb-2">{form.name}</p>
      <div className="flex flex-wrap items-center gap-1.5 mb-4">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-accent-dark bg-accent/10 border border-accent/25 px-2 py-0.5 rounded-full">
          Draft
        </span>
        <span className="text-xs text-ink/45">Estimated time: 2 mins</span>
        {form.workflow?.enabled && (
          <>
            <span className="text-ink/25">·</span>
            <span className="text-xs text-ink/45">Manager Approval</span>
          </>
        )}
      </div>
      <div className="border border-border rounded-xl bg-white p-4 mb-5 hover:shadow-card transition-shadow">
        <div className="space-y-2.5">
          {fields.map((f) => (
            <PreviewField key={f.id} field={f} onClick={() => onFieldClick(f)} />
          ))}
        </div>
        <Button className="w-full justify-center mt-4" disabled>Submit</Button>
      </div>

      <div className="grid grid-cols-2 gap-2.5 mb-5">
        {[
          ["Fields", fields.length],
          ["Required", required],
          ["Steps", Math.max(1, Math.ceil(fields.length / 4))],
          ["Workflow", form.workflow?.enabled ? "Manager Approval" : "None"],
        ].map(([label, value]) => (
          <div key={label} className="border border-border rounded-lg px-3 py-2.5">
            <p className="text-[11px] text-ink/40">{label}</p>
            <p className="text-sm font-semibold text-ink mt-0.5">{value}</p>
          </div>
        ))}
      </div>
      <div className="border border-border rounded-lg px-3 py-2.5 mb-5">
        <p className="text-[11px] text-ink/40">Estimated Completion</p>
        <p className="text-sm font-semibold text-ink mt-0.5">2 mins</p>
      </div>

      <div className="h-px bg-border mb-4" />
      <p className="text-[11px] font-semibold uppercase tracking-wider text-ink/35 mb-2.5">Quick Actions</p>
      <div className="flex flex-wrap gap-1.5">
        {QUICK_ACTIONS.map((qa) => (
          <button
            key={qa.label}
            onClick={() => onQuickAction(qa)}
            disabled={quickActionBusy}
            className="text-xs font-medium text-ink/70 border border-border rounded-full px-3 py-1.5 hover:border-primary/40 hover:text-primary hover:scale-[1.03] active:scale-[0.97] transition-all disabled:opacity-40"
          >
            {qa.label}
          </button>
        ))}
      </div>
    </div>
  );
}

// ---------- Field customization drawer ----------

// Docked as its own column next to Live Preview (not an overlay/modal) —
// so a user can see the field they're editing and the rest of the form at
// the same time, and the AI chat, preview, and this panel all stay
// visible together rather than one covering another.
function FieldDrawer({ field, fields, formId, onChange, onClose, onAiApplied }) {
  const [tab, setTab] = useState("properties"); // properties | ai
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiBusy, setAiBusy] = useState(false);
  const toast = useToast();

  const askAi = async () => {
    if (!aiPrompt.trim() || aiBusy) return;
    setAiBusy(true);
    try {
      const { data } = await api.post(`/forms/${formId}/ai/build`, {
        prompt: `Regarding the "${field.label}" field: ${aiPrompt.trim()}`,
      });
      onAiApplied(data.fields || []);
      setAiPrompt("");
      toast.success("Field updated.");
    } catch (err) {
      toast.error(err.response?.data?.error || "Couldn't apply that change.");
    } finally {
      setAiBusy(false);
    }
  };

  return (
    <div className="hidden 2xl:flex flex-col w-[340px] shrink-0 border-l border-border bg-white h-full overflow-y-auto animate-[fadeIn_0.2s_ease-out_forwards]">
      <div className="flex items-center justify-between px-4 py-3.5 border-b border-border sticky top-0 bg-white z-10">
        <div>
          <p className="text-[11px] text-ink/40 uppercase tracking-wide font-semibold">Field Settings</p>
          <p className="font-semibold text-ink">{field.label}</p>
        </div>
        <button onClick={onClose} title="Close" className="text-ink/40 hover:text-ink">
          <X size={18} />
        </button>
      </div>

      <div className="flex border-b border-border px-4 gap-4 sticky top-[57px] bg-white z-10">
        <button
          onClick={() => setTab("properties")}
          className={`text-sm font-medium py-2.5 border-b-2 -mb-px transition-colors ${tab === "properties" ? "border-primary text-primary" : "border-transparent text-ink/45 hover:text-ink"}`}
        >
          Properties
        </button>
        <button
          onClick={() => setTab("ai")}
          className={`text-sm font-medium py-2.5 border-b-2 -mb-px flex items-center gap-1.5 transition-colors ${tab === "ai" ? "border-primary text-primary" : "border-transparent text-ink/45 hover:text-ink"}`}
        >
          AI Assistant
          <span className="text-[9px] font-semibold uppercase tracking-wide text-accent-dark bg-accent/10 border border-accent/25 px-1.5 py-0.5 rounded-full">New</span>
        </button>
      </div>

      {tab === "properties" ? (
        <div className="p-4">
          <FieldEditor field={field} fields={fields} onChange={onChange} onDelete={() => {}} bare />
        </div>
      ) : (
        <div className="p-4">
          <textarea
            className={`${inputCls} resize-none`}
            rows={4}
            placeholder="Ask AI to modify this field…"
            value={aiPrompt}
            onChange={(e) => setAiPrompt(e.target.value)}
          />
          <p className="text-xs text-ink/35 mt-1.5 mb-3">
            e.g. "Make this required only for contractors." · "Add Sick Leave option." · "Convert to radio buttons."
          </p>
          <Button onClick={askAi} disabled={aiBusy || !aiPrompt.trim()} className="w-full justify-center">
            <Sparkles size={14} /> {aiBusy ? "Applying…" : "Apply"}
          </Button>
        </div>
      )}
    </div>
  );
}

// ---------- Empty state ----------

function EmptyHero({ prompt, onPromptChange, onSubmit }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center px-6 text-center">
      <div className="w-14 h-14 rounded-2xl bg-primary/8 flex items-center justify-center mb-5">
        <Wand2 size={26} className="text-primary" />
      </div>
      <h1 className="font-display font-bold text-2xl text-ink mb-1.5">Welcome to Flowora AI</h1>
      <p className="text-ink/50 mb-6">What would you like to build today?</p>
      <form onSubmit={onSubmit} className="w-full max-w-xl">
        <div className="flex items-center gap-2 border border-border rounded-xl px-3 py-2.5 bg-white focus-within:ring-2 focus-within:ring-primary/15 focus-within:border-primary/40 transition-shadow">
          <input
            className="flex-1 outline-none text-sm bg-transparent"
            placeholder="Describe the form you want to create…"
            value={prompt}
            onChange={(e) => onPromptChange(e.target.value)}
            autoFocus
          />
          <button type="submit" disabled={!prompt.trim()} className="text-primary disabled:text-ink/20 hover:scale-110 transition-transform shrink-0">
            <Send size={17} />
          </button>
        </div>
      </form>
      <div className="flex flex-wrap justify-center gap-2 mt-4">
        {EXAMPLE_PROMPTS.map((p) => (
          <button
            key={p.label}
            onClick={() => onPromptChange(p.prompt)}
            className="text-xs font-medium text-ink/60 border border-border rounded-full px-3 py-1.5 hover:border-primary/40 hover:text-primary hover:-translate-y-px transition-all"
          >
            {p.emoji} {p.label}
          </button>
        ))}
      </div>
    </div>
  );
}

// ---------- Main ----------

export default function AiArchitect() {
  const router = useRouter();
  const toast = useToast();
  const [messages, setMessages] = useState([]);
  const [prompt, setPrompt] = useState("");
  const [phase, setPhase] = useState("idle"); // idle | checklist | generating | ready
  const [checklistStep, setChecklistStep] = useState(-1);
  const [form, setForm] = useState(null);
  const [fields, setFields] = useState([]);
  const [summary, setSummary] = useState(null);
  const [selectedField, setSelectedField] = useState(null);
  const [publishing, setPublishing] = useState(false);
  const [quickActionBusy, setQuickActionBusy] = useState(false);
  const [recent, setRecent] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [pinned, setPinned] = useState([]);
  const [aiCredits, setAiCredits] = useState(null);
  const [importing, setImporting] = useState(false);
  const scrollRef = useRef(null);
  const checklistTimer = useRef(null);
  const inputRef = useRef(null);
  const pdfInputRef = useRef(null);
  const imageInputRef = useRef(null);
  const wordInputRef = useRef(null);

  useEffect(() => {
    api.get("/forms").then((r) => {
      setRecent([...r.data].filter((f) => (f.fields || []).length > 0).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 6));
    }).catch(() => {});
    api.get("/forms/templates").then((r) => {
      const byKey = Object.fromEntries(r.data.map((t) => [t.key, t]));
      setTemplates(POPULAR_TEMPLATE_KEYS.map((k) => byKey[k]).filter(Boolean));
    }).catch(() => {});
    api.get("/settings").then((r) => setAiCredits(r.data.aiCredits)).catch(() => {});
    setPinned(loadPinned());
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, phase, checklistStep]);

  useEffect(() => () => clearInterval(checklistTimer.current), []);

  const runChecklistThenGenerate = async (formId, aiPrompt) => {
    setPhase("thinking");
    setChecklistStep(-1);
    await new Promise((r) => setTimeout(r, 500));
    setPhase("checklist");
    setChecklistStep(0);
    checklistTimer.current = setInterval(() => {
      setChecklistStep((s) => (s < CHECKLIST_STEPS.length - 2 ? s + 1 : s));
    }, 500);
    try {
      const { data: result } = await api.post(`/forms/${formId}/ai/build`, { prompt: aiPrompt });
      const nextFields = result.fields || [];
      const { data: saved } = await api.put(`/forms/${formId}`, { fields: nextFields });
      clearInterval(checklistTimer.current);
      setChecklistStep(CHECKLIST_STEPS.length - 1);
      setPhase("generating");
      setTimeout(() => {
        setForm(saved);
        setFields(nextFields);
        const s = computeSummary(nextFields, saved);
        setSummary(s);
        setMessages((m) => [...m, { role: "ai", type: "summary", summary: s }]);
        setPhase("ready");
        api.get("/settings").then((r) => setAiCredits(r.data.aiCredits)).catch(() => {});
      }, 700);
    } catch (err) {
      clearInterval(checklistTimer.current);
      setPhase(form ? "ready" : "idle");
      toast.error(err.response?.data?.error || "Couldn't generate that form.");
      setMessages((m) => m.filter((msg) => msg.type !== "checklist"));
    }
  };

  const submitPrompt = async (e) => {
    e?.preventDefault();
    const text = prompt.trim();
    if (!text || busy) return;
    setPrompt("");
    setMessages((m) => [...m, { role: "user", type: "text", content: text }, { role: "ai", type: "checklist" }]);

    try {
      let formId = form?.id;
      if (!formId) {
        const { data: newForm } = await api.post("/forms/from-template", { templateKey: "blank", name: text.slice(0, 60) });
        formId = newForm.id;
      }
      await runChecklistThenGenerate(formId, text);
    } catch (err) {
      toast.error(err.response?.data?.error || "Couldn't start generating that form.");
      setPhase("idle");
      setMessages((m) => m.filter((msg) => msg.type !== "checklist"));
    }
  };

  const regenerate = () => {
    if (!form || busy) return;
    const lastUser = [...messages].reverse().find((m) => m.role === "user");
    const text = lastUser?.content || form.name;
    setMessages((m) => [...m, { role: "ai", type: "checklist" }]);
    runChecklistThenGenerate(form.id, text);
  };

  const runQuickAction = async (qa) => {
    if (!form || quickActionBusy) return;
    setQuickActionBusy(true);
    setMessages((m) => [...m, { role: "user", type: "text", content: qa.prompt }]);
    try {
      const { data: result } = await api.post(`/forms/${form.id}/ai/build`, { prompt: qa.prompt });
      const nextFields = result.fields || [];
      const { data: saved } = await api.put(`/forms/${form.id}`, { fields: nextFields });
      setForm(saved);
      setFields(nextFields);
      const s = computeSummary(nextFields, saved);
      setSummary(s);
      setMessages((m) => [...m, { role: "ai", type: "summary", summary: s }]);
      toast.success(`${qa.label} applied.`);
      api.get("/settings").then((r) => setAiCredits(r.data.aiCredits)).catch(() => {});
    } catch (err) {
      toast.error(err.response?.data?.error || "Couldn't apply that.");
    } finally {
      setQuickActionBusy(false);
    }
  };

  // Real upload → real form, via the same POST /import (multer + AI
  // extraction) endpoint Forms.jsx's "Import PDF/Word/Image" flow already
  // uses — the backend does extraction + field generation in one request,
  // so there's no separate checklist to animate here, just a short
  // "reading your document" beat before the summary lands.
  const importFile = async (file) => {
    if (!file || importing || busy) return;
    setImporting(true);
    setMessages((m) => [...m, { role: "user", type: "text", content: `📎 Uploaded ${file.name}` }, { role: "ai", type: "checklist" }]);
    setPhase("thinking");
    try {
      const formData = new FormData();
      formData.append("file", file);
      const { data: saved } = await api.post("/import", formData);
      setForm(saved);
      setFields(saved.fields || []);
      const s = computeSummary(saved.fields || [], saved);
      setSummary(s);
      setMessages((m) => [...m.filter((msg) => msg.type !== "checklist"), { role: "ai", type: "summary", summary: s }]);
      setPhase("ready");
      api.get("/settings").then((r) => setAiCredits(r.data.aiCredits)).catch(() => {});
    } catch (err) {
      toast.error(err.response?.data?.error || "Couldn't import that file.");
      setMessages((m) => m.filter((msg) => msg.type !== "checklist"));
      setPhase(form ? "ready" : "idle");
    } finally {
      setImporting(false);
    }
  };

  const publish = async () => {
    if (!form || publishing) return;
    setPublishing(true);
    try {
      await api.put(`/forms/${form.id}/publish`);
      toast.success("Form published.");
    } catch (err) {
      toast.error(err.response?.data?.error || "Couldn't publish that form.");
    } finally {
      setPublishing(false);
    }
  };

  const updateField = (updated) => {
    const next = fields.map((f) => (f.id === updated.id ? updated : f));
    setFields(next);
    setSelectedField(updated);
    if (form) api.put(`/forms/${form.id}`, { fields: next }).catch(() => {});
  };

  const onAiFieldApplied = (nextFields) => {
    setFields(nextFields);
    const stillThere = nextFields.find((f) => f.id === selectedField?.id);
    setSelectedField(stillThere || null);
  };

  const togglePin = (text) => {
    setPinned((p) => {
      const next = p.includes(text) ? p.filter((x) => x !== text) : [...p, text];
      localStorage.setItem(PINNED_PROMPTS_KEY, JSON.stringify(next));
      return next;
    });
  };

  const startNewConversation = () => {
    clearInterval(checklistTimer.current);
    setMessages([]);
    setPrompt("");
    setPhase("idle");
    setForm(null);
    setFields([]);
    setSummary(null);
    setSelectedField(null);
  };

  const pickFromLibrary = (text, recentForm) => {
    if (recentForm) {
      setForm(recentForm);
      setFields(recentForm.fields || []);
      const s = computeSummary(recentForm.fields || [], recentForm);
      setSummary(s);
      setMessages([{ role: "ai", type: "summary", summary: s }]);
      setPhase("ready");
      return;
    }
    setPrompt(text);
  };

  const hasStarted = messages.length > 0;
  const busy = phase === "thinking" || phase === "checklist" || phase === "generating";

  const creditsTotal = aiCredits ? aiCredits.remaining + aiCredits.used : 100;

  return (
    <div className="-m-6 h-[calc(100vh-4rem)] flex overflow-hidden bg-base">
      <div className="flex-1 flex flex-col min-w-0">
        {hasStarted ? (
          <>
            <div className="px-6 py-4 border-b border-border bg-white shrink-0">
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-lg bg-primary/8 flex items-center justify-center shrink-0">
                    <Sparkles size={17} className="text-primary" />
                  </div>
                  <div>
                    <h1 className="font-display font-bold text-lg text-ink leading-tight">Flowora AI</h1>
                    <p className="text-xs text-ink/45">Your AI Form Architect</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {aiCredits && (
                    <span className="hidden sm:inline text-xs font-medium text-ink/50 bg-base border border-border rounded-full px-2.5 py-1">
                      {aiCredits.remaining}/{creditsTotal} credits
                    </span>
                  )}
                  <PromptLibraryPopover recent={recent} pinned={pinned} onTogglePin={togglePin} onPickPrompt={pickFromLibrary} templates={templates} />
                  <button
                    onClick={startNewConversation}
                    className="flex items-center gap-1.5 text-sm font-medium text-white bg-primary rounded-lg px-3 py-1.5 hover:bg-primary-dark transition-colors"
                  >
                    <Wand2 size={14} /> New
                  </button>
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {EXAMPLE_PROMPTS.map((p) => (
                  <button
                    key={p.label}
                    onClick={() => setPrompt(p.prompt)}
                    disabled={busy}
                    className="text-xs font-medium text-ink/65 border border-border rounded-full px-2.5 py-1.5 hover:border-primary/40 hover:text-primary transition-colors disabled:opacity-40"
                  >
                    {p.emoji} {p.label}
                  </button>
                ))}
              </div>
            </div>

            <div ref={scrollRef} className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
              {messages.map((m, i) => {
                if (m.type === "text") {
                  return (
                    <div key={i} className="group flex items-start gap-1.5">
                      <ChatMessage role={m.role}>{m.content}</ChatMessage>
                      {m.role === "user" && (
                        <button
                          onClick={() => togglePin(m.content)}
                          className="opacity-0 group-hover:opacity-100 text-ink/25 hover:text-primary mt-2 transition-opacity"
                          title={pinned.includes(m.content) ? "Unpin" : "Pin this prompt"}
                        >
                          <Pin size={13} className={pinned.includes(m.content) ? "fill-primary text-primary" : ""} />
                        </button>
                      )}
                    </div>
                  );
                }
                if (m.type === "checklist") {
                  const isLast = i === messages.length - 1;
                  if (isLast && phase === "thinking") return <ThinkingMessage key={i} />;
                  if (isLast && phase === "checklist") return <ChecklistMessage key={i} stepsReached={checklistStep} generating />;
                  if (isLast && phase === "generating") return <ChecklistMessage key={i} stepsReached={CHECKLIST_STEPS.length - 1} generating />;
                  return <ChecklistMessage key={i} stepsReached={CHECKLIST_STEPS.length - 1} />;
                }
                if (m.type === "summary") {
                  return (
                    <SummaryMessage
                      key={i}
                      summary={m.summary}
                      onPreview={() => router.push(`/app/forms/${form.id}/build`)}
                      onRegenerate={regenerate}
                      onPublish={publish}
                      onEditWithAi={() => inputRef.current?.focus()}
                      onFollowup={(s) => { setPrompt(s); inputRef.current?.focus(); }}
                      publishing={publishing}
                    />
                  );
                }
                return null;
              })}
            </div>
          </>
        ) : (
          <>
            <div className="flex items-center justify-end gap-2 px-6 py-3 shrink-0">
              {aiCredits && (
                <span className="hidden sm:inline text-xs font-medium text-ink/50 bg-base border border-border rounded-full px-2.5 py-1">
                  {aiCredits.remaining}/{creditsTotal} credits
                </span>
              )}
              <PromptLibraryPopover recent={recent} pinned={pinned} onTogglePin={togglePin} onPickPrompt={pickFromLibrary} templates={templates} />
            </div>
            <EmptyHero prompt={prompt} onPromptChange={setPrompt} onSubmit={submitPrompt} />
          </>
        )}

        {hasStarted && (
          <div className="border-t border-border bg-white px-6 py-3.5 shrink-0">
            <form onSubmit={submitPrompt} className="flex items-center gap-1 border border-border rounded-xl px-2 py-2 focus-within:ring-2 focus-within:ring-primary/15 focus-within:border-primary/40 transition-shadow">
              <button type="button" onClick={() => pdfInputRef.current?.click()} className="text-ink/35 hover:text-primary shrink-0 p-1.5 rounded-md hover:bg-base" title="Upload PDF">
                <PdfIcon size={16} />
              </button>
              <button type="button" onClick={() => imageInputRef.current?.click()} className="text-ink/35 hover:text-primary shrink-0 p-1.5 rounded-md hover:bg-base" title="Upload Image">
                <ImageIcon size={16} />
              </button>
              <button type="button" onClick={() => wordInputRef.current?.click()} className="text-ink/35 hover:text-primary shrink-0 p-1.5 rounded-md hover:bg-base" title="Upload Word doc">
                <FileType size={16} />
              </button>
              <button type="button" className="text-ink/20 shrink-0 p-1.5 rounded-md cursor-not-allowed" title="Voice input — coming soon" disabled>
                <Mic size={16} />
              </button>
              <input
                ref={inputRef}
                className="flex-1 outline-none text-sm bg-transparent px-1"
                placeholder="Describe the form you want to create…"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                disabled={busy || importing}
              />
              <button
                type="submit"
                disabled={!prompt.trim() || busy || importing}
                className="text-primary disabled:text-ink/20 hover:scale-110 transition-transform shrink-0 p-1.5"
              >
                <Send size={17} />
              </button>
            </form>
            <input ref={pdfInputRef} type="file" accept="application/pdf" className="hidden" onChange={(e) => importFile(e.target.files?.[0])} />
            <input ref={imageInputRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => importFile(e.target.files?.[0])} />
            <input ref={wordInputRef} type="file" accept=".docx" className="hidden" onChange={(e) => importFile(e.target.files?.[0])} />
            <p className="text-center text-[11px] text-ink/30 mt-2">AI can make mistakes. Please review before publishing.</p>
          </div>
        )}
      </div>

      <div className="hidden xl:flex flex-col w-[420px] shrink-0 border-l border-border bg-white h-full">
        <LivePreview form={form} fields={fields} onFieldClick={setSelectedField} onQuickAction={runQuickAction} quickActionBusy={quickActionBusy} />
      </div>

      {selectedField && (
        <FieldDrawer
          field={selectedField}
          fields={fields}
          formId={form?.id}
          onChange={updateField}
          onClose={() => setSelectedField(null)}
          onAiApplied={onAiFieldApplied}
        />
      )}
    </div>
  );
}
