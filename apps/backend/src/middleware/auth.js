// Demo-grade auth: the client sends the logged-in user's role in a header
// (set by the frontend's AuthContext) and we trust it to gate writes.
// This is enough to make "view only" accounts genuinely read-only for a
// prototype. A production build would replace this with signed session
// tokens / JWT validation.

function requireManager(req, res, next) {
  const role = req.header("x-auth-role");
  if (role === "viewer") {
    return res.status(403).json({ error: "This account is view-only and cannot make changes." });
  }
  next();
}

module.exports = { requireManager };
