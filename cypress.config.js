const { defineConfig } = require("cypress");
const { MongoClient } = require("mongodb");
const { addCucumberPreprocessorPlugin } = require("@badeball/cypress-cucumber-preprocessor");
const createBundler = require("@bahmutov/cypress-esbuild-preprocessor");
const { createEsbuildPlugin } = require("@badeball/cypress-cucumber-preprocessor/esbuild");

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/sales_crm";

module.exports = defineConfig({
  e2e: {
    baseUrl: "http://localhost:3000",
    viewportWidth: 1440,
    viewportHeight: 900,
    video: false,
    screenshotOnRunFailure: true,
    supportFile: false,
    // Plain Cypress specs (existing suite) and Gherkin .feature files
    // (backed by @badeball/cypress-cucumber-preprocessor) live side by
    // side — this repo isn't migrating everything to Gherkin, just using
    // it where a scenario is meant to read as product-level behavior
    // first (see cypress/e2e/leaveRequest.feature).
    specPattern: ["cypress/e2e/**/*.cy.js", "cypress/e2e/**/*.feature"],
    async setupNodeEvents(on, config) {
      on("task", {
        // Backdates a real magic-link claim token's expiry so a test can
        // assert on genuine TTL expiry instead of just "token doesn't
        // exist" — there's no way to fast-forward 24h any other way
        // without a fake-timers setup the actual backend process doesn't
        // share, since the expiry check runs there, not in the browser.
        async expireClaimToken(responseId) {
          const client = new MongoClient(MONGODB_URI);
          try {
            await client.connect();
            await client
              .db()
              .collection("form_responses")
              .updateOne({ id: responseId }, { $set: { claimTokenExpiresAt: new Date(Date.now() - 1000).toISOString() } });
          } finally {
            await client.close();
          }
          return null;
        },
        // Backdates a real event's createdAt so a test can push it past a
        // rule's time threshold (e.g. approvalPending48h's 48h) without
        // waiting on real time — the same reasoning as expireClaimToken
        // above, since the check runs in the backend process, not the
        // browser under test.
        async backdateEvent({ type, entityId, hoursAgo }) {
          const client = new MongoClient(MONGODB_URI);
          try {
            await client.connect();
            await client
              .db()
              .collection("events")
              .updateOne({ type, entityId }, { $set: { createdAt: new Date(Date.now() - hoursAgo * 60 * 60 * 1000).toISOString() } });
          } finally {
            await client.close();
          }
          return null;
        },
        // Runs the real Rule Engine directly against the same database the
        // backend process under test uses — used by leaveRequest.feature's
        // "the recommendation engine evaluates business rules" step, since
        // that scenario calls out rule evaluation as its own explicit step
        // rather than relying on it happening as a side effect of some
        // other action (contrast aiCenter.cy.js, which triggers it
        // indirectly via a second form submission, matching how forms.js
        // actually triggers it in production).
        async runRuleEngine(accountId) {
          process.env.MONGODB_URI = MONGODB_URI;
          // eslint-disable-next-line global-require
          const { evaluateRules } = require("./apps/backend/src/services/ruleEngine");
          return evaluateRules(accountId);
        },
      });

      // Wires up .feature file discovery/step-matching (this call also
      // reads the "cypress-cucumber-preprocessor" key in package.json for
      // where step definitions live — see that file).
      await addCucumberPreprocessorPlugin(on, config);

      on(
        "file:preprocessor",
        createBundler({
          plugins: [createEsbuildPlugin(config)],
        })
      );

      return config;
    },
  },
});
