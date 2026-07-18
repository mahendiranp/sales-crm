import Link from "next/link";
import { Sparkles } from "lucide-react";
import { Modal, Button } from "./ui";

// Shown whenever an AI action (form generation, document import, lead
// scoring/parsing) comes back with `code: "insufficient_credits"` — every
// AI-calling screen shares this same dialog instead of each hand-rolling
// its own low-credits message, so the upsell reads consistently everywhere.
export default function UpgradeCreditsDialog({ open, onClose, message }) {
  return (
    <Modal open={open} onClose={onClose} title="Out of AI credits">
      <div className="text-center py-2">
        <div className="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center mx-auto mb-3">
          <Sparkles size={22} />
        </div>
        <p className="text-sm text-ink/70 mb-1">{message || "You're out of AI credits."}</p>
        <p className="text-xs text-ink/45 mb-5">
          Upgrade your plan for a monthly AI credit top-up, or wait for your next billing cycle if you're already on a paid plan.
        </p>
        <div className="flex items-center justify-center gap-2">
          <Button variant="secondary" onClick={onClose}>Not now</Button>
          <Link href="/app/settings">
            <Button>Upgrade plan</Button>
          </Link>
        </div>
      </div>
    </Modal>
  );
}
