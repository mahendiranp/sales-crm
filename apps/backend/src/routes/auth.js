const express = require("express");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const { randomUUID: uuid } = require("crypto");
const { collection } = require("../db/store");
const { signToken, requireAuth, requireFullAccess, effectivePermission } = require("../middleware/auth");
const { defaults: settingsDefaults, getLimitsForAccount } = require("./settings");
const emailClient = require("../integrations/emailClient");
const { APP_NAME } = require("../utils/brand");
const { emailLayout } = require("../utils/emailTemplate");

const router = express.Router();
const accounts = collection("accounts");
const settings = collection("settings");
const signupOtps = collection("signup_otps");

const BCRYPT_ROUNDS = 12;
const RESET_TOKEN_TTL_MS = 30 * 60 * 1000; // 30 minutes
const OTP_TTL_MS = 10 * 60 * 1000; // 10 minutes
const OTP_MAX_ATTEMPTS = 5;
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

// Actually creates the account + initial settings once an OTP has been
// verified — shared by /signup/verify-otp below. Not exposed directly:
// nothing creates an account without going through the OTP step first.
async function createAccountFromPending(pending) {
  const { name, email, passwordHash, company, apps, modules } = pending.payload;
  const account = {
    id: uuid(),
    name,
    email,
    password: passwordHash,
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

  // Best-effort — a slow/misconfigured mail server shouldn't block account
  // creation. Mocked (console-logged) locally the same as every other
  // transactional email when SMTP isn't configured.
  emailClient
    .sendMail({
      to: account.email,
      subject: `Welcome to ${APP_NAME}`,
      html: emailLayout({
        preheader: "Your account is ready to go.",
        heading: `Welcome, ${account.name.split(" ")[0]} 👋`,
        bodyHtml: `<p>Your ${APP_NAME} account is ready. Log in whenever you like to start building forms and managing your pipeline.</p>`,
        cta: { label: "Log in", url: `${FRONTEND_URL}/login` },
      }),
    })
    .catch(() => {});

  return account;
}

// Lets the signup form check email availability right after step 1 (before
// committing to the OTP round-trip), instead of only discovering a
// duplicate account after typing a password and picking a starter kit.
router.get("/check-email", async (req, res) => {
  const email = (req.query.email || "").toLowerCase();
  if (!email) return res.status(400).json({ error: "Email is required." });
  const existing = (await accounts.all()).find((a) => a.email.toLowerCase() === email);
  res.json({ available: !existing });
});

// ---------------- SIGNUP (email OTP verification) ----------------
// Two-step: request-otp validates the details, emails a 6-digit code, and
// stashes the (already-hashed) payload — nothing is written to `accounts`
// yet. verify-otp checks the code and only then actually creates the
// account. This confirms the signup email is real/reachable before it
// becomes the tenant owner's login.
router.post("/signup/request-otp", async (req, res) => {
  const { name, email, password, company, apps, modules } = req.body;
  if (!name || !email || !password) {
    return res.status(400).json({ error: "Name, email, and password are required." });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: "Password must be at least 8 characters." });
  }
  const normalizedEmail = email.toLowerCase();
  const existing = (await accounts.all()).find((a) => a.email.toLowerCase() === normalizedEmail);
  if (existing) {
    return res.status(409).json({ error: "An account with this email already exists." });
  }

  const otp = String(crypto.randomInt(100000, 1000000)); // 6 digits
  const pending = {
    id: normalizedEmail,
    email: normalizedEmail,
    otpHash: hashToken(otp),
    expiresAt: new Date(Date.now() + OTP_TTL_MS).toISOString(),
    attempts: 0,
    payload: {
      name,
      email,
      passwordHash: await bcrypt.hash(password, BCRYPT_ROUNDS),
      company: company || "",
      apps: apps && typeof apps === "object" ? apps : {},
      modules: modules && typeof modules === "object" ? modules : {},
    },
  };
  // Re-requesting (e.g. "resend code") replaces any earlier pending OTP for
  // this email rather than stacking them.
  const existingPending = await signupOtps.find(normalizedEmail);
  if (existingPending) await signupOtps.update(normalizedEmail, pending);
  else await signupOtps.insert(pending);

  const mailResult = await emailClient.sendMail({
    to: email,
    subject: `Your ${APP_NAME} verification code`,
    html: emailLayout({
      preheader: `Your verification code is ${otp}`,
      heading: "Verify your email",
      bodyHtml: `<p>Hi ${name},</p><p>Enter this code to finish creating your ${APP_NAME} account. It expires in 10 minutes.</p>`,
      highlight: otp,
    }),
  });

  // Dev convenience only, mirroring /forgot-password: with no real SMTP
  // configured there's no other way to see the code locally.
  if (mailResult.mocked && process.env.NODE_ENV !== "production") {
    return res.json({ message: "Verification code sent.", devOtp: otp });
  }
  res.json({ message: "Verification code sent." });
});

