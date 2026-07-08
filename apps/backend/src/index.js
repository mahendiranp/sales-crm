const express = require("express");
const cors = require("cors");
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

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

// Seed demo data on first run
seed();

app.get("/api/health", (req, res) => res.json({ status: "ok" }));

app.use("/api/auth", authRouter);

app.use("/api/leads", leadsRouter);
app.use("/api/deals", dealsRouter);
app.use("/api", simpleModulesRouter); // contacts, companies, activities, tasks, templates, users, teams
app.use("/api/whatsapp", whatsappRouter);
app.use("/api/emails", emailRouter);
app.use("/api/dashboard", dashboardRouter);
app.use("/api/analytics", analyticsRouter);
app.use("/api/reports", reportsRouter);
app.use("/api/performance", performanceRouter);
app.use("/api/settings", settingsRouter);

app.listen(PORT, () => {
  console.log(`🚀 Sales CRM API running at http://localhost:${PORT}`);
});
