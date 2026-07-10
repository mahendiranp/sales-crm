const express = require("express");
const { randomUUID: uuid } = require("crypto");
const { scopedCollection } = require("../db/store");
const { requireManager } = require("../middleware/auth");

function crudRouter(collectionName) {
  const router = express.Router();
  // Scoped fresh per request using the authenticated caller's tenant —
  // req.user only exists once requireAuth has run (see index.js), which
  // happens for every route this factory mounts under.
  const col = (req) => scopedCollection(collectionName, req.user.accountId);

  router.get("/", async (req, res) => {
    res.json(await col(req).all());
  });

  router.get("/:id", async (req, res) => {
    const record = await col(req).find(req.params.id);
    if (!record) return res.status(404).json({ error: "Not found" });
    res.json(record);
  });

  router.post("/", requireManager, async (req, res) => {
    const record = {
      ...req.body,
      // Always generated/stamped server-side — never trust an id or
      // accountId the client tried to slip into the request body.
      id: uuid(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await col(req).insert(record);
    res.status(201).json({ ...record, accountId: req.user.accountId });
  });

  router.put("/:id", requireManager, async (req, res) => {
    const updated = await col(req).update(req.params.id, req.body);
    if (!updated) return res.status(404).json({ error: "Not found" });
    res.json(updated);
  });

  router.delete("/:id", requireManager, async (req, res) => {
    const removed = await col(req).remove(req.params.id);
    if (!removed) return res.status(404).json({ error: "Not found" });
    res.status(204).end();
  });

  return router;
}

module.exports = { crudRouter };
