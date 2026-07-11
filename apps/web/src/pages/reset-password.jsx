import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { Target, CheckCircle2 } from "lucide-react";
import api from "../api/client";
import { Field, inputCls, Button } from "../components/ui";

export default function ResetPassword() {
  const router = useRouter();
  const { token, email } = router.query;
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    setLoading(true);
    try {
      await api.post("/auth/reset-password", { email, token, password });
      setDone(true);
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
          {done ? (
            <div className="text-center py-2">
              <CheckCircle2 size={28} className="text-primary mx-auto mb-3" />
              <h1 className="font-display font-bold text-lg mb-1">Password updated</h1>
              <p className="text-sm text-ink/50 mb-4">You can log in with your new password now.</p>
              <Link href="/login">
                <Button className="w-full justify-center">Go to login</Button>
              </Link>
            </div>
          ) : (
            <>
              <h1 className="font-display font-bold text-xl mb-1">Set a new password</h1>
              <p className="text-sm text-ink/50 mb-5">Choose a new password for {email || "your account"}.</p>
              <form onSubmit={submit}>
                <Field label="New Password">
                  <input className={inputCls} type="password" value={password} onChange={(e) => setPassword(e.target.value)} minLength={8} required />
                </Field>
                <Field label="Confirm Password">
                  <input className={inputCls} type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} minLength={8} required />
                </Field>
                {error && <p className="text-sm text-danger mb-3">{error}</p>}
                <Button type="submit" className="w-full justify-center" disabled={loading || !token}>
                  {loading ? "Updating…" : "Update password"}
                </Button>
                {!token && <p className="text-xs text-danger mt-2">This link is missing its reset token — use the link from your email.</p>}
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
