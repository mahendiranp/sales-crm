import { useEffect, useState } from "react";
import { Plus, Sparkles, MessageCircle, Mail } from "lucide-react";
import api from "../api/client";
import { useAuth } from "../context/AuthContext";
import { Card, PageHeader, Button, Modal, Field, inputCls, EmptyState } from "../components/ui";

const CATEGORIES = ["Welcome", "Quotation", "Payment Reminder", "Festival Wishes", "Follow-up"];
const emptyForm = { name: "", category: "Welcome", channel: "WhatsApp", body: "" };

export default function Templates() {
  const { canManage } = useAuth();
  const [templates, setTemplates] = useState([]);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = () => {
    api.get("/templates").then((r) => {
      setTemplates(r.data);
      setLoading(false);
    });
  };
  useEffect(load, []);

  const save = async () => {
    await api.post("/templates", form);
    setModal(false);
    setForm(emptyForm);
    load();
  };

  const personalize = (body) =>
    body
      .replace(/{{name}}/g, "Rohit Saxena")
      .replace(/{{product}}/g, "CRM Pro")
      .replace(/{{amount}}/g, "45,000")
      .replace(/{{date}}/g, "12 Jul 2026")
      .replace(/{{company}}/g, "Your Company");

  return (
    <div>
      <PageHeader
        title="Templates"
        subtitle="Ready-made messages the AI can personalize automatically"
        action={canManage && <Button onClick={() => setModal(true)}><Plus size={15} /> New Template</Button>}
      />

      {loading ? (
        <div className="text-ink/40 text-sm">Loading…</div>
      ) : templates.length === 0 ? (
        <Card><EmptyState title="No templates yet" /></Card>
      ) : (
        <div className="grid grid-cols-3 gap-4">
          {templates.map((t) => (
            <Card key={t.id} className="p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-ink/50">{t.category}</span>
                {t.channel === "WhatsApp" ? <MessageCircle size={14} className="text-primary" /> : <Mail size={14} className="text-primary" />}
              </div>
              <h4 className="font-display font-semibold mb-2">{t.name}</h4>
              <p className="text-sm text-ink/60 line-clamp-3 mb-3">{t.body}</p>
              <button
                onClick={() => setPreview(t)}
                className="text-xs font-medium text-primary flex items-center gap-1"
              >
                <Sparkles size={12} /> Preview AI personalization
              </button>
            </Card>
          ))}
        </div>
      )}

      <Modal open={modal} onClose={() => setModal(false)} title="New Template" wide>
        <Field label="Template Name"><input className={inputCls} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
        <div className="grid grid-cols-2 gap-x-4">
          <Field label="Category">
            <select className={inputCls} value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
              {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
            </select>
          </Field>
          <Field label="Channel">
            <select className={inputCls} value={form.channel} onChange={(e) => setForm({ ...form, channel: e.target.value })}>
              <option>WhatsApp</option>
              <option>Email</option>
            </select>
          </Field>
        </div>
        <Field label="Message Body (use {{name}}, {{product}}, {{amount}}, {{date}}, {{company}})">
          <textarea className={inputCls} rows={4} value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} />
        </Field>
        <div className="flex justify-end gap-2 mt-2">
          <Button variant="secondary" onClick={() => setModal(false)}>Cancel</Button>
          <Button onClick={save}>Save Template</Button>
        </div>
      </Modal>

      <Modal open={!!preview} onClose={() => setPreview(null)} title="AI-Personalized Preview">
        {preview && (
          <div>
            <p className="text-xs text-ink/40 mb-1">Original</p>
            <div className="bg-base rounded-lg px-3 py-2 text-sm mb-4">{preview.body}</div>
            <p className="text-xs text-ink/40 mb-1 flex items-center gap-1"><Sparkles size={11} className="text-accent" /> Personalized for Rohit Saxena</p>
            <div className="bg-accent/10 border border-accent/25 rounded-lg px-3 py-2 text-sm">{personalize(preview.body)}</div>
          </div>
        )}
      </Modal>
    </div>
  );
}
