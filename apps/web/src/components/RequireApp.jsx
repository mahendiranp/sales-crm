import { useEffect, useState } from "react";
import Link from "next/link";
import { Lock } from "lucide-react";
import api from "../api/client";
import { useAuth } from "../context/AuthContext";
import { Card, PageHeader } from "./ui";
import { findApp } from "../lib/appCatalog";

// Enforces the toggle set on the Admin Portal — a disabled app's page
// renders this instead of its real content, regardless of how the user
// got to the URL (nav link, bookmark, direct navigation).
export default function RequireApp({ appKey, children }) {
  const { isMasterAdmin } = useAuth();
  const [enabled, setEnabled] = useState(null);
  const app = findApp(appKey);

  useEffect(() => {
    api.get("/settings").then((r) => setEnabled(!!r.data.apps?.[appKey]));
  }, [appKey]);

  if (enabled === null && !isMasterAdmin) return null;

  // Master admin bypasses every tenant's app flags — they see everything.
  if (!enabled && !isMasterAdmin) {
    return (
      <div>
        <PageHeader title={app?.label || appKey} />
        <Card className="p-10 flex flex-col items-center text-center">
          <div className="w-12 h-12 rounded-full bg-base flex items-center justify-center mb-3">
            <Lock size={20} className="text-ink/30" />
          </div>
          <p className="font-medium text-ink/70">{app?.label || "This app"} is turned off</p>
          <p className="text-sm text-ink/40 mt-1 max-w-sm">
            {isMasterAdmin
              ? "Turn it on from the Admin Portal to use it."
              : "Ask your master admin to enable it from the Admin Portal."}
          </p>
          {isMasterAdmin && (
            <Link href="/app/apps" className="text-sm text-primary font-medium mt-4 hover:underline">
              Go to Admin Portal
            </Link>
          )}
        </Card>
      </div>
    );
  }

  return children;
}
