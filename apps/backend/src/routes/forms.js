const express = require("express");
const dayjs = require("dayjs");
const XLSX = require("xlsx");
const { randomUUID: uuid } = require("crypto");
const { collection, scopedCollection } = require("../db/store");
const { requireManager } = require("../middleware/auth");
const { encryptAnswers, decryptResponse } = require("../utils/formCrypto");
const { listTemplates, getTemplate } = require("../data/formTemplates");

const router = express.Router();
// Public routes (/public, /responses POST) bypass auth entirely (see
// index.js's PUBLIC_ROUTES allowlist), so they use the raw, unscoped
// collection — there's no req.user to scope by. Every admin-facing route
// below scopes fresh per request via req.user.accountId instead.
const rawForms = collection("forms");
const rawResponses = collection("form_responses");
const formsFor = (req) => scopedCollection("forms", req.user.accountId);
const responsesFor = (req) => scopedCollection("form_responses", req.user.accountId);

async function withResponseCount(form, allResponses) {
  const count = (allResponses || (await rawResponses.query((r) => r.formId === form.id))).filter((r) => r.formId === form.id).length;
  return { ...form, responseCount: count };
}

router.get("/stats", async (req, res) => {
  const [allForms, allResponses] = await Promise.all([formsFor(req).all(), responsesFor(req).all()]);
  const recentResponses = [...allResponses]
    .sort((a, b) => dayjs(b.submittedAt).diff(dayjs(a.submittedAt)))
    .slice(0, 5)
    .map((r) => ({ ...decryptResponse(r), formName: allForms.find((f) => f.id === r.formId)?.name || "Unknown form" }));
  res.json({
    totalForms: allForms.length,
    totalResponses: allResponses.length,
    recentResponses,
  });
});

router.get("/", async (req, res) => {
  const [allForms, allResponses] = await Promise.all([formsFor(req).all(), responsesFor(req).all()]);
  const withCounts = await Promise.all(allForms.map((f) => withResponseCount(f, allResponses)));
  res.json(withCounts.sort((a, b) => dayjs(b.updatedAt).diff(dayjs(a.updatedAt))));
});

router.get("/templates", (req, res) => {
  res.json(listTemplates());
});

