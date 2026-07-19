const { defineConfig } = require("cypress");
const { MongoClient } = require("mongodb");

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/sales_crm";

module.exports = defineConfig({
  e2e: {
    baseUrl: "http://localhost:3000",
    viewportWidth: 1440,
    viewportHeight: 900,
    video: false,
    screenshotOnRunFailure: true,
    supportFile: false,
    setupNodeEvents(on) {
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
      });
    },
  },
});
