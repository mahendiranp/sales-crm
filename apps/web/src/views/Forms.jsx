import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/router";
import {
  Plus, FormInput, Copy, Trash2, GripVertical, Pencil, Share2, Check, ExternalLink, Eye, ClipboardCheck,
  LayoutGrid, Inbox, Workflow as WorkflowIcon, BarChart3, Plug, Settings as SettingsIcon, Sparkles, Send, X as XIcon,
} from "lucide-react";
import api from "../api/client";
import { useAuth } from "../context/AuthContext";
import { Card, PageHeader, Button, Badge, Modal, Field, inputCls, EmptyState } from "../components/ui";
import { timeAgo } from "../lib/format";
import useLiveCollection from "../lib/useLiveCollection";
import FormResponses from "./FormResponses";
import WhatsAppSurveyPanel from "./WhatsAppSurveyPanel";
import FormFieldInput from "../components/FormFieldInput";
import { FORM_THEMES } from "../lib/formThemes";

const FIELD_TYPES = [
  { type: "text", label: "Short Text" },
  { type: "longtext", label: "Long Text" },
  { type: "email", label: "Email" },
  { type: "phone", label: "Phone" },
  { type: "number", label: "Number" },
  { type: "date", label: "Date" },
  { type: "time", label: "Time" },
  { type: "dropdown", label: "Dropdown" },
  { type: "radio", label: "Radio Button" },
  { type: "checkbox", label: "Checkbox" },
  { type: "file", label: "File Upload" },
  { type: "rating", label: "Rating" },
  { type: "yesno", label: "Yes/No" },
];

const BASIC_FIELD_TYPES = ["text", "longtext", "email", "phone", "number", "date", "dropdown", "checkbox"];
const FIELD_CATEGORIES = [
  { key: "basic", label: "Basic Fields", types: FIELD_TYPES.filter((f) => BASIC_FIELD_TYPES.includes(f.type)) },
  { key: "advanced", label: "Advanced Fields", types: FIELD_TYPES.filter((f) => !BASIC_FIELD_TYPES.includes(f.type)) },
];

const STUDIO_NAV = [
  { key: "builder", label: "Build", icon: LayoutGrid },
  { key: "responses", label: "Submissions", icon: Inbox },
  { key: "workflow", label: "Workflow", icon: WorkflowIcon },
  { key: "analytics", label: "Analytics", icon: BarChart3 },
  { key: "whatsapp", label: "Integrations", icon: Plug },
  { key: "settings", label: "Settings", icon: SettingsIcon },
];

const OPTION_TYPES = ["dropdown", "radio", "checkbox"];

function fieldTypeLabel(type) {
  return FIELD_TYPES.find((f) => f.type === type)?.label || type;
}

