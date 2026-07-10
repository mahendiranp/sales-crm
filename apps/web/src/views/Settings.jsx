import { useEffect, useState } from "react";
import { Building2, CreditCard, ShieldCheck, MessageCircle, Mail, Wallet, Sparkles, Bell, Plug } from "lucide-react";
import api from "../api/client";
import { useAuth } from "../context/AuthContext";
import { Card, PageHeader, Button, Field, inputCls } from "../components/ui";
import useLiveCollection from "../lib/useLiveCollection";

const SECTIONS = [
  { key: "companyProfile", label: "Company Profile", icon: Building2 },
  { key: "subscription", label: "Subscription", icon: CreditCard },
  { key: "whatsappApi", label: "WhatsApp API", icon: MessageCircle },
  { key: "emailSettings", label: "Email Settings", icon: Mail },
  { key: "paymentGateway", label: "Payment Gateway", icon: Wallet },
  { key: "aiConfiguration", label: "AI Configuration", icon: Sparkles },
  { key: "notifications", label: "Notifications", icon: Bell },
  { key: "integrations", label: "Integrations", icon: Plug },
];

export default function Settings() {
  const { canManage } = useAuth();
  const [settings, setSettings] = useState(null);
  const [active, setActive] = useState("companyProfile");
  const [saved, setSaved] = useState(false);

  const load = () => api.get("/settings").then((r) => setSettings(r.data));
  useEffect(() => {
    load();
  }, []);
  useLiveCollection(["settings"], load);

  const save = async () => {
    await api.put("/settings", settings);
    setSaved(true);
    setTimeout(() => setSaved(false), 1800);
  };

  const update = (section, patch) => setSettings((s) => ({ ...s, [section]: { ...s[section], ...patch } }));

  if (!settings) return <div className="text-ink/40 text-sm">Loading…</div>;

  return (
    <div>
      <PageHeader
        title="Settings"
        subtitle="Configure your CRM to match how your business runs."
        action={canManage && <Button onClick={save}>{saved ? "Saved ✓" : "Save Changes"}</Button>}
      />

      <div className="grid grid-cols-4 gap-4">
        <Card className="p-2 h-fit">
          {SECTIONS.map((s) => (
            <button
              key={s.key}
              onClick={() => setActive(s.key)}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm mb-0.5 text-left ${
                active === s.key ? "bg-primary/8 text-primary font-medium" : "text-ink/60 hover:bg-base"
              }`}
            >
              <s.icon size={15} />
              {s.label}
            </button>
          ))}
        </Card>

        <Card className="col-span-3 p-6">
          {active === "companyProfile" && (
            <div>
              <h3 className="font-display font-semibold mb-4">Company Profile</h3>
              <Field label="Company Name">
                <input className={inputCls} value={settings.companyProfile.name} onChange={(e) => update("companyProfile", { name: e.target.value })} />
              </Field>
              <Field label="Industry">
                <input className={inputCls} value={settings.companyProfile.industry} onChange={(e) => update("companyProfile", { industry: e.target.value })} />
              </Field>
              <Field label="Address">
                <input className={inputCls} value={settings.companyProfile.address} onChange={(e) => update("companyProfile", { address: e.target.value })} />
              </Field>
            </div>
          )}

          {active === "subscription" && (
            <div>
              <h3 className="font-display font-semibold mb-4">Subscription</h3>
              <div className="flex items-center justify-between bg-base rounded-lg p-4">
                <div>
                  <p className="font-medium">{settings.subscription.plan}</p>
                  <p className="text-xs text-ink/40">Manage your billing and plan</p>
                </div>
                <ShieldCheck size={20} className="text-primary" />
              </div>
            </div>
          )}

          {active === "whatsappApi" && (
            <div>
              <h3 className="font-display font-semibold mb-4">WhatsApp Business API</h3>
              <Field label="Provider">
                <input className={inputCls} placeholder="e.g. Meta Cloud API, Twilio" value={settings.whatsappApi.provider} onChange={(e) => update("whatsappApi", { provider: e.target.value })} />
              </Field>
              <Field label="API Key">
                <input className={inputCls} type="password" value={settings.whatsappApi.apiKey} onChange={(e) => update("whatsappApi", { apiKey: e.target.value })} />
              </Field>
            </div>
          )}

          {active === "emailSettings" && (
            <div>
              <h3 className="font-display font-semibold mb-4">Email Settings</h3>
              <Field label="Provider">
                <input className={inputCls} value={settings.emailSettings.provider} onChange={(e) => update("emailSettings", { provider: e.target.value })} />
              </Field>
              <Field label="From Address">
                <input className={inputCls} value={settings.emailSettings.fromAddress} onChange={(e) => update("emailSettings", { fromAddress: e.target.value })} />
              </Field>
            </div>
          )}

          {active === "paymentGateway" && (
            <div>
              <h3 className="font-display font-semibold mb-4">Payment Gateway</h3>
              <Field label="Provider">
                <input className={inputCls} value={settings.paymentGateway.provider} onChange={(e) => update("paymentGateway", { provider: e.target.value })} />
              </Field>
            </div>
          )}

          {active === "aiConfiguration" && (
            <div>
              <h3 className="font-display font-semibold mb-4">AI Configuration</h3>
              <p className="text-sm text-ink/50 mb-4">Plug in an LLM provider to power AI suggestions, WhatsApp auto-replies, and template personalization.</p>
              <Field label="Provider">
                <input className={inputCls} value={settings.aiConfiguration.provider} onChange={(e) => update("aiConfiguration", { provider: e.target.value })} />
              </Field>
              <Field label="API Key">
                <input className={inputCls} type="password" value={settings.aiConfiguration.apiKey} onChange={(e) => update("aiConfiguration", { apiKey: e.target.value })} />
              </Field>
              <label className="flex items-center gap-2 text-sm mt-2">
                <input type="checkbox" checked={settings.aiConfiguration.enabled} onChange={(e) => update("aiConfiguration", { enabled: e.target.checked })} />
                Enable AI features
              </label>
            </div>
          )}

          {active === "notifications" && (
            <div>
              <h3 className="font-display font-semibold mb-4">Notifications</h3>
              {["email", "sms", "push"].map((ch) => (
                <label key={ch} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                  <span className="text-sm capitalize">{ch} notifications</span>
                  <input
                    type="checkbox"
                    checked={settings.notifications[ch]}
                    onChange={(e) => update("notifications", { [ch]: e.target.checked })}
                  />
                </label>
              ))}
            </div>
          )}

          {active === "integrations" && (
            <div>
              <h3 className="font-display font-semibold mb-4">Integrations</h3>
              <p className="text-sm text-ink/40">No third-party integrations connected yet.</p>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
