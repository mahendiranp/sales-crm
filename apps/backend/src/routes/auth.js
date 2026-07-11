const express = require("express");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const { randomUUID: uuid } = require("crypto");
const { collection } = require("../db/store");
const { signToken, requireAuth, requireFullAccess, effectivePermission } = require("../middleware/auth");
const { defaults: settingsDefaults, getLimitsForAccount } = require("./settings");
const emailClient = require("../integrations/emailClient");

const router = express.Router();
const accounts = collection("accounts");
const settings = collection("settings");

const BCRYPT_ROUNDS = 12;
const RESET_TOKEN_TTL_MS = 30 * 60 * 1000; // 30 minutes
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:3000";

function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function publicAccount(acc) {
  const { password, resetTokenHash, resetTokenExpiresAt, ...rest } = acc;
  // Always computed, never trusted from the stored field alone — admin/
  // master-admin accounts don't store a `permission` value (they're
  // implicitly "full"), so the client needs the resolved value, not the raw field.
  return { ...rest, permission: effectivePermission(acc) };
}

router.post("/signup", async (req, res) => {
  const { name, email, password, company, apps, modules } = req.body;
  if (!name || !email || !password) {
    return res.status(400).json({ error: "Name, email, and password are required." });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: "Password must be at least 8 characters." });
  }
  const existing = (await accounts.all()).find((a) => a.email.toLowerCase() === email.toLowerCase());
  if (existing) {
    return res.status(409).json({ error: "An account with this email already exists." });
  }
  const account = {
    id: uuid(),
    name,
    email,
    password: await bcrypt.hash(password, BCRYPT_ROUNDS),
    company: company || "",
    // Signup always creates the owner/admin of a new company account. Role
    // is never taken from the client — additional users (managers,
    // viewers) get invited/created from Settings → Team instead.
    authRole: "admin",
    // Only the platform's master admin (seeded, never created via signup)
    // sees the Admin Portal / controls feature flags — a company's own
    // admin does not get this.
    isMasterAdmin: false,
    createdAt: new Date().toISOString(),
  };
  await accounts.insert(account);

  // The starter-kit selection from the signup wizard becomes this new
  // tenant's day-one settings — set directly here (not via PUT /settings,
  // which requires master admin) since this is establishing initial state
  // for a brand new tenant, not changing an existing one's flags.
  const initialSettings = settingsDefaults(account.id);
  if (apps && typeof apps === "object") {
    initialSettings.apps = { ...initialSettings.apps, ...apps };
  }
  if (modules && typeof modules === "object") {
    initialSettings.modules = { ...initialSettings.modules, ...modules };
  }
  await settings.insert(initialSettings);

  res.status(201).json({ user: publicAccount(account), token: signToken(account) });
});

router.post("/login", async (req, res) => {
  const { email, password } = req.body;
  const account = (await accounts.all()).find((a) => a.email.toLowerCase() === (email || "").toLowerCase());
  const valid = account && (await bcrypt.compare(password || "", account.password));
  if (!valid) {
    return res.status(401).json({ error: "Invalid email or password." });
  }
  res.json({ user: publicAccount(account), token: signToken(account) });
});

// Demo helper: log straight in as one of the seeded personas without a
// password. Gated behind ALLOW_DEMO_LOGIN so it can (and should) be
// disabled once this is a real production deployment with real users.
router.post("/demo-login", async (req, res) => {
  if (process.env.ALLOW_DEMO_LOGIN === "false") {
    return res.status(404).json({ error: "Demo login is disabled." });
  }
  const { authRole } = req.body;
  const account = (await accounts.all()).find((a) => a.authRole === authRole && a.isDemo);
  if (!account) return res.status(404).json({ error: "No demo account for that role." });
  res.json({ user: publicAccount(account), token: signToken(account) });
});

// ---------------- PASSWORD RESET ----------------
router.post("/forgot-password", async (req, res) => {
  const { email } = req.body;
  const account = (await accounts.all()).find((a) => a.email.toLowerCase() === (email || "").toLowerCase());

  // Always respond the same way whether or not the account exists — telling
  // an attacker "no account with that email" lets them enumerate real users.
  const genericResponse = { message: "If an account exists for that email, a reset link has been sent." };

  if (!account) return res.json(genericResponse);

  const rawToken = crypto.randomBytes(32).toString("hex");
  await accounts.update(account.id, {
    resetTokenHash: hashToken(rawToken),
    resetTokenExpiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS).toISOString(),
  });

  const resetLink = `${FRONTEND_URL}/reset-password?token=${rawToken}&email=${encodeURIComponent(account.email)}`;
  const mailResult = await emailClient.sendMail({
    to: account.email,
    subject: "Reset your password",
    html: `<p>Hi ${account.name},</p><p>Click below to reset your password. This link expires in 30 minutes.</p><p><a href="${resetLink}">${resetLink}</a></p><p>If you didn't request this, you can ignore this email.</p>`,
  });

  // Dev convenience only: with no real SMTP configured, there's no other
  // way to get the link (no email actually goes out) — surface it in the
  // response so local testing/dev doesn't require a mail account. Never
  // done once real email is configured, and never in production even if
  // email happens to be unconfigured there (misconfiguration shouldn't
  // leak reset tokens to any caller who knows an account's email).
  if (mailResult.mocked && process.env.NODE_ENV !== "production") {
    return res.json({ ...genericResponse, devResetLink: resetLink });
  }
  res.json(genericResponse);
});

