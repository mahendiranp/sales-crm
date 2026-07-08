const express = require("express");
const { collection } = require("../db/store");
const { crudRouter } = require("./crudFactory");
const { requireManager } = require("../middleware/auth");

const router = express.Router();
const deals = collection("deals");

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
router.post("/:id/stage", requireManager, async (req, res) => {
  const { stage } = req.body;
  if (!STAGES.includes(stage)) return res.status(400).json({ error: "Invalid stage" });
  const probability = stage === "Won" ? 100 : stage === "Lost" ? 0 : undefined;
  const patch = { stage };
  if (probability !== undefined) patch.probability = probability;
  const updated = await deals.update(req.params.id, patch);
  if (!updated) return res.status(404).json({ error: "Deal not found" });
  res.json(updated);
});

module.exports = router;
