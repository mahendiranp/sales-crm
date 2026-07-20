// Global search — backs the header's search box and the ⌘K command
// palette (Layout.jsx). One request, fanned out across every module a
// user would actually expect "search anything" to cover: Leads, Contacts,
// Companies, Deals, Tasks, Meetings, Forms. Each collection is small
// enough per-tenant that a plain in-memory filter (same pattern the rest
// of this app already uses for ad hoc queries) is fine — no need for a
// real search index.
const express = require("express");
const { scopedCollection } = require("../db/store");

const router = express.Router();
const PER_CATEGORY_LIMIT = 5;

const matches = (value, q) => typeof value === "string" && value.toLowerCase().includes(q);

router.get("/", async (req, res) => {
  const q = String(req.query.q || "").trim().toLowerCase();
  if (!q) return res.json({ leads: [], contacts: [], companies: [], deals: [], tasks: [], meetings: [], forms: [] });

  const accountId = req.user.accountId;
  const [leads, contacts, companies, deals, tasks, meetings, forms] = await Promise.all([
    scopedCollection("leads", accountId).query((r) => matches(r.name, q)),
    scopedCollection("contacts", accountId).query((r) => matches(r.name, q)),
    scopedCollection("companies", accountId).query((r) => matches(r.name, q)),
    scopedCollection("deals", accountId).query((r) => matches(r.title, q)),
    scopedCollection("tasks", accountId).query((r) => !r.deletedAt && matches(r.title, q)),
    scopedCollection("meetings", accountId).query((r) => !r.deletedAt && matches(r.title, q)),
    scopedCollection("forms", accountId).query((r) => matches(r.name, q)),
  ]);

  res.json({
    leads: leads.slice(0, PER_CATEGORY_LIMIT).map((r) => ({ id: r.id, label: r.name, href: "/app/leads" })),
    contacts: contacts.slice(0, PER_CATEGORY_LIMIT).map((r) => ({ id: r.id, label: r.name, href: "/app/contacts" })),
    companies: companies.slice(0, PER_CATEGORY_LIMIT).map((r) => ({ id: r.id, label: r.name, href: "/app/companies" })),
    deals: deals.slice(0, PER_CATEGORY_LIMIT).map((r) => ({ id: r.id, label: r.title, href: "/app/deals" })),
    tasks: tasks.slice(0, PER_CATEGORY_LIMIT).map((r) => ({ id: r.id, label: r.title, href: `/app/tasks?open=${r.id}` })),
    meetings: meetings.slice(0, PER_CATEGORY_LIMIT).map((r) => ({ id: r.id, label: r.title, href: `/app/meetings?open=${r.id}` })),
    forms: forms.slice(0, PER_CATEGORY_LIMIT).map((r) => ({ id: r.id, label: r.name, href: `/app/forms/${r.id}/build` })),
  });
});

module.exports = router;