router.post("/reset-password", async (req, res) => {
  const { email, token, password } = req.body;
  if (!email || !token || !password) {
    return res.status(400).json({ error: "Email, token, and new password are required." });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: "Password must be at least 8 characters." });
  }
  const account = (await accounts.all()).find((a) => a.email.toLowerCase() === email.toLowerCase());
  const validToken =
    account?.resetTokenHash &&
    account.resetTokenHash === hashToken(token) &&
    account.resetTokenExpiresAt &&
    new Date(account.resetTokenExpiresAt) > new Date();

  if (!validToken) {
    return res.status(400).json({ error: "This reset link is invalid or has expired." });
  }

  await accounts.update(account.id, {
    password: await bcrypt.hash(password, BCRYPT_ROUNDS),
    resetTokenHash: null,
    resetTokenExpiresAt: null,
  });
  res.json({ message: "Password updated — you can log in now." });
});

// ---------------- TEAM (teammate login accounts) ----------------
// Only the tenant owner (authRole "admin") or the platform's master admin
// can manage teammates — a teammate can never create/edit/remove other
// teammates, regardless of their own permission level.
function requireOwner(req, res, next) {
  if (!req.user.isMasterAdmin && req.user.authRole !== "admin") {
    return res.status(403).json({ error: "Only the account owner can manage team members." });
  }
  next();
}

router.get("/team", requireAuth, requireOwner, async (req, res) => {
  const teammates = (await accounts.all()).filter((a) => (a.accountId || a.id) === req.user.accountId && a.id !== req.user.id);
  res.json(teammates.map(publicAccount));
});

router.post("/team", requireAuth, requireOwner, async (req, res) => {
  const { name, email, password, permission } = req.body;
  if (!name || !email || !password) {
    return res.status(400).json({ error: "Name, email, and password are required." });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: "Password must be at least 8 characters." });
  }
  if (!["view", "edit", "full"].includes(permission)) {
    return res.status(400).json({ error: "Permission must be view, edit, or full." });
  }
  if (!req.user.isMasterAdmin) {
    const limits = await getLimitsForAccount(req.user.accountId);
    if (limits.maxUsers !== Infinity) {
      // +1 for the owner themselves — maxUsers counts the whole team, not just teammates.
      const currentUsers = (await accounts.all()).filter((a) => (a.accountId || a.id) === req.user.accountId).length;
      if (currentUsers >= limits.maxUsers) {
        return res.status(403).json({ error: `Your plan (${limits.label}) allows up to ${limits.maxUsers} user${limits.maxUsers === 1 ? "" : "s"}. Upgrade to add more.` });
      }
    }
  }
  const existing = (await accounts.all()).find((a) => a.email.toLowerCase() === email.toLowerCase());
  if (existing) {
    return res.status(409).json({ error: "An account with this email already exists." });
  }
  const teammate = {
    id: uuid(),
    accountId: req.user.accountId,
    name,
    email,
    password: await bcrypt.hash(password, BCRYPT_ROUNDS),
    authRole: "manager",
    isMasterAdmin: false,
    permission,
    isDemo: false,
    createdAt: new Date().toISOString(),
  };
  await accounts.insert(teammate);
  res.status(201).json(publicAccount(teammate));
});

router.put("/team/:id", requireAuth, requireOwner, async (req, res) => {
  const teammate = await accounts.find(req.params.id);
  if (!teammate || (teammate.accountId || teammate.id) !== req.user.accountId || teammate.id === req.user.id) {
    return res.status(404).json({ error: "Not found" });
  }
  const { permission, name } = req.body;
  const patch = {};
  if (permission) {
    if (!["view", "edit", "full"].includes(permission)) {
      return res.status(400).json({ error: "Permission must be view, edit, or full." });
    }
    patch.permission = permission;
  }
  if (name) patch.name = name;
  const updated = await accounts.update(req.params.id, patch);
  res.json(publicAccount(updated));
});

router.delete("/team/:id", requireAuth, requireOwner, requireFullAccess, async (req, res) => {
  const teammate = await accounts.find(req.params.id);
  if (!teammate || (teammate.accountId || teammate.id) !== req.user.accountId || teammate.id === req.user.id) {
    return res.status(404).json({ error: "Not found" });
  }
  await accounts.remove(req.params.id);
  res.status(204).end();
});

module.exports = router;
