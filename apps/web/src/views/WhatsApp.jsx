import { useEffect, useState } from "react";
import { Send, Sparkles, Check, CheckCheck } from "lucide-react";
import api from "../api/client";
import { useAuth } from "../context/AuthContext";
import { Card, PageHeader, Button, EmptyState } from "../components/ui";
import { timeAgo } from "../lib/format";
import useLiveCollection from "../lib/useLiveCollection";

export default function WhatsApp() {
  const { canManage } = useAuth();
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState("");
  const [suggestion, setSuggestion] = useState("");
  const [loading, setLoading] = useState(true);

  const load = () => {
    api.get("/whatsapp").then((r) => {
      setMessages(r.data.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)));
      setLoading(false);
    });
  };
  useEffect(() => {
    load();
  }, []);
  useLiveCollection(["whatsapp_messages"], load);

  const lastInbound = messages.find((m) => m.direction === "inbound");

  const getAiSuggestion = async () => {
    const text = lastInbound?.message || draft;
    const r = await api.post("/whatsapp/ai-suggest", { message: text });
    setSuggestion(r.data.suggestion);
  };

  const send = async (message) => {
    if (!message) return;
    await api.post("/whatsapp/send", { leadId: lastInbound?.leadId, contactName: lastInbound?.contactName || "Customer", message });
    setDraft("");
    setSuggestion("");
    load();
  };

  return (
    <div>
      <PageHeader title="WhatsApp" subtitle="Templates, bulk messages, and AI-suggested replies." />

      <div className="grid grid-cols-3 gap-4">
        <Card className="col-span-2 p-0 flex flex-col h-[65vh]">
          <div className="p-4 border-b border-border font-display font-semibold">Recent Conversations</div>
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {loading ? (
              <div className="text-ink/40 text-sm">Loading…</div>
            ) : messages.length === 0 ? (
              <EmptyState title="No messages yet" />
            ) : (
              messages.slice().reverse().map((m) => (
                <div key={m.id} className={`flex ${m.direction === "outbound" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[70%] rounded-2xl px-3.5 py-2 text-sm ${
                    m.direction === "outbound" ? "bg-primary text-white rounded-br-sm" : "bg-base text-ink rounded-bl-sm"
                  }`}>
                    <p>{m.message}</p>
                    <div className={`flex items-center gap-1 mt-1 text-[10px] ${m.direction === "outbound" ? "text-white/60" : "text-ink/40"}`}>
                      {m.aiSuggested && <Sparkles size={10} />}
                      {timeAgo(m.timestamp)}
                      {m.direction === "outbound" && (m.status === "read" ? <CheckCheck size={11} /> : <Check size={11} />)}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
          <div className="p-3 border-t border-border">
            {!canManage && (
              <p className="text-xs text-ink/40 text-center py-2">View-only account — messaging is disabled.</p>
            )}
            {canManage && suggestion && (
              <div className="mb-2 flex items-center justify-between bg-accent/10 border border-accent/25 rounded-lg px-3 py-2 text-sm">
                <span className="flex items-center gap-1.5"><Sparkles size={13} className="text-accent" /> {suggestion}</span>
                <button className="text-xs font-medium text-primary shrink-0 ml-2" onClick={() => send(suggestion)}>Send</button>
              </div>
            )}
            {canManage && (
              <div className="flex gap-2">
                <input
                  className="flex-1 border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-primary"
                  placeholder="Type a message…"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && send(draft)}
                />
                <Button variant="secondary" onClick={getAiSuggestion}><Sparkles size={15} /></Button>
                <Button onClick={() => send(draft)}><Send size={15} /></Button>
              </div>
            )}
          </div>
        </Card>

        <Card className="p-5">
          <h4 className="font-display font-semibold mb-3">AI Reply Example</h4>
          <div className="text-xs text-ink/50 mb-2">Customer:</div>
          <div className="bg-base rounded-lg px-3 py-2 text-sm mb-3">Is this available?</div>
          <div className="text-xs text-ink/50 mb-2 flex items-center gap-1"><Sparkles size={11} className="text-accent" /> AI Suggestion:</div>
          <div className="bg-accent/10 border border-accent/25 rounded-lg px-3 py-2 text-sm">
            Yes. It is available. Would you like a demo tomorrow?
          </div>
        </Card>
      </div>
    </div>
  );
}
