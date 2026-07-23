const express = require("express");
const { scopedCollection } = require("../db/store");
const { crudRouter } = require("./crudFactory");
const { requirePermission } = require("../middleware/permissions");

const router = express.Router();

router.use("/", crudRouter("deals"));

const STAGES = [
  "New Lead",
  "Qualified",
  "Meeting Scheduled",
  "Quotation Sent",
  "Negotiation",
  "Won",
  "Lost",
];

router.get("/meta/stages", (req, res) => res.json(STAGES));

// Move a deal to a new pipeline stage
router.post("/:id/stage", requirePermission("deals.edit"), async (req, res) => {
  const { stage } = req.body;
  if (!STAGES.includes(stage)) return res.status(400).json({ error: "Invalid stage" });
  const probability = stage === "Won" ? 100 : stage === "Lost" ? 0 : undefined;
  const patch = { stage };
  if (probability !== undefined) patch.probability = probability;
  const deals = scopedCollection("deals", req.user.accountId);
  const updated = await deals.update(req.params.id, patch);
  if (!updated) return res.status(404).json({ error: "Deal not found" });
  res.json(updated);
});

module.exports = router;
