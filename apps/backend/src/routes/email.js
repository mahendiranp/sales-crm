const express = require("express");
const { randomUUID: uuid } = require("crypto");
const { scopedCollection } = require("../db/store");
const { requireManager } = require("../middleware/auth");

const router = express.Router();

router.get("/", async (req, res) => res.json(await scopedCollection("emails", req.user.accountId).all()));

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
  await scopedCollection("emails", req.user.accountId).insert(record);
  res.status(201).json({ ...record, accountId: req.user.accountId });
});

// Campaign send: same subject/body to a list of recipients
router.post("/campaign", requireManager, async (req, res) => {
  const { recipients, subject, body } = req.body; // recipients: [{leadId, to}]
  const emails = scopedCollection("emails", req.user.accountId);
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

router.get("/stats", async (req, res) => {
  const all = await scopedCollection("emails", req.user.accountId).all();
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
