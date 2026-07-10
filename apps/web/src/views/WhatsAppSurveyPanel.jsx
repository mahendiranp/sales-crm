import { useEffect, useRef, useState } from "react";
import { Send, MessageCircle, CheckCircle2, Clock3, ArrowLeft, Smartphone, PowerOff } from "lucide-react";
import api from "../api/client";
import { useAuth } from "../context/AuthContext";
import { Card, Button, Field, inputCls, Badge, EmptyState, Switch } from "../components/ui";
import { timeAgo } from "../lib/format";

function chatTime(dateStr) {
  return new Date(dateStr).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
}
import useLiveCollection from "../lib/useLiveCollection";

function ChatBubble({ msg }) {
  const isCustomer = msg.direction === "inbound";
  return (
    <div className={`flex ${isCustomer ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[75%] rounded-2xl px-3.5 py-2.5 text-sm whitespace-pre-wrap ${
          isCustomer ? "bg-primary text-white rounded-br-sm" : "bg-white border border-border rounded-bl-sm"
        }`}
      >
        {msg.message}
        <div className={`text-[10px] mt-1 ${isCustomer ? "text-white/70" : "text-ink/35"}`}>{chatTime(msg.timestamp)}</div>
      </div>
    </div>
  );
}

// Renders the right input control for the current question's field type —
// so the person testing the survey clicks an answer instead of having to
// know the expected reply format (numbers, "Yes"/"No", comma-separated…).
function ReplyControl({ field, onSend, sending }) {
  const [checked, setChecked] = useState([]);
  const [text, setText] = useState("");

  useEffect(() => {
    setChecked([]);
    setText("");
  }, [field?.id]);

  if (!field) return null;

  if (field.type === "yesno") {
    return (
      <div className="flex gap-2">
        <Button className="flex-1 justify-center" onClick={() => onSend("Yes")} disabled={sending}>Yes</Button>
        <Button variant="secondary" className="flex-1 justify-center" onClick={() => onSend("No")} disabled={sending}>No</Button>
      </div>
    );
  }

  if (field.type === "rating") {
    return (
      <div className="flex gap-2">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            disabled={sending}
            onClick={() => onSend(String(n))}
            className="flex-1 h-10 rounded-lg border border-border hover:border-primary hover:bg-primary/5 text-sm font-medium"
          >
            {n}★
          </button>
        ))}
      </div>
    );
  }

  if (field.type === "dropdown" || field.type === "radio") {
    return (
      <div className="flex flex-col gap-1.5">
        {field.options.map((o, i) => (
          <button
            key={o}
            disabled={sending}
            onClick={() => onSend(String(i + 1))}
            className="text-left px-3 py-2 rounded-lg border border-border hover:border-primary hover:bg-primary/5 text-sm"
          >
            {o}
          </button>
        ))}
      </div>
    );
  }

  if (field.type === "checkbox") {
    const toggle = (i) => setChecked((c) => (c.includes(i) ? c.filter((x) => x !== i) : [...c, i]));
    return (
      <div>
        <div className="flex flex-col gap-1.5 mb-2">
          {field.options.map((o, i) => (
            <button
              key={o}
              disabled={sending}
              onClick={() => toggle(i + 1)}
              className={`text-left px-3 py-2 rounded-lg border text-sm ${
                checked.includes(i + 1) ? "border-primary bg-primary/5" : "border-border"
              }`}
            >
              {checked.includes(i + 1) ? "☑" : "☐"} {o}
            </button>
          ))}
        </div>
        <Button className="w-full justify-center" disabled={sending || checked.length === 0} onClick={() => onSend(checked.join(","))}>
          Send Selection
        </Button>
      </div>
    );
  }

  const placeholder =
    field.type === "email" ? "you@example.com" : field.type === "date" ? "YYYY-MM-DD" : field.type === "number" ? "Enter a number" : "Type a reply…";

  return (
    <div className="flex items-center gap-2">
      <input
        className={`${inputCls} flex-1`}
        placeholder={placeholder}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && text.trim()) {
            onSend(text);
            setText("");
          }
        }}
      />
      <Button
        onClick={() => {
          if (text.trim()) {
            onSend(text);
            setText("");
          }
        }}
        disabled={sending || !text.trim()}
      >
        <Send size={14} />
      </Button>
    </div>
  );
}

