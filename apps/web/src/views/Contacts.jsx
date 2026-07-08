import { useEffect, useState } from "react";
import { FileText, MapPin, ShoppingBag } from "lucide-react";
import api from "../api/client";
import { Card, PageHeader, EmptyState } from "../components/ui";
import { formatINR, formatDate } from "../lib/format";

export default function Contacts() {
  const [contacts, setContacts] = useState([]);
  const [active, setActive] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get("/contacts").then((r) => {
      setContacts(r.data);
      setActive(r.data[0] || null);
      setLoading(false);
    });
  }, []);

  return (
    <div>
      <PageHeader title="Contacts" subtitle="Customers who were once leads — full history, one place." />

      {loading ? (
        <div className="text-ink/40 text-sm">Loading…</div>
      ) : contacts.length === 0 ? (
        <Card><EmptyState title="No contacts yet" subtitle="Convert a lead to see it appear here." /></Card>
      ) : (
        <div className="grid grid-cols-3 gap-4">
          <Card className="p-2 h-fit max-h-[70vh] overflow-y-auto">
            {contacts.map((c) => (
              <button
                key={c.id}
                onClick={() => setActive(c)}
                className={`w-full text-left p-3 rounded-lg mb-1 ${active?.id === c.id ? "bg-primary/8" : "hover:bg-base"}`}
              >
                <div className="font-medium text-sm">{c.name}</div>
                <div className="text-xs text-ink/40">{c.mobile}</div>
              </button>
            ))}
          </Card>

          {active && (
            <div className="col-span-2 space-y-4">
              <Card className="p-5">
                <div className="flex items-center gap-3 mb-1">
                  <div className="w-11 h-11 rounded-full bg-primary text-white flex items-center justify-center font-display font-semibold">
                    {active.name.split(" ").map((n) => n[0]).join("")}
                  </div>
                  <div>
                    <h3 className="font-display font-semibold text-lg">{active.name}</h3>
                    <p className="text-xs text-ink/40">{active.mobile} · {active.email}</p>
                  </div>
                </div>
                <div className="flex items-start gap-2 mt-4 text-sm text-ink/60">
                  <MapPin size={15} className="mt-0.5 shrink-0" />
                  {active.address || "No address on file"}
                </div>
              </Card>

              <Card className="p-5">
                <div className="flex items-center gap-2 mb-3">
                  <ShoppingBag size={16} className="text-primary" />
                  <h4 className="font-display font-semibold">Purchase History</h4>
                </div>
                {(active.purchaseHistory || []).length === 0 ? (
                  <p className="text-sm text-ink/40">No purchases recorded.</p>
                ) : (
                  <div className="space-y-2">
                    {active.purchaseHistory.map((p) => (
                      <div key={p.id} className="flex justify-between text-sm border-b border-border last:border-0 pb-2 last:pb-0">
                        <span>{p.product}</span>
                        <span className="font-mono text-ink/60">{formatINR(p.amount)} · {formatDate(p.date)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </Card>

              <Card className="p-5">
                <h4 className="font-display font-semibold mb-2">Notes</h4>
                <p className="text-sm text-ink/60">{active.notes || "No notes yet."}</p>
              </Card>

              <Card className="p-5">
                <div className="flex items-center gap-2 mb-3">
                  <FileText size={16} className="text-primary" />
                  <h4 className="font-display font-semibold">Documents</h4>
                </div>
                {(active.documents || []).length === 0 ? (
                  <p className="text-sm text-ink/40">No documents uploaded.</p>
                ) : (
                  <div className="space-y-1.5">
                    {active.documents.map((d) => (
                      <div key={d.id} className="text-sm text-primary hover:underline cursor-pointer">{d.name}</div>
                    ))}
                  </div>
                )}
              </Card>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
