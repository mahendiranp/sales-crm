// Real session auth: the client sends a JWT (issued at login/signup) in
// the Authorization header, we verify its signature server-side, and
// attach the decoded, trusted payload as req.user. Nothing downstream
// trusts anything the client merely *claims* about its own identity.
const jwt = require("jsonwebtoken");
const { roleFor } = require("./permissions");

if (!process.env.JWT_SECRET) {
  if (process.env.NODE_ENV === "production") {
    throw new Error("JWT_SECRET must be set in production — refusing to start with an insecure default.");
  }
  // eslint-disable-next-line no-console
  console.warn("⚠️  JWT_SECRET is not set — using an insecure default key (dev only). Set JWT_SECRET in your .env.");
}
const JWT_SECRET = process.env.JWT_SECRET || "dev-only-insecure-jwt-secret";
const JWT_EXPIRY = "7d";

// Permission levels for teammates a company admin creates (Settings → Team):
// "view" (read-only), "edit" (create/update, no delete), "full" (everything).
// The tenant owner (authRole "admin") and the platform's master admin are
// always treated as "full" regardless of what's stored — see effectivePermission().
const PERMISSION_RANK = { view: 0, edit: 1, full: 2 };

function effectivePermission(account) {
  if (account.isMasterAdmin || account.authRole === "admin") return "full";
  return PERMISSION_RANK[account.permission] !== undefined ? account.permission : "view";
}

function signToken(account) {
  return jwt.sign(
    {
      sub: account.id,
      email: account.email,
      authRole: account.authRole,
      isMasterAdmin: !!account.isMasterAdmin,
      permission: effectivePermission(account),
      role: roleFor(account),
      // The tenant this account's data lives under. A signup's own id is
      // its tenant root; invited teammates (seeded demo manager/viewer,
      // or ones created via Settings → Team) share the owner's id here
      // instead of their own.
      accountId: account.accountId || account.id,
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRY }
  );
}

// Shared by the HTTP middleware below and the socket.io connection gate in
// index.js — one place that knows how to turn a raw token into a trusted
// user object (or throw).
function verifyToken(token) {
  const payload = jwt.verify(token, JWT_SECRET);
  return {
    id: payload.sub,
    email: payload.email,
    authRole: payload.authRole,
    isMasterAdmin: payload.isMasterAdmin,
    permission: payload.permission || "view",
    role: payload.role || "viewer",
    accountId: payload.accountId,
  };
}

// Verifies the bearer token and attaches req.user. Rejects the request
// (401) if the token is missing, malformed, expired, or has a bad
// signature — this is the actual authentication boundary.
function requireAuth(req, res, next) {
  const header = req.header("authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: "Authentication required." });

  try {
    req.user = verifyToken(token);
    next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired session — please log in again." });
  }
}

// Authorization check, run after requireAuth — blocks view-only accounts
// from making changes. Reads the verified req.user, not anything the
// client sent directly. Equivalent to requirePermission("edit").
function requireManager(req, res, next) {
  if (PERMISSION_RANK[req.user?.permission] < PERMISSION_RANK.edit) {
    return res.status(403).json({ error: "This account is view-only and cannot make changes." });
  }
  next();
}

// Stricter than requireManager — for destructive actions (delete). A
// teammate with "edit" permission can create/update but not delete.
function requireFullAccess(req, res, next) {
  if (PERMISSION_RANK[req.user?.permission] < PERMISSION_RANK.full) {
    return res.status(403).json({ error: "This account doesn't have permission to delete records." });
  }
  next();
}

function requireMasterAdmin(req, res, next) {
  if (!req.user?.isMasterAdmin) {
    return res.status(403).json({ error: "Only the master admin can do this." });
  }
  next();
}

module.exports = {
  requireAuth,
  requireManager,
  requireFullAccess,
  requireMasterAdmin,
  signToken,
  verifyToken,
  effectivePermission,
  PERMISSION_RANK,
  requirePermission: require("./permissions").requirePermission,
};
