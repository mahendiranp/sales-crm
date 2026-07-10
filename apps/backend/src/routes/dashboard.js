const express = require("express");
const dayjs = require("dayjs");
const { scopedCollection } = require("../db/store");

const router = express.Router();

const SALESPERSON_ROLES = ["Sales Executive", "Sales Manager"];
const MONTHLY_TARGET_PER_REP = 500000; // matches performance.js

function wonRevenueInRange(allDeals, unit) {
  return allDeals
    .filter((d) => d.stage === "Won" && dayjs(d.updatedAt).isSame(dayjs(), unit))
    .reduce((sum, d) => sum + (d.expectedRevenue || 0), 0);
}

router.get("/", async (req, res) => {
  const accountId = req.user.accountId;
  const [allLeads, allDeals, allTasks, allActivities, allUsers, allContacts] = await Promise.all([
    scopedCollection("leads", accountId).all(),
    scopedCollection("deals", accountId).all(),
    scopedCollection("tasks", accountId).all(),
    scopedCollection("activities", accountId).all(),
    scopedCollection("users", accountId).all(),
    scopedCollection("contacts", accountId).all(),
  ]);
  const today = dayjs().format("YYYY-MM-DD");

  const totalLeads = allLeads.length;
  const newLeadsToday = allLeads.filter((l) => dayjs(l.createdAt).format("YYYY-MM-DD") === today).length;
  const followUpsDue = allTasks.filter((t) => t.status !== "Completed" && dayjs(t.dueDate).isBefore(dayjs().add(1, "day"))).length;
  const dealsWon = allDeals.filter((d) => d.stage === "Won").length;

  const wonThisMonth = allDeals.filter((d) => d.stage === "Won" && dayjs(d.updatedAt).isSame(dayjs(), "month"));
  const monthlyRevenue = wonThisMonth.reduce((sum, d) => sum + (d.expectedRevenue || 0), 0);

  const salesGraph = [];
  for (let i = 5; i >= 0; i--) {
    const month = dayjs().subtract(i, "month");
    const monthDeals = allDeals.filter((d) => d.stage === "Won" && dayjs(d.updatedAt).isSame(month, "month"));
    salesGraph.push({
      month: month.format("MMM YYYY"),
      revenue: monthDeals.reduce((sum, d) => sum + (d.expectedRevenue || 0), 0),
    });
  }

  // 1. Sales Performance — revenue of won deals by period
  const salesPerformance = {
    today: wonRevenueInRange(allDeals, "day"),
    weekly: wonRevenueInRange(allDeals, "week"),
    monthly: wonRevenueInRange(allDeals, "month"),
    yearly: wonRevenueInRange(allDeals, "year"),
  };

  // 2. Lead / pipeline status — lead-stage counts from leads, deal-stage counts from deals
  const leadStatus = {
    newLeads: allLeads.filter((l) => l.status === "New").length,
    contacted: allLeads.filter((l) => l.status === "Contacted").length,
    qualified: allLeads.filter((l) => l.status === "Qualified").length,
    proposalSent: allDeals.filter((d) => d.stage === "Quotation Sent").length,
    negotiation: allDeals.filter((d) => d.stage === "Negotiation").length,
    won: allDeals.filter((d) => d.stage === "Won").length,
    lost: allLeads.filter((l) => l.status === "Lost").length + allDeals.filter((d) => d.stage === "Lost").length,
  };

  // 3. Today's activities
  const todaysActivities = {
    meetings: allActivities.filter((a) => a.type === "Meeting" && dayjs(a.timestamp).format("YYYY-MM-DD") === today).length,
    calls: allActivities.filter((a) => a.type === "Phone Call" && dayjs(a.timestamp).format("YYYY-MM-DD") === today).length,
    followUps: allTasks.filter((t) => t.status !== "Completed" && dayjs(t.dueDate).format("YYYY-MM-DD") === today).length,
    pendingTasks: allTasks.filter((t) => t.status !== "Completed").length,
    upcomingAppointments: allActivities.filter(
      (a) => a.type === "Meeting" && dayjs(a.timestamp).isAfter(dayjs()) && dayjs(a.timestamp).isBefore(dayjs().add(7, "day"))
    ).length,
  };

  // 4. Sales team performance
  const salespeople = allUsers.filter((u) => SALESPERSON_ROLES.includes(u.role));
  const perRep = salespeople.map((u) => {
    const wonDeals = allDeals.filter((d) => d.assignedTo === u.id && d.stage === "Won");
    return {
      userId: u.id,
      name: u.name,
      dealsClosed: wonDeals.length,
      revenue: wonDeals.reduce((sum, d) => sum + (d.expectedRevenue || 0), 0),
    };
  });
  const rankedByRevenue = [...perRep].sort((a, b) => b.revenue - a.revenue);
  const teamPerformance = {
    topPerformer: rankedByRevenue[0] || null,
    lowestPerformer: rankedByRevenue[rankedByRevenue.length - 1] || null,
    dealsClosed: dealsWon,
    revenueBySalesperson: rankedByRevenue,
  };

  // 5. Revenue summary
  const allWonDeals = allDeals.filter((d) => d.stage === "Won");
  const totalRevenue = allWonDeals.reduce((sum, d) => sum + (d.expectedRevenue || 0), 0);
  const targetRevenue = MONTHLY_TARGET_PER_REP * Math.max(salespeople.length, 1);
  const revenueSummary = {
    totalRevenue,
    targetRevenue,
    achievementPct: Math.min(100, Math.round((monthlyRevenue / targetRevenue) * 100)),
    avgDealValue: allWonDeals.length ? Math.round(totalRevenue / allWonDeals.length) : 0,
  };

  // 6. Lead sources
  const sourceCounts = {};
  allLeads.forEach((l) => {
    const key = l.source || "Unknown";
    sourceCounts[key] = (sourceCounts[key] || 0) + 1;
  });
  const leadSources = Object.entries(sourceCounts)
    .map(([source, count]) => ({ source, count }))
    .sort((a, b) => b.count - a.count);

  // 7. Notifications — derived from real events (no dedicated notifications collection yet)
  const notifications = [];
  const latestLead = [...allLeads].sort((a, b) => dayjs(b.createdAt).diff(dayjs(a.createdAt)))[0];
  if (latestLead) {
    const owner = allUsers.find((u) => u.id === latestLead.assignedTo);
    notifications.push({
      type: "New Lead Assigned",
      message: `${latestLead.name} assigned to ${owner ? owner.name : "unassigned"}`,
      timestamp: latestLead.createdAt,
    });
  }
  const latestWonDeal = [...allWonDeals].sort((a, b) => dayjs(b.updatedAt).diff(dayjs(a.updatedAt)))[0];
  if (latestWonDeal) {
    notifications.push({
      type: "Deal Closed",
      message: `"${latestWonDeal.title}" closed for ₹${(latestWonDeal.expectedRevenue || 0).toLocaleString("en-IN")}`,
      timestamp: latestWonDeal.updatedAt,
    });
  }
  const nextFollowUp = allTasks
    .filter((t) => t.status !== "Completed" && dayjs(t.dueDate).isAfter(dayjs()))
    .sort((a, b) => dayjs(a.dueDate).diff(dayjs(b.dueDate)))[0];
  if (nextFollowUp) {
    notifications.push({
      type: "Follow-up Reminder",
      message: `"${nextFollowUp.title}" due ${dayjs(nextFollowUp.dueDate).format("DD MMM")}`,
      timestamp: nextFollowUp.dueDate,
    });
  }
  const overdueCount = allTasks.filter((t) => t.status !== "Completed" && dayjs(t.dueDate).isBefore(dayjs())).length;
  if (overdueCount > 0) {
    notifications.push({
      type: "Overdue Tasks",
      message: `${overdueCount} task${overdueCount > 1 ? "s are" : " is"} overdue`,
      timestamp: dayjs().toISOString(),
    });
  }
  const birthdayToday = allContacts.find((c) => c.birthday && dayjs(c.birthday).format("MM-DD") === dayjs().format("MM-DD"));
  if (birthdayToday) {
    notifications.push({
      type: "Customer Birthday",
      message: `It's ${birthdayToday.name}'s birthday today — send a greeting`,
      timestamp: dayjs().toISOString(),
    });
  }
  const upcomingRenewal = allContacts
    .filter((c) => c.contractRenewalDate && dayjs(c.contractRenewalDate).isAfter(dayjs()) && dayjs(c.contractRenewalDate).isBefore(dayjs().add(30, "day")))
    .sort((a, b) => dayjs(a.contractRenewalDate).diff(dayjs(b.contractRenewalDate)))[0];
  if (upcomingRenewal) {
    notifications.push({
      type: "Contract Renewal Reminder",
      message: `${upcomingRenewal.name}'s contract renews ${dayjs(upcomingRenewal.contractRenewalDate).format("DD MMM")}`,
      timestamp: upcomingRenewal.contractRenewalDate,
    });
  }

  // Rule-based AI suggestions (mock — swap for a real LLM call in production)
  const suggestions = [];
  const staleLeads = allLeads.filter(
    (l) => l.status !== "Converted" && l.status !== "Lost" && dayjs().diff(dayjs(l.updatedAt), "day") > 5
  );
  if (staleLeads.length > 0) {
    const hottest = [...staleLeads].sort((a, b) => (b.budget || 0) - (a.budget || 0))[0];
    suggestions.push(`🔥 Contact ${hottest.name} today (highest budget among ${staleLeads.length} stale lead${staleLeads.length > 1 ? "s" : ""})`);
  }
  if (overdueCount > 0) {
    suggestions.push(`📞 ${overdueCount} follow-up${overdueCount > 1 ? "s are" : " is"} overdue`);
  }
  if (leadSources.length > 1) {
    const best = leadSources[0];
    suggestions.push(`📈 ${best.source} is your top lead source this month with ${best.count} lead${best.count > 1 ? "s" : ""}`);
  }
  if (revenueSummary.achievementPct < 85) {
    suggestions.push(`⚠️ Revenue is ${100 - revenueSummary.achievementPct}% below the monthly target`);
  }
  if (rankedByRevenue.length > 0 && rankedByRevenue[0].revenue > 0) {
    suggestions.push(`⭐ ${rankedByRevenue[0].name} has the highest revenue this month`);
  }
  const negotiationDeals = allDeals.filter((d) => d.stage === "Negotiation");
  if (negotiationDeals.length > 0) {
    const stalledDeal = [...negotiationDeals].sort((a, b) => dayjs(a.updatedAt).diff(dayjs(b.updatedAt)))[0];
    suggestions.push(`💰 Offer a discount to ${stalledDeal.contactName || stalledDeal.title} to close the deal`);
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
    salesPerformance,
    leadStatus,
    todaysActivities,
    teamPerformance,
    revenueSummary,
    leadSources,
    notifications,
  });
});

module.exports = router;
