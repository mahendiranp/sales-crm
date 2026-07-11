import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { Target, ArrowLeft } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { Field, inputCls, Button } from "../components/ui";
import FeaturePicker from "../components/FeaturePicker";
import CoreModulePicker from "../components/CoreModulePicker";
import { RECOMMENDED_APP_KEYS } from "../lib/appCatalog";
import { CORE_MODULES, RECOMMENDED_MODULE_KEYS } from "../lib/coreModules";

const recommendedAppsMap = () => Object.fromEntries(RECOMMENDED_APP_KEYS.map((k) => [k, true]));
const recommendedModulesMap = () => Object.fromEntries(RECOMMENDED_MODULE_KEYS.map((k) => [k, true]));

export default function Signup() {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({ name: "", email: "", company: "", password: "" });
  const [selectedModules, setSelectedModules] = useState(recommendedModulesMap);
  const [selectedApps, setSelectedApps] = useState(recommendedAppsMap);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { signup } = useAuth();
  const router = useRouter();

  const toggleModule = (key) => setSelectedModules((s) => ({ ...s, [key]: !s[key] }));
  const toggleApp = (key) => setSelectedApps((s) => ({ ...s, [key]: !s[key] }));
  const useRecommended = () => {
    setSelectedModules(recommendedModulesMap());
    setSelectedApps(recommendedAppsMap());
  };

  const continueToStep2 = (e) => {
    e.preventDefault();
    setStep(2);
  };

  const finish = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      // The starter-kit selection is set server-side as part of account
      // creation (see POST /auth/signup) — a separate PUT /settings call
      // would require master-admin permission, which a brand-new account
      // doesn't have. Only what's checked here stays visible afterward —
      // everything else can still be turned on later from the Admin Portal.
      const modules = Object.fromEntries(CORE_MODULES.map((m) => [m.key, !!selectedModules[m.key]]));
      const appsToEnable = Object.fromEntries(Object.entries(selectedApps).filter(([, v]) => v));
      await signup({ ...form, modules, apps: appsToEnable });
      router.push("/app");
    } catch (err) {
      setError(err.response?.data?.error || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-base flex items-center justify-center p-6">
      <div className={`w-full transition-all ${step === 1 ? "max-w-md" : "max-w-2xl"}`}>
        <Link href="/" className="flex items-center justify-center gap-2 mb-8">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
            <Target size={17} className="text-white" />
          </div>
          <span className="font-display font-bold text-lg">Pipeline</span>
        </Link>

        <div className="bg-white border border-border rounded-card shadow-card p-6">
          {step === 1 ? (
            <>
              <h1 className="font-display font-bold text-xl mb-1">Create your account</h1>
              <p className="text-sm text-ink/50 mb-5">Free forever on the Starter plan. No card required.</p>

              <form onSubmit={continueToStep2}>
                <Field label="Full Name">
                  <input className={inputCls} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
                </Field>
                <Field label="Work Email">
                  <input className={inputCls} type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
                </Field>
                <Field label="Company">
                  <input className={inputCls} value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} />
                </Field>
                <Field label="Password">
                  <input className={inputCls} type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required minLength={8} />
                </Field>
                <Button type="submit" className="w-full justify-center">
                  Continue
                </Button>
              </form>
            </>
          ) : (
            <>
              <button
                onClick={() => setStep(1)}
                className="flex items-center gap-1 text-xs text-ink/40 hover:text-ink mb-3"
              >
                <ArrowLeft size={13} /> Back
              </button>
              <h1 className="font-display font-bold text-xl mb-1">Build your starter toolkit</h1>
              <p className="text-sm text-ink/50 mb-4">
                Pick exactly what you want to see from day one — only what's checked below will show up in your
                sidebar. You (the account owner) can turn anything else on anytime from the Admin Portal.
              </p>

              <form onSubmit={finish} className="space-y-5">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-ink/35 mb-2">Core CRM</p>
                  <CoreModulePicker selected={selectedModules} onToggle={toggleModule} />
                </div>

                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-ink/35 mb-2">Add-on Apps</p>
                  <FeaturePicker selected={selectedApps} onToggle={toggleApp} onUseRecommended={useRecommended} />
                </div>

                {error && <p className="text-sm text-danger">{error}</p>}
                <Button type="submit" className="w-full justify-center" disabled={loading}>
                  {loading ? "Creating account…" : "Create account"}
                </Button>
                <p className="text-xs text-ink/40 text-center">
                  By creating an account, you agree to our{" "}
                  <Link href="/terms" className="text-primary hover:underline">Terms of Service</Link> and{" "}
                  <Link href="/privacy" className="text-primary hover:underline">Privacy Policy</Link>.
                </p>
              </form>
            </>
          )}
        </div>

        <p className="text-center text-sm text-ink/50 mt-5">
          Already have an account? <Link href="/login" className="text-primary font-medium">Log in</Link>
        </p>
      </div>
    </div>
  );
}
