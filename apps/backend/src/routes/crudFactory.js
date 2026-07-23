const express = require("express");
const { randomUUID: uuid } = require("crypto");
const { scopedCollection } = require("../db/store");
const { requirePermission } = require("../middleware/permissions");
const { recordEvent } = require("../services/eventEngine");

// "tasks" -> "task", "companies" -> "company" — every collection this
// factory mounts (see simpleModules.js) is a plain plural English noun, so
// this covers all of them without needing a per-collection override table.
function singularize(name) {
  if (name.endsWith("ies")) return `${name.slice(0, -3)}y`;
  if (name.endsWith("s")) return name.slice(0, -1);
  return name;
}

// Best-effort human label for an event's payload — a generic Activity
// Timeline showing "Lead created" with nothing but a UUID isn't useful;
// every record this factory manages has one of these fields as its
// natural display name.
function displayName(record) {
  return record.name || record.title || record.email || null;
}

function crudRouter(collectionName) {
  const router = express.Router();
  const entityType = singularize(collectionName);
  // Scoped fresh per request using the authenticated caller's tenant —
  // req.user only exists once requireAuth has run (see index.js), which
  // happens for every route this factory mounts under.
  const col = (req) => scopedCollection(collectionName, req.user.accountId);

  // Opt-in pagination: pass ?page=1&limit=50 to get { items, total, page,
  // limit, totalPages } instead of a bare array. Omitting page keeps the
  // old behavior (full array) so existing views don't need to change —
  // new/updated views can adopt pagination without a breaking API change.
  router.get("/", requirePermission(`${collectionName}.view`), async (req, res) => {
    if (req.query.page) {
      const result = await col(req).paginate({ page: req.query.page, limit: req.query.limit });
      return res.json(result);
    }
    res.json(await col(req).all());
  });

  router.get("/:id", requirePermission(`${collectionName}.view`), async (req, res) => {
    const record = await col(req).find(req.params.id);
    if (!record) return res.status(404).json({ error: "Not found" });
    res.json(record);
  });

  router.post("/", requirePermission(`${collectionName}.create`), async (req, res) => {
    const record = {
      ...req.body,
      // Always generated/stamped server-side — never trust an id or
      // accountId the client tried to slip into the request body.
      id: uuid(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await col(req).insert(record);
    await recordEvent({
      accountId: req.user.accountId,
      type: `${entityType}.created`,
      entityType,
      entityId: record.id,
      actorId: req.user.id,
      actorName: req.user.email,
      source: collectionName,
      payload: { name: displayName(record) },
    });
    res.status(201).json({ ...record, accountId: req.user.accountId });
  });

  router.put("/:id", requirePermission(`${collectionName}.edit`), async (req, res) => {
    const updated = await col(req).update(req.params.id, req.body);
    if (!updated) return res.status(404).json({ error: "Not found" });
    await recordEvent({
      accountId: req.user.accountId,
      type: `${entityType}.updated`,
      entityType,
      entityId: updated.id,
      actorId: req.user.id,
      actorName: req.user.email,
      source: collectionName,
      payload: { name: displayName(updated) },
    });
    res.json(updated);
  });

  router.delete("/:id", requirePermission(`${collectionName}.delete`), async (req, res) => {
    // remove() only returns a boolean — fetch first so the delete event's
    // payload can still name what was deleted, not just its id.
    const existing = await col(req).find(req.params.id);
    const removed = await col(req).remove(req.params.id);
    if (!removed) return res.status(404).json({ error: "Not found" });
    await recordEvent({
      accountId: req.user.accountId,
      type: `${entityType}.deleted`,
      entityType,
      entityId: req.params.id,
      actorId: req.user.id,
      actorName: req.user.email,
      source: collectionName,
      payload: { name: existing ? displayName(existing) : null },
    });
    res.status(204).end();
  });

  return router;
}

module.exports = { crudRouter };
