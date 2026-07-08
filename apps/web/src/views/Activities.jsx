import { useEffect, useState } from "react";
import { Phone, MessageCircle, Mail, Users, MapPin } from "lucide-react";
import api from "../api/client";
import { Card, PageHeader, EmptyState } from "../components/ui";
import { timeAgo } from "../lib/format";

const ICONS = {
  "Phone Call": Phone,
  "WhatsApp Message": MessageCircle,
  Email: Mail,
  Meeting: Users,
  "Site Visit": MapPin,
};
const COLORS = {
  "Phone Call": "#3E6FA3",
  "WhatsApp Message": "#2F5D50",
  Email: "#8B5FBF",
  Meeting: "#E8A33D",
  "Site Visit": "#C1443C",
};

export default function Activities() {
  const [activities, setActivities] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([api.get("/activities"), api.get("/users")]).then(([a, u]) => {
      setActivities(a.data.sort((x, y) => new Date(y.timestamp) - new Date(x.timestamp)));
      setUsers(u.data);
      setLoading(false);
    });
  }, []);

  const userName = (id) => users.find((u) => u.id === id)?.name || "System";

  return (
    <div>
      <PageHeader title="Activities" subtitle="Every touchpoint, logged automatically." />
      <Card className="p-5">
        {loading ? (
          <div className="text-ink/40 text-sm">Loading…</div>
        ) : activities.length === 0 ? (
          <EmptyState title="No activity yet" subtitle="Calls, messages, and meetings will show up here." />
        ) : (
          <div className="space-y-0.5">
            {activities.map((a) => {
              const Icon = ICONS[a.type] || Phone;
              return (
                <div key={a.id} className="flex gap-3 py-3 border-b border-border last:border-0">
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
                    style={{ background: `${COLORS[a.type]}18`, color: COLORS[a.type] }}
                  >
                    <Icon size={14} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm">{a.summary}</p>
                    <p className="text-xs text-ink/40 mt-0.5">{userName(a.performedBy)} · {timeAgo(a.timestamp)}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}
