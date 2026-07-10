import { useEffect, useState } from "react";
import { Phone, Users as UsersIcon, Trophy, Wallet } from "lucide-react";
import api from "../api/client";
import { Card, PageHeader, EmptyState } from "../components/ui";
import { formatINR } from "../lib/format";
import useLiveCollection from "../lib/useLiveCollection";

export default function Performance() {
  const [data, setData] = useState(null);

  const load = () => api.get("/performance").then((r) => setData(r.data));
  useEffect(() => {
    load();
  }, []);
  useLiveCollection(["users", "leads", "deals", "activities"], load);

  if (!data) return <div className="text-ink/40 text-sm">Loading…</div>;

  return (
    <div>
      <PageHeader title="Performance" subtitle="How each salesperson is tracking against target." />

      {data.length === 0 ? (
        <Card><EmptyState title="No salespeople yet" /></Card>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          {data.map((p) => (
            <Card key={p.userId} className="p-5">
              <div className="flex items-center justify-between mb-4">
                <h4 className="font-display font-semibold">{p.name}</h4>
                <span className="text-xs font-medium text-ink/50">{p.targetAchievement}% of target</span>
              </div>

              <div className="h-2 bg-base rounded-full mb-4 overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full transition-all"
                  style={{ width: `${p.targetAchievement}%` }}
                />
              </div>

              <div className="grid grid-cols-4 gap-2 text-center">
                <div>
                  <UsersIcon size={14} className="mx-auto text-ink/30 mb-1" />
                  <p className="text-sm font-semibold">{p.leadsAssigned}</p>
                  <p className="text-[10px] text-ink/40">Leads</p>
                </div>
                <div>
                  <Phone size={14} className="mx-auto text-ink/30 mb-1" />
                  <p className="text-sm font-semibold">{p.callsMade}</p>
                  <p className="text-[10px] text-ink/40">Calls</p>
                </div>
                <div>
                  <Trophy size={14} className="mx-auto text-ink/30 mb-1" />
                  <p className="text-sm font-semibold">{p.dealsClosed}</p>
                  <p className="text-[10px] text-ink/40">Closed</p>
                </div>
                <div>
                  <Wallet size={14} className="mx-auto text-ink/30 mb-1" />
                  <p className="text-sm font-semibold font-mono">{formatINR(p.revenueGenerated).replace("₹", "")}</p>
                  <p className="text-[10px] text-ink/40">Revenue</p>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