function newField(type) {
  return {
    id: `f_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    type,
    label: fieldTypeLabel(type),
    placeholder: "",
    defaultValue: "",
    helpText: "",
    required: false,
    options: OPTION_TYPES.includes(type) ? ["Option 1", "Option 2"] : undefined,
    validation: {},
  };
}

function StatCard({ label, value }) {
  return (
    <Card className="p-4">
      <p className="text-xs font-medium text-ink/50">{label}</p>
      <p className="text-2xl font-display font-bold mt-1.5">{value}</p>
    </Card>
  );
}

function FieldEditor({ field, onChange, onDelete }) {
  const update = (patch) => onChange({ ...field, ...patch });
  return (
    <div className="border border-border rounded-lg p-3 space-y-2.5 bg-base/40">
      <div className="grid grid-cols-2 gap-2.5">
        <Field label="Label">
          <input className={inputCls} value={field.label} onChange={(e) => update({ label: e.target.value })} />
        </Field>
        <Field label="Placeholder">
          <input className={inputCls} value={field.placeholder || ""} onChange={(e) => update({ placeholder: e.target.value })} />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-2.5">
        <Field label="Default Value">
          <input className={inputCls} value={field.defaultValue || ""} onChange={(e) => update({ defaultValue: e.target.value })} />
        </Field>
        <Field label="Help Text">
          <input className={inputCls} value={field.helpText || ""} onChange={(e) => update({ helpText: e.target.value })} />
        </Field>
      </div>

      {OPTION_TYPES.includes(field.type) && (
        <Field label="Options (comma-separated)">
          <input
            className={inputCls}
            value={(field.options || []).join(", ")}
            onChange={(e) => update({ options: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })}
          />
        </Field>
      )}

      {field.type === "number" && (
        <div className="grid grid-cols-2 gap-2.5">
          <Field label="Min value">
            <input
              type="number"
              className={inputCls}
              value={field.validation?.min ?? ""}
              onChange={(e) => update({ validation: { ...field.validation, min: e.target.value } })}
            />
          </Field>
          <Field label="Max value">
            <input
              type="number"
              className={inputCls}
              value={field.validation?.max ?? ""}
              onChange={(e) => update({ validation: { ...field.validation, max: e.target.value } })}
            />
          </Field>
        </div>
      )}

      {(field.type === "text" || field.type === "longtext") && (
        <div className="grid grid-cols-2 gap-2.5">
          <Field label="Min length">
            <input
              type="number"
              className={inputCls}
              value={field.validation?.minLength ?? ""}
              onChange={(e) => update({ validation: { ...field.validation, minLength: e.target.value } })}
            />
          </Field>
          <Field label="Max length">
            <input
              type="number"
              className={inputCls}
              value={field.validation?.maxLength ?? ""}
              onChange={(e) => update({ validation: { ...field.validation, maxLength: e.target.value } })}
            />
          </Field>
        </div>
      )}

      <div className="flex items-center justify-between pt-1">
        <label className="flex items-center gap-2 text-sm text-ink/70">
          <input type="checkbox" checked={!!field.required} onChange={(e) => update({ required: e.target.checked })} />
          Required field
        </label>
        <button onClick={onDelete} className="text-danger text-xs font-medium flex items-center gap-1 hover:underline">
          <Trash2 size={13} /> Remove field
        </button>
      </div>
    </div>
  );
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

const MAX_IMAGE_BYTES = 1.5 * 1024 * 1024; // 1.5MB — images are stored inline as base64, keep them small

function ImageUploadField({ label, value, onChange }) {
  const [error, setError] = useState("");

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_IMAGE_BYTES) {
      setError("Image is too large — please use one under 1.5MB.");
      return;
    }
    setError("");
    onChange(await fileToDataUrl(file));
  };

  return (
    <div>
      <p className="text-xs font-medium text-ink/60 mb-1.5">{label}</p>
      {value ? (
        <div className="flex items-center gap-2">
          <img src={value} alt={label} className="h-12 w-12 object-cover rounded-lg border border-border" />
          <Button variant="secondary" onClick={() => onChange("")}>Remove</Button>
        </div>
      ) : (
        <input type="file" accept="image/*" onChange={handleFile} className="text-sm" />
      )}
      {error && <p className="text-xs text-danger mt-1">{error}</p>}
    </div>
  );
}

function ThemePicker({ activeTheme, onPick }) {
  return (
    <div>
      <p className="text-xs font-medium text-ink/60 mb-1.5">Design Theme</p>
      <div className="grid grid-cols-4 gap-2">
        {FORM_THEMES.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => onPick(t)}
            title={t.name}
            className={`rounded-lg overflow-hidden border-2 ${activeTheme === t.key ? "border-primary" : "border-transparent"}`}
          >
            <div className="h-10" style={{ background: t.background }} />
            <div className="text-[10px] py-1 text-center bg-white text-ink/60">{t.name}</div>
          </button>
        ))}
      </div>
    </div>
  );
}

function BrandingEditor({ branding, onChange }) {
  const update = (patch) => onChange({ ...branding, ...patch });
  const bgMode = branding.backgroundImageDataUrl ? "image" : "color";
  // Back-compat: older forms only ever had logoDataUrl with no explicit logoType.
  const logoType = branding.logoType || (branding.logoDataUrl ? "image" : "none");

  const pickTheme = (theme) => {
    update({
      theme: theme.key,
      backgroundCss: theme.background,
      accentColor: theme.accent,
      backgroundColor: "",
      backgroundImageDataUrl: "",
    });
  };

  return (
    <div className="border border-border rounded-lg p-4 space-y-4 bg-base/40">
      <h4 className="font-display font-semibold text-sm">Branding</h4>

      <ThemePicker activeTheme={branding.theme} onPick={pickTheme} />

      <div>
        <p className="text-xs font-medium text-ink/60 mb-1.5">Logo</p>
        <div className="flex gap-2 mb-2">
          {[
            { key: "image", label: "Image" },
            { key: "text", label: "Text" },
            { key: "none", label: "None" },
          ].map((opt) => (
            <button
              key={opt.key}
              type="button"
              onClick={() => update({ logoType: opt.key })}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border ${
                logoType === opt.key ? "bg-primary text-white border-primary" : "border-border text-ink/60"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {logoType === "image" && (
          <ImageUploadField label="" value={branding.logoDataUrl || ""} onChange={(v) => update({ logoDataUrl: v })} />
        )}
        {logoType === "text" && (
          <input
            className={inputCls}
            placeholder="e.g. Your Company Name"
            value={branding.logoText || ""}
            onChange={(e) => update({ logoText: e.target.value })}
          />
        )}
        {logoType === "none" && <p className="text-xs text-ink/40">No logo will be shown on the form.</p>}
      </div>

      <div>
        <p className="text-xs font-medium text-ink/60 mb-1.5">Background {branding.theme && <span className="text-ink/35">(overrides theme)</span>}</p>
        <div className="flex gap-2 mb-2">
          <button
            type="button"
            onClick={() => update({ backgroundImageDataUrl: "", theme: "", backgroundCss: "" })}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium border ${bgMode === "color" ? "bg-primary text-white border-primary" : "border-border text-ink/60"}`}
          >
            Solid Color
          </button>
          <button
            type="button"
            onClick={() => update({ backgroundImageDataUrl: branding.backgroundImageDataUrl || " ", theme: "", backgroundCss: "" })}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium border ${bgMode === "image" ? "bg-primary text-white border-primary" : "border-border text-ink/60"}`}
          >
            Image
          </button>
        </div>

        {bgMode === "color" ? (
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={branding.backgroundColor || "#F5F6F8"}
              onChange={(e) => update({ backgroundColor: e.target.value, theme: "", backgroundCss: "" })}
              className="w-10 h-10 rounded border border-border cursor-pointer"
            />
            <span className="text-xs text-ink/50">{branding.backgroundColor || "#F5F6F8"}</span>
          </div>
        ) : (
          <div>
            <ImageUploadField
              label=""
              value={branding.backgroundImageDataUrl.trim() ? branding.backgroundImageDataUrl : ""}
              onChange={(v) => update({ backgroundImageDataUrl: v })}
            />

            {branding.backgroundImageDataUrl.trim() && (
              <div className="mt-3 space-y-3 border-t border-border pt-3">
                <div>
                  <p className="text-xs font-medium text-ink/60 mb-1.5">Fit</p>
                  <div className="flex gap-2">
                    {[
                      { key: "cover", label: "Cover" },
                      { key: "contain", label: "Contain" },
                      { key: "repeat", label: "Repeat" },
                    ].map((opt) => (
                      <button
                        key={opt.key}
                        type="button"
                        onClick={() => update({ backgroundImageFit: opt.key })}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium border ${
                          (branding.backgroundImageFit || "cover") === opt.key ? "bg-primary text-white border-primary" : "border-border text-ink/60"
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="text-xs font-medium text-ink/60 mb-1.5">Position</p>
                  <div className="flex gap-2">
                    {["top", "center", "bottom"].map((pos) => (
                      <button
                        key={pos}
                        type="button"
                        onClick={() => update({ backgroundImagePosition: pos })}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium border capitalize ${
                          (branding.backgroundImagePosition || "center") === pos ? "bg-primary text-white border-primary" : "border-border text-ink/60"
                        }`}
                      >
                        {pos}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="text-xs font-medium text-ink/60 mb-1.5">
                    Darken overlay <span className="text-ink/35">({branding.backgroundImageOverlay || 0}%)</span>
                  </p>
                  <input
                    type="range"
                    min="0"
                    max="80"
                    value={branding.backgroundImageOverlay || 0}
                    onChange={(e) => update({ backgroundImageOverlay: Number(e.target.value) })}
                    className="w-full"
                  />
                  <p className="text-[11px] text-ink/40 mt-0.5">Darkens the image so text and logos stay readable.</p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function FieldPalette({ onAdd, onAskAI }) {
  const [cat, setCat] = useState("basic");
  const active = FIELD_CATEGORIES.find((c) => c.key === cat);
  return (
    <div className="border border-border rounded-card bg-white p-3 h-fit">
      <h4 className="font-display font-semibold text-sm mb-3">Add Fields</h4>
      <div className="flex gap-1 mb-3 border-b border-border">
        {FIELD_CATEGORIES.map((c) => (
          <button
            key={c.key}
            onClick={() => setCat(c.key)}
            className={`px-2.5 py-1.5 text-xs font-medium border-b-2 -mb-px ${
              cat === c.key ? "border-primary text-primary" : "border-transparent text-ink/50 hover:text-ink"
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>
      <div className="space-y-1">
        {active.types.map((t) => (
          <button
            key={t.type}
            onClick={() => onAdd(t.type)}
            className="w-full flex items-center gap-2 text-left text-sm px-2.5 py-2 rounded-lg border border-border hover:border-primary hover:bg-primary/5 transition-colors"
          >
            <span className="text-ink/70">{t.label}</span>
          </button>
        ))}
      </div>
      <button
        onClick={onAskAI}
        className="w-full mt-3 flex items-center justify-center gap-1.5 text-xs font-medium text-primary border border-primary/30 bg-primary/5 rounded-lg px-2.5 py-2 hover:bg-primary/10"
      >
        <Sparkles size={13} /> Ask AI to add a field
      </button>
    </div>
  );
}

// The center canvas doubles as the live preview — what you see while
// editing is exactly what a respondent sees, with an edit/delete overlay
// on hover instead of a separate compact field-list + preview pane.
function CanvasField({ field, expanded, onToggle, onChange, onDelete, dragHandleProps }) {
  return (
    <div className="group relative border border-border rounded-lg p-3.5 bg-white hover:border-primary/40 transition-colors" {...dragHandleProps}>
      <div className="absolute top-2 right-2 hidden group-hover:flex items-center gap-1">
        <button onClick={onToggle} className="p-1.5 rounded bg-base text-ink/50 hover:text-primary"><Pencil size={13} /></button>
        <button onClick={onDelete} className="p-1.5 rounded bg-base text-ink/50 hover:text-danger"><Trash2 size={13} /></button>
        <span className="p-1.5 rounded bg-base text-ink/30 cursor-grab"><GripVertical size={13} /></span>
      </div>
      <label className="block text-sm font-medium mb-1.5">
        {field.label} {field.required && <span className="text-danger">*</span>}
      </label>
      <FormFieldInput field={field} value={field.type === "checkbox" ? [] : ""} onChange={() => {}} />
      {field.helpText && <p className="text-xs text-ink/40 mt-1">{field.helpText}</p>}

      {expanded && (
        <div className="mt-3 pt-3 border-t border-border">
          <FieldEditor field={field} onChange={onChange} onDelete={onDelete} />
        </div>
      )}
    </div>
  );
}

function AI_REPLY_INTRO() {
  return "I can add fields to this form right now — try \"Add a field for email\" or \"Add a phone number field\". Full AI-generated forms from a single prompt need an LLM API key; ask your admin to add one so I can do more.";
}

// Pattern-matches simple "add a field for X" / "add an X field" style
// requests locally (no LLM required) so the assistant does *something*
// real without a key configured, rather than only ever stubbing replies.
function matchAddFieldIntent(text) {
  const lower = text.toLowerCase();
  if (!/\badd\b/.test(lower) || !/\bfield\b/.test(lower)) return null;
  for (const t of FIELD_TYPES) {
    const needle = t.label.toLowerCase();
    if (lower.includes(needle)) return t;
  }
  // Fallback keyword matches for common phrasings ("add a field for email").
  const keywordMap = {
    email: "email", phone: "phone", number: "number", date: "date", time: "time",
    rating: "rating", file: "file", upload: "file", "yes/no": "yesno", "yes or no": "yesno",
    dropdown: "dropdown", "long text": "longtext", paragraph: "longtext", checkbox: "checkbox", radio: "radio",
  };
  for (const [kw, type] of Object.entries(keywordMap)) {
    if (lower.includes(kw)) return FIELD_TYPES.find((t) => t.type === type);
  }
  return null;
}

// Calls the real backend AI endpoint (POST /forms/:id/ai/build) first. If
// it comes back 503 "not configured" (no ANTHROPIC_API_KEY set yet), falls
// back to the local "add a field for X" pattern-matcher so the panel still
// does something useful before a key is wired up.
function AIAssistantPanel({ formId, formName, onApplyResult, onAddField, onClose }) {
  const [messages, setMessages] = useState([
    { role: "ai", text: AI_REPLY_INTRO() },
  ]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const listRef = useRef(null);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages, busy]);

  const send = async () => {
    const text = input.trim();
    if (!text || busy) return;
    setInput("");
    setMessages((m) => [...m, { role: "user", text }]);
    setBusy(true);
    try {
      const { data } = await api.post(`/forms/${formId}/ai/build`, { prompt: text });
      onApplyResult(data);
      setMessages((m) => [...m, { role: "ai", text: data.message || "Updated the form." }]);
    } catch (err) {
      if (err.response?.status === 503) {
        const match = matchAddFieldIntent(text);
        if (match) {
          onAddField(match.type);
          setMessages((m) => [...m, { role: "ai", text: `Added a "${match.label}" field to ${formName}. (Full AI generation needs an API key — not configured yet.)` }]);
        } else {
          setMessages((m) => [...m, { role: "ai", text: err.response?.data?.error || AI_REPLY_INTRO() }]);
        }
      } else {
        setMessages((m) => [...m, { role: "ai", text: err.response?.data?.error || "Something went wrong talking to the AI Assistant." }]);
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="border border-border rounded-card bg-white flex flex-col h-[600px]">
      <div className="flex items-center justify-between px-3.5 py-3 border-b border-border">
        <div className="flex items-center gap-1.5">
          <Sparkles size={15} className="text-primary" />
          <h4 className="font-display font-semibold text-sm">AI Assistant</h4>
          <Badge>Beta</Badge>
        </div>
        <button onClick={onClose} className="text-ink/40 hover:text-ink"><XIcon size={16} /></button>
      </div>

      <div ref={listRef} className="flex-1 overflow-y-auto p-3.5 space-y-3">
        {messages.map((m, i) => (
          <div key={i} className={m.role === "user" ? "flex justify-end" : ""}>
            <div className={`text-sm rounded-lg px-3 py-2 max-w-[85%] ${m.role === "user" ? "bg-primary text-white" : "bg-base text-ink/80"}`}>
              {m.text}
            </div>
          </div>
        ))}
        {busy && (
          <div className="text-sm rounded-lg px-3 py-2 max-w-[85%] bg-base text-ink/50 italic">Thinking…</div>
        )}
      </div>

      <div className="p-3 border-t border-border">
        <div className="flex items-center gap-2 bg-base rounded-lg px-2.5 py-1.5">
          <input
            className="bg-transparent outline-none text-sm flex-1"
            placeholder="Ask AI to create or modify your form…"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && send()}
            disabled={busy}
          />
          <button onClick={send} className="text-primary shrink-0" disabled={busy}><Send size={15} /></button>
        </div>
        <p className="text-[11px] text-ink/35 mt-1.5">Examples: "Add a signature field", "Create an employee leave request form"</p>
      </div>
    </div>
  );
}

function FormBuilder({ form, onSave }) {
  const [fields, setFields] = useState(form.fields || []);
  const [expandedId, setExpandedId] = useState(null);
  const [dragIndex, setDragIndex] = useState(null);
  const [dirty, setDirty] = useState(false);
  const [aiOpen, setAiOpen] = useState(true);

  useEffect(() => {
    setFields(form.fields || []);
    setDirty(false);
  }, [form.id]);

  const markDirty = () => setDirty(true);

  const addField = (type) => {
    const f = newField(type);
    setFields((prev) => [...prev, f]);
    setExpandedId(f.id);
    markDirty();
  };
  const updateField = (id, updated) => {
    setFields((f) => f.map((x) => (x.id === id ? updated : x)));
    markDirty();
  };
  const removeField = (id) => {
    setFields((f) => f.filter((x) => x.id !== id));
    markDirty();
  };

  const handleDrop = (dropIndex) => {
    if (dragIndex === null || dragIndex === dropIndex) return;
    setFields((f) => {
      const next = [...f];
      const [moved] = next.splice(dragIndex, 1);
      next.splice(dropIndex, 0, moved);
      return next;
    });
    setDragIndex(null);
    markDirty();
  };

  const save = () => {
    onSave({ fields });
    setDirty(false);
  };

  // Applies an AI-generated result: "add" appends only the new fields
  // (assigning ids), "replace" swaps in the full list the AI returned,
  // preserving ids it echoed back for unchanged fields and assigning new
  // ones only where it omitted an id.
  const applyAIResult = (result) => {
    const withIds = (result.fields || []).map((f) => ({
      id: f.id || `f_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      type: f.type,
      label: f.label || fieldTypeLabel(f.type),
      placeholder: f.placeholder || "",
      defaultValue: f.defaultValue || "",
      helpText: f.helpText || "",
      required: !!f.required,
      options: OPTION_TYPES.includes(f.type) ? (f.options?.length ? f.options : ["Option 1", "Option 2"]) : undefined,
      validation: f.validation || {},
    }));
    setFields((prev) => (result.action === "add" ? [...prev, ...withIds] : withIds));
    markDirty();
  };

  return (
    <div className={`grid ${aiOpen ? "grid-cols-[220px_1fr_320px]" : "grid-cols-[220px_1fr]"} gap-4 items-start`}>
      <FieldPalette onAdd={addField} onAskAI={() => setAiOpen(true)} />

      <div>
        <div className="flex items-center justify-between mb-3">
          <h4 className="font-display font-semibold text-sm">Canvas</h4>
          <div className="flex items-center gap-2">
            {!aiOpen && (
              <button onClick={() => setAiOpen(true)} className="flex items-center gap-1.5 text-xs font-medium text-primary border border-primary/30 bg-primary/5 rounded-lg px-2.5 py-1.5">
                <Sparkles size={13} /> AI Assistant
              </button>
            )}
            <Button onClick={save} disabled={!dirty}>Save Changes</Button>
          </div>
        </div>

        <div className="border border-border rounded-card bg-base/30 p-4">
          {fields.length === 0 ? (
            <div className="text-sm text-ink/40 border border-dashed border-border rounded-lg p-8 text-center bg-white">
              No fields yet — add one from the palette on the left, or ask the AI Assistant.
            </div>
          ) : (
            <div className="space-y-2.5">
              {fields.map((f, i) => (
                <div key={f.id} draggable onDragStart={() => setDragIndex(i)} onDragOver={(e) => e.preventDefault()} onDrop={() => handleDrop(i)}>
                  <CanvasField
                    field={f}
                    expanded={expandedId === f.id}
                    onToggle={() => setExpandedId(expandedId === f.id ? null : f.id)}
                    onChange={(updated) => updateField(f.id, updated)}
                    onDelete={() => removeField(f.id)}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {aiOpen && (
        <AIAssistantPanel
          formId={form.id}
          formName={form.name}
          onApplyResult={applyAIResult}
          onAddField={addField}
          onClose={() => setAiOpen(false)}
        />
      )}
    </div>
  );
}

// Name/description + branding, split out of the field canvas so "Settings"
// is its own left-rail destination, matching the studio layout.
function FormSettingsPanel({ form, onSave }) {
  const [name, setName] = useState(form.name);
  const [description, setDescription] = useState(form.description || "");
  const [branding, setBranding] = useState(form.settings?.branding || {});
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    setName(form.name);
    setDescription(form.description || "");
    setBranding(form.settings?.branding || {});
    setDirty(false);
  }, [form.id]);

  const markDirty = () => setDirty(true);

  const save = () => {
    const cleanBranding = {
      logoType: branding.logoType || (branding.logoDataUrl ? "image" : "none"),
      logoDataUrl: branding.logoDataUrl || "",
      logoText: branding.logoText || "",
      theme: branding.theme || "",
      accentColor: branding.accentColor || "",
      backgroundCss: branding.backgroundCss || "",
      backgroundColor: branding.backgroundColor || "",
      backgroundImageDataUrl: (branding.backgroundImageDataUrl || "").trim(),
      backgroundImageFit: branding.backgroundImageFit || "cover",
      backgroundImagePosition: branding.backgroundImagePosition || "center",
      backgroundImageOverlay: branding.backgroundImageOverlay || 0,
    };
    onSave({ name, description, settings: { ...form.settings, branding: cleanBranding } });
    setDirty(false);
  };

  return (
    <div className="max-w-2xl">
      <div className="grid grid-cols-2 gap-3 mb-4">
        <Field label="Form Name">
          <input className={inputCls} value={name} onChange={(e) => { setName(e.target.value); markDirty(); }} />
        </Field>
        <Field label="Description">
          <input className={inputCls} value={description} onChange={(e) => { setDescription(e.target.value); markDirty(); }} />
        </Field>
      </div>

      <BrandingEditor branding={branding} onChange={(next) => { setBranding(next); markDirty(); }} />

      <div className="flex justify-end mt-4">
        <Button onClick={save} disabled={!dirty}>Save Settings</Button>
      </div>
    </div>
  );
}

const ROLE_OPTIONS = [
  { value: "admin", label: "Owner/Admin" },
  { value: "manager", label: "Manager" },
  { value: "viewer", label: "Viewer" },
];

function newStep() {
  return {
    id: `step_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    name: "Approval Step",
    mode: "all",
    approvers: [{ type: "role", value: "manager" }],
    autoApprove: false,
    escalateAfterHours: "",
    escalateTo: null,
  };
}

// Employee → Manager → HR style sequential approval routing, attached to
// a form so every submission gets its own approval instance. Approvers
// are role-based (resolved against the tenant's current team each time)
// or a specific teammate; steps run in order, each step can require every
// assigned approver ("all") or just the first one ("any").
function WorkflowStepEditor({ step, onChange, onDelete, teammates }) {
  const update = (patch) => onChange({ ...step, ...patch });
  const approver = step.approvers[0] || { type: "role", value: "manager" };
  const updateApprover = (patch) => update({ approvers: [{ ...approver, ...patch }] });

  return (
    <div className="border border-border rounded-lg p-3 space-y-2.5 bg-base/40">
      <div className="flex items-center gap-2">
        <input className={`${inputCls} flex-1`} value={step.name} onChange={(e) => update({ name: e.target.value })} placeholder="Step name" />
        <button onClick={onDelete} className="text-danger shrink-0"><Trash2 size={14} /></button>
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        <Field label="Approver">
          <div className="flex gap-1.5">
            <select className={inputCls} value={approver.type} onChange={(e) => updateApprover({ type: e.target.value, value: e.target.value === "role" ? "manager" : "" })}>
              <option value="role">By role</option>
              <option value="user">Specific person</option>
            </select>
          </div>
        </Field>
        <Field label={approver.type === "role" ? "Role" : "Teammate"}>
          {approver.type === "role" ? (
            <select className={inputCls} value={approver.value} onChange={(e) => updateApprover({ value: e.target.value })}>
              {ROLE_OPTIONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          ) : teammates === null ? (
            // /auth/team is owner-only — a manager-level teammate building
            // this workflow won't be able to list the roster, so fall back
            // to a manual id field rather than showing a broken dropdown.
            <input className={inputCls} value={approver.value} onChange={(e) => updateApprover({ value: e.target.value })} placeholder="Paste teammate's account id" />
          ) : (
            <select className={inputCls} value={approver.value} onChange={(e) => updateApprover({ value: e.target.value })}>
              <option value="">Select a teammate…</option>
              {teammates.map((t) => <option key={t.id} value={t.id}>{t.name} ({t.email})</option>)}
            </select>
          )}
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        <Field label="If role resolves to multiple people">
          <select className={inputCls} value={step.mode} onChange={(e) => update({ mode: e.target.value })}>
            <option value="all">All must approve</option>
            <option value="any">Any one approval advances</option>
          </select>
        </Field>
        <Field label="Escalate after (hours, optional)">
          <input type="number" className={inputCls} value={step.escalateAfterHours} onChange={(e) => update({ escalateAfterHours: e.target.value })} placeholder="e.g. 24" />
        </Field>
      </div>

      <label className="flex items-center gap-2 text-sm text-ink/70">
        <input type="checkbox" checked={!!step.autoApprove} onChange={(e) => update({ autoApprove: e.target.checked })} />
        Auto-approve this step (skip, useful as a placeholder step)
      </label>
    </div>
  );
}

function WorkflowEditor({ form, onSave }) {
  const [enabled, setEnabled] = useState(!!form.workflow?.enabled);
  const [steps, setSteps] = useState(form.workflow?.steps || []);
  const [dirty, setDirty] = useState(false);
  // null = not loaded yet / unavailable (e.g. this account isn't the
  // owner, so GET /auth/team 403s) — WorkflowStepEditor falls back to a
  // manual account-id field in that case instead of an empty dropdown.
  const [teammates, setTeammates] = useState(null);

  useEffect(() => {
    setEnabled(!!form.workflow?.enabled);
    setSteps(form.workflow?.steps || []);
    setDirty(false);
  }, [form.id]);

  useEffect(() => {
    api.get("/auth/team").then((r) => setTeammates(r.data)).catch(() => setTeammates(null));
  }, []);

  const markDirty = () => setDirty(true);
  const addStep = () => { setSteps((s) => [...s, newStep()]); markDirty(); };
  const updateStep = (id, updated) => { setSteps((s) => s.map((x) => (x.id === id ? updated : x))); markDirty(); };
  const removeStep = (id) => { setSteps((s) => s.filter((x) => x.id !== id)); markDirty(); };

  const save = () => {
    onSave({ workflow: { enabled, steps } });
    setDirty(false);
  };

  return (
    <div>
      <label className="flex items-center gap-2 text-sm font-medium mb-4">
        <input type="checkbox" checked={enabled} onChange={(e) => { setEnabled(e.target.checked); markDirty(); }} />
        Require approval workflow before a submission counts as final
      </label>

      {enabled && (
        <>
          {steps.length === 0 ? (
            <div className="text-sm text-ink/40 border border-dashed border-border rounded-lg p-6 text-center mb-3">
              No steps yet — add one below. Each submission routes through steps in order.
            </div>
          ) : (
            <div className="space-y-2.5 mb-3">
              {steps.map((s, i) => (
                <div key={s.id} className="flex items-start gap-2">
                  <span className="text-xs font-semibold text-ink/30 mt-3 shrink-0 w-5">{i + 1}.</span>
                  <div className="flex-1">
                    <WorkflowStepEditor step={s} onChange={(u) => updateStep(s.id, u)} onDelete={() => removeStep(s.id)} teammates={teammates} />
                  </div>
                </div>
              ))}
            </div>
          )}
          <Button variant="secondary" onClick={addStep}><Plus size={14} /> Add Step</Button>
        </>
      )}

      <div className="flex justify-end mt-4">
        <Button onClick={save} disabled={!dirty}>Save Workflow</Button>
      </div>
    </div>
  );
}

// Cross-form inbox of everything waiting on the current user's decision —
// opened from the header button on the Forms list page.
function ApprovalsModal({ open, onClose, onDecided }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);

  const load = () => {
    setLoading(true);
    api.get("/forms/approvals/pending").then((r) => {
      setItems(r.data);
      setLoading(false);
    });
  };
  useEffect(() => {
    if (open) load();
  }, [open]);

  const decide = async (item, action) => {
    setBusyId(item.id);
    const comment = action === "reject" ? prompt("Reason for rejecting (optional):") || "" : "";
    try {
      await api.post(`/forms/${item.formId}/responses/${item.id}/workflow/decide`, { action, comment });
      load();
      onDecided?.();
    } catch (err) {
      alert(err.response?.data?.error || "Failed to record decision.");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="My Approvals" wide>
      {loading ? (
        <div className="text-sm text-ink/40">Loading…</div>
      ) : items.length === 0 ? (
        <EmptyState icon={ClipboardCheck} title="Nothing pending" subtitle="You have no approvals waiting on you right now." />
      ) : (
        <div className="space-y-2.5">
          {items.map((item) => {
            const step = item.workflow.steps[item.workflow.currentStep];
            return (
              <div key={item.id} className="border border-border rounded-lg p-3">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="font-medium text-sm">{item.formName}</span>
                  <span className="text-xs text-ink/40">{timeAgo(item.submittedAt)}</span>
                </div>
                <p className="text-xs text-ink/50 mb-2">Step: {step?.name}</p>
                <div className="text-xs space-y-0.5 mb-2.5">
                  {item.formFields.slice(0, 3).map((f) => (
                    <div key={f.id} className="flex gap-1.5">
                      <span className="text-ink/40">{f.label}:</span>
                      <span className="truncate">{Array.isArray(item.answers?.[f.id]) ? item.answers[f.id].join(", ") : String(item.answers?.[f.id] ?? "—")}</span>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Button onClick={() => decide(item, "approve")} disabled={busyId === item.id}>Approve</Button>
                  <Button variant="danger" onClick={() => decide(item, "reject")} disabled={busyId === item.id}>Reject</Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Modal>
  );
}

function ShareLink({ form }) {
  const [copied, setCopied] = useState(false);
  if (typeof window === "undefined") return null;
  const url = `${window.location.origin}/forms/${form.id}`;

  const copy = async () => {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="flex items-center gap-2 bg-base border border-border rounded-lg px-3 py-2 mb-4">
      <Share2 size={15} className="text-ink/40 shrink-0" />
      <input readOnly value={url} className="bg-transparent outline-none text-sm flex-1 text-ink/70" onFocus={(e) => e.target.select()} />
      <Button variant="secondary" onClick={copy}>
        {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? "Copied" : "Copy"}
      </Button>
    </div>
  );
}

function TemplateGallery({ templates, onPick }) {
  const categories = [...new Set(templates.map((t) => t.category))];
  return (
    <div className="space-y-4">
      {categories.map((cat) => (
        <div key={cat}>
          <p className="text-xs font-semibold uppercase tracking-wider text-ink/35 mb-1.5">{cat}</p>
          <div className="grid grid-cols-2 gap-2">
            {templates.filter((t) => t.category === cat).map((t) => (
              <button
                key={t.key}
                onClick={() => onPick(t)}
                className="text-left border border-border rounded-lg p-3 hover:border-primary hover:bg-primary/5 transition-colors"
              >
                <p className="text-sm font-medium">{t.name}</p>
                <p className="text-xs text-ink/40 mt-0.5">{t.description}</p>
                {t.fieldCount > 0 && <p className="text-xs text-primary/70 mt-1.5">{t.fieldCount} fields</p>}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function NewFormModal({ open, onClose, onCreated }) {
  const [templates, setTemplates] = useState([]);
  const [selected, setSelected] = useState(null);
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (open) {
      api.get("/forms/templates").then((r) => setTemplates(r.data));
      setSelected(null);
      setName("");
    }
  }, [open]);

  const pick = (template) => {
    setSelected(template);
    setName(template.key === "blank" ? "" : template.name);
  };

  const create = async () => {
    if (!name.trim() || !selected) return;
    setCreating(true);
    const { data } = await api.post("/forms/from-template", { templateKey: selected.key, name });
    setCreating(false);
    onCreated(data);
  };

  return (
    <Modal open={open} onClose={onClose} title={selected ? "Name Your Form" : "Choose a Template"} wide={!selected}>
      {!selected ? (
        <TemplateGallery templates={templates} onPick={pick} />
      ) : (
        <div>
          <button onClick={() => setSelected(null)} className="text-xs text-primary font-medium mb-3 hover:underline">
            ← Choose a different template
          </button>
          <Field label="Form Name">
            <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Contact Us" autoFocus />
          </Field>
          <div className="flex justify-end gap-2 mt-2">
            <Button variant="secondary" onClick={onClose}>Cancel</Button>
            <Button onClick={create} disabled={creating || !name.trim()}>{creating ? "Creating…" : "Create Form"}</Button>
          </div>
        </div>
      )}
    </Modal>
  );
}

function FormAnalyticsPanel({ form, recentResponses }) {
  const forThisForm = recentResponses.filter((r) => r.formName === form.name);
  return (
    <div>
      <div className="grid grid-cols-2 gap-3 mb-4">
        <Card className="p-4">
          <p className="text-xs font-medium text-ink/50">Total Responses</p>
          <p className="text-2xl font-display font-bold mt-1.5">{form.responseCount}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs font-medium text-ink/50">Status</p>
          <p className="text-2xl font-display font-bold mt-1.5">{form.status}</p>
        </Card>
      </div>
      <Card className="p-4">
        <p className="text-xs font-medium text-ink/50 mb-1.5">Recent Activity</p>
        {forThisForm.length === 0 ? (
          <p className="text-xs text-ink/40">No responses yet.</p>
        ) : (
          <div className="space-y-1">
            {forThisForm.map((r) => (
              <div key={r.id} className="flex justify-between text-xs">
                <span className="text-ink/70">New submission</span>
                <span className="text-ink/40">{timeAgo(r.submittedAt)}</span>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

export default function Forms() {
  const { canManage } = useAuth();
  const router = useRouter();
  const [forms, setForms] = useState([]);
  const [stats, setStats] = useState(null);
  const [active, setActive] = useState(null);
  const [tab, setTab] = useState("builder");
  const [modal, setModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [approvalsOpen, setApprovalsOpen] = useState(false);
  const [approvalsCount, setApprovalsCount] = useState(0);

  const load = () => {
    Promise.all([api.get("/forms"), api.get("/forms/stats")]).then(([f, s]) => {
      setForms(f.data);
      setStats(s.data);
      setActive((prev) => f.data.find((x) => x.id === prev?.id) || f.data[0] || null);
      setLoading(false);
    });
  };
  const loadApprovalsCount = () => api.get("/forms/approvals/pending").then((r) => setApprovalsCount(r.data.length));
  useEffect(() => {
    load();
    loadApprovalsCount();
  }, []);
  useLiveCollection(["forms", "form_responses"], () => { load(); loadApprovalsCount(); });

  const handleFormCreated = (data) => {
    setModal(false);
    load();
    setActive(data);
  };

  const duplicateForm = async (form) => {
    await api.post(`/forms/${form.id}/duplicate`);
    load();
  };

  const deleteForm = async (form) => {
    if (!confirm(`Delete "${form.name}"? This also deletes its responses.`)) return;
    await api.delete(`/forms/${form.id}`);
    setActive(null);
    load();
  };

  const togglePublish = async (form) => {
    const endpoint = form.status === "Published" ? "unpublish" : "publish";
    await api.put(`/forms/${form.id}/${endpoint}`);
    load();
  };

  const saveBuilder = async (patch) => {
    await api.put(`/forms/${active.id}`, patch);
    load();
  };

  return (
    <div>
      <PageHeader
        title="Forms"
        subtitle="Build custom forms and collect responses."
        action={
          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={() => setApprovalsOpen(true)}>
              <ClipboardCheck size={15} /> My Approvals{approvalsCount > 0 ? ` (${approvalsCount})` : ""}
            </Button>
            {canManage && <Button onClick={() => setModal(true)}><Plus size={15} /> New Form</Button>}
          </div>
        }
      />

      <ApprovalsModal open={approvalsOpen} onClose={() => setApprovalsOpen(false)} onDecided={loadApprovalsCount} />

      {stats && (
        <div className="grid grid-cols-3 gap-4 mb-6">
          <StatCard label="Total Forms" value={stats.totalForms} />
          <StatCard label="Total Responses" value={stats.totalResponses} />
          <Card className="p-4">
            <p className="text-xs font-medium text-ink/50 mb-1.5">Recent Responses</p>
            {stats.recentResponses.length === 0 ? (
              <p className="text-xs text-ink/40">None yet</p>
            ) : (
              <div className="space-y-1">
                {stats.recentResponses.map((r) => (
                  <div key={r.id} className="flex justify-between text-xs">
                    <span className="text-ink/70 truncate">{r.formName}</span>
                    <span className="text-ink/40 shrink-0 ml-2">{timeAgo(r.submittedAt)}</span>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      )}

      {loading ? (
        <div className="text-ink/40 text-sm">Loading…</div>
      ) : forms.length === 0 ? (
        <Card><EmptyState icon={FormInput} title="No forms yet" subtitle="Create your first form to start collecting responses." /></Card>
      ) : (
        <div>
          {active && (
            <div className="space-y-4">
              <Card className="p-5">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <select
                      value={active.id}
                      onChange={(e) => {
                        setActive(forms.find((f) => f.id === e.target.value) || active);
                        setTab("builder");
                      }}
                      className="font-display font-semibold text-lg bg-transparent border-none outline-none cursor-pointer -ml-1 max-w-[420px] truncate"
                    >
                      {forms.map((f) => (
                        <option key={f.id} value={f.id}>{f.name} — {f.responseCount} response{f.responseCount === 1 ? "" : "s"}</option>
                      ))}
                    </select>
                    <Badge>{active.status}</Badge>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Button
                      variant="secondary"
                      onClick={() => window.open(`/forms/${active.id}?preview=1`, "_blank")}
                    >
                      <Eye size={14} /> Preview
                    </Button>
                    {canManage && (
                      <>
                        <Button variant="secondary" onClick={() => togglePublish(active)}>
                          {active.status === "Published" ? "Unpublish" : "Publish"}
                        </Button>
                        <Button variant="secondary" onClick={() => duplicateForm(active)}><Copy size={14} /></Button>
                        <Button variant="danger" onClick={() => deleteForm(active)}><Trash2 size={14} /></Button>
                      </>
                    )}
                  </div>
                </div>

                {active.status === "Published" && <ShareLink form={active} />}

                <div className="grid grid-cols-[76px_1fr] gap-4">
                  <div className="flex flex-col gap-1 border-r border-border pr-2">
                    {STUDIO_NAV.map((item) => (
                      <button
                        key={item.key}
                        onClick={() => setTab(item.key)}
                        className={`flex flex-col items-center gap-1 py-2.5 rounded-lg text-[11px] font-medium ${
                          tab === item.key ? "bg-primary/8 text-primary" : "text-ink/50 hover:bg-base hover:text-ink"
                        }`}
                      >
                        <item.icon size={17} />
                        {item.label}
                      </button>
                    ))}
                  </div>

                  <div>
                    {tab === "responses" && (
                      <div className="flex justify-end mb-2">
                        <button
                          onClick={() => router.push(`/app/forms/${active.id}/responses`)}
                          className="text-xs font-medium text-primary flex items-center gap-1 hover:underline"
                        >
                          View Details <ExternalLink size={12} />
                        </button>
                      </div>
                    )}

                    {tab === "builder" ? (
                      <FormBuilder form={active} onSave={saveBuilder} />
                    ) : tab === "workflow" ? (
                      <WorkflowEditor form={active} onSave={saveBuilder} />
                    ) : tab === "responses" ? (
                      <FormResponses formId={active.id} headerless />
                    ) : tab === "whatsapp" ? (
                      <WhatsAppSurveyPanel form={active} />
                    ) : tab === "settings" ? (
                      <FormSettingsPanel form={active} onSave={saveBuilder} />
                    ) : (
                      <FormAnalyticsPanel form={active} recentResponses={stats?.recentResponses || []} />
                    )}
                  </div>
                </div>
              </Card>
            </div>
          )}
        </div>
      )}

      <NewFormModal open={modal} onClose={() => setModal(false)} onCreated={handleFormCreated} />
    </div>
  );
}
