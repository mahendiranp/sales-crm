import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { Target, ArrowLeft, ShieldCheck, LockKeyhole, CheckCircle2, Sparkles, Zap, BarChart3, Palette, Download } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import api from "../api/client";
import { Field, inputCls, Button, PasswordInput } from "../components/ui";
import FeaturePicker from "../components/FeaturePicker";
import CoreModulePicker from "../components/CoreModulePicker";
import { RECOMMENDED_APP_KEYS } from "../lib/appCatalog";
import { CORE_MODULES, RECOMMENDED_MODULE_KEYS } from "../lib/coreModules";
import { APP_NAME } from "../lib/brand";
import { loadRazorpayScript } from "../lib/razorpay";
import Seo from "../components/Seo";
import GoogleSignInButton from "../components/GoogleSignInButton";

const recommendedAppsMap = () => Object.fromEntries(RECOMMENDED_APP_KEYS.map((k) => [k, true]));
const recommendedModulesMap = () => Object.fromEntries(RECOMMENDED_MODULE_KEYS.map((k) => [k, true]));

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Mirrors the login page's right-side feature panel — same list, same
// styling — so the two auth screens read as one cohesive system.
const WHY_FLOWORA = [
  { icon: Sparkles, label: "AI Form Builder", desc: "Create forms in seconds using plain English.", badge: "New" },
  { icon: Zap, label: "Approval Workflows", desc: "Automatically route requests for approval." },
  { icon: BarChart3, label: "Analytics Dashboard", desc: "Monitor submissions in real time." },
  { icon: Palette, label: "Brand Customization", desc: "Match forms to your company." },
  { icon: Download, label: "CSV & Excel Export", desc: "Export your data whenever you need it." },
];

// Bumps input height/border/focus-ring for step 1 only — `inputCls` is
// shared by every form across the app (including steps 2-3 below), so
// overriding it globally would've changed every input everywhere.
// `bg-white text-ink` are pinned explicitly here — without them, a
// browser in OS dark mode renders native <input> chrome with a dark
// background and white text (the shared `inputCls` never sets either),
// which on this page's white card made typed text unreadable.
const loginInputCls = `${inputCls} h-[52px] text-[16px] bg-white text-[#14172b99] border-[#D9E3E6] focus:ring-2 focus:ring-primary/15`;

function WhyFloworaPanel() {
  return (
    <div
      className="hidden lg:flex flex-col gap-5 w-full max-w-[430px] bg-white rounded-card p-8 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg"
      style={{ border: "1px solid #E7ECEF", boxShadow: "0 15px 45px rgba(0,0,0,.06)" }}
    >
      <h2 className="flex items-center gap-2 font-display font-bold text-ink leading-snug text-[28px]">
        <Sparkles size={22} className="text-primary shrink-0" />
        Why teams choose {APP_NAME}
      </h2>
      <ul className="space-y-5">
        {WHY_FLOWORA.map(({ icon: Icon, label, desc, badge }) => (
          <li key={label} className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-lg bg-primary/8 flex items-center justify-center shrink-0">
              <Icon size={19} className="text-primary" />
            </div>
            <div>
              <div className="flex items-center gap-2 text-[18px] font-semibold text-ink">
                {label}
                {badge && (
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-accent-dark bg-accent/10 border border-accent/25 px-1.5 py-0.5 rounded-full">
                    {badge}
                  </span>
                )}
              </div>
              <p className="text-[16px] text-ink/50 mt-0.5">{desc}</p>
            </div>
          </li>
        ))}
      </ul>
      <p className="text-sm font-medium text-primary mt-1">✓ Start free. Upgrade when you're ready.</p>
    </div>
  );
}

