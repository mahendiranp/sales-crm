const express = require("express");
const bcrypt = require("bcryptjs");
const { randomUUID: uuid } = require("crypto");
const { collection } = require("../db/store");
const { signToken } = require("../middleware/auth");

const router = express.Router();
const accounts = collection("accounts");

const BCRYPT_ROUNDS = 12;

function publicAccount(acc) {
  const { password, ...rest } = acc;
  return rest;
}

router.post("/signup", async (req, res) => {
  const { name, email, password, company } = req.body;
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
    // viewers) get invited/created from the Admin Portal instead.
    authRole: "admin",
    // Only the platform's master admin (seeded, never created via signup)
    // sees the Admin Portal / controls feature flags — a company's own
    // admin does not get this.
    isMasterAdmin: false,
    createdAt: new Date().toISOString(),
  };
  await accounts.insert(account);
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

module.exports = router;
