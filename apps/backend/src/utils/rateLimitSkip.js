// Every rate limiter in this app skips NODE_ENV=test by default — without
// that, the Cypress suite's own request volume (run from one machine, no
// real IP diversity) would trip the limiters and fail unrelated tests. The
// one thing that legitimately needs to exercise real limiting under test is
// the rate-limiting spec itself — it opts in per-request via this header
// rather than flipping NODE_ENV, so every other spec stays unaffected.
const BYPASS_HEADER = "x-test-force-rate-limit";

function skipRateLimit(req) {
  if (process.env.NODE_ENV !== "test") return false;
  return req.headers[BYPASS_HEADER] !== "1";
}

module.exports = { skipRateLimit, BYPASS_HEADER };
