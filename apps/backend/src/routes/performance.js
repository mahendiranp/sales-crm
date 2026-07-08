const express = require("express");
const { collection } = require("../db/store");

const router = express.Router();
const users = collection("users");
const leads = collection("leads");
const deals = collection("deals");
const activities = collection("activities");

router.get("/", (req, res) => {
  const salespeople = users.all().filter((u) => u.role === "Sales Executive" || u.role === "Sales Manager");
  const allLeads = leads.all();
  const allDeals = deals.all();
  const allActivities = activities.all();

  const data = salespeople.map((u) => {
    const assignedLeads = allLeads.filter((l) => l.assignedTo === u.id);
    const userDeals = allDeals.filter((d) => d.assignedTo === u.id);
    const wonDeals = userDeals.filter((d) => d.stage === "Won");
    const calls = allActivities.filter((a) => a.performedBy === u.id && a.type === "Phone Call").length;
    const meetings = allActivities.filter((a) => a.performedBy === u.id && a.type === "Meeting").length;
    const revenue = wonDeals.reduce((s, d) => s + (d.expectedRevenue || 0), 0);
    const target = 500000; // static monthly target for demo purposes
    return {
      userId: u.id,
      name: u.name,
      leadsAssigned: assignedLeads.length,
      callsMade: calls,
      meetings,
      dealsClosed: wonDeals.length,
      revenueGenerated: revenue,
      target,
      targetAchievement: Math.min(100, Math.round((revenue / target) * 100)),
    };
  });

  res.json(data);
});

module.exports = router;
