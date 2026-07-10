import Link from "next/link";
import { Hammer } from "lucide-react";
import { PageHeader, Card } from "../components/ui";

export default function ModulePlaceholder({ app }) {
  return (
    <div>
      <PageHeader title={app.label} subtitle={app.category} />
      <Card className="p-10 flex flex-col items-center text-center">
        <div className="w-12 h-12 rounded-full bg-base flex items-center justify-center mb-3">
          <Hammer size={20} className="text-ink/30" />
        </div>
        <p className="font-medium text-ink/70">{app.label} isn't built yet</p>
        <p className="text-sm text-ink/40 mt-1 max-w-sm">
          You've enabled this app from the Apps page, but it's still a
          placeholder. Ask to have {app.label} built next and it'll get the
          same real, working treatment as Invoicing or Expenses.
        </p>
        <Link href="/app/apps" className="text-sm text-primary font-medium mt-4 hover:underline">
          Back to Apps
        </Link>
      </Card>
    </div>
  );
}
