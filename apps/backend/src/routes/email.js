const express = require("express");
const { v4: uuid } = require("uuid");
const { collection } = require("../db/store");
const { requireManager } = require("../middleware/auth");

const router = express.Router();
const emails = collection("emails");

router.get("/", (req, res) => res.json(emails.all()));

router.post("/send", requireManager, async (req, res) => {
  const { leadId, to, subject, body } = req.body;
  const record = {
    id: uuid(),
    leadId,
    to,
    subject,
    body,
    opened: false,
    clicked: false,
    sentAt: new Date().toISOString(),
  };
  await emails.insert(record);
  res.status(201).json(record);
});

// Campaign send: same subject/body to a list of recipients
router.post("/campaign", requireManager, async (req, res) => {
  const { recipients, subject, body } = req.body; // recipients: [{leadId, to}]
  const sent = [];
  for (const r of recipients || []) {
    const record = {
      id: uuid(),
      leadId: r.leadId,
      to: r.to,
      subject,
      body,
      opened: false,
      clicked: false,
      sentAt: new Date().toISOString(),
    };
    await emails.insert(record);
    sent.push(record);
  }
  res.status(201).json({ sentCount: sent.length, messages: sent });
});

router.get("/stats", (req, res) => {
  const all = emails.all();
  const total = all.length || 1;
  const opened = all.filter((e) => e.opened).length;
  const clicked = all.filter((e) => e.clicked).length;
  res.json({
    total: all.length,
    openRate: Math.round((opened / total) * 100),
    clickRate: Math.round((clicked / total) * 100),
  });
});

module.exports = router;
