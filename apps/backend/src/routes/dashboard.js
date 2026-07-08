const express = require("express");
const dayjs = require("dayjs");
const { collection } = require("../db/store");

const router = express.Router();
const leads = collection("leads");
const deals = collection("deals");
const tasks = collection("tasks");

router.get("/", (req, res) => {
  const allLeads = leads.all();
  const allDeals = deals.all();
  const allTasks = tasks.all();
  const today = dayjs().format("YYYY-MM-DD");

  const totalLeads = allLeads.length;
  const newLeadsToday = allLeads.filter((l) => dayjs(l.createdAt).format("YYYY-MM-DD") === today).length;
  const followUpsDue = allTasks.filter((t) => t.status !== "Completed" && dayjs(t.dueDate).isBefore(dayjs().add(1, "day"))).length;
  const dealsWon = allDeals.filter((d) => d.stage === "Won").length;

  const wonThisMonth = allDeals.filter(
    (d) => d.stage === "Won" && dayjs(d.updatedAt).isSame(dayjs(), "month")
  );
  const monthlyRevenue = wonThisMonth.reduce((sum, d) => sum + (d.expectedRevenue || 0), 0);

  // Sales graph: revenue of won deals per month, last 6 months
  const salesGraph = [];
  for (let i = 5; i >= 0; i--) {
    const month = dayjs().subtract(i, "month");
    const monthDeals = allDeals.filter(
      (d) => d.stage === "Won" && dayjs(d.updatedAt).isSame(month, "month")
    );
    salesGraph.push({
      month: month.format("MMM YYYY"),
      revenue: monthDeals.reduce((sum, d) => sum + (d.expectedRevenue || 0), 0),
    });
  }

  // Rule-based AI suggestions (mock — swap for a real LLM call in production)
  const suggestions = [];
  const staleLeads = allLeads.filter(
    (l) => l.status !== "Converted" && l.status !== "Lost" && dayjs().diff(dayjs(l.updatedAt), "day") > 5
  );
  if (staleLeads.length > 0) {
    suggestions.push(`${staleLeads.length} lead${staleLeads.length > 1 ? "s haven't" : " hasn't"} been contacted in 5+ days — consider following up.`);
  }
  const overdueTasks = allTasks.filter((t) => t.status !== "Completed" && dayjs(t.dueDate).isBefore(dayjs()));
  if (overdueTasks.length > 0) {
    suggestions.push(`${overdueTasks.length} task${overdueTasks.length > 1 ? "s are" : " is"} overdue — clear these to keep your pipeline healthy.`);
  }
  const negotiationDeals = allDeals.filter((d) => d.stage === "Negotiation");
  if (negotiationDeals.length > 0) {
    suggestions.push(`${negotiationDeals.length} deal${negotiationDeals.length > 1 ? "s are" : " is"} in Negotiation — prioritize these to close the month strong.`);
  }
  const highBudgetNewLeads = allLeads.filter((l) => l.status === "New" && l.budget > 200000);
  if (highBudgetNewLeads.length > 0) {
    suggestions.push(`${highBudgetNewLeads.length} high-budget lead${highBudgetNewLeads.length > 1 ? "s" : ""} came in — assign your top closer.`);
  }
  if (suggestions.length === 0) suggestions.push("Everything looks on track. No urgent actions right now.");

  res.json({
    totalLeads,
    newLeadsToday,
    followUpsDue,
    dealsWon,
    monthlyRevenue,
    salesGraph,
    aiSuggestions: suggestions,
  });
});

module.exports = router;
