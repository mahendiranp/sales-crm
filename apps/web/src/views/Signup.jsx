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
import { APP_NAME } from "../lib/brand";
import Seo from "../components/Seo";

const recommendedAppsMap = () => Object.fromEntries(RECOMMENDED_APP_KEYS.map((k) => [k, true]));
const recommendedModulesMap = () => Object.fromEntries(RECOMMENDED_MODULE_KEYS.map((k) => [k, true]));

export default function Signup() {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({ name: "", email: "", company: "", password: "" });
  const [selectedModules, setSelectedModules] = useState(recommendedModulesMap);
  const [selectedApps, setSelectedApps] = useState(recommendedAppsMap);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [otp, setOtp] = useState("");
  const [otpError, setOtpError] = useState("");
  const [devOtp, setDevOtp] = useState("");
  const { requestSignupOtp, verifySignupOtp } = useAuth();
  const router = useRouter();

  const toggleModule = (key) => setSelectedModules((s) => ({ ...s, [key]: !s[key] }));
  const toggleApp = (key) => setSelectedApps((s) => ({ ...s, [key]: !s[key] }));

  const continueToStep2 = (e) => {
    e.preventDefault();
    setStep(2);
  };

  const requestCode = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      // The starter-kit selection rides along with the OTP request and is
      // set server-side once the code is verified (see POST
      // /auth/signup/verify-otp) — a separate PUT /settings call would
      // require master-admin permission, which a brand-new account doesn't
      // have. Only what's checked here stays visible afterward — everything
      // else can still be turned on later from the Admin Portal.
      const modules = Object.fromEntries(CORE_MODULES.map((m) => [m.key, !!selectedModules[m.key]]));
      const appsToEnable = Object.fromEntries(Object.entries(selectedApps).filter(([, v]) => v));
      const result = await requestSignupOtp({ ...form, modules, apps: appsToEnable });
      setDevOtp(result.devOtp || "");
      setOtp("");
      setOtpError("");
      setStep(3);
    } catch (err) {
      setError(err.response?.data?.error || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  const verifyCode = async (e) => {
    e.preventDefault();
    setOtpError("");
    setLoading(true);
    try {
      await verifySignupOtp(form.email, otp);
      router.push("/app");
    } catch (err) {
      setOtpError(err.response?.data?.error || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  const resendCode = async () => {
    setOtpError("");
    setLoading(true);
    try {
      const modules = Object.fromEntries(CORE_MODULES.map((m) => [m.key, !!selectedModules[m.key]]));
      const appsToEnable = Object.fromEntries(Object.entries(selectedApps).filter(([, v]) => v));
      const result = await requestSignupOtp({ ...form, modules, apps: appsToEnable });
      setDevOtp(result.devOtp || "");
    } catch (err) {
      setOtpError(err.response?.data?.error || "Couldn't resend the code.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-base flex items-center justify-center p-6">
      <Seo
        title="Sign up"
        description={`Create your free ${APP_NAME} account — drag-and-drop form builder with approval workflows and WhatsApp delivery. No card required.`}
        path="/signup"
      />
      <div className={`w-full transition-all ${step === 2 ? "max-w-2xl" : "max-w-md"}`}>
        <Link href="/" className="flex items-center justify-center gap-2 mb-8">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
            <Target size={17} className="text-white" />
          </div>
          <span className="font-display font-bold text-lg">{APP_NAME}</span>
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
          ) : step === 2 ? (
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

              <form onSubmit={requestCode} className="space-y-5">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-ink/35 mb-2">Core CRM</p>
                  <CoreModulePicker selected={selectedModules} onToggle={toggleModule} />
                </div>

                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-ink/35 mb-2">Add-on Apps</p>
                  <FeaturePicker selected={selectedApps} onToggle={toggleApp} />
                </div>

                {error && <p className="text-sm text-danger">{error}</p>}
                <Button type="submit" className="w-full justify-center" disabled={loading}>
                  {loading ? "Sending code…" : "Send verification code"}
                </Button>
                <p className="text-xs text-ink/40 text-center">
                  By creating an account, you agree to our{" "}
                  <Link href="/terms" className="text-primary hover:underline">Terms of Service</Link> and{" "}
                  <Link href="/privacy" className="text-primary hover:underline">Privacy Policy</Link>.
                </p>
              </form>
            </>
          ) : (
            <>
              <button
                onClick={() => setStep(2)}
                className="flex items-center gap-1 text-xs text-ink/40 hover:text-ink mb-3"
              >
                <ArrowLeft size={13} /> Back
              </button>
              <h1 className="font-display font-bold text-xl mb-1">Verify your email</h1>
              <p className="text-sm text-ink/50 mb-5">
                We sent a 6-digit code to <strong>{form.email}</strong>. Enter it below to finish creating your account.
              </p>

              {devOtp && (
                <p className="text-xs text-primary bg-primary/5 border border-primary/20 rounded-lg px-3 py-2 mb-4">
                  Dev mode (no SMTP configured): your code is <strong>{devOtp}</strong>.
                </p>
              )}

              <form onSubmit={verifyCode}>
                <Field label="Verification Code">
                  <input
                    className={`${inputCls} text-center text-lg tracking-[0.3em]`}
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    inputMode="numeric"
                    maxLength={6}
                    autoFocus
                    required
                  />
                </Field>
                {otpError && <p className="text-sm text-danger mb-3">{otpError}</p>}
                <Button type="submit" className="w-full justify-center" disabled={loading || otp.length !== 6}>
                  {loading ? "Verifying…" : "Verify & create account"}
                </Button>
                <button
                  type="button"
                  onClick={resendCode}
                  disabled={loading}
                  className="w-full text-xs text-primary font-medium text-center mt-3 hover:underline disabled:opacity-50"
                >
                  Resend code
                </button>
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
