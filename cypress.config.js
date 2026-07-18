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
      });
    },
  },
});
