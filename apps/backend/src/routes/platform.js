// Platform-wide feature release switches — separate from any tenant's own
// settings.modules/settings.apps (which just says "is this ON for my
// account"). This says "does this feature exist for anyone but master
// admin to turn on at all yet." Read by the signup picker (before login
// exists) and every tenant's own Settings/Upgrade page; written only by
// master admin from the Admin Portal.
const express = require("express");
const { collection } = require("../db/store");
const { requireMasterAdmin } = require("../middleware/auth");
const emailClient = require("../integrations/emailClient");
const { emailLayout } = require("../utils/emailTemplate");

const router = express.Router();
const platform = collection("platform");
const accounts = collection("accounts");
const ID = "platform-features";

// Matches the pre-launch defaults RELEASED_MODULE_KEYS/RELEASED_APP_KEYS
// used to hardcode — same starting point, now editable at runtime instead
// of requiring a code change to widen the release.
function defaults() {
  return {
    id: ID,
    releasedModules: { dashboard: true },
    releasedApps: { forms: true },
  };
}

router.get("/", async (req, res) => {
  const current = await platform.find(ID);
  res.json(current || defaults());
});

router.put("/", requireMasterAdmin, async (req, res) => {
  const current = await platform.find(ID);
  const base = current || defaults();
  const patch = {};
  if (req.body.releasedModules) patch.releasedModules = { ...base.releasedModules, ...req.body.releasedModules };
  if (req.body.releasedApps) patch.releasedApps = { ...base.releasedApps, ...req.body.releasedApps };

  if (!current) await platform.insert({ ...base, ...patch });
  else await platform.update(ID, patch);
  res.json(await platform.find(ID));
});

const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:3000";
const FEEDBACK_EMAIL_MIN_DAYS = 2;
const FEEDBACK_EMAIL_MAX_DAYS = 3;

function feedbackRequestEmailHtml(firstName) {
  return emailLayout({
    preheader: "We'd love to hear how Flowora is working for you so far.",
    heading: "We'd love your feedback on Flowora 💚",
    bodyHtml: `
      <p>Hi ${firstName},</p>
      <p>Thank you for using Flowora!</p>
      <p>We're continuously improving Flowora to make form creation and workflow automation faster and easier for businesses like yours.</p>
      <p>If you've had a chance to explore the platform, we'd love to hear about your experience. Your feedback helps us prioritize the features and improvements that matter most.</p>
      <p>It only takes a couple of minutes.</p>
      <p>Here are a few questions you might answer:</p>
      <ul style="margin:0 0 16px;padding-left:20px;">
        <li>How easy was it to get started with Flowora?</li>
        <li>What feature did you find most useful?</li>
        <li>Did you face any issues or confusion?</li>
        <li>What feature would you like us to build next?</li>
        <li>How likely are you to recommend Flowora to a friend or colleague? (0–10)</li>
      </ul>
      <p>Thank you for helping us make Flowora better.</p>
      <p>Best regards,<br />The Flowora Team</p>
    `,
    cta: { label: "Share your feedback", url: `${FRONTEND_URL}/app/feedback` },
  });
}

// Manual trigger since this repo has no cron infra wired up (same
// reasoning as forms.js's /workflow/check-escalations) — call this from
// an external scheduler (Vercel Cron, etc.) once a day, or run it by
// hand. Only ever emails an account's actual owner (authRole "admin" —
// the person who signed up), never invited teammates, never demo/master-
// admin accounts, and never the same account twice (feedbackEmailSentAt
// gates that). The 2-3 day window means a daily run catches every owner
// exactly once, whichever day of that window the job happens to run on.
router.post("/send-feedback-emails", requireMasterAdmin, async (req, res) => {
  const now = Date.now();
  const minAgeMs = FEEDBACK_EMAIL_MIN_DAYS * 24 * 60 * 60 * 1000;
  const maxAgeMs = FEEDBACK_EMAIL_MAX_DAYS * 24 * 60 * 60 * 1000;

  const allAccounts = await accounts.all();
  const eligible = allAccounts.filter((a) => {
    if (a.authRole !== "admin" || a.isMasterAdmin || a.isDemo || a.feedbackEmailSentAt) return false;
    const ageMs = now - new Date(a.createdAt).getTime();
    return ageMs >= minAgeMs && ageMs <= maxAgeMs;
  });

  let sent = 0;
  for (const account of eligible) {
    const firstName = (account.name || "there").split(" ")[0];
    try {
      await emailClient.sendMail({
        to: account.email,
        subject: "We'd love your feedback on Flowora 💚",
        html: feedbackRequestEmailHtml(firstName),
      });
      await accounts.update(account.id, { feedbackEmailSentAt: new Date().toISOString() });
      sent++;
    } catch (err) {
      // Best-effort, same as every other bulk/notification send in this
      // app — one account's mail failure shouldn't abort the whole run,
      // and it'll simply be picked up again on the next scheduled call
      // since feedbackEmailSentAt was never set for it.
      // eslint-disable-next-line no-console
      console.error(`Failed to send feedback-request email to ${account.email}:`, err);
    }
  }

  res.json({ checked: allAccounts.length, eligible: eligible.length, sent });
});

module.exports = router;
