import { useEffect, useState } from "react";
import { Plus, Send, LifeBuoy, Paperclip, X as XIcon } from "lucide-react";
import api from "../api/client";
import { useAuth } from "../context/AuthContext";
import { Card, PageHeader, Button, Badge, Modal, Field, inputCls, EmptyState } from "../components/ui";
import { timeAgo } from "../lib/format";
import useLiveCollection from "../lib/useLiveCollection";

const STATUS_LABEL = { open: "Open", in_progress: "In Progress", resolved: "Resolved" };
const STATUS_OPTIONS = ["open", "in_progress", "resolved"];

// Same allowlist/size cap enforced server-side (utils/fileUploads.js's
// validateImageAnswer) — this is UX only, the real gate is on the backend.
const MAX_IMAGE_BYTES = 3 * 1024 * 1024;

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// Small attach-image control shared by the new-ticket form and the reply
// box — pick a file, get back a { name, type, dataUrl } object (or null),
// with a thumbnail + remove button once picked.
function ImageAttachButton({ value, onChange }) {
  const [error, setError] = useState("");

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Only image files are allowed.");
      e.target.value = "";
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setError("Image is too large — max 3MB.");
      e.target.value = "";
      return;
    }
    setError("");
    onChange({ name: file.name, type: file.type, dataUrl: await fileToDataUrl(file) });
    e.target.value = "";
  };

  if (value) {
    return (
      <div className="flex items-center gap-2">
        <img src={value.dataUrl} alt={value.name} className="w-10 h-10 rounded-md object-cover border border-border" />
        <button type="button" onClick={() => onChange(null)} className="text-ink/30 hover:text-danger" title="Remove image">
          <XIcon size={14} />
        </button>
      </div>
    );
  }

  return (
    <div>
      <label className="inline-flex items-center gap-1.5 text-xs text-ink/50 hover:text-primary cursor-pointer">
        <Paperclip size={13} />
        Attach image
        <input type="file" accept="image/*" onChange={handleFile} className="hidden" />
      </label>
      {error && <p className="text-xs text-danger mt-1">{error}</p>}
    </div>
  );
}

