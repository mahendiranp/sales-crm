const express = require("express");
const { randomUUID: uuid } = require("crypto");
const { scopedCollection } = require("../db/store");
const { crudRouter } = require("./crudFactory");
const { requireManager } = require("../middleware/auth");

const router = express.Router();
const leads = (req) => scopedCollection("leads", req.user.accountId);
const contacts = (req) => scopedCollection("contacts", req.user.accountId);

// mount base CRUD first, then add extra action routes
router.use("/", crudRouter("leads"));

// Assign a salesperson to a lead
router.post("/:id/assign", requireManager, async (req, res) => {
  const { userId } = req.body;
  const updated = await leads(req).update(req.params.id, { assignedTo: userId });
  if (!updated) return res.status(404).json({ error: "Lead not found" });
  res.json(updated);
});

// Convert a lead into a customer (Contact)
router.post("/:id/convert", requireManager, async (req, res) => {
  const lead = await leads(req).find(req.params.id);
  if (!lead) return res.status(404).json({ error: "Lead not found" });

  const contact = {
    id: uuid(),
    leadId: lead.id,
    name: lead.name,
    mobile: lead.mobile,
    email: lead.email,
    address: req.body.address || "",
    companyId: req.body.companyId || null,
    purchaseHistory: [],
    notes: req.body.notes || "",
    documents: [],
    createdAt: new Date().toISOString(),
  };
  await contacts(req).insert(contact);
  await leads(req).update(lead.id, { status: "Converted" });
  res.status(201).json({ ...contact, accountId: req.user.accountId });
});

// Merge duplicate leads: keep primary, drop the rest
router.post("/merge", requireManager, async (req, res) => {
  const { primaryId, duplicateIds } = req.body;
  const primary = await leads(req).find(primaryId);
  if (!primary) return res.status(404).json({ error: "Primary lead not found" });

  for (const dupId of duplicateIds || []) {
    await leads(req).remove(dupId);
  }
  res.json({ merged: true, primary });
});

module.exports = router;
