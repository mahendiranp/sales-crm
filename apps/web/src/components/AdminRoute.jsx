import Link from "next/link";
import { ShieldAlert } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { Card, PageHeader } from "./ui";

// Gates the Admin Portal to the master admin specifically — even a
// company's own admin (let alone managers/viewers) is blocked, since only
// the master admin controls app feature flags.
export default function AdminRoute({ children }) {
  const { isMasterAdmin } = useAuth();

  if (!isMasterAdmin) {
    return (
      <div>
        <PageHeader title="Admin Portal" />
        <Card className="p-10 flex flex-col items-center text-center">
          <div className="w-12 h-12 rounded-full bg-base flex items-center justify-center mb-3">
            <ShieldAlert size={20} className="text-ink/30" />
          </div>
          <p className="font-medium text-ink/70">Master admin only</p>
          <p className="text-sm text-ink/40 mt-1 max-w-sm">
            The Admin Portal manages feature flags for the whole company. Only
            the master admin account can access this.
          </p>
          <Link href="/app" className="text-sm text-primary font-medium mt-4 hover:underline">
            Back to Dashboard
          </Link>
        </Card>
      </div>
    );
  }

  return children;
}
