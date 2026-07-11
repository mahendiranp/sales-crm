import { useEffect, useState } from "react";
import Link from "next/link";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { Users2, UserPlus, Clock3, Trophy, Wallet, Sparkles, Bell, Crown, TrendingDown, FormInput } from "lucide-react";
import api from "../api/client";
import { useAuth } from "../context/AuthContext";
import { Card, PageHeader } from "../components/ui";
import { formatINR, formatDate } from "../lib/format";
import useLiveCollection from "../lib/useLiveCollection";
import { RELEASED_MODULE_KEYS } from "../lib/coreModules";

function StatCard({ icon: Icon, label, value, accent }) {
  return (
    <Card className="p-4 flex-1 min-w-[180px]">
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

function WidgetCard({ icon, title, subtitle, children, className = "" }) {
  return (
    <Card className={`p-5 flex-1 min-w-[280px] ${className}`}>
      <h3 className="font-display font-semibold mb-1 flex items-center gap-2">
        <span>{icon}</span> {title}
      </h3>
      {subtitle && <p className="text-xs text-ink/35 mb-3 -mt-0.5">{subtitle}</p>}
      {!subtitle && <div className="mb-4" />}
      {children}
    </Card>
  );
}

function MetricRow({ label, value }) {
  return (
    <div className="flex items-center justify-between py-1.5 text-sm">
      <span className="text-ink/60">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

export default function Dashboard() {
  const { isMasterAdmin } = useAuth();
  const [data, setData] = useState(null);
  const [formStats, setFormStats] = useState(null);
  const [modules, setModules] = useState(null);
  const [appsFlags, setAppsFlags] = useState(null);

  const load = () => api.get("/dashboard").then((r) => setData(r.data));
  const loadFormStats = () => api.get("/forms/stats").then((r) => setFormStats(r.data)).catch(() => {});
  const loadSettings = () =>
    api.get("/settings").then((r) => {
      setModules(r.data.modules || {});
      setAppsFlags(r.data.apps || {});
    });
  useEffect(() => {
    load();
    loadFormStats();
    loadSettings();
  }, []);
  useLiveCollection(["leads", "deals", "tasks", "activities"], load);
  useLiveCollection(["forms", "form_responses"], loadFormStats);
  useLiveCollection(["settings"], loadSettings);

  if (!data || !modules || !appsFlags) return <div className="text-ink/40 text-sm">Loading dashboard…</div>;

  const { salesPerformance, leadStatus, todaysActivities, teamPerformance, revenueSummary, leadSources, notifications } = data;

  // UI-only release lock, same as Layout.jsx's nav — this build only
  // ships Dashboard + Forms, so these widgets stay hidden for
  // non-master-admin regardless of this tenant's stored flags.
  // Master admin sees every widget regardless of this tenant's flags.
  const on = (key) => isMasterAdmin || (RELEASED_MODULE_KEYS.includes(key) && modules[key] !== false);
  const showLeads = on("leads");
  const showDeals = on("deals");
  const showTasks = on("tasks");
  const showActivities = on("activities");
  const showForms = isMasterAdmin || appsFlags.forms !== false;
  const showPipelineData = showLeads || showDeals || showTasks;

  return (
    <div>
      <PageHeader title="Dashboard" subtitle="Here's what's happening across your pipeline today." />

      {showPipelineData && (
        <div className="flex flex-wrap gap-4 mb-6">
          {showLeads && <StatCard icon={Users2} label="Total Leads" value={data.totalLeads} accent="#3E6FA3" />}
          {showLeads && <StatCard icon={UserPlus} label="New Leads Today" value={data.newLeadsToday} accent="#2F5D50" />}
          {showTasks && <StatCard icon={Clock3} label="Follow-ups Due" value={data.followUpsDue} accent="#E8A33D" />}
          {showDeals && <StatCard icon={Trophy} label="Deals Won" value={data.dealsWon} accent="#8B5FBF" />}
          {showDeals && <StatCard icon={Wallet} label="Monthly Revenue" value={formatINR(data.monthlyRevenue)} accent="#C1443C" />}
        </div>
      )}

      {(showDeals || showPipelineData) && (
        <div className="flex flex-wrap gap-4 mb-4">
          {showDeals && (
            <Card className="p-5 flex-[2] min-w-[400px]">
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
          )}

          {showPipelineData && (
            <WidgetCard
              icon={<Sparkles size={17} className="text-accent inline" />}
              title="AI Suggestions"
              subtitle="Rule-based right now, not a live LLM — see Settings → AI Configuration to connect one."
            >
              <div className="space-y-3">
                {data.aiSuggestions.map((s, i) => (
                  <div key={i} className="text-sm text-ink/70 bg-accent/8 border border-accent/20 rounded-lg p-3 leading-snug">
                    {s}
                  </div>
                ))}
              </div>
            </WidgetCard>
          )}
        </div>
      )}

      {(showDeals || showLeads || showActivities || showTasks) && (
        <div className="flex flex-wrap gap-4 mb-4">
          {showDeals && (
            <WidgetCard icon="📊" title="Sales Performance">
              <MetricRow label="Today's Sales" value={formatINR(salesPerformance.today)} />
              <MetricRow label="Weekly Sales" value={formatINR(salesPerformance.weekly)} />
              <MetricRow label="Monthly Sales" value={formatINR(salesPerformance.monthly)} />
              <MetricRow label="Yearly Sales" value={formatINR(salesPerformance.yearly)} />
            </WidgetCard>
          )}

          {(showLeads || showDeals) && (
            <WidgetCard icon="📌" title="Lead Status">
              <MetricRow label="New Leads" value={leadStatus.newLeads} />
              <MetricRow label="Contacted" value={leadStatus.contacted} />
              <MetricRow label="Qualified" value={leadStatus.qualified} />
              <MetricRow label="Proposal Sent" value={leadStatus.proposalSent} />
              <MetricRow label="Negotiation" value={leadStatus.negotiation} />
              <MetricRow label="Won" value={leadStatus.won} />
              <MetricRow label="Lost" value={leadStatus.lost} />
            </WidgetCard>
          )}

          {(showActivities || showTasks) && (
            <WidgetCard icon="📅" title="Today's Activities">
              <MetricRow label="Meetings" value={todaysActivities.meetings} />
              <MetricRow label="Calls" value={todaysActivities.calls} />
              <MetricRow label="Follow-ups" value={todaysActivities.followUps} />
              <MetricRow label="Pending Tasks" value={todaysActivities.pendingTasks} />
              <MetricRow label="Upcoming Appointments" value={todaysActivities.upcomingAppointments} />
            </WidgetCard>
          )}
        </div>
      )}

      {(showDeals || showLeads) && (
        <div className="flex flex-wrap gap-4 mb-4">
          {showDeals && (
            <WidgetCard icon="👨‍💼" title="Sales Team Performance">
              <div className="flex items-center gap-2 text-sm mb-1.5">
                <Crown size={14} className="text-amber-500" />
                <span className="text-ink/60">Top Performer</span>
                <span className="ml-auto font-medium">
                  {teamPerformance.topPerformer ? teamPerformance.topPerformer.name : "—"}
                </span>
              </div>
              <div className="flex items-center gap-2 text-sm mb-1.5">
                <TrendingDown size={14} className="text-ink/40" />
                <span className="text-ink/60">Lowest Performer</span>
                <span className="ml-auto font-medium">
                  {teamPerformance.lowestPerformer ? teamPerformance.lowestPerformer.name : "—"}
                </span>
              </div>
              <MetricRow label="Deals Closed" value={teamPerformance.dealsClosed} />
              <div className="mt-2 pt-2 border-t border-border">
                <p className="text-xs font-medium text-ink/40 mb-1.5">Revenue by Salesperson</p>
                {teamPerformance.revenueBySalesperson.slice(0, 5).map((p) => (
                  <MetricRow key={p.userId} label={p.name} value={formatINR(p.revenue)} />
                ))}
              </div>
            </WidgetCard>
          )}

          {showDeals && (
            <WidgetCard icon="💰" title="Revenue Summary">
              <MetricRow label="Total Revenue" value={formatINR(revenueSummary.totalRevenue)} />
              <MetricRow label="Target Revenue" value={formatINR(revenueSummary.targetRevenue)} />
              <MetricRow label="Revenue Achievement %" value={`${revenueSummary.achievementPct}%`} />
              <MetricRow label="Average Deal Value" value={formatINR(revenueSummary.avgDealValue)} />
            </WidgetCard>
          )}

          {showLeads && (
            <WidgetCard icon="🌍" title="Lead Sources">
              {leadSources.length === 0 && <p className="text-sm text-ink/40">No leads yet.</p>}
              {leadSources.map((s) => (
                <MetricRow key={s.source} label={s.source} value={s.count} />
              ))}
            </WidgetCard>
          )}
        </div>
      )}

      {showForms && formStats && (
        <div className="flex flex-wrap gap-4 mb-4">
          <WidgetCard icon={<FormInput size={17} className="text-primary inline" />} title="Forms">
            <MetricRow label="Total Forms" value={formStats.totalForms} />
            <MetricRow label="Total Responses" value={formStats.totalResponses} />
          </WidgetCard>

          <Card className="p-5 flex-[2] min-w-[400px]">
            <h3 className="font-display font-semibold mb-4">Recent Form Responses</h3>
            {formStats.recentResponses.length === 0 ? (
              <p className="text-sm text-ink/40">No responses yet.</p>
            ) : (
              <div className="space-y-1">
                {formStats.recentResponses.map((r) => (
                  <Link
                    key={r.id}
                    href={`/app/forms/${r.formId}/responses?highlight=${r.id}`}
                    className="flex items-center justify-between text-sm py-1 px-1.5 -mx-1.5 rounded-lg hover:bg-base"
                  >
                    <span className="text-ink/70 truncate">{r.formName}</span>
                    <span className="text-xs text-ink/40 shrink-0 ml-2">{formatDate(r.submittedAt)}</span>
                  </Link>
                ))}
              </div>
            )}
          </Card>
        </div>
      )}

      {showPipelineData && (
        <div className="grid grid-cols-1 gap-4">
          <WidgetCard icon="🔔" title="Notifications">
            {notifications.length === 0 && <p className="text-sm text-ink/40">No notifications right now.</p>}
            <div className="space-y-2">
              {notifications.map((n, i) => (
                <div key={i} className="flex items-start gap-3 text-sm p-2.5 rounded-lg hover:bg-base">
                  <Bell size={15} className="text-ink/30 mt-0.5 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <span className="font-medium">{n.type}</span>
                    <span className="text-ink/60"> — {n.message}</span>
                  </div>
                  <span className="text-xs text-ink/35 shrink-0">{formatDate(n.timestamp)}</span>
                </div>
              ))}
            </div>
          </WidgetCard>
        </div>
      )}

      {!showPipelineData && !showForms && (
        <div className="text-center text-sm text-ink/40 py-16">No modules enabled yet — check the Admin Portal.</div>
      )}
    </div>
  );
}
