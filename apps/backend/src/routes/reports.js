const express = require("express");
const dayjs = require("dayjs");
const XLSX = require("xlsx");
const PDFDocument = require("pdfkit");
const { collection } = require("../db/store");

const router = express.Router();
const deals = collection("deals");
const users = collection("users");

function wonDealsInRange(start, end) {
  return deals.all().filter(
    (d) => d.stage === "Won" && dayjs(d.updatedAt).isAfter(dayjs(start).subtract(1, "second")) && dayjs(d.updatedAt).isBefore(dayjs(end).add(1, "second"))
  );
}

function buildReport(period) {
  const now = dayjs();
  let start, end;
  if (period === "daily") {
    start = now.startOf("day");
    end = now.endOf("day");
  } else if (period === "weekly") {
    start = now.startOf("week");
    end = now.endOf("week");
  } else {
    start = now.startOf("month");
    end = now.endOf("month");
  }
  const won = wonDealsInRange(start, end);
  const allUsers = users.all();

  const productWise = {};
  won.forEach((d) => (d.products || []).forEach((p) => {
    productWise[p] = (productWise[p] || 0) + (d.expectedRevenue || 0);
  }));

  const employeePerformance = {};
  won.forEach((d) => {
    const name = allUsers.find((u) => u.id === d.assignedTo)?.name || "Unassigned";
    employeePerformance[name] = (employeePerformance[name] || 0) + (d.expectedRevenue || 0);
  });

  return {
    period,
    range: { start: start.toISOString(), end: end.toISOString() },
    dealsWon: won.length,
    totalRevenue: won.reduce((s, d) => s + (d.expectedRevenue || 0), 0),
    productWise,
    employeePerformance,
    deals: won,
  };
}

router.get("/:period", (req, res) => {
  const { period } = req.params;
  if (!["daily", "weekly", "monthly"].includes(period)) {
    return res.status(400).json({ error: "period must be daily, weekly, or monthly" });
  }
  res.json(buildReport(period));
});

router.get("/:period/export/excel", (req, res) => {
  const report = buildReport(req.params.period);
  const wb = XLSX.utils.book_new();

  const summarySheet = XLSX.utils.json_to_sheet([
    { Metric: "Deals Won", Value: report.dealsWon },
    { Metric: "Total Revenue", Value: report.totalRevenue },
  ]);
  XLSX.utils.book_append_sheet(wb, summarySheet, "Summary");

  const dealsSheet = XLSX.utils.json_to_sheet(
    report.deals.map((d) => ({
      Title: d.title,
      Revenue: d.expectedRevenue,
      ClosingDate: d.closingDate,
      Products: (d.products || []).join(", "),
    }))
  );
  XLSX.utils.book_append_sheet(wb, dealsSheet, "Deals");

  const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
  res.setHeader("Content-Disposition", `attachment; filename=${report.period}-sales-report.xlsx`);
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.send(buffer);
});

router.get("/:period/export/pdf", (req, res) => {
  const report = buildReport(req.params.period);
  const doc = new PDFDocument({ margin: 40 });
  res.setHeader("Content-Disposition", `attachment; filename=${report.period}-sales-report.pdf`);
  res.setHeader("Content-Type", "application/pdf");
  doc.pipe(res);

  doc.fontSize(18).text(`${report.period.toUpperCase()} SALES REPORT`, { align: "center" });
  doc.moveDown();
  doc.fontSize(12).text(`Range: ${dayjs(report.range.start).format("DD MMM YYYY")} - ${dayjs(report.range.end).format("DD MMM YYYY")}`);
  doc.text(`Deals Won: ${report.dealsWon}`);
  doc.text(`Total Revenue: ₹${report.totalRevenue.toLocaleString("en-IN")}`);
  doc.moveDown();
  doc.fontSize(14).text("Deals", { underline: true });
  doc.moveDown(0.5);
  report.deals.forEach((d) => {
    doc.fontSize(10).text(`${d.title}  —  ₹${(d.expectedRevenue || 0).toLocaleString("en-IN")}  —  Closing: ${dayjs(d.closingDate).format("DD MMM YYYY")}`);
  });

  doc.end();
});

module.exports = router;
