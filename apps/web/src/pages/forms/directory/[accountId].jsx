import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { FormInput, ArrowRight } from "lucide-react";
import api from "../../../api/client";
import Seo from "../../../components/Seo";

export default function FormsDirectory() {
  const router = useRouter();
  const { accountId } = router.query;
  const [data, setData] = useState(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!accountId || !router.isReady) return;
    api
      .get(`/forms/directory/${accountId}`)
      .then((r) => setData(r.data))
      .catch(() => setError(true));
  }, [accountId, router.isReady]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-base p-4">
        <Seo title="Forms unavailable" noindex path={`/forms/directory/${accountId || ""}`} />
        <div className="bg-white border border-border rounded-card shadow-card p-8 max-w-md text-center">
          <FormInput size={28} className="text-ink/30 mx-auto mb-3" />
          <p className="font-medium text-ink/70">This page isn't available</p>
          <p className="text-sm text-ink/40 mt-1">The link may be incorrect.</p>
        </div>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="min-h-screen bg-base p-4">
      <Seo title={data.company ? `${data.company} — Forms` : "Forms"} noindex path={`/forms/directory/${accountId}`} />
      <div className="max-w-xl mx-auto py-12">
        <h1 className="font-display font-bold text-2xl mb-1">{data.company || "Forms"}</h1>
        <p className="text-sm text-ink/50 mb-8">Choose a form below to get started.</p>

        {data.forms.length === 0 ? (
          <div className="bg-white border border-border rounded-card shadow-card p-8 text-center">
            <FormInput size={28} className="text-ink/30 mx-auto mb-3" />
            <p className="text-sm text-ink/50">No forms are available right now.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {data.forms.map((f) => (
              <Link
                key={f.id}
                href={`/forms/${f.id}`}
                className="flex items-center justify-between gap-4 bg-white border border-border rounded-card shadow-card p-5 hover:border-primary transition-colors"
              >
                <div>
                  <p className="font-display font-semibold">{f.name}</p>
                  {f.description && <p className="text-sm text-ink/50 mt-0.5">{f.description}</p>}
                </div>
                <ArrowRight size={18} className="text-ink/30 shrink-0" />
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
