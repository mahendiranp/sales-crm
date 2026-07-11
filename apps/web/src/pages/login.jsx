import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { Target, ShieldCheck, UserCog, Eye, ArrowRight } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { Field, inputCls, Button } from "../components/ui";

// Demo passwords come from env (must be NEXT_PUBLIC_ to reach the client
// bundle) so they're never hardcoded in source and stay in sync with the
// backend's DEMO_*_PASSWORD seed values — see apps/web/.env.example.
const ROLES = [
  {
    key: "admin",
    label: "Admin",
    desc: "Full access — manage everything, including settings and users.",
    icon: ShieldCheck,
    email: "admin@pipeline.com",
    password: process.env.NEXT_PUBLIC_DEMO_ADMIN_PASSWORD || "admin123",
  },
  {
    key: "manager",
    label: "User (Manager)",
    desc: "Can manage leads, deals, tasks, and messaging.",
    icon: UserCog,
    email: "manager@pipeline.com",
    password: process.env.NEXT_PUBLIC_DEMO_MANAGER_PASSWORD || "manager123",
  },
  {
    key: "viewer",
    label: "Viewer",
    desc: "View-only — can browse the CRM but can't make changes.",
    icon: Eye,
    email: "viewer@pipeline.com",
    password: process.env.NEXT_PUBLIC_DEMO_VIEWER_PASSWORD || "viewer123",
  },
];

export default function Login() {
  const [selectedRole, setSelectedRole] = useState("admin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { login, demoLogin } = useAuth();
  const router = useRouter();

  const selectRole = (role) => {
    setSelectedRole(role.key);
    setEmail(role.email);
    setPassword(role.password);
    setError("");
  };

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(email, password);
      router.push("/app");
    } catch (err) {
      setError(err.response?.data?.error || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  const continueAsDemo = async () => {
    setError("");
    setLoading(true);
    try {
      await demoLogin(selectedRole);
      router.push("/app");
    } catch (err) {
      setError(err.response?.data?.error || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-base flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <Link href="/" className="flex items-center justify-center gap-2 mb-8">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
            <Target size={17} className="text-white" />
          </div>
          <span className="font-display font-bold text-lg">Pipeline</span>
        </Link>

        <div className="bg-white border border-border rounded-card shadow-card p-6">
          <h1 className="font-display font-bold text-xl mb-1">Welcome back</h1>
          <p className="text-sm text-ink/50 mb-5">Choose how you'd like to sign in.</p>

          <div className="space-y-2 mb-5">
            {ROLES.map((role) => (
              <button
                key={role.key}
                type="button"
                onClick={() => selectRole(role)}
                className={`w-full text-left p-3 rounded-lg border flex items-start gap-3 transition-colors ${
                  selectedRole === role.key ? "border-primary bg-primary/5" : "border-border hover:bg-base"
                }`}
              >
                <div
                  className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                    selectedRole === role.key ? "bg-primary text-white" : "bg-base text-ink/40"
                  }`}
                >
                  <role.icon size={15} />
                </div>
                <div>
                  <p className="text-sm font-medium">{role.label}</p>
                  <p className="text-xs text-ink/40 mt-0.5">{role.desc}</p>
                </div>
              </button>
            ))}
          </div>

          <Button onClick={continueAsDemo} className="w-full justify-center mb-5" disabled={loading}>
            Continue as {ROLES.find((r) => r.key === selectedRole)?.label} <ArrowRight size={15} />
          </Button>

          <div className="flex items-center gap-3 mb-5">
            <div className="flex-1 h-px bg-border" />
            <span className="text-xs text-ink/40">or sign in with email</span>
            <div className="flex-1 h-px bg-border" />
          </div>

          <form onSubmit={submit}>
            <Field label="Email">
              <input className={inputCls} type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </Field>
            <Field label="Password">
              <input className={inputCls} type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </Field>
            <div className="text-right -mt-2 mb-3">
              <Link href="/forgot-password" className="text-xs text-primary font-medium hover:underline">
                Forgot password?
              </Link>
            </div>
            {error && <p className="text-sm text-danger mb-3">{error}</p>}
            <Button type="submit" variant="secondary" className="w-full justify-center" disabled={loading}>
              {loading ? "Signing in…" : "Sign in"}
            </Button>
          </form>
        </div>

        <p className="text-center text-sm text-ink/50 mt-5">
          Don't have an account? <Link href="/signup" className="text-primary font-medium">Sign up free</Link>
        </p>
      </div>
    </div>
  );
}