function SessionChat({ session, onBack }) {
  const [detail, setDetail] = useState(null);
  const [thread, setThread] = useState([]);
  const [sending, setSending] = useState(false);
  const bottomRef = useRef(null);

  const load = () => {
    api.get(`/whatsapp-surveys/${session.id}`).then((r) => setDetail(r.data));
    api.get(`/whatsapp-surveys/${session.id}/messages`).then((r) => setThread(r.data));
  };
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.id]);
  useLiveCollection(["whatsapp_messages", "survey_sessions"], load);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [thread.length]);

  const send = async (text) => {
    setSending(true);
    await api.post("/whatsapp-surveys/simulate-reply", { phone: session.phone, text });
    setSending(false);
  };

  const isComplete = detail?.session.status === "completed";
  const answered = Object.keys(detail?.session.answers || {}).length;
  const total = detail?.form.fields.length || 0;

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <button onClick={onBack} className="text-ink/50 hover:text-ink">
          <ArrowLeft size={16} />
        </button>
        <Smartphone size={15} className="text-primary" />
        <span className="text-sm font-medium">{session.phone}</span>
        <Badge>{isComplete ? "Completed" : "In Progress"}</Badge>
        <span className="text-xs text-ink/40 ml-auto">{answered} / {total} answered</span>
      </div>

      <div className="bg-base rounded-lg p-3 h-80 overflow-y-auto space-y-2.5 mb-3">
        {thread.map((m) => <ChatBubble key={m.id} msg={m} />)}
        <div ref={bottomRef} />
      </div>

      {isComplete ? (
        <div className="text-center text-sm text-primary bg-primary/5 border border-primary/20 rounded-lg py-3">
          <CheckCircle2 size={16} className="inline mr-1.5 -mt-0.5" /> Survey completed — response saved.
        </div>
      ) : (
        <ReplyControl field={detail?.currentField} onSend={send} sending={sending} />
      )}
    </div>
  );
}

function SessionListRow({ session, totalFields, onOpen }) {
  const answered = Object.keys(session.answers || {}).length;
  return (
    <button onClick={onOpen} className="w-full text-left border border-border rounded-lg p-3 hover:bg-base transition-colors">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MessageCircle size={15} className="text-primary" />
          <span className="text-sm font-medium">{session.phone}</span>
          <Badge>{session.status === "completed" ? "Completed" : "In Progress"}</Badge>
        </div>
        <span className="text-xs text-ink/40">{timeAgo(session.startedAt)}</span>
      </div>
      <div className="text-xs text-ink/50 mt-1.5 flex items-center gap-1.5">
        {session.status === "completed" ? <CheckCircle2 size={13} className="text-primary" /> : <Clock3 size={13} />}
        {answered} / {totalFields} questions answered
      </div>
    </button>
  );
}

