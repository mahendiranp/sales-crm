import { useState } from "react";
import Link from "next/link";
import { Target, Mail } from "lucide-react";
import api from "../api/client";
import { Field, inputCls, Button } from "../components/ui";
import { APP_NAME } from "../lib/brand";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [devLink, setDevLink] = useState("");
  const [error, setError] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const { data } = await api.post("/auth/forgot-password", { email });
      setSent(true);
      if (data.devResetLink) setDevLink(data.devResetLink);
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
          <span className="font-display font-bold text-lg">{APP_NAME}</span>
        </Link>

        <div className="bg-white border border-border rounded-card shadow-card p-6">
          {sent ? (
            <div className="text-center py-2">
              <Mail size={28} className="text-primary mx-auto mb-3" />
              <h1 className="font-display font-bold text-lg mb-1">Check your email</h1>
              <p className="text-sm text-ink/50">
                If an account exists for <strong>{email}</strong>, a reset link is on its way. It expires in 30 minutes.
              </p>
              {devLink && (
                <div className="mt-4 p-3 bg-accent/8 border border-accent/20 rounded-lg text-left">
                  <p className="text-xs font-medium text-accent-dark mb-1">
                    Dev mode — no SMTP configured, so here's the link directly:
                  </p>
                  <a href={devLink} className="text-xs text-primary break-all hover:underline">{devLink}</a>
                </div>
              )}
            </div>
          ) : (
            <>
              <h1 className="font-display font-bold text-xl mb-1">Reset your password</h1>
              <p className="text-sm text-ink/50 mb-5">Enter your email and we'll send you a reset link.</p>
              <form onSubmit={submit}>
                <Field label="Email">
                  <input className={inputCls} type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
                </Field>
                {error && <p className="text-sm text-danger mb-3">{error}</p>}
                <Button type="submit" className="w-full justify-center" disabled={loading}>
                  {loading ? "Sending…" : "Send reset link"}
                </Button>
              </form>
            </>
          )}
        </div>

        <p className="text-center text-sm text-ink/50 mt-5">
          <Link href="/login" className="text-primary font-medium">Back to login</Link>
        </p>
      </div>
    </div>
  );
}
