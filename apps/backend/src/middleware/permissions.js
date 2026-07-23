// Granular RBAC: named roles, each granted an explicit set of "module.action"
// permission strings (e.g. "forms.create", "billing.manage"). This replaces
// the old flat view/edit/full rank (still kept in middleware/auth.js for
// anything not yet converted — see requirePermission's fallback below) with
// real per-module control: a Manager can fully run CRM but not touch
// billing; an Employee can create leads but not delete them; a Viewer can't
// write anywhere.
//
// A permission set entry of "<module>.*" grants every action on that
// module — checked via prefix match in roleHasPermission, not by
// pre-enumerating every action a module happens to support today, so
// adding a new action to an existing module (e.g. "forms.archive") doesn't
// require touching every role that already has "forms.*".
const ROLES = ["owner", "admin", "manager", "employee", "viewer"];

// Every business module a real CRUD route in this app actually gates on.
// "crm" doesn't exist as one module here — leads/deals/contacts/companies/
// activities are each their own module, matching how the route files are
// actually split, not the illustrative single "crm.*" grouping.
// Note: "users"/"teams" here are the generic CRUD-factory-backed directory
// modules (routes/simpleModules.js) — an internal contacts-style directory,
// NOT the same thing as tenant login/teammate management, which lives under
// /api/auth/team and is gated separately by requireOwner (owner-only,
// regardless of this permission table — see routes/auth.js).
const BUSINESS_MODULES = [
  "forms",
  "leads",
  "deals",
  "contacts",
  "companies",
  "activities",
  "tasks",
  "meetings",
  "documents",
  "invoices",
  "expenses",
  "templates",
  "users",
  "teams",
];

function wildcard(modules) {
  return modules.map((m) => `${m}.*`);
}

const ROLE_PERMISSIONS = {
  // Tenant owner — everything, including billing and full team management.
  owner: new Set(["*"]),
  // Runs day-to-day operations across every business module and can invite/
  // view teammates, but can't touch billing or remove/promote other users —
  // those stay owner-only (enforced separately by requireOwner in auth.js).
  admin: new Set([...wildcard(BUSINESS_MODULES), "workflow.publish", "users.view", "users.invite", "settings.view"]),
  // Same business-module access as admin, no team/settings access at all.
  manager: new Set([...wildcard(BUSINESS_MODULES), "workflow.publish"]),
  // Can create/edit but never delete, and never sees invoices/expenses
  // (financial records) — matches the old "edit" rank's intent, made explicit.
  employee: new Set(
    ["forms", "leads", "deals", "contacts", "companies", "activities", "tasks", "meetings", "documents"].flatMap(
      (m) => [`${m}.view`, `${m}.create`, `${m}.edit`]
    )
  ),
  // Read-only everywhere.
  viewer: new Set([...BUSINESS_MODULES, "workflow", "billing", "users", "settings"].map((m) => `${m}.view`)),
};

function roleHasPermission(role, permission) {
  const perms = ROLE_PERMISSIONS[role];
  if (!perms) return false;
  if (perms.has("*") || perms.has(permission)) return true;
  const [mod] = permission.split(".");
  return perms.has(`${mod}.*`);
}

// Legacy accounts (created before roles existed) only ever had
// permission: "view" | "edit" | "full" — this derives a reasonable role so
// nothing breaks until the owner explicitly assigns a real role from
// Settings -> Team. "edit" maps to "employee" (the lower of the two roles
// that rank could plausibly mean) rather than "manager", since there's no
// way to recover which one was actually intended from the old data.
function legacyRoleFor(account) {
  if (account.isMasterAdmin || account.authRole === "admin") return "owner";
  if (account.permission === "full") return "admin";
  if (account.permission === "edit") return "employee";
  return "viewer";
}

function roleFor(account) {
  return ROLES.includes(account.role) ? account.role : legacyRoleFor(account);
}

// Authorization middleware — run after requireAuth. The platform master
// admin bypasses tenant RBAC entirely (same as it already bypasses the old
// rank checks via effectivePermission), since it operates across tenants,
// not within one's role structure.
function requirePermission(permission) {
  return (req, res, next) => {
    if (req.user?.isMasterAdmin) return next();
    if (!roleHasPermission(req.user?.role, permission)) {
      return res.status(403).json({ error: `Your role doesn't have permission to do that (${permission}).` });
    }
    next();
  };
}

// Keeps the old view/edit/full rank (still read by a few not-yet-converted
// routes, e.g. requireManager/requireFullAccess in middleware/auth.js) in
// sync with a teammate's real role, so a route that hasn't been migrated to
// requirePermission yet still sees a sane rank instead of silently locking
// out an admin/manager assigned only a `role`.
const ROLE_TO_RANK = { owner: "full", admin: "full", manager: "edit", employee: "edit", viewer: "view" };

module.exports = { ROLES, ROLE_PERMISSIONS, ROLE_TO_RANK, roleHasPermission, roleFor, legacyRoleFor, requirePermission };