router.post("/from-template", requireManager, async (req, res) => {
  const { templateKey, name } = req.body;
  const template = getTemplate(templateKey);
  if (!template) return res.status(404).json({ error: "Template not found" });

  const form = {
    id: uuid(),
    name: name?.trim() || template.name,
    description: template.description,
    fields: template.fields.map((f) => ({ ...f, id: uuid() })),
    settings: { submitButtonText: "Submit", confirmationMessage: "Thanks for your submission!" },
    status: "Draft",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  await formsFor(req).insert(form);
  res.status(201).json({ ...form, accountId: req.user.accountId });
});

// Public, unauthenticated: only exposes published forms, and only the
// fields needed to render + submit them (no response counts/settings internals).
router.get("/:id/public", async (req, res) => {
  const form = await rawForms.find(req.params.id);
  if (!form || form.status !== "Published") return res.status(404).json({ error: "Form not found or not published" });
  res.json({ id: form.id, name: form.name, description: form.description, fields: form.fields, settings: form.settings });
});

// Manager-only: same shape as /public but works regardless of publish
// status, so Draft forms can be previewed before going live.
router.get("/:id/preview", requireManager, async (req, res) => {
  const form = await formsFor(req).find(req.params.id);
  if (!form) return res.status(404).json({ error: "Not found" });
  res.json({ id: form.id, name: form.name, description: form.description, fields: form.fields, settings: form.settings });
});

router.get("/:id", async (req, res) => {
  const form = await formsFor(req).find(req.params.id);
  if (!form) return res.status(404).json({ error: "Not found" });
  res.json(await withResponseCount(form));
});

router.post("/", requireManager, async (req, res) => {
  const form = {
    id: uuid(),
    name: req.body.name || "Untitled Form",
    description: req.body.description || "",
    fields: req.body.fields || [],
    settings: req.body.settings || {},
    status: "Draft",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  await formsFor(req).insert(form);
  res.status(201).json({ ...form, accountId: req.user.accountId });
});

router.put("/:id", requireManager, async (req, res) => {
  const updated = await formsFor(req).update(req.params.id, req.body);
  if (!updated) return res.status(404).json({ error: "Not found" });
  res.json(updated);
});

router.delete("/:id", requireManager, async (req, res) => {
  const form = await formsFor(req).find(req.params.id);
  if (!form) return res.status(404).json({ error: "Not found" });
  const formResponses = await responsesFor(req).query((r) => r.formId === req.params.id);
  await Promise.all(formResponses.map((r) => responsesFor(req).remove(r.id)));
  await formsFor(req).remove(req.params.id);
  res.status(204).end();
});

router.post("/:id/duplicate", requireManager, async (req, res) => {
  const form = await formsFor(req).find(req.params.id);
  if (!form) return res.status(404).json({ error: "Not found" });
  const copy = {
    ...form,
    id: uuid(),
    name: `${form.name} (Copy)`,
    status: "Draft",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  await formsFor(req).insert(copy);
  res.status(201).json({ ...copy, accountId: req.user.accountId });
});

router.put("/:id/publish", requireManager, async (req, res) => {
  const updated = await formsFor(req).update(req.params.id, { status: "Published" });
  if (!updated) return res.status(404).json({ error: "Not found" });
  res.json(updated);
});

router.put("/:id/unpublish", requireManager, async (req, res) => {
  const updated = await formsFor(req).update(req.params.id, { status: "Draft" });
  if (!updated) return res.status(404).json({ error: "Not found" });
  res.json(updated);
});

router.get("/:id/responses", async (req, res) => {
  const form = await formsFor(req).find(req.params.id);
  if (!form) return res.status(404).json({ error: "Not found" });

  const { q, fieldId, value } = req.query;
  // Answers are encrypted at rest — decrypt before filtering/searching or
  // matches against ciphertext would silently never hit.
  let list = (await responsesFor(req).query((r) => r.formId === req.params.id)).map(decryptResponse);

  if (fieldId && value) {
    list = list.filter((r) => String(r.answers?.[fieldId] ?? "").toLowerCase() === String(value).toLowerCase());
  }
  if (q) {
    const needle = q.toLowerCase();
    list = list.filter((r) => Object.values(r.answers || {}).some((v) => String(v ?? "").toLowerCase().includes(needle)));
  }

  res.json(list.sort((a, b) => dayjs(b.submittedAt).diff(dayjs(a.submittedAt))));
});

// Public submission — anonymous form-fillers and the WhatsApp survey engine
// have no session, so the response inherits the *form's* tenant, not a
// (nonexistent) requester's.
router.post("/:id/responses", async (req, res) => {
  const form = await rawForms.find(req.params.id);
  if (!form) return res.status(404).json({ error: "Not found" });
  const response = {
    id: uuid(),
    formId: req.params.id,
    // Customer-submitted answers are encrypted (AES-256-GCM) before being
    // written to Mongo — see utils/formCrypto.js.
    answers: encryptAnswers(req.body.answers || {}),
    submittedAt: new Date().toISOString(),
    accountId: form.accountId,
  };
  await rawResponses.insert(response);
  res.status(201).json(decryptResponse(response));
});

router.delete("/:id/responses/:responseId", requireManager, async (req, res) => {
  const removed = await responsesFor(req).remove(req.params.responseId);
  if (!removed) return res.status(404).json({ error: "Not found" });
  res.status(204).end();
});

function responseRows(form, formResponses) {
  return formResponses.map((r) => {
    const row = { "Submitted At": dayjs(r.submittedAt).format("YYYY-MM-DD HH:mm") };
    form.fields.forEach((f) => {
      row[f.label] = r.answers?.[f.id] ?? "";
    });
    return row;
  });
}

router.get("/:id/responses/export/csv", async (req, res) => {
  const form = await formsFor(req).find(req.params.id);
  if (!form) return res.status(404).json({ error: "Not found" });
  const formResponses = (await responsesFor(req).query((r) => r.formId === req.params.id)).map(decryptResponse);
  const rows = responseRows(form, formResponses);
  const headers = rows.length ? Object.keys(rows[0]) : ["Submitted At", ...form.fields.map((f) => f.label)];
  const escape = (v) => `"${String(v).replace(/"/g, '""')}"`;
  const csv = [headers.map(escape).join(","), ...rows.map((row) => headers.map((h) => escape(row[h] ?? "")).join(","))].join("\n");
  res.setHeader("Content-Disposition", `attachment; filename=${form.name.replace(/\s+/g, "_")}-responses.csv`);
  res.setHeader("Content-Type", "text/csv");
  res.send(csv);
});

router.get("/:id/responses/export/excel", async (req, res) => {
  const form = await formsFor(req).find(req.params.id);
  if (!form) return res.status(404).json({ error: "Not found" });
  const formResponses = (await responsesFor(req).query((r) => r.formId === req.params.id)).map(decryptResponse);
  const rows = responseRows(form, formResponses);
  const wb = XLSX.utils.book_new();
  const sheet = XLSX.utils.json_to_sheet(rows);
  XLSX.utils.book_append_sheet(wb, sheet, "Responses");
  const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
  res.setHeader("Content-Disposition", `attachment; filename=${form.name.replace(/\s+/g, "_")}-responses.xlsx`);
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.send(buffer);
});

module.exports = router;
