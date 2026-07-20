const express = require("express");
const { crudRouter } = require("./crudFactory");

const router = express.Router();

router.use("/contacts", crudRouter("contacts"));
router.use("/companies", crudRouter("companies"));
router.use("/activities", crudRouter("activities"));
// Tasks has its own dedicated router now (routes/tasks.js, mounted
// directly in app.js) — a real schema (assignee, priority, status,
// soft delete) instead of crudFactory's arbitrary-shape CRUD.
router.use("/templates", crudRouter("templates"));
router.use("/users", crudRouter("users"));
router.use("/teams", crudRouter("teams"));
router.use("/invoices", crudRouter("invoices"));
router.use("/expenses", crudRouter("expenses"));
router.use("/documents", crudRouter("documents"));

module.exports = router;
