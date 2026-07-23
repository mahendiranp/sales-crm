import { useEffect, useState } from "react";
import { Plus, Send, LifeBuoy, Paperclip, X as XIcon, Star, Camera } from "lucide-react";
import api from "../api/client";
import { useAuth } from "../context/AuthContext";
import { Card, PageHeader, Button, Badge, Modal, Field, inputCls, EmptyState } from "../components/ui";
import { timeAgo } from "../lib/format";
import useLiveCollection from "../lib/useLiveCollection";
import { collectDiagnostics } from "../lib/feedbackDiagnostics";
import { APP_VERSION } from "../lib/brand";

const STATUS_LABEL = { open: "Open", in_progress: "In Progress", resolved: "Resolved" };
const STATUS_OPTIONS = ["open", "in_progress", "resolved"];

// Values match the backend's CATEGORIES allowlist exactly (routes/feedback.js).
// "bug" is only offered when Report an Issue is selected — everything else
// is available for both ticket types.
const CATEGORIES = [
  { value: "feature_request", label: "💡 Feature Request" },
  { value: "general_feedback", label: "👍 General Feedback" },
  { value: "ui_ux", label: "🎨 UI/UX" },
  { value: "performance", label: "⚡ Performance" },
  { value: "ai_quality", label: "🤖 AI Quality" },
  { value: "integrations", label: "🔗 Integrations" },
  { value: "forms", label: "📋 Forms" },
];
const BUG_CATEGORY = { value: "bug", label: "🐞 Bug" };

const SEVERITIES = [
  { value: "critical", label: "Critical" },
  { value: "high", label: "High" },
  { value: "medium", label: "Medium" },
  { value: "low", label: "Low" },
];

// Shared by the modal's stars and the read-only display in a submitted
// ticket's thread header — `onChange` omitted makes it read-only.
function StarRating({ value, onChange }) {
  const [hover, setHover] = useState(0);
  const readOnly = !onChange;
  return (
    <div className="flex items-center gap-1" onMouseLeave={() => setHover(0)}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          disabled={readOnly}
          onMouseEnter={() => !readOnly && setHover(n)}
          onClick={() => onChange?.(n)}
          className={readOnly ? "cursor-default" : "cursor-pointer"}
          aria-label={`${n} star${n === 1 ? "" : "s"}`}
        >
          <Star
            size={20}
            className={(hover || value) >= n ? "text-amber-400" : "text-ink/15"}
            fill={(hover || value) >= n ? "currentColor" : "none"}
          />
        </button>
      ))}
    </div>
  );
}

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

// Captures the current tab via the browser's native Screen/Tab Capture
// API — there's no way to silently screenshot a page from JS (real
// browsers deliberately require an explicit user gesture + a picker for
// this, for the obvious reason that silent screenshotting would be a
// serious privacy hole), so "automatic" here means "one click starts the
// capture and it resolves as soon as the browser hands back a frame," not
// "no permission prompt at all" — that prompt is unavoidable by design.
// Returns a { name, type, dataUrl } object, same shape as a picked file.
async function captureScreenshot() {
  if (!navigator.mediaDevices?.getDisplayMedia) {
    throw new Error("Screenshot capture isn't supported in this browser.");
  }
  const stream = await navigator.mediaDevices.getDisplayMedia({ video: { displaySurface: "browser" } });
  try {
    // A <video> element + canvas.drawImage is the broadly-supported path
    // (Chrome/Edge/Firefox/Safari all support MediaStream -> <video>) —
    // the ImageCapture API that would skip this step is still Chromium-only.
    const video = document.createElement("video");
    video.srcObject = stream;
    await video.play();
    // The stream's first frame can arrive a tick after play() resolves —
    // wait for real dimensions instead of capturing a blank 0x0 frame.
    if (!video.videoWidth) {
      await new Promise((resolve) => video.addEventListener("loadedmetadata", resolve, { once: true }));
    }
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d").drawImage(video, 0, 0);
    const dataUrl = canvas.toDataURL("image/png");
    return { name: "screenshot.png", type: "image/png", dataUrl };
  } finally {
    stream.getTracks().forEach((t) => t.stop());
  }
}

