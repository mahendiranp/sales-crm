import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { Target } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { Field, inputCls, Button } from "../components/ui";

export default function Signup() {
  const [form, setForm] = useState({ name: "", email: "", company: "", password: "", authRole: "admin" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { signup } = useAuth();
  const router = useRouter();

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await signup(form);
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
          <h1 className="font-display font-bold text-xl mb-1">Create your account</h1>
          <p className="text-sm text-ink/50 mb-5">Free forever on the Starter plan. No card required.</p>

          <form onSubmit={submit}>
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
              <input className={inputCls} type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required minLength={6} />
            </Field>
            <Field label="Account Type">
              <select className={inputCls} value={form.authRole} onChange={(e) => setForm({ ...form, authRole: e.target.value })}>
                <option value="admin">Admin — full access</option>
                <option value="manager">User — can manage the CRM</option>
                <option value="viewer">Viewer — view only</option>
              </select>
            </Field>
            {error && <p className="text-sm text-danger mb-3">{error}</p>}
            <Button type="submit" className="w-full justify-center" disabled={loading}>
              {loading ? "Creating account…" : "Create account"}
            </Button>
          </form>
        </div>

        <p className="text-center text-sm text-ink/50 mt-5">
          Already have an account? <Link href="/login" className="text-primary font-medium">Log in</Link>
        </p>
      </div>
    </div>
  );
}
