const express = require("express");
const { v4: uuid } = require("uuid");
const { collection } = require("../db/store");
const { requireManager } = require("../middleware/auth");

function crudRouter(collectionName) {
  const router = express.Router();
  const col = collection(collectionName);

  router.get("/", (req, res) => {
    res.json(col.all());
  });

  router.get("/:id", (req, res) => {
    const record = col.find(req.params.id);
    if (!record) return res.status(404).json({ error: "Not found" });
    res.json(record);
  });

  router.post("/", requireManager, (req, res) => {
    const record = {
      id: uuid(),
      ...req.body,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    col.insert(record);
    res.status(201).json(record);
  });

  router.put("/:id", requireManager, async (req, res) => {
    const updated = await col.update(req.params.id, req.body);
    if (!updated) return res.status(404).json({ error: "Not found" });
    res.json(updated);
  });

  router.delete("/:id", requireManager, async (req, res) => {
    await col.remove(req.params.id);
    res.status(204).end();
  });

  return router;
}

module.exports = { crudRouter };