// Small attach-screenshot control shared by the new-ticket form and the
// reply box — pick a file or capture one, get back a
// { name, type, dataUrl } object (or null), with a thumbnail + remove
// button once picked. `allowCapture` shows the "Take Screenshot" button
// (the reply box skips it — capturing mid-conversation is a less common
// need, and keeps that toolbar simple).
function ImageAttachButton({ value, onChange, allowCapture }) {
  const [error, setError] = useState("");
  const [capturing, setCapturing] = useState(false);

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

  const handleCapture = async () => {
    setError("");
    setCapturing(true);
    try {
      onChange(await captureScreenshot());
    } catch (err) {
      // AbortError/NotAllowedError just means the user cancelled the
      // picker or denied the prompt — not a real error worth surfacing.
      if (err?.name !== "AbortError" && err?.name !== "NotAllowedError") {
        setError(err.message || "Couldn't capture a screenshot.");
      }
    } finally {
      setCapturing(false);
    }
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
      <div className="flex items-center gap-3 flex-wrap">
        <label className="inline-flex items-center gap-1.5 text-xs text-ink/50 hover:text-primary cursor-pointer">
          <Paperclip size={13} />
          📷 Attach screenshot (optional)
          <input type="file" accept="image/*" onChange={handleFile} className="hidden" />
        </label>
        {allowCapture && (
          <button
            type="button"
            onClick={handleCapture}
            disabled={capturing}
            className="inline-flex items-center gap-1.5 text-xs text-ink/50 hover:text-primary disabled:opacity-50"
          >
            <Camera size={13} />
            {capturing ? "Capturing…" : "Take Screenshot"}
          </button>
        )}
      </div>
      {error && <p className="text-xs text-danger mt-1">{error}</p>}
    </div>
  );
}

