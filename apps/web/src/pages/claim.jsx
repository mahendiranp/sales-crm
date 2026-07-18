import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { Target, FileWarning } from "lucide-react";
import api from "../api/client";
import { APP_NAME } from "../lib/brand";
import Seo from "../components/Seo";

export default function ClaimResponse() {
  const router = useRouter();
  const { token } = router.query;
  const [state, setState] = useState("loading"); // loading | ready | error
  const [data, setData] = useState(null);

  useEffect(() => {
    if (!token || !router.isReady) return;
    api
      .get("/forms/claim", { params: { token } })
      .then((r) => {
        setData(r.data);
        setState("ready");
      })
      .catch(() => setState("error"));
  }, [token, router.isReady]);

  return (
    <div className="min-h-screen bg-base flex items-center justify-center p-6">
      <Seo title="Your submission" noindex path="/claim" />
      <div className="w-full max-w-lg">
        <Link href="/" className="flex items-center justify-center gap-2 mb-8">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
            <Target size={17} className="text-white" />
          </div>
          <span className="font-display font-bold text-lg">{APP_NAME}</span>
        </Link>

        <div className="bg-white border border-border rounded-card shadow-card p-6">
          {state === "loading" && <p className="text-sm text-ink/50 text-center py-4">Loading your submission…</p>}

          {state === "error" && (
            <div className="text-center py-2">
              <FileWarning size={28} className="text-ink/30 mx-auto mb-3" />
              <h1 className="font-display font-bold text-lg mb-1">Link invalid or expired</h1>
              <p className="text-sm text-ink/50">This link may have already expired (links last 24 hours) or was mistyped.</p>
            </div>
          )}

          {state === "ready" && data && (
            <div>
              <p className="text-xs text-ink/40 mb-1">
                Reference <span className="font-mono font-medium text-ink/70">{data.response.referenceId}</span>
              </p>
              <h1 className="font-display font-bold text-lg mb-4">{data.form?.name || "Your submission"}</h1>
              <div className="space-y-3">
                {(data.form?.fields || []).map((f) => (
                  <div key={f.id}>
                    <p className="text-xs font-medium text-ink/50">{f.label}</p>
                    <p className="text-sm text-ink/80 break-words">
                      {f.type === "file" && data.response.answers?.[f.id]?.name
                        ? data.response.answers[f.id].name
                        : String(data.response.answers?.[f.id] ?? "—")}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
