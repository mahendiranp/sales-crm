const express = require("express");
const { v4: uuid } = require("uuid");
const { collection } = require("../db/store");

const router = express.Router();
const accounts = collection("accounts");

function publicAccount(acc) {
  const { password, ...rest } = acc;
  return rest;
}

router.post("/signup", async (req, res) => {
  const { name, email, password, company, authRole } = req.body;
  if (!name || !email || !password) {
    return res.status(400).json({ error: "Name, email, and password are required." });
  }
  const existing = accounts.all().find((a) => a.email.toLowerCase() === email.toLowerCase());
  if (existing) {
    return res.status(409).json({ error: "An account with this email already exists." });
  }
  const account = {
    id: uuid(),
    name,
    email,
    password, // NOTE: plaintext for demo purposes only — hash this (bcrypt/argon2) in production
    company: company || "",
    authRole: authRole || "manager", // 'admin' | 'manager' | 'viewer'
    createdAt: new Date().toISOString(),
  };
  await accounts.insert(account);
  res.status(201).json({ user: publicAccount(account), token: account.id });
});

router.post("/login", (req, res) => {
  const { email, password } = req.body;
  const account = accounts.all().find((a) => a.email.toLowerCase() === (email || "").toLowerCase());
  if (!account || account.password !== password) {
    return res.status(401).json({ error: "Invalid email or password." });
  }
  res.json({ user: publicAccount(account), token: account.id });
});

// Demo helper: log straight in as one of the seeded personas without a password
router.post("/demo-login", (req, res) => {
  const { authRole } = req.body;
  const account = accounts.all().find((a) => a.authRole === authRole && a.isDemo);
  if (!account) return res.status(404).json({ error: "No demo account for that role." });
  res.json({ user: publicAccount(account), token: account.id });
});

module.exports = router;
