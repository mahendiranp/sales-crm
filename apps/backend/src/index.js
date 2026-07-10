require("dotenv").config();
const http = require("http");
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const { Server } = require("socket.io");
const { connectDB, setIO } = require("./db/store");
const { seed } = require("./db/seed");

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
const { requireAuth, verifyToken } = require("./middleware/auth");

const app = express();
const PORT = process.env.PORT || 4000;

// This is a pure JSON API (no HTML rendered here), so helmet's defaults are
// safe as-is — no inline scripts/styles to worry about breaking.
app.use(helmet());
app.use(cors());
// Default 100kb limit is too small for form branding, which stores logo/
// background images inline as base64 (a form can have two ~1.5MB images →
// ~4MB of base64 in one PUT /forms/:id body).
app.use(express.json({ limit: "10mb" }));

app.get("/api/health", (req, res) => res.json({ status: "ok" }));

// Tight limiter on auth — these are the endpoints someone would actually
// try to brute-force (login) or abuse (repeated signups).
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many attempts. Please try again in a few minutes." },
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
  skip: (req) => req.path.startsWith("/api/whatsapp-surveys/webhook"),
});
app.use("/api", apiLimiter);

// Everything below requires a valid session — except the handful of routes
// that are genuinely meant to be public (published-form viewing/submission,
// and the WhatsApp webhook, which Meta calls directly with no session).
const PUBLIC_ROUTES = [
  { method: "GET", pattern: /^\/api\/forms\/[^/]+\/public$/ },
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

const httpServer = http.createServer(app);
const io = new Server(httpServer, { cors: { origin: "*" } });
// Live-update broadcasts carry real CRM data — reject unauthenticated
// socket connections instead of letting anyone with the URL listen in.
io.use((socket, next) => {
  try {
    const token = socket.handshake.auth?.token;
    if (!token) throw new Error("no token");
    socket.user = verifyToken(token);
    next();
  } catch {
    next(new Error("Authentication required"));
  }
});
setIO(io);

async function main() {
  await connectDB();
  await seed(); // seeds demo data on first run (no-op once collections are populated)
  httpServer.listen(PORT, () => {
    console.log(`🚀 Sales CRM API running at http://localhost:${PORT}`);
  });
}

main().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
