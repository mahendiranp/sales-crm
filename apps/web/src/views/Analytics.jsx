import { useEffect, useState } from "react";
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import api from "../api/client";
import { Card, PageHeader } from "../components/ui";
import { formatINR } from "../lib/format";
import useLiveCollection from "../lib/useLiveCollection";

const PIE_COLORS = ["#2F5D50", "#E8A33D", "#3E6FA3", "#8B5FBF", "#C1443C"];

export default function Analytics() {
  const [data, setData] = useState(null);

  const load = () => api.get("/analytics").then((r) => setData(r.data));
  useEffect(() => {
    load();
  }, []);
  useLiveCollection(["leads", "deals", "users"], load);

  if (!data) return <div className="text-ink/40 text-sm">Loading analytics…</div>;

  const sourceData = Object.entries(data.leadSources).map(([name, value]) => ({ name, value }));
  const stageData = Object.entries(data.revenueByStage).map(([name, revenue]) => ({ name, revenue }));

  return (
    <div>
      <PageHeader title="Analytics" subtitle="Business insights across your entire pipeline." />

      <div className="grid grid-cols-3 gap-4 mb-4">
        <Card className="p-5 col-span-2">
          <h3 className="font-display font-semibold mb-4">Sales Trend</h3>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={data.salesTrend}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E4E7EC" />
              <XAxis dataKey="month" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 12 }} axisLine={false} tickLine={false} tickFormatter={(v) => `₹${v / 1000}k`} />
              <Tooltip formatter={(v) => formatINR(v)} />
              <Line type="monotone" dataKey="revenue" stroke="#2F5D50" strokeWidth={2.5} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </Card>
        <Card className="p-5 flex flex-col items-center justify-center">
          <h3 className="font-display font-semibold mb-2 self-start">Conversion Rate</h3>
          <p className="text-5xl font-display font-bold text-primary">{data.conversionRate}%</p>
          <p className="text-xs text-ink/40 mt-1">of leads become customers</p>
        </Card>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-4">
        <Card className="p-5">
          <h3 className="font-display font-semibold mb-4">Revenue by Pipeline Stage</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={stageData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E4E7EC" />
              <XAxis dataKey="name" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} interval={0} angle={-20} textAnchor="end" height={50} />
              <YAxis tick={{ fontSize: 12 }} axisLine={false} tickLine={false} tickFormatter={(v) => `₹${v / 1000}k`} />
              <Tooltip formatter={(v) => formatINR(v)} />
              <Bar dataKey="revenue" fill="#2F5D50" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card className="p-5">
          <h3 className="font-display font-semibold mb-4">Lead Sources</h3>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={sourceData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                {sourceData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </Card>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Card className="p-5">
          <h3 className="font-display font-semibold mb-3">Best Performing Employee</h3>
          <div className="space-y-2">
            {data.bestPerforming.map((e, i) => (
              <div key={i} className="flex justify-between items-center text-sm p-2 rounded-lg hover:bg-base">
                <span className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-primary/10 text-primary text-xs flex items-center justify-center font-medium">{i + 1}</span>
                  {e.user}
                </span>
                <span className="font-mono font-medium">{formatINR(e.revenue)}</span>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-5">
          <h3 className="font-display font-semibold mb-3">Lost Reasons</h3>
          <div className="space-y-2">
            {data.lostReasons.map((r, i) => (
              <div key={i} className="flex justify-between text-sm">
                <span className="text-ink/60">{r.reason}</span>
                <span className="font-mono">{r.count}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
