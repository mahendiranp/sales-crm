import { useEffect, useState } from "react";
import { Building2, CreditCard, ShieldCheck, MessageCircle, Mail, Wallet, Sparkles, Bell, Plug, LayoutGrid, AlertTriangle } from "lucide-react";
import api from "../api/client";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../components/ui/Toast";
import { Card, PageHeader, Button, Field, inputCls } from "../components/ui";
import { limitsFor } from "../lib/plans";
import CoreModulePicker from "../components/CoreModulePicker";
import FeaturePicker from "../components/FeaturePicker";
import useLiveCollection from "../lib/useLiveCollection";
import { APP_NAME } from "../lib/brand";
import { loadRazorpayScript } from "../lib/razorpay";

// Growth is currently the only self-serve-purchasable plan — Starter is
// free by default and Enterprise is sales-assisted ("Talk to sales" on the
// landing page), matching utils/plans.js on the backend (only Growth has
// a priceInMinorUnits).
const GROWTH_PRICE_LABEL = "$19/month";

// WhatsApp API / Email Settings / Payment Gateway / Notifications /
// Integrations aren't wired to anything real yet — the actual WhatsApp/
// email integrations all read from backend env vars set at deploy time,
// not these fields, so filling them in here would silently do nothing.
// Hidden (not deleted) until each is actually connected — add the key
// back to this list to bring one back. AI Configuration IS wired up (see
// routes/settings.js's getAiProviderForAccount) — it only picks which
// platform-configured provider (Anthropic/Gemini) this account's AI
// Assistant calls, not a per-account API key.
const VISIBLE_SECTION_KEYS = ["companyProfile", "subscription", "sidebarSetup", "aiConfiguration"];

function baseSections(isOwner) {
  return [
    { key: "companyProfile", label: "Company Profile", icon: Building2 },
    { key: "subscription", label: "Subscription", icon: CreditCard },
    ...(isOwner ? [{ key: "sidebarSetup", label: "Sidebar Setup", icon: LayoutGrid }] : []),
    { key: "whatsappApi", label: "WhatsApp API", icon: MessageCircle },
    { key: "emailSettings", label: "Email Settings", icon: Mail },
    { key: "paymentGateway", label: "Payment Gateway", icon: Wallet },
    { key: "aiConfiguration", label: "AI Configuration", icon: Sparkles },
    { key: "notifications", label: "Notifications", icon: Bell },
    { key: "integrations", label: "Integrations", icon: Plug },
  ].filter((s) => VISIBLE_SECTION_KEYS.includes(s.key));
}