export default function WhatsAppSurveyPanel({ form }) {
  const { isMasterAdmin } = useAuth();
  const [sessions, setSessions] = useState([]);
  const [config, setConfig] = useState(null);
  const [phone, setPhone] = useState("");
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState("");
  const [openSession, setOpenSession] = useState(null);
  const [toggling, setToggling] = useState(false);

  const loadConfig = () => api.get("/whatsapp-surveys/config").then((r) => setConfig(r.data));
  const load = () => api.get(`/whatsapp-surveys?formId=${form.id}`).then((r) => setSessions(r.data));
  useEffect(() => {
    load();
    loadConfig();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.id]);
  useLiveCollection(["survey_sessions"], load);
  useLiveCollection(["settings"], loadConfig);

  const toggleBot = async (next) => {
    setToggling(true);
    const { data: current } = await api.get("/settings");
    await api.put("/settings", { apps: { ...current.apps, whatsappBot: next } });
    await loadConfig();
    setToggling(false);
  };

  const startSurvey = async () => {
    if (!phone.trim()) return;
    setError("");
    setStarting(true);
    try {
      const { data } = await api.post("/whatsapp-surveys", { formId: form.id, phone });
      setPhone("");
      load();
      setOpenSession(data);
    } catch (err) {
      setError(err.response?.data?.error || "Couldn't start the survey.");
    } finally {
      setStarting(false);
    }
  };

  if (form.status !== "Published") {
    return (
      <Card className="p-6 text-center">
        <p className="text-sm text-ink/50">Publish this form first to send it as a WhatsApp survey.</p>
      </Card>
    );
  }

  if (config && !config.enabled) {
    return (
      <Card className="p-6 text-center">
        <PowerOff size={22} className="text-ink/30 mx-auto mb-2" />
        <p className="text-sm font-medium text-ink/70">The WhatsApp bot is turned off</p>
        <p className="text-xs text-ink/40 mt-1 max-w-sm mx-auto">
          {isMasterAdmin
            ? "No new surveys can be started or advanced while this is off."
            : "Ask your master admin to turn it back on to send WhatsApp surveys."}
        </p>
        {isMasterAdmin && (
          <div className="flex items-center justify-center gap-2 mt-4">
            <Switch checked={false} onChange={() => toggleBot(true)} disabled={toggling} />
            <span className="text-xs text-ink/50">Turn on</span>
          </div>
        )}
      </Card>
    );
  }

  if (openSession) {
    return <SessionChat session={openSession} onBack={() => setOpenSession(null)} />;
  }

  return (
    <div>
      {isMasterAdmin && (
        <div className="flex items-center justify-between bg-base border border-border rounded-lg px-3 py-2 mb-4">
          <span className="text-xs text-ink/60">WhatsApp bot</span>
          <div className="flex items-center gap-2">
            <span className="text-xs text-ink/40">On</span>
            <Switch checked={true} onChange={() => toggleBot(false)} disabled={toggling} />
          </div>
        </div>
      )}

      {config && !config.configured && (
        <div className="text-xs text-accent-dark bg-accent/10 border border-accent/25 rounded-lg p-3 mb-4">
          Running in <strong>mock mode</strong> — no WhatsApp Business API credentials are configured, so messages
          stay inside this app instead of going out over real WhatsApp. Start a survey below and try it like a chat —
          click the answer buttons to simulate the customer replying. Set{" "}
          <code className="bg-white px-1 rounded">WHATSAPP_ACCESS_TOKEN</code> and{" "}
          <code className="bg-white px-1 rounded">WHATSAPP_PHONE_NUMBER_ID</code> in the backend's{" "}
          <code className="bg-white px-1 rounded">.env</code> to send real messages.
        </div>
      )}

      <div className="flex items-end gap-2 mb-4">
        <div className="flex-1">
          <Field label="Customer's WhatsApp Number">
            <input
              className={inputCls}
              placeholder="+91 98765 43210"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && startSurvey()}
            />
          </Field>
        </div>
        <Button onClick={startSurvey} disabled={starting} className="mb-3.5">
          <Send size={15} /> Start Survey
        </Button>
      </div>
      {error && <p className="text-sm text-danger mb-4">{error}</p>}

      {sessions.length === 0 ? (
        <EmptyState icon={MessageCircle} title="No WhatsApp surveys sent yet" subtitle="Enter a number above to start one." />
      ) : (
        <div className="space-y-2">
          {sessions.map((s) => (
            <SessionListRow key={s.id} session={s} totalFields={form.fields.length} onOpen={() => setOpenSession(s)} />
          ))}
        </div>
      )}
    </div>
  );
}
