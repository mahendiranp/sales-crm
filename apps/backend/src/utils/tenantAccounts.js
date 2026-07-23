// Shared helper for the repeated "(await accounts.all()).filter(...)"
// pattern used across routes/services to get the login accounts that
// belong to a given tenant (accountId) — the accounts collection is
// cross-tenant, so every caller needs this same filter.
const { collection } = require("../db/store");

const accounts = collection("accounts");

async function tenantAccountsFor(accountId) {
  return (await accounts.all()).filter((a) => (a.accountId || a.id) === accountId);
}

module.exports = { tenantAccountsFor };
