// The Express app itself, separate from index.js's "connect DB, seed, bind
// a port, start socket.io" bootstrapping — so tests can require() this and
// hit it with supertest without a real network listener or a second Mongo
// connection racing the one index.js opens.
require("dotenv").config();
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");

const leadsRouter = require("./routes/leads");
const dealsRouter = require("./routes/deals");
const simpleModulesRouter = require("./routes/simpleModules");
const whatsappRouter = require("./routes/whatsapp");
const emailRouter = require("./routes/email");
const dashboardRouter = require("./routes/dashboard");
const analyticsRouter = require("./routes/analytics");
const reportsRouter = require("./routes/reports");
const performanceRouter = require("./routes/performance");
const settingsRouter = require("./routes/settings");
const authRouter = require("./routes/auth");
const formsRouter = require("./routes/forms");
const whatsappSurveysRouter = require("./routes/whatsappSurveys");
const paymentsRouter = require("./routes/payments");
const feedbackRouter = require("./routes/feedback");
const { requireAuth } = require("./middleware/auth");
const { ensureConnected } = require("./db/store");

const app = express();

// Deployed behind Vercel's proxy, which sets X-Forwarded-For — without this,
// express-rate-limit refuses to trust that header and throws on every
// request (ERR_ERL_UNEXPECTED_X_FORWARDED_FOR). "1" trusts exactly the
// first hop, matching a single reverse proxy in front of the app.
app.set("trust proxy", 1);

// This is a pure JSON API (no HTML rendered here), so helmet's defaults are
// safe as-is — no inline scripts/styles to worry about breaking.
app.use(helmet());
app.use(cors());
// Default 100kb limit is too small for form branding, which stores logo/
// background images inline as base64 (a form can have two ~1.5MB images →
// ~4MB of base64 in one PUT /forms/:id body). The verify callback stashes
// the raw bytes on req.rawBody — needed to check Meta's webhook HMAC
// signature, which must be computed over the exact raw payload, not the
// re-serialized parsed object (see routes/whatsappSurveys.js).
app.use(
  express.json({
    limit: "10mb",
    verify: (req, res, buf) => {
      req.rawBody = buf;
    },
  })
);

app.get("/api/health", (req, res) => res.json({ status: "ok" }));

// In a traditional server (index.js) connectDB() already ran before any
// request arrives. In a serverless deployment there's no bootstrap step —
// this is the entry point itself — so every route that touches the DB
// needs the connection guaranteed first. ensureConnected() caches the
// promise, so warm invocations skip straight through.
app.use(async (req, res, next) => {
  try {
    await ensureConnected();
    next();
  } catch (err) {
    next(err);
  }
});

// Rate limiting is a production/staging concern — under automated tests,
// every request comes from the same in-process client with no real IP
// diversity, so a real limit would throttle the test suite itself rather
// than catching abuse. Skip both limiters when NODE_ENV=test.
const isTestEnv = process.env.NODE_ENV === "test";

// Tight limiter on auth — these are the endpoints someone would actually
// try to brute-force (login) or abuse (repeated signups).
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many attempts. Please try again in a few minutes." },
  skip: () => isTestEnv,
});
app.use("/api/auth", authLimiter, authRouter);

// Looser general limiter for everything else, so the API can't be trivially
// hammered — generous enough that normal app usage never hits it.
const apiLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 1000,
  standardHeaders: true,
  legacyHeaders: false,
  // The WhatsApp webhook is called by Meta's infrastructure, not a single
  // abusive client — don't let it get throttled by a shared limiter.
  skip: (req) => isTestEnv || req.path.startsWith("/api/whatsapp-surveys/webhook"),
});
app.use("/api", apiLimiter);

// Everything below requires a valid session — except the handful of routes
// that are genuinely meant to be public (published-form viewing/submission,
// and the WhatsApp webhook, which Meta calls directly with no session).
const PUBLIC_ROUTES = [
  { method: "GET", pattern: /^\/api\/forms\/[^/]+\/public$/ },
  { method: "GET", pattern: /^\/api\/forms\/[^/]+\/booking-dates$/ },
  { method: "GET", pattern: /^\/api\/forms\/[^/]+\/booking-slots$/ },
  { method: "POST", pattern: /^\/api\/forms\/[^/]+\/responses$/ },
  { method: "GET", pattern: /^\/api\/whatsapp-surveys\/webhook$/ },
  { method: "POST", pattern: /^\/api\/whatsapp-surveys\/webhook$/ },
];

app.use((req, res, next) => {
  const isPublic = PUBLIC_ROUTES.some((r) => r.method === req.method && r.pattern.test(req.path));
  if (isPublic) return next();
  return requireAuth(req, res, next);
});

app.use("/api/leads", leadsRouter);
app.use("/api/deals", dealsRouter);
app.use("/api", simpleModulesRouter); // contacts, companies, activities, tasks, templates, users, teams, invoices, expenses, documents
app.use("/api/whatsapp", whatsappRouter);
app.use("/api/emails", emailRouter);
app.use("/api/dashboard", dashboardRouter);
app.use("/api/analytics", analyticsRouter);
app.use("/api/reports", reportsRouter);
app.use("/api/performance", performanceRouter);
app.use("/api/settings", settingsRouter);
app.use("/api/forms", formsRouter);
app.use("/api/whatsapp-surveys", whatsappSurveysRouter);
app.use("/api/payments", paymentsRouter);
app.use("/api/feedback", feedbackRouter);

module.exports = app;