function NewTicketModal({ open, onClose, onCreated }) {
  const { user } = useAuth();
  const [subject, setSubject] = useState("");
  const [type, setType] = useState("feedback");
  const [category, setCategory] = useState("");
  const [rating, setRating] = useState(0);
  const [message, setMessage] = useState("");
  const [severity, setSeverity] = useState("medium");
  const [whatWereYouDoing, setWhatWereYouDoing] = useState("");
  const [whatHappened, setWhatHappened] = useState("");
  const [whatExpected, setWhatExpected] = useState("");
  const [attachment, setAttachment] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const categoryOptions = type === "issue" ? [...CATEGORIES, BUG_CATEGORY] : CATEGORIES;

  useEffect(() => {
    if (open) {
      setSubject("");
      setType("feedback");
      setCategory("");
      setRating(0);
      setMessage("");
      setSeverity("medium");
      setWhatWereYouDoing("");
      setWhatHappened("");
      setWhatExpected("");
      setAttachment(null);
      setError("");
    }
  }, [open]);

  // Switching type away from "issue" after picking "bug" would otherwise
  // leave category pointing at an option no longer offered.
  const changeType = (next) => {
    setType(next);
    if (next !== "issue" && category === "bug") setCategory("");
  };

  const submit = async () => {
    if (!subject.trim() || !message.trim()) {
      setError("Subject and message are both required.");
      return;
    }
    if (!category) {
      setError("Please choose a category.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const { data } = await api.post("/feedback", {
        subject,
        message,
        type,
        category,
        rating: type === "feedback" && rating ? rating : null,
        severity: type === "issue" ? severity : null,
        whatWereYouDoing: type === "issue" ? whatWereYouDoing : null,
        whatHappened: type === "issue" ? whatHappened : null,
        whatExpected: type === "issue" ? whatExpected : null,
        attachment,
        diagnostics: collectDiagnostics(user, APP_VERSION),
      });
      onCreated(data);
    } catch (err) {
      setError(err.response?.data?.error || "Couldn't submit that.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="New Feedback or Issue">
      <div className="flex gap-2 mb-4">
        {[{ key: "feedback", label: "Feedback" }, { key: "issue", label: "Report an Issue" }].map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => changeType(t.key)}
            className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium border ${
              type === t.key ? "bg-primary text-white border-primary" : "border-border text-ink/60"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {type === "feedback" && (
        <Field label="How would you rate your experience?">
          <StarRating value={rating} onChange={setRating} />
        </Field>
      )}

      <Field label="Category" required>
        <select className={inputCls} value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="" disabled>Choose a category…</option>
          {categoryOptions.map((c) => (
            <option key={c.value} value={c.value}>{c.label}</option>
          ))}
        </select>
      </Field>

      <Field label="Subject" required>
        <input
          className={inputCls}
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder='Brief summary (e.g. "Need more form templates")'
          autoFocus
        />
      </Field>

      <Field label="Message" required>
        <textarea
          className={inputCls}
          rows={4}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Tell us what happened or what you'd like to see. The more details you provide, the better we can help."
        />
      </Field>

      {type === "issue" && (
        <>
          <Field label="Severity">
            <select className={inputCls} value={severity} onChange={(e) => setSeverity(e.target.value)}>
              {SEVERITIES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </Field>
          <Field label="What were you trying to do?">
            <textarea className={inputCls} rows={2} value={whatWereYouDoing} onChange={(e) => setWhatWereYouDoing(e.target.value)} />
          </Field>
          <Field label="What happened?">
            <textarea className={inputCls} rows={2} value={whatHappened} onChange={(e) => setWhatHappened(e.target.value)} />
          </Field>
          <Field label="What did you expect to happen?">
            <textarea className={inputCls} rows={2} value={whatExpected} onChange={(e) => setWhatExpected(e.target.value)} />
          </Field>
        </>
      )}

      <div className="mb-3">
        <ImageAttachButton value={attachment} onChange={setAttachment} allowCapture />
      </div>

      <p className="text-xs text-ink/40 mb-3">✓ Diagnostic information will be included automatically to help us investigate.</p>

      {error && <p className="text-xs text-danger mb-2">{error}</p>}

      <div className="flex justify-end gap-2 mt-2">
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button onClick={submit} disabled={saving}>{saving ? "Sending…" : "Send"}</Button>
      </div>
      <p className="text-xs text-ink/35 text-right mt-2">We'll review your feedback and usually respond within 1–2 business days.</p>
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
          <p className="font-medium text-sm">
            {ticket.ticketNumber && <span className="text-ink/40 font-normal">#{ticket.ticketNumber} · </span>}
            {ticket.subject}
          </p>
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

      {(ticket.category || ticket.rating || ticket.severity || ticket.diagnostics) && (
        <div className="flex flex-wrap items-center gap-2 px-4 py-2 border-b border-border bg-base/50 text-xs">
          {ticket.category && (
            <Badge>{[...CATEGORIES, BUG_CATEGORY].find((c) => c.value === ticket.category)?.label || ticket.category}</Badge>
          )}
          {ticket.severity && <Badge>{SEVERITIES.find((s) => s.value === ticket.severity)?.label || ticket.severity} severity</Badge>}
          {ticket.rating && <StarRating value={ticket.rating} />}
          {isMasterAdmin && ticket.diagnostics && (
            <span className="text-ink/35 truncate">
              {[ticket.diagnostics.browser, ticket.diagnostics.os, ticket.diagnostics.screenResolution, ticket.diagnostics.appVersion && `v${ticket.diagnostics.appVersion}`]
                .filter(Boolean)
                .join(" · ")}
            </span>
          )}
        </div>
      )}

      {isMasterAdmin && (ticket.whatWereYouDoing || ticket.whatHappened || ticket.whatExpected) && (
        <div className="px-4 py-2.5 border-b border-border bg-base/30 text-xs space-y-1">
          {ticket.whatWereYouDoing && <p><span className="font-medium text-ink/60">Trying to do:</span> {ticket.whatWereYouDoing}</p>}
          {ticket.whatHappened && <p><span className="font-medium text-ink/60">What happened:</span> {ticket.whatHappened}</p>}
          {ticket.whatExpected && <p><span className="font-medium text-ink/60">Expected:</span> {ticket.whatExpected}</p>}
        </div>
      )}

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
  const [justSubmitted, setJustSubmitted] = useState(false);

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

      {justSubmitted && (
        <div className="mb-4 px-4 py-3 rounded-lg bg-primary/8 border border-primary/20 text-sm text-primary font-medium">
          🎉 Thanks for your feedback! Every suggestion helps us improve Flowora.
        </div>
      )}

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
                  <p className="text-sm font-medium truncate">
                    {t.ticketNumber && <span className="text-ink/40 font-normal">#{t.ticketNumber} · </span>}
                    {t.subject}
                  </p>
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
          setJustSubmitted(true);
          setTimeout(() => setJustSubmitted(false), 6000);
        }}
      />
    </div>
  );
}
