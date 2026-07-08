import { useEffect, useState } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { Users2, UserPlus, Clock3, Trophy, Wallet, Sparkles } from "lucide-react";
import api from "../api/client";
import { Card, PageHeader } from "../components/ui";
import { formatINR } from "../lib/format";

function StatCard({ icon: Icon, label, value, accent }) {
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-ink/50">{label}</p>
          <p className="text-2xl font-display font-bold mt-1.5">{value}</p>
        </div>
        <div
          className="w-9 h-9 rounded-lg flex items-center justify-center"
          style={{ background: `${accent}18`, color: accent }}
        >
          <Icon size={17} />
        </div>
      </div>
    </Card>
  );
}

export default function Dashboard() {
  const [data, setData] = useState(null);

  useEffect(() => {
    api.get("/dashboard").then((r) => setData(r.data));
  }, []);

  if (!data) return <div className="text-ink/40 text-sm">Loading dashboard…</div>;

  return (
    <div>
      <PageHeader title="Dashboard" subtitle="Here's what's happening across your pipeline today." />

      <div className="grid grid-cols-5 gap-4 mb-6">
        <StatCard icon={Users2} label="Total Leads" value={data.totalLeads} accent="#3E6FA3" />
        <StatCard icon={UserPlus} label="New Leads Today" value={data.newLeadsToday} accent="#2F5D50" />
        <StatCard icon={Clock3} label="Follow-ups Due" value={data.followUpsDue} accent="#E8A33D" />
        <StatCard icon={Trophy} label="Deals Won" value={data.dealsWon} accent="#8B5FBF" />
        <StatCard icon={Wallet} label="Monthly Revenue" value={formatINR(data.monthlyRevenue)} accent="#C1443C" />
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Card className="col-span-2 p-5">
          <h3 className="font-display font-semibold mb-4">Sales Trend — Last 6 Months</h3>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={data.salesGraph}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E4E7EC" />
              <XAxis dataKey="month" tick={{ fontSize: 12, fill: "#14172B99" }} axisLine={false} tickLine={false} />
              <YAxis
                tick={{ fontSize: 12, fill: "#14172B99" }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => `₹${v / 1000}k`}
              />
              <Tooltip formatter={(v) => formatINR(v)} contentStyle={{ borderRadius: 8, border: "1px solid #E4E7EC", fontSize: 13 }} />
              <Line type="monotone" dataKey="revenue" stroke="#2F5D50" strokeWidth={2.5} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </Card>

        <Card className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <Sparkles size={17} className="text-accent" />
            <h3 className="font-display font-semibold">AI Suggestions</h3>
          </div>
          <div className="space-y-3">
            {data.aiSuggestions.map((s, i) => (
              <div key={i} className="text-sm text-ink/70 bg-accent/8 border border-accent/20 rounded-lg p-3 leading-snug">
                {s}
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
