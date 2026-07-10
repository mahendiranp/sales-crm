import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { Plus, FormInput, Copy, Trash2, GripVertical, Pencil, Share2, Check, ExternalLink, Eye } from "lucide-react";
import api from "../api/client";
import { useAuth } from "../context/AuthContext";
import { Card, PageHeader, Button, Badge, Modal, Field, inputCls, EmptyState } from "../components/ui";
import { timeAgo } from "../lib/format";
import useLiveCollection from "../lib/useLiveCollection";
import FormResponses from "./FormResponses";
import WhatsAppSurveyPanel from "./WhatsAppSurveyPanel";
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

function FormBuilder({ form, onSave }) {
  const [name, setName] = useState(form.name);
  const [description, setDescription] = useState(form.description || "");
  const [fields, setFields] = useState(form.fields || []);
  const [branding, setBranding] = useState(form.settings?.branding || {});
  const [expandedId, setExpandedId] = useState(null);
  const [dragIndex, setDragIndex] = useState(null);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    setName(form.name);
    setDescription(form.description || "");
    setFields(form.fields || []);
    setBranding(form.settings?.branding || {});
    setDirty(false);
  }, [form.id]);

  const markDirty = () => setDirty(true);

  const addField = (type) => {
    setFields((f) => [...f, newField(type)]);
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
    onSave({ name, description, fields, settings: { ...form.settings, branding: cleanBranding } });
    setDirty(false);
  };

  return (
    <div>
      <div className="grid grid-cols-2 gap-3 mb-4">
        <Field label="Form Name">
          <input
            className={inputCls}
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              markDirty();
            }}
          />
        </Field>
        <Field label="Description">
          <input
            className={inputCls}
            value={description}
            onChange={(e) => {
              setDescription(e.target.value);
              markDirty();
            }}
          />
        </Field>
      </div>

      <div className="flex items-center justify-between mb-2">
        <h4 className="font-display font-semibold text-sm">Fields</h4>
        <select
          className={`${inputCls} w-44`}
          value=""
          onChange={(e) => {
            if (e.target.value) addField(e.target.value);
          }}
        >
          <option value="">+ Add Field…</option>
          {FIELD_TYPES.map((t) => (
            <option key={t.type} value={t.type}>{t.label}</option>
          ))}
        </select>
      </div>

      {fields.length === 0 ? (
        <div className="text-sm text-ink/40 border border-dashed border-border rounded-lg p-6 text-center">
          No fields yet — add one above.
        </div>
      ) : (
        <div className="space-y-2 mb-4">
          {fields.map((f, i) => (
            <div
              key={f.id}
              draggable
              onDragStart={() => setDragIndex(i)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => handleDrop(i)}
            >
              <div className="flex items-center gap-2 border border-border rounded-lg px-3 py-2 bg-white cursor-grab">
                <GripVertical size={15} className="text-ink/30 shrink-0" />
                <span className="text-sm font-medium flex-1">{f.label}</span>
                <Badge>{fieldTypeLabel(f.type)}</Badge>
                {f.required && <span className="text-xs text-danger font-medium">Required</span>}
                <button
                  onClick={() => setExpandedId(expandedId === f.id ? null : f.id)}
                  className="text-ink/40 hover:text-ink"
                >
                  <Pencil size={14} />
                </button>
              </div>
              {expandedId === f.id && (
                <div className="mt-1.5">
                  <FieldEditor field={f} onChange={(updated) => updateField(f.id, updated)} onDelete={() => removeField(f.id)} />
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="mb-4">
        <BrandingEditor
          branding={branding}
          onChange={(next) => {
            setBranding(next);
            markDirty();
          }}
        />
      </div>

      <div className="flex justify-end">
        <Button onClick={save} disabled={!dirty}>Save Changes</Button>
      </div>
    </div>
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

export default function Forms() {
  const { canManage } = useAuth();
  const router = useRouter();
  const [forms, setForms] = useState([]);
  const [stats, setStats] = useState(null);
  const [active, setActive] = useState(null);
  const [tab, setTab] = useState("builder");
  const [modal, setModal] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = () => {
    Promise.all([api.get("/forms"), api.get("/forms/stats")]).then(([f, s]) => {
      setForms(f.data);
      setStats(s.data);
      setActive((prev) => f.data.find((x) => x.id === prev?.id) || f.data[0] || null);
      setLoading(false);
    });
  };
  useEffect(() => {
    load();
  }, []);
  useLiveCollection(["forms", "form_responses"], load);

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
        action={canManage && <Button onClick={() => setModal(true)}><Plus size={15} /> New Form</Button>}
      />

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
        <div className="grid grid-cols-3 gap-4">
          <Card className="p-2 h-fit max-h-[70vh] overflow-y-auto">
            {forms.map((f) => (
              <button
                key={f.id}
                onClick={() => {
                  setActive(f);
                  setTab("builder");
                }}
                className={`w-full text-left p-3 rounded-lg mb-1 ${active?.id === f.id ? "bg-primary/8" : "hover:bg-base"}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium text-sm truncate">{f.name}</span>
                  <Badge>{f.status}</Badge>
                </div>
                <div className="text-xs text-ink/40 mt-0.5">{f.responseCount} response{f.responseCount === 1 ? "" : "s"}</div>
              </button>
            ))}
          </Card>

          {active && (
            <div className="col-span-2 space-y-4">
              <Card className="p-5">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <h3 className="font-display font-semibold text-lg">{active.name}</h3>
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

                <div className="flex items-center justify-between border-b border-border mb-4">
                  <div className="flex gap-1">
                    {["builder", "responses", "whatsapp"].map((t) => (
                      <button
                        key={t}
                        onClick={() => setTab(t)}
                        className={`px-3 py-2 text-sm font-medium border-b-2 -mb-px ${
                          tab === t ? "border-primary text-primary" : "border-transparent text-ink/50 hover:text-ink"
                        }`}
                      >
                        {t === "builder" ? "Builder" : t === "responses" ? `Responses (${active.responseCount})` : "WhatsApp"}
                      </button>
                    ))}
                  </div>
                  {tab === "responses" && (
                    <button
                      onClick={() => router.push(`/app/forms/${active.id}/responses`)}
                      className="text-xs font-medium text-primary flex items-center gap-1 hover:underline mb-2"
                    >
                      View Details <ExternalLink size={12} />
                    </button>
                  )}
                </div>

                {tab === "builder" ? (
                  <FormBuilder form={active} onSave={saveBuilder} />
                ) : tab === "responses" ? (
                  <FormResponses formId={active.id} headerless />
                ) : (
                  <WhatsAppSurveyPanel form={active} />
                )}
              </Card>
            </div>
          )}
        </div>
      )}

      <NewFormModal open={modal} onClose={() => setModal(false)} onCreated={handleFormCreated} />
    </div>
  );
}
