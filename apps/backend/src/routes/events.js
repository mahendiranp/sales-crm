// Read API for the Event Engine (services/eventEngine.js) — backs the
// Activity Timeline page. Read-only: events are only ever written by
// recordEvent() calls scattered through the app, never through this API.
//
// Deliberately doesn't validate `type`/`entityType`/`source` against the
// EVENT_TYPES/EVENT_SOURCES allowlists in eventEngine.js — those constants
// only cover the events explicitly named there (forms, tasks, payments,
// comments); crudFactory.js's generic CRUD (leads, deals, contacts, ...)
// emits "lead.created" etc. dynamically without ever referencing the
// enum, so a strict filter here would silently reject real, valid values.
const express = require("express");
const { scopedCollection } = require("../db/store");

const router = express.Router();
const eventsFor = (req) => scopedCollection("events", req.user.accountId);

// GET /api/events?type=&entityType=&source=&actorId=&from=&to=&search=&page=&limit=
// Newest first. `from`/`to` are ISO timestamps (inclusive/exclusive) —
// the frontend computes Today/Yesterday/This Week/Last Month/Custom
// bounds itself and just sends the resulting range, so this endpoint
// stays a single simple filter rather than special-casing each preset.
router.get("/", async (req, res) => {
  const { type, entityType, source, actorId, from, to, search, page = 1, limit = 50 } = req.query;

  const filter = {};
  if (type) filter.type = type;
  if (entityType) filter.entityType = entityType;
  if (source) filter.source = source;
  // "Created By Me" / "by teammate X" — actorId is null on system/public
  // events (an anonymous form submission, an auto-resolve), so this only
  // ever matches events that really do have an actor.
  if (actorId) filter.actorId = actorId;
  if (from || to) {
    filter.createdAt = {};
    if (from) filter.createdAt.$gte = from;
    if (to) filter.createdAt.$lt = to;
  }
  if (search) {
    const escaped = String(search).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    filter.$or = [
      { type: { $regex: escaped, $options: "i" } },
      { "payload.name": { $regex: escaped, $options: "i" } },
      { "payload.title": { $regex: escaped, $options: "i" } },
      { "payload.formName": { $regex: escaped, $options: "i" } },
    ];
  }

  const result = await eventsFor(req).paginate({ filter, page, limit, sort: { createdAt: -1 } });
  res.json(result);
});

// GET /api/events/sources — every distinct (type, source, entityType)
// combination this account has actually produced, so the frontend's
// filter chips only ever offer options that can return results (no
// "Meetings"/"Calls" chips for sources that don't exist yet).
router.get("/meta/sources", async (req, res) => {
  const all = await eventsFor(req).all();
  const sources = [...new Set(all.map((e) => e.source))].sort();
  const entityTypes = [...new Set(all.map((e) => e.entityType))].sort();
  // Only actors who've actually produced an event — same reasoning as
  // sources/entityTypes above, so a "by user" filter never offers someone
  // who's never done anything yet.
  const actors = [...new Map(all.filter((e) => e.actorId).map((e) => [e.actorId, e.actorName])).entries()].map(([id, name]) => ({ id, name }));
  res.json({ sources, entityTypes, actors });
});

module.exports = router;