function NewTicketModal({ open, onClose, onCreated }) {
  const [subject, setSubject] = useState("");
  const [type, setType] = useState("feedback");
  const [message, setMessage] = useState("");
  const [attachment, setAttachment] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setSubject("");
      setType("feedback");
      setMessage("");
      setAttachment(null);
      setError("");
    }
  }, [open]);

  const submit = async () => {
    if (!subject.trim() || !message.trim()) {
      setError("Subject and message are both required.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const { data } = await api.post("/feedback", { subject, message, type, attachment });
      onCreated(data);
    } catch (err) {
      setError(err.response?.data?.error || "Couldn't submit that.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="New Feedback or Issue">
      <div className="flex gap-2 mb-3">
        {[{ key: "feedback", label: "Feedback" }, { key: "issue", label: "Report an Issue" }].map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setType(t.key)}
            className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium border ${
              type === t.key ? "bg-primary text-white border-primary" : "border-border text-ink/60"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <Field label="Subject">
        <input className={inputCls} value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Short summary" autoFocus />
      </Field>
      <Field label="Message">
        <textarea
          className={inputCls}
          rows={5}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder={type === "issue" ? "What went wrong? Steps to reproduce, if any." : "What's on your mind?"}
        />
      </Field>
      <div className="mb-3">
        <ImageAttachButton value={attachment} onChange={setAttachment} />
      </div>
      {error && <p className="text-xs text-danger mb-2">{error}</p>}
      <div className="flex justify-end gap-2 mt-2">
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button onClick={submit} disabled={saving}>{saving ? "Sending…" : "Send"}</Button>
      </div>
    </Modal>
  );
}

// Message thread + reply box, shared by both the master-admin and
// tenant-owner views — only the status dropdown at the top differs by role.
function TicketThread({ ticket, isMasterAdmin, currentUserId, onReplied, onStatusChanged }) {
  const [reply, setReply] = useState("");
  const [replyAttachment, setReplyAttachment] = useState(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  // A reply with only an attachment (no text) is still meaningful — don't
  // force a caption just to satisfy the "message required" validation.
  const sendReply = async () => {
    if (!reply.trim() && !replyAttachment) return;
    setSending(true);
    setError("");
    try {
      const { data } = await api.post(`/feedback/${ticket.id}/reply`, {
        message: reply.trim() || "(attached an image)",
        attachment: replyAttachment,
      });
      setReply("");
      setReplyAttachment(null);
      onReplied(data);
    } catch (err) {
      setError(err.response?.data?.error || "Couldn't send that reply.");
    } finally {
      setSending(false);
    }
  };

  const changeStatus = async (status) => {
    const { data } = await api.put(`/feedback/${ticket.id}/status`, { status });
    onStatusChanged(data);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between p-4 border-b border-border">
        <div>
          <p className="font-medium text-sm">{ticket.subject}</p>
          <p className="text-xs text-ink/40 mt-0.5">
            {ticket.type === "issue" ? "Issue" : "Feedback"}
            {ticket.companyName ? ` · ${ticket.companyName}` : ""} · {ticket.createdBy?.name}
          </p>
        </div>
        {isMasterAdmin ? (
          <select className={`${inputCls} w-40`} value={ticket.status} onChange={(e) => changeStatus(e.target.value)}>
            {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
          </select>
        ) : (
          <Badge>{STATUS_LABEL[ticket.status]}</Badge>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {ticket.messages.map((m) => {
          // "Mine" is relative to whoever's *looking* at the thread, not a
          // static role on the message — a master admin's own reply must
          // still show as "theirs" when the tenant views the same ticket,
          // and vice versa. isMasterAdmin on the message was previously
          // (incorrectly) used for both alignment and color, which made
          // every viewer see the same role-based split instead of a
          // sender-relative one.
          const mine = m.authorId === currentUserId;
          return (
            <div key={m.id} className={`max-w-[80%] ${mine ? "ml-auto text-right" : ""}`}>
              <div className={`inline-block text-left rounded-lg px-3 py-2 text-sm ${mine ? "bg-primary text-white" : "bg-base"}`}>
                {m.body}
                {m.attachment?.dataUrl && (
                  <a href={m.attachment.dataUrl} target="_blank" rel="noreferrer" className="block mt-1.5">
                    <img src={m.attachment.dataUrl} alt={m.attachment.name} className="max-h-48 rounded-md border border-border/50" />
                  </a>
                )}
              </div>
              <p className="text-[11px] text-ink/35 mt-0.5">
                {mine ? "You" : m.isMasterAdmin ? "Support" : m.authorName} · {timeAgo(m.createdAt)}
              </p>
            </div>
          );
        })}
      </div>

      <div className="p-3 border-t border-border">
        {error && <p className="text-xs text-danger mb-2">{error}</p>}
        <div className="flex items-end gap-2">
          <textarea
            className={`${inputCls} flex-1`}
            rows={2}
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            placeholder="Write a reply…"
          />
          <Button onClick={sendReply} disabled={sending || (!reply.trim() && !replyAttachment)}>
            <Send size={14} />
          </Button>
        </div>
        <div className="mt-2">
          <ImageAttachButton value={replyAttachment} onChange={setReplyAttachment} />
        </div>
      </div>
    </div>
  );
}

export default function Feedback() {
  const { isMasterAdmin, user } = useAuth();
  const [tickets, setTickets] = useState(null);
  const [activeId, setActiveId] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);

  const load = () =>
    api.get("/feedback").then((r) => {
      setTickets(r.data);
      // Keep the currently-open thread in sync (new replies, status
      // changes) instead of just refreshing the list and losing selection.
      setActiveId((prev) => (prev && r.data.some((t) => t.id === prev) ? prev : r.data[0]?.id || null));
    });
  useEffect(() => {
    load();
  }, []);
  useLiveCollection(["feedback"], load);

  if (tickets === null) return <div className="text-ink/40 text-sm">Loading…</div>;

  const active = tickets.find((t) => t.id === activeId) || null;

  return (
    <div>
      <PageHeader
        title="Feedback & Support"
        subtitle={
          isMasterAdmin
            ? "Every tenant's feedback and reported issues, in one inbox."
            : "Send feedback or report an issue directly to the platform team."
        }
        action={
          !isMasterAdmin && (
            <Button onClick={() => setModalOpen(true)}>
              <Plus size={15} /> New
            </Button>
          )
        }
      />

      {tickets.length === 0 ? (
        <Card className="p-10">
          <EmptyState
            icon={LifeBuoy}
            title="Nothing here yet"
            subtitle={isMasterAdmin ? "No tenant has submitted feedback or an issue yet." : "Submit feedback or report an issue to get started."}
          />
        </Card>
      ) : (
        <Card className="grid grid-cols-3 overflow-hidden" style={{ height: "calc(100vh - 220px)" }}>
          <div className="col-span-1 border-r border-border overflow-y-auto">
            {tickets.map((t) => (
              <button
                key={t.id}
                onClick={() => setActiveId(t.id)}
                className={`w-full text-left px-4 py-3 border-b border-border last:border-0 ${
                  activeId === t.id ? "bg-primary/5" : "hover:bg-base"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium truncate">{t.subject}</p>
                  <Badge>{STATUS_LABEL[t.status]}</Badge>
                </div>
                <p className="text-xs text-ink/40 mt-0.5 truncate">
                  {t.type === "issue" ? "Issue" : "Feedback"}
                  {t.companyName ? ` · ${t.companyName}` : ""}
                </p>
                <p className="text-[11px] text-ink/35 mt-1">{timeAgo(t.updatedAt)}</p>
              </button>
            ))}
          </div>
          <div className="col-span-2">
            {active && (
              <TicketThread
                ticket={active}
                isMasterAdmin={isMasterAdmin}
                currentUserId={user?.id}
                onReplied={(updated) => setTickets((ts) => ts.map((t) => (t.id === updated.id ? { ...updated, companyName: t.companyName } : t)))}
                onStatusChanged={(updated) => setTickets((ts) => ts.map((t) => (t.id === updated.id ? { ...updated, companyName: t.companyName } : t)))}
              />
            )}
          </div>
        </Card>
      )}

      <NewTicketModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onCreated={(ticket) => {
          setModalOpen(false);
          setTickets((ts) => [ticket, ...ts]);
          setActiveId(ticket.id);
        }}
      />
    </div>
  );
}