router.post("/signup/verify-otp", async (req, res) => {
  const { email, otp } = req.body;
  if (!email || !otp) return res.status(400).json({ error: "Email and code are required." });
  const normalizedEmail = email.toLowerCase();

  const pending = await signupOtps.find(normalizedEmail);
  if (!pending) return res.status(400).json({ error: "No pending signup for that email — start over." });

  if (new Date(pending.expiresAt) < new Date()) {
    await signupOtps.remove(normalizedEmail);
    return res.status(400).json({ error: "This code has expired — request a new one." });
  }
  if (pending.attempts >= OTP_MAX_ATTEMPTS) {
    await signupOtps.remove(normalizedEmail);
    return res.status(429).json({ error: "Too many incorrect attempts — request a new code." });
  }
  if (hashToken(String(otp)) !== pending.otpHash) {
    await signupOtps.update(normalizedEmail, { attempts: pending.attempts + 1 });
    return res.status(400).json({ error: "Incorrect code — please try again." });
  }

  // Someone else could've claimed this email while the code was pending.
  const existing = (await accounts.all()).find((a) => a.email.toLowerCase() === normalizedEmail);
  if (existing) {
    await signupOtps.remove(normalizedEmail);
    return res.status(409).json({ error: "An account with this email already exists." });
  }

  const account = await createAccountFromPending(pending);
  await signupOtps.remove(normalizedEmail);
  res.status(201).json({ user: publicAccount(account), token: signToken(account) });
});

router.post("/login", async (req, res) => {
  const { email, password } = req.body;
  const account = (await accounts.all()).find((a) => a.email.toLowerCase() === (email || "").trim().toLowerCase());
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

// Google "Sign in / Sign up" — the frontend uses Google Identity Services,
// which hands back a signed ID token (JWT) after the user picks an account.
// We never trust that token's claims directly: Google's own tokeninfo
// endpoint re-validates the signature and expiry server-side, and we also
// check `aud` matches our client ID so a token issued for a *different*
// Google app can't be replayed here. Existing email match = login; no match
// = signup (mirrors createAccountFromPending, minus the OTP step since
// Google has already verified the email for us).
router.post("/google", async (req, res) => {
  const { credential } = req.body;
  if (!credential) return res.status(400).json({ error: "Missing Google credential." });
  if (!process.env.GOOGLE_CLIENT_ID) {
    return res.status(501).json({ error: "Google sign-in isn't configured yet." });
  }

  let payload;
  try {
    const verifyRes = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`);
    if (!verifyRes.ok) throw new Error("bad token");
    payload = await verifyRes.json();
  } catch {
    return res.status(401).json({ error: "Couldn't verify that Google sign-in — please try again." });
  }

  if (payload.aud !== process.env.GOOGLE_CLIENT_ID || payload.email_verified !== "true" || !payload.email) {
    return res.status(401).json({ error: "Couldn't verify that Google sign-in — please try again." });
  }

  const normalizedEmail = payload.email.toLowerCase();
  const existing = (await accounts.all()).find((a) => a.email.toLowerCase() === normalizedEmail);
  if (existing) {
    return res.json({ user: publicAccount(existing), token: signToken(existing) });
  }

  const account = await createAccountFromPending({
    payload: {
      name: payload.name || normalizedEmail.split("@")[0],
      email: payload.email,
      // Google-created accounts don't have a usable password — this hash
      // never matches any real input, so /login always rejects password
      // attempts on this account (the user can still "Forgot password" to
      // set a real one later, which is intentional, not a gap).
      passwordHash: await bcrypt.hash(crypto.randomBytes(32).toString("hex"), BCRYPT_ROUNDS),
      company: "",
      apps: {},
      modules: {},
    },
  });
  res.status(201).json({ user: publicAccount(account), token: signToken(account) });
});

// ---------------- PASSWORD RESET ----------------
router.post("/forgot-password", async (req, res) => {
  const { email } = req.body;
  const account = (await accounts.all()).find((a) => a.email.toLowerCase() === (email || "").trim().toLowerCase());

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
    html: emailLayout({
      preheader: "Reset your password — this link expires in 30 minutes.",
      heading: "Reset your password",
      bodyHtml: `<p>Hi ${account.name},</p><p>Click below to choose a new password. This link expires in 30 minutes. If you didn't request this, you can safely ignore this email.</p>`,
      cta: { label: "Reset password", url: resetLink },
    }),
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

  // Confirms the change actually happened, and doubles as an alert if the
  // account holder didn't do this themselves. Best-effort, same as every
  // other transactional email here.
  emailClient
    .sendMail({
      to: account.email,
      subject: "Your password was changed",
      html: emailLayout({
        preheader: "Your password was just changed.",
        heading: "Password changed",
        bodyHtml: `<p>Hi ${account.name},</p><p>Your ${APP_NAME} password was just changed. If this wasn't you, reset your password again immediately or contact support.</p>`,
      }),
    })
    .catch(() => {});

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