export default function Settings() {
  const { user, canManage, isOwner } = useAuth();
  const toast = useToast();
  const [settings, setSettings] = useState(null);
  const [active, setActive] = useState("companyProfile");
  const [saved, setSaved] = useState(false);
  const [planSaved, setPlanSaved] = useState(false);
  const [upgrading, setUpgrading] = useState(false);
  const [upgradeError, setUpgradeError] = useState("");

  const load = () => api.get("/settings").then((r) => setSettings(r.data));
  useEffect(() => {
    load();
  }, []);
  useLiveCollection(["settings"], load);

  const SECTIONS = baseSections(isOwner);

  const save = async () => {
    // Plain field edits shouldn't touch apps/modules — those are only sent
    // from the Sidebar Setup tab's own save, so a non-owner teammate saving
    // Notifications/Company Profile never trips the owner-only flag check.
    // `subscription` is excluded too — plan changes only ever happen via
    // the Upgrade to Growth flow below, never this generic save button, so
    // sending the unchanged value back here should never look like an
    // attempted plan change (backend/routes/settings.js also guards this).
    const { apps, modules, subscription, ...editable } = settings;
    try {
      await api.put("/settings", editable);
      setSaved(true);
      setTimeout(() => setSaved(false), 1800);
    } catch (err) {
      toast.error(err.response?.data?.error || "Couldn't save your settings.");
    }
  };

  const update = (section, patch) => setSettings((s) => ({ ...s, [section]: { ...s[section], ...patch } }));

  const toggleModule = (key, next) => setSettings((s) => ({ ...s, modules: { ...s.modules, [key]: next ?? !s.modules[key] } }));
  const toggleApp = (key) => setSettings((s) => ({ ...s, apps: { ...s.apps, [key]: !s.apps[key] } }));
  const savePlan = async () => {
    try {
      await api.put("/settings", { modules: settings.modules, apps: settings.apps });
      setPlanSaved(true);
      setTimeout(() => setPlanSaved(false), 1800);
    } catch (err) {
      toast.error(err.response?.data?.error || "Couldn't save your sidebar setup.");
    }
  };

  const upgradeToGrowth = async () => {
    setUpgradeError("");
    setUpgrading(true);
    try {
      const scriptLoaded = await loadRazorpayScript();
      if (!scriptLoaded) throw new Error("Couldn't load the payment widget — check your connection and try again.");

      const { data: order } = await api.post("/payments/create-order", { plan: "growth" });

      const checkout = new window.Razorpay({
        key: order.keyId,
        amount: order.amount,
        currency: order.currency,
        order_id: order.orderId,
        name: APP_NAME,
        description: `Upgrade to ${order.planLabel}`,
        image: `${window.location.origin}/favicon.svg`,
        prefill: { name: user?.name, email: user?.email },
        notes: { plan: "growth" },
        theme: { color: "#2F5D50" },
        handler: async (response) => {
          try {
            await api.post("/payments/verify", {
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
              plan: "growth",
            });
            load();
          } catch (err) {
            setUpgradeError(err.response?.data?.error || "Payment succeeded but upgrading your plan failed — contact support.");
          } finally {
            setUpgrading(false);
          }
        },
        modal: {
          // Razorpay's own dismiss (user closed the widget without paying)
          // doesn't call `handler` at all, so this is the only place
          // upgrading needs resetting for that path.
          ondismiss: () => setUpgrading(false),
        },
      });
      checkout.open();
    } catch (err) {
      setUpgradeError(err.response?.data?.error || err.message || "Couldn't start checkout — please try again.");
      setUpgrading(false);
    }
  };

  if (!settings) return <div className="text-ink/40 text-sm">Loading…</div>;

  return (
    <div>
      <PageHeader
        title="Settings"
        subtitle="Configure your CRM to match how your business runs."
        action={
          canManage &&
          (active === "sidebarSetup" ? (
            <Button onClick={savePlan}>{planSaved ? "Saved ✓" : "Save Sidebar"}</Button>
          ) : (
            <Button onClick={save}>{saved ? "Saved ✓" : "Save Changes"}</Button>
          ))
        }
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

              {settings.subscription.downgradedFrom && (
                <div className="flex items-start gap-2 bg-danger/8 border border-danger/20 rounded-lg p-4 mb-4 text-sm text-danger">
                  <AlertTriangle size={16} className="shrink-0 mt-0.5" />
                  <p>
                    Your {limitsFor(settings.subscription.downgradedFrom).label} plan expired on{" "}
                    {new Date(settings.subscription.downgradedAt).toLocaleDateString()} and wasn't renewed, so your
                    account moved back to Starter. Upgrade below to get those features back.
                  </p>
                </div>
              )}

              <div className="flex items-center justify-between bg-base rounded-lg p-4 mb-4">
                <div>
                  <p className="font-medium capitalize">{settings.subscription.plan}</p>
                  <p className="text-xs text-ink/40">
                    {settings.subscription.renewsOn
                      ? `Renews ${new Date(settings.subscription.renewsOn).toLocaleDateString()}`
                      : "Manage your billing and plan"}
                  </p>
                </div>
                <ShieldCheck size={20} className="text-primary" />
              </div>

              {settings.aiCredits && (
                <div className="flex items-center justify-between bg-base rounded-lg p-4 mb-4">
                  <div className="flex items-center gap-2">
                    <Sparkles size={16} className="text-primary" />
                    <div>
                      <p className="font-medium">{settings.aiCredits.remaining} AI credits left</p>
                      <p className="text-xs text-ink/40">{settings.aiCredits.used} used so far — paid plans top this up every billing cycle</p>
                    </div>
                  </div>
                </div>
              )}

              {settings.subscription.plan === "starter" && (
                <div className="border border-primary/20 bg-primary/5 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">Upgrade to Growth</p>
                      <p className="text-xs text-ink/50 mt-0.5">
                        Unlimited forms, approval workflows, WhatsApp survey bot, AI Assistant, and up to 20 users.
                      </p>
                    </div>
                    <p className="font-display font-semibold text-lg whitespace-nowrap ml-4">{GROWTH_PRICE_LABEL}</p>
                  </div>
                  {isOwner ? (
                    <Button onClick={upgradeToGrowth} disabled={upgrading} className="w-full justify-center mt-3">
                      {upgrading ? "Opening checkout…" : `Upgrade for ${GROWTH_PRICE_LABEL}`}
                    </Button>
                  ) : (
                    <p className="text-xs text-ink/40 mt-3">Ask your account owner to upgrade the plan.</p>
                  )}
                  {upgradeError && <p className="text-xs text-danger mt-2">{upgradeError}</p>}
                </div>
              )}

              {settings.subscription.plan === "growth" && (
                <p className="text-xs text-ink/40">
                  Need Enterprise (unlimited users, priority support, custom integrations)?{" "}
                  <a href="mailto:info@floworaone.com" className="text-primary hover:underline">Talk to sales</a>.
                </p>
              )}
            </div>
          )}

          {active === "sidebarSetup" && (
            <div>
              <h3 className="font-display font-semibold mb-1">Sidebar Setup</h3>
              <p className="text-sm text-ink/50 mb-4">
                Pick what's live for your whole team. Only what's checked here shows up in the sidebar — for you and
                everyone you've added under Team Access.
              </p>

              <p className="text-xs font-semibold uppercase tracking-wider text-ink/35 mb-2">Core CRM</p>
              <CoreModulePicker selected={settings.modules} onToggle={toggleModule} />

              <p className="text-xs font-semibold uppercase tracking-wider text-ink/35 mb-2 mt-5">Add-on Apps</p>
              <FeaturePicker selected={settings.apps} onToggle={toggleApp} />
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
              <h3 className="font-display font-semibold mb-1">AI Configuration</h3>
              <p className="text-sm text-ink/50 mb-4">
                Choose which AI provider powers the Form Builder's AI Assistant (Growth plan and up). API access is
                configured platform-wide by your admin — this only picks which one your account uses.
              </p>
              <p className="text-xs font-medium text-ink/60 mb-1.5">Provider</p>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { key: "anthropic", label: "Anthropic (Claude)" },
                  { key: "gemini", label: "Google Gemini" },
                ].map((p) => (
                  <button
                    key={p.key}
                    type="button"
                    onClick={() => update("aiConfiguration", { provider: p.key })}
                    className={`text-left px-3 py-2.5 rounded-lg border-2 text-sm font-medium transition-colors ${
                      (settings.aiConfiguration.provider || "gemini") === p.key
                        ? "border-primary bg-primary/5 text-primary"
                        : "border-border text-ink/60 hover:border-primary/30"
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
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
