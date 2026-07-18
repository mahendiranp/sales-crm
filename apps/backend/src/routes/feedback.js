const express = require("express");
const { randomUUID: uuid } = require("crypto");
const { collection, nextSequence } = require("../db/store");
const { requireManager } = require("../middleware/auth");
const { validateImageAnswer } = require("../utils/fileUploads");
const emailClient = require("../integrations/emailClient");
const { emailLayout } = require("../utils/emailTemplate");

const router = express.Router();
const feedback = collection("feedback");
const accounts = collection("accounts");

const SUPPORT_INBOX = "floworaone@gmail.com";

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

// Best-effort notification to the team inbox whenever a tenant opens a new
// ticket, or follows up on an existing one with a reply — never throws: a
// transient SMTP failure shouldn't turn an otherwise-successful submission
// into a 500 for the user filing it. `message` is whichever entry (the
// opening message, or a later reply) should be quoted in the email — always
// the specific one just added, never a stale/earlier one from the thread.
async function notifySupportInbox(ticket, account, message, { isReply = false } = {}) {
  try {
    const typeLabel = ticket.type === "issue" ? "Issue report" : "Feedback";
    const company = account?.company || account?.name || "Unknown account";
    const kind = isReply ? `Reply on ${typeLabel.toLowerCase()}` : `New ${typeLabel}`;
    // A short, sequential, human-friendly number (#1000, #1001, ...) rather
    // than a UUID fragment — easy to say out loud, write down, or search for
    // when following up, and guaranteed unique/ordered (see nextSequence in
    // db/store.js). Older tickets created before this existed won't have
    // one — fall back to the UUID so the email still has *some* reference.
    const ref = ticket.ticketNumber ? `#${ticket.ticketNumber}` : ticket.id;
    await emailClient.sendMail({
      to: SUPPORT_INBOX,
      subject: `[Flowora ${typeLabel} ${ref}] ${ticket.subject}`,
      html: emailLayout({
        preheader: `${kind} from ${company}`,
        heading: kind,
        bodyHtml: `
          <p><strong>Ticket:</strong> ${escapeHtml(ref)} <span style="color:#9CA3AF;">(${escapeHtml(ticket.id)})</span></p>
          <p><strong>From:</strong> ${escapeHtml(message.authorName)} (${escapeHtml(company)})</p>
          <p><strong>Subject:</strong> ${escapeHtml(ticket.subject)}</p>
          <p style="white-space:pre-wrap;">${escapeHtml(message.body)}</p>
          ${message.attachment ? "<p><em>(Includes an image attachment — view it in the Admin Portal.)</em></p>" : ""}
        `,
      }),
    });
  } catch {
    // Notification is a nice-to-have — the ticket/reply itself is already saved.
  }
}

const STATUSES = ["open", "in_progress", "resolved"];

// Same "owner or master admin" check used elsewhere (payments, team
// management) — a teammate shouldn't be able to open support tickets or
// see the company's correspondence with the platform on the owner's behalf.
function isOwner(req) {
  return req.user.isMasterAdmin || req.user.authRole === "admin";
}

// Master admin sees every tenant's tickets (with the company name attached,
// since ticket rows alone don't say who they're from); a regular owner only
// ever sees their own account's.
router.get("/", requireManager, async (req, res) => {
  if (!isOwner(req)) {
    return res.status(403).json({ error: "Only the account owner can view feedback and support tickets." });
  }
  const all = await feedback.all();
  if (req.user.isMasterAdmin) {
    const allAccounts = await accounts.all();
    const nameFor = (accountId) => allAccounts.find((a) => a.id === accountId)?.company || allAccounts.find((a) => a.id === accountId)?.name || "Unknown";
    const withCompany = all.map((t) => ({ ...t, companyName: nameFor(t.accountId) }));
    return res.json(withCompany.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)));
  }
  const mine = all.filter((t) => t.accountId === req.user.accountId).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  res.json(mine);
});