export default function Signup() {
  const router = useRouter();
  // ?plan=growth on the URL (from the landing page's Growth "Start free
  // trial" button) means this signup should collect payment right after
  // email verification — anything else (including no query at all) signs
  // up free on Starter, matching the existing default behavior.
  const [selectedPlan, setSelectedPlan] = useState("starter");
  useEffect(() => {
    if (router.query.plan === "growth") setSelectedPlan("growth");
  }, [router.query.plan]);

  const [step, setStep] = useState(1);
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [selectedModules, setSelectedModules] = useState(recommendedModulesMap);
  const [selectedApps, setSelectedApps] = useState(recommendedAppsMap);
  // Step 1 renders each message under the specific field it's about; `form`
  // catches anything not tied to one input (Google's own OAuth failures).
  // `error` (below) stays a single string for step 2, which has no
  // name/email/password fields to attach a per-field message to.
  const [fieldErrors, setFieldErrors] = useState({ name: "", email: "", password: "", form: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [checkingEmail, setCheckingEmail] = useState(false);
  const [otp, setOtp] = useState("");
  const [otpError, setOtpError] = useState("");
  const [devOtp, setDevOtp] = useState("");
  const [paying, setPaying] = useState(false);
  const [payError, setPayError] = useState("");
  const { requestSignupOtp, verifySignupOtp } = useAuth();

  const toggleModule = (key, next) => setSelectedModules((s) => ({ ...s, [key]: next ?? !s[key] }));
  const toggleApp = (key) => setSelectedApps((s) => ({ ...s, [key]: !s[key] }));

  const continueToStep2 = async (e) => {
    e.preventDefault();
    const next = { name: "", email: "", password: "", form: "" };
    if (!form.name.trim()) next.name = "Full name is required.";
    if (!form.email.trim()) next.email = "Email is required.";
    else if (!EMAIL_RE.test(form.email.trim())) next.email = "Enter a valid email address.";
    if (!form.password.trim()) next.password = "Password is required.";
    else if (form.password.length < 8) next.password = "Password must be at least 8 characters.";
    if (next.name || next.email || next.password) {
      setFieldErrors(next);
      return;
    }
    setFieldErrors(next);
    setCheckingEmail(true);
    try {
      const { data } = await api.get("/auth/check-email", { params: { email: form.email } });
      if (!data.available) {
        setFieldErrors({ ...next, email: "An account with this email already exists. Try logging in instead." });
        return;
      }
      setStep(2);
    } catch {
      setFieldErrors({ ...next, email: "Couldn't verify that email right now — please try again." });
    } finally {
      setCheckingEmail(false);
    }
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
      // Account is created here (on Starter — see POST /auth/signup/verify-otp)
      // and the session token is now live. Only after that does a Growth
      // signup move to the payment step — the account already exists and
      // works either way, so a failed/abandoned payment never blocks access.
      await verifySignupOtp(form.email, otp);
      if (selectedPlan === "growth") {
        setStep(4);
      } else {
        router.push("/app");
      }
    } catch (err) {
      setOtpError(err.response?.data?.error || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  const payForGrowth = async () => {
    setPayError("");
    setPaying(true);
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
        prefill: { name: form.name, email: form.email },
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
            router.push("/app");
          } catch (err) {
            setPayError(err.response?.data?.error || "Payment succeeded but activating Growth failed — you can retry from Settings.");
          } finally {
            setPaying(false);
          }
        },
        modal: { ondismiss: () => setPaying(false) },
      });
      checkout.open();
    } catch (err) {
      setPayError(err.response?.data?.error || err.message || "Couldn't start checkout — please try again.");
      setPaying(false);
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

  const passwordValid = form.password.length >= 8;

  return (
    <div
      className="min-h-screen flex items-center justify-center p-6"
      style={{ background: "linear-gradient(180deg, #F8FBFA 0%, #FFFFFF 35%, #FFFFFF 100%)" }}
    >
      <Seo
        title="Sign up"
        description={`Create your free ${APP_NAME} account — drag-and-drop form builder with approval workflows and WhatsApp delivery. No card required.`}
        keywords={["sign up CRM", "free form builder", "create CRM account", "online form builder signup"]}
        path="/signup"
      />
      <div
        className={`w-full transition-all ${
          step === 1 ? "max-w-5xl grid lg:grid-cols-[560px_430px] justify-center gap-14 items-center" : step === 2 ? "max-w-2xl" : "max-w-md"
        }`}
      >
        <div className={`w-full ${step === 1 ? "max-w-[560px] mx-auto lg:mx-0 lg:ml-auto" : ""}`}>
        <Link href="/" className="flex items-center justify-center gap-2 mb-2">
          <div className="w-9 h-9 rounded-lg bg-primary flex items-center justify-center">
            <Target size={18} className="text-white" />
          </div>
          <span className="font-display font-bold text-[22px]">{APP_NAME}</span>
        </Link>
        {step === 1 && <p className="text-center text-xs text-ink/40 mb-4">AI-powered forms for modern teams</p>}

        <div
          className={`bg-white rounded-card p-6 ${step === 1 ? "lg:p-10 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg" : "shadow-card border border-border"}`}
          style={step === 1 ? { border: "1px solid #E7ECEF", boxShadow: "0 15px 45px rgba(0,0,0,.06)" } : undefined}
        >
          {step === 1 ? (
            <>
              <div className="flex items-center justify-between gap-3 mb-1 flex-wrap">
                <h1 className="font-display font-bold text-ink text-[32px] leading-tight">Create your Flowora account</h1>
                <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-full shrink-0">
                  FREE FOREVER
                </span>
              </div>
              <p className="text-[16px] mb-6" style={{ color: "#6B7280" }}>
                {selectedPlan === "growth"
                  ? "Signing up for Growth ($19/month) — you'll pay after verifying your email."
                  : "Start building AI-powered forms for free. No credit card required."}
              </p>

              <form onSubmit={continueToStep2} noValidate>
                <Field label="Full Name">
                  <input
                    className={loginInputCls}
                    value={form.name}
                    onChange={(e) => { setForm({ ...form, name: e.target.value }); setFieldErrors((er) => ({ ...er, name: "" })); }}
                    style={fieldErrors.name ? { borderColor: "#DC2626" } : undefined}
                  />
                </Field>
                {fieldErrors.name && <p className="text-sm text-danger mt-1">{fieldErrors.name}</p>}
                <div className="mt-2.5">
                  <Field label="Email">
                    <input
                      className={loginInputCls}
                      type="email"
                      value={form.email}
                      onChange={(e) => { setForm({ ...form, email: e.target.value }); setFieldErrors((er) => ({ ...er, email: "" })); }}
                      style={fieldErrors.email ? { borderColor: "#DC2626" } : undefined}
                    />
                  </Field>
                  {fieldErrors.email && <p className="text-sm text-danger mt-1">{fieldErrors.email}</p>}
                </div>
                <div className="mt-2.5">
                  <Field label="Password">
                    <PasswordInput
                      className={loginInputCls}
                      value={form.password}
                      onChange={(e) => { setForm({ ...form, password: e.target.value }); setFieldErrors((er) => ({ ...er, password: "" })); }}
                      style={fieldErrors.password ? { borderColor: "#DC2626" } : undefined}
                    />
                  </Field>
                  {fieldErrors.password && <p className="text-sm text-danger mt-1">{fieldErrors.password}</p>}
                  <p className={`text-xs mt-1 ${passwordValid ? "text-emerald-600" : "text-ink/40"}`}>
                    {passwordValid ? "✓ Strong password" : "• Use at least 8 characters."}
                  </p>
                </div>
                <div className="mt-5">
                  <Button
                    type="submit"
                    className="w-full justify-center h-[53px] text-[16px] font-semibold rounded-[10px] transition-all duration-200 hover:-translate-y-px hover:shadow-md"
                    disabled={checkingEmail}
                  >
                    {checkingEmail ? "Checking…" : "Create account →"}
                  </Button>
                </div>
              </form>

              {selectedPlan !== "growth" && (
                <>
                  <div className="flex items-center gap-3 mt-8 mb-3">
                    <div className="h-px bg-border flex-1" />
                    <span className="text-[10px] font-semibold tracking-wider text-ink/40 uppercase">Or continue with</span>
                    <div className="h-px bg-border flex-1" />
                  </div>
                  <div className="transition-colors rounded-lg [&_button]:hover:bg-[#FAFAFA]">
                    <GoogleSignInButton
                      text="signup_with"
                      onSuccess={() => router.push("/app")}
                      onError={(msg) => setFieldErrors((er) => ({ ...er, form: msg }))}
                    />
                  </div>
                  {fieldErrors.form && <p className="text-center text-sm text-danger mt-2">{fieldErrors.form}</p>}
                  <p className="text-center text-xs text-ink/40 mt-2">Securely sign up with your Google account.</p>
                </>
              )}

              <div className="mt-7 text-center">
                <div className="flex items-center justify-center flex-wrap gap-x-2 gap-y-1 text-ink/35" style={{ fontSize: "13px" }}>
                  <span className="flex items-center gap-1"><LockKeyhole size={12} className="text-primary" /> Secure signup</span>
                  <span>•</span>
                  <span className="flex items-center gap-1"><ShieldCheck size={12} className="text-primary" /> Google OAuth</span>
                  <span>•</span>
                  <span className="flex items-center gap-1"><CheckCircle2 size={12} className="text-primary" /> No credit card</span>
                </div>
              </div>

              <p className="text-xs text-ink/40 text-center mt-5">
                By creating an account, you agree to our{" "}
                <Link href="/terms" className="text-primary hover:underline">Terms of Service</Link> and{" "}
                <Link href="/privacy" className="text-primary hover:underline">Privacy Policy</Link>.
              </p>
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
          ) : step === 3 ? (
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

              <form onSubmit={verifyCode} noValidate>
                <Field label="Verification Code">
                  <input
                    className={`${inputCls} bg-white text-[#14172b99] text-center text-lg tracking-[0.3em]`}
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    inputMode="numeric"
                    maxLength={6}
                    autoFocus
                  />
                </Field>
                {otpError && <p className="text-sm text-danger mb-3">{otpError}</p>}
                <Button type="submit" className="w-full justify-center" disabled={loading || otp.length !== 6}>
                  {loading ? "Verifying…" : selectedPlan === "growth" ? "Verify & continue to payment" : "Verify & create account"}
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
          ) : (
            <>
              <h1 className="font-display font-bold text-xl mb-1">Activate Growth</h1>
              <p className="text-sm text-ink/50 mb-5">
                Your account is created — one last step to unlock unlimited forms, approval workflows, WhatsApp
                delivery, and the AI Assistant.
              </p>

              <div className="border border-primary/20 bg-primary/5 rounded-lg p-4 mb-4">
                <div className="flex items-center justify-between">
                  <p className="font-medium">Growth plan</p>
                  <p className="font-display font-semibold text-lg">$19/month</p>
                </div>
              </div>

              {payError && <p className="text-sm text-danger mb-3">{payError}</p>}
              <Button onClick={payForGrowth} disabled={paying} className="w-full justify-center">
                {paying ? "Opening checkout…" : "Pay & activate Growth"}
              </Button>
              <button
                type="button"
                onClick={() => router.push("/app")}
                className="w-full text-xs text-ink/40 text-center mt-3 hover:underline"
              >
                Skip for now — I'll upgrade later from Settings
              </button>
            </>
          )}
        </div>

        <p className="text-center text-sm text-ink/50 mt-3">
          Already have an account? <Link href="/login" className="text-primary font-medium">Log in</Link>
        </p>
        </div>

        {step === 1 && <WhyFloworaPanel />}
      </div>
    </div>
  );
}
