import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { Target } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { Field, inputCls, Button, PasswordInput } from "../components/ui";
import { APP_NAME } from "../lib/brand";
import Seo from "../components/Seo";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const router = useRouter();

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

  return (
    <div className="min-h-screen bg-base flex items-center justify-center p-6">
      <Seo title="Log in" description={`Log in to your ${APP_NAME} account.`} path="/login" />
      <div className="w-full max-w-md">
        <Link href="/" className="flex items-center justify-center gap-2 mb-8">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
            <Target size={17} className="text-white" />
          </div>
          <span className="font-display font-bold text-lg">{APP_NAME}</span>
        </Link>

        <div className="bg-white border border-border rounded-card shadow-card p-6">
          <h1 className="font-display font-bold text-xl mb-1">Welcome back</h1>
          <p className="text-sm text-ink/50 mb-5">Log in to your account.</p>

          <form onSubmit={submit}>
            <Field label="Email">
              <input className={inputCls} type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </Field>
            <Field label="Password">
              <PasswordInput value={password} onChange={(e) => setPassword(e.target.value)} required />
            </Field>
            <div className="text-right -mt-2 mb-3">
              <Link href="/forgot-password" className="text-xs text-primary font-medium hover:underline">
                Forgot password?
              </Link>
            </div>
            {error && <p className="text-sm text-danger mb-3">{error}</p>}
            <Button type="submit" className="w-full justify-center" disabled={loading}>
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