router.post("/", requireManager, async (req, res) => {
  if (!isOwner(req)) {
    return res.status(403).json({ error: "Only the account owner can submit feedback or report an issue." });
  }
  const { subject, message, type, attachment } = req.body;
  if (!subject?.trim() || !message?.trim()) {
    return res.status(400).json({ error: "Subject and message are required." });
  }
  // Same allowlist/size/magic-byte re-check pattern as form file uploads
  // (utils/fileUploads.js) — the client's checks are UX only, not a
  // security boundary, and this is an image-only attachment (not the full
  // file-type allowlist forms support).
  const attachmentError = validateImageAnswer("Attachment", attachment);
  if (attachmentError) return res.status(400).json({ error: attachmentError });

  const now = new Date().toISOString();
  const ticketNumber = await nextSequence("feedback_ticket", 1000);
  const ticket = {
    id: uuid(),
    ticketNumber,
    accountId: req.user.accountId,
    subject: subject.trim(),
    type: type === "issue" ? "issue" : "feedback",
    status: "open",
    createdBy: { id: req.user.id, name: req.user.email },
    createdAt: now,
    updatedAt: now,
    messages: [
      {
        id: uuid(),
        body: message.trim(),
        attachment: attachment?.dataUrl ? attachment : null,
        authorId: req.user.id,
        authorName: req.user.email,
        isMasterAdmin: false,
        createdAt: now,
      },
    ],
  };
  await feedback.insert(ticket);
  const account = await accounts.find(req.user.accountId);
  await notifySupportInbox(ticket, account, ticket.messages[0]);
  res.status(201).json(ticket);
});

// Shared access check for a single ticket — factored out since /:id, reply,
// and status all need "is this my ticket, or am I the master admin".
async function loadTicketForRequest(req, res) {
  const ticket = await feedback.find(req.params.id);
  if (!ticket) {
    res.status(404).json({ error: "Not found" });
    return null;
  }
  if (!req.user.isMasterAdmin && ticket.accountId !== req.user.accountId) {
    res.status(403).json({ error: "You don't have access to this ticket." });
    return null;
  }
  return ticket;
}

router.get("/:id", requireManager, async (req, res) => {
  if (!isOwner(req)) return res.status(403).json({ error: "Only the account owner can view this." });
  const ticket = await loadTicketForRequest(req, res);
  if (!ticket) return;
  res.json(ticket);
});

router.post("/:id/reply", requireManager, async (req, res) => {
  if (!isOwner(req)) return res.status(403).json({ error: "Only the account owner can reply here." });
  const ticket = await loadTicketForRequest(req, res);
  if (!ticket) return;
  const { message, attachment } = req.body;
  if (!message?.trim()) return res.status(400).json({ error: "Message is required." });
  const attachmentError = validateImageAnswer("Attachment", attachment);
  if (attachmentError) return res.status(400).json({ error: attachmentError });

  const now = new Date().toISOString();
  const reply = {
    id: uuid(),
    body: message.trim(),
    attachment: attachment?.dataUrl ? attachment : null,
    authorId: req.user.id,
    authorName: req.user.email,
    isMasterAdmin: !!req.user.isMasterAdmin,
    createdAt: now,
  };
  const messages = [...ticket.messages, reply];
  // A master admin replying re-opens a resolved ticket into "in_progress" —
  // otherwise a tenant's follow-up question on a closed ticket would sit
  // marked "resolved" and easy to miss. The tenant owner replying doesn't
  // change status; only the master admin's own explicit status change does.
  const status = req.user.isMasterAdmin && ticket.status === "resolved" ? "in_progress" : ticket.status;
  const updated = await feedback.update(ticket.id, { messages, status, updatedAt: now });

  // Only notify on the tenant's own follow-ups — a master admin replying to
  // their own team's ticket has no reason to email themselves about it.
  if (!req.user.isMasterAdmin) {
    const account = await accounts.find(req.user.accountId);
    await notifySupportInbox(updated, account, reply, { isReply: true });
  }

  res.json(updated);
});

router.put("/:id/status", requireManager, async (req, res) => {
  if (!req.user.isMasterAdmin) {
    return res.status(403).json({ error: "Only the platform admin can change a ticket's status." });
  }
  const { status } = req.body;
  if (!STATUSES.includes(status)) {
    return res.status(400).json({ error: `Status must be one of: ${STATUSES.join(", ")}.` });
  }
  const ticket = await feedback.find(req.params.id);
  if (!ticket) return res.status(404).json({ error: "Not found" });
  const updated = await feedback.update(ticket.id, { status, updatedAt: new Date().toISOString() });
  res.json(updated);
});

module.exports = router;
