import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { Target, ShieldCheck, LockKeyhole, CheckCircle2, Sparkles, Zap, BarChart3, Palette, Download } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { Field, inputCls, Button, PasswordInput } from "../components/ui";
import { APP_NAME } from "../lib/brand";
import Seo from "../components/Seo";
import GoogleSignInButton from "../components/GoogleSignInButton";

const WHY_FLOWORA = [
  { icon: Sparkles, label: "AI Form Builder", desc: "Build forms from natural language.", badge: "New" },
  { icon: Zap, label: "Approval Workflows", desc: "Automate approvals with ease." },
  { icon: BarChart3, label: "Analytics Dashboard", desc: "Track every submission." },
  { icon: Palette, label: "Brand Customization", desc: "Match your organization." },
  { icon: Download, label: "CSV & Excel Export", desc: "Export anytime." },
];

// Bumps input height/border/focus-ring for this page only — `inputCls` is
// shared by every form across the app, so overriding it here would've
// changed every input everywhere, not just login.
// `bg-white text-ink` are pinned explicitly here — without them, a
// browser in OS dark mode renders native <input> chrome with a dark
// background and white text (the shared `inputCls` never sets either),
// which on this page's white card made typed text unreadable.
const loginInputCls = `${inputCls} h-[52px] text-[16px] bg-white text-[#14172b99] border-[#D9E3E6] focus:ring-2 focus:ring-primary/15`;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// The backend's raw error strings are accurate but terse — this maps the
// common ones to friendlier copy without hiding what actually went wrong.
function friendlyError(message) {
  if (!message) return "Something went wrong. Please try again.";
  if (/invalid/i.test(message) && /(credential|password|email)/i.test(message)) {
    return "We couldn't sign you in. Please check your email and password and try again.";
  }
  return message;
}

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  // Keyed per-field so each message renders under the field it's about —
  // `form` holds anything not tied to a specific input (e.g. Google's own
  // OAuth failures, which have nothing to do with the email/password inputs).
  const [errors, setErrors] = useState({ email: "", password: "", form: "" });
  const [loading, setLoading] = useState(false);
  const [capsLockOn, setCapsLockOn] = useState(false);
  const { login } = useAuth();
  const router = useRouter();

  // ?redirect=/templates/leave-request%3FuseTemplate%3D1 (from the public
  // template marketplace) sends a visitor back to the template page after
  // login instead of straight into /app — only trusted for a same-origin path.
  const postAuthDestination = () => {
    const { redirect } = router.query;
    if (typeof redirect === "string" && redirect.startsWith("/") && !redirect.startsWith("//")) return redirect;
    return "/app";
  };

  const submit = async (e) => {
    e.preventDefault();
    const nextErrors = { email: "", password: "", form: "" };
    if (!email.trim()) nextErrors.email = "Email is required.";
    else if (!EMAIL_RE.test(email.trim())) nextErrors.email = "Enter a valid email address.";
    if (!password.trim()) nextErrors.password = "Password is required.";
    if (nextErrors.email || nextErrors.password) {
      setErrors(nextErrors);
      return;
    }
    setErrors(nextErrors);
    setLoading(true);
    try {
      await login(email.trim(), password);
      router.push(postAuthDestination());
    } catch (err) {
      // Invalid-credentials failures aren't specific to either field
      // individually (it could be either one), so they render under
      // Password — the last field the user filled in before submitting.
      setErrors({ email: "", password: friendlyError(err.response?.data?.error), form: "" });
    } finally {
      setLoading(false);
    }
  };

  const checkCapsLock = (e) => {
    if (typeof e.getModifierState === "function") {
      setCapsLockOn(e.getModifierState("CapsLock"));
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center p-6"
      style={{ background: "linear-gradient(180deg, #F8FBFA 0%, #FFFFFF 35%, #FFFFFF 100%)" }}
    >
      <Seo title="Log in" description={`Log in to your ${APP_NAME} account.`} path="/login" />
      <div className="w-full max-w-5xl grid lg:grid-cols-[520px_440px] justify-center gap-14 items-center">
        <div className="w-full max-w-[520px] mx-auto lg:mx-0 lg:ml-auto">
          <Link href="/" className="flex items-center justify-center gap-2 mb-4">
            <div className="w-9 h-9 rounded-lg bg-primary flex items-center justify-center">
              <Target size={18} className="text-white" />
            </div>
            <span className="font-display font-bold text-[22px]">{APP_NAME}</span>
          </Link>
          <div className="w-10 h-px bg-border mx-auto mb-6" />

          <div
            className="bg-white rounded-card p-10 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg"
            style={{ border: "1px solid #E7ECEF", boxShadow: "0 15px 45px rgba(0,0,0,.06)" }}
          >
            <h1 className="font-display font-bold text-ink text-[48px] leading-[1.05]">
              Welcome back
            </h1>
            <p className="mt-2 text-ink/60 text-xl leading-relaxed">
              Continue building smarter forms.
            </p>

            <form onSubmit={submit} noValidate className="mt-6">
              <Field label="Email">
                <input
                  className={loginInputCls}
                  type="email"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); setErrors((er) => ({ ...er, email: "" })); }}
                  style={errors.email ? { borderColor: "#DC2626" } : undefined}
                />
              </Field>
              {errors.email && <p className="text-sm text-danger mt-1">{errors.email}</p>}
              <div className="mt-2.5">
                <Field label="Password">
                  <PasswordInput
                    className={loginInputCls}
                    value={password}
                    onChange={(e) => { setPassword(e.target.value); setErrors((er) => ({ ...er, password: "" })); }}
                    onKeyUp={checkCapsLock}
                    onKeyDown={checkCapsLock}
                    style={errors.password ? { borderColor: "#DC2626" } : undefined}
                  />
                </Field>
                {errors.password && <p className="text-sm text-danger mt-1">{errors.password}</p>}
                {capsLockOn && <p className="text-xs text-accent-dark mt-1">Caps Lock is ON</p>}
              </div>
              <div className="flex items-center justify-between mb-3 mt-3 text-xs">
                <Link href="/forgot-password" className="text-primary font-medium hover:underline">
                  Forgot password?
                </Link>
                <a href="mailto:info@floworaone.com?subject=Login%20help" className="text-ink/40 hover:text-ink/60">
                  Need help? Contact Support
                </a>
              </div>
              <div className="mt-5">
                <Button
                  type="submit"
                  className="w-full justify-center h-12 text-[16px] font-semibold rounded-[10px] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
                  disabled={loading}
                >
                  {loading ? "Signing you in…" : "Sign in securely →"}
                </Button>
                {loading && (
                  <div className="h-1 rounded-full bg-base overflow-hidden mt-2">
                    <div className="h-full w-1/3 bg-primary animate-pulse rounded-full" />
                  </div>
                )}
              </div>
            </form>

            <div className="flex items-center gap-3 mt-6 mb-3">
              <div className="h-px bg-border flex-1" />
              <span className="text-[10px] font-semibold tracking-wider text-ink/40 uppercase">Or continue with</span>
              <div className="h-px bg-border flex-1" />
            </div>
            <div className="transition-colors rounded-lg [&_button]:hover:bg-[#FAFAFA]">
              <GoogleSignInButton
                onSuccess={() => router.push(postAuthDestination())}
                onError={(msg) => setErrors({ email: "", password: "", form: friendlyError(msg) })}
              />
            </div>
            {errors.form && <p className="text-center text-sm text-danger mt-2">{errors.form}</p>}
            <p className="text-center text-xs text-ink/40 mt-2">Uses your Google account</p>

            <div className="mt-5 text-center">
              <div className="flex items-center justify-center flex-wrap gap-x-4 gap-y-1 text-xs text-ink/35">
                <span className="flex items-center gap-1"><CheckCircle2 size={12} className="text-primary" /> Free forever</span>
                <span className="flex items-center gap-1"><LockKeyhole size={12} className="text-primary" /> No credit card</span>
                <span className="flex items-center gap-1"><ShieldCheck size={12} className="text-primary" /> Google OAuth</span>
              </div>
            </div>
          </div>

          <p className="text-center text-sm text-ink/50 mt-5">
            Don't have an account? <Link href="/signup" className="text-primary font-medium">Sign up free</Link>
          </p>

          <p className="text-center mt-4 text-sm" style={{ color: "#98A2B3" }}>
            <Link href="/privacy" className="hover:text-ink/50">Privacy Policy</Link>
            {" • "}
            <Link href="/terms" className="hover:text-ink/50">Terms</Link>
            {" • "}
            <a href="mailto:info@floworaone.com" className="hover:text-ink/50">Support</a>
          </p>
        </div>

        <div
          className="hidden lg:flex flex-col gap-5 w-full max-w-[440px] bg-white rounded-card p-8 transition-all duration-200 hover:-translate-y-0.5"
          style={{ border: "1px solid #E7ECEF", boxShadow: "0 15px 45px rgba(0,0,0,.06)" }}
        >
          <h2 className="flex items-center gap-2 font-display font-bold text-ink leading-snug text-[28px]">
            <Sparkles size={22} className="text-primary shrink-0" />
            Why teams choose {APP_NAME}
          </h2>
          <ul className="space-y-4">
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
          <p className="text-sm font-medium text-primary mt-1">Free forever plan available</p>
        </div>
      </div>
    </div>
  );
}
