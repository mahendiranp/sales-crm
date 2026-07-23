// Session replay + error/network monitoring for the actual product
// (/app/*), not the marketing site — the opposite scope of Analytics.jsx
// (GA measures the anonymous marketing funnel; LogRocket replays real
// logged-in usage so a support/engineering issue can be debugged from an
// actual session instead of a bug report alone).
//
// Set in .env.local (and must be set the same way in Vercel's production
// env vars — that file itself is never deployed, see apps/web/.env.local).
// Not sensitive (it'd be visible in client-side JS either way, same
// reasoning as GA_MEASUREMENT_ID in Analytics.jsx being a plain constant),
// it's just an env var so a different project/environment can use its own.
const LOGROCKET_APP_ID = process.env.NEXT_PUBLIC_LOGROCKET_APP_ID;

// Field names that must never reach LogRocket in a request/response body —
// covers every auth endpoint's payload shape (routes/auth.js): password
// (login/signup), otp (signup verification), token (password reset AND
// the JWT itself, returned by login/signup/google/reset responses),
// credential (Google Identity Services' signed ID token).
const SENSITIVE_BODY_KEYS = ["password", "otp", "token", "credential", "passwordHash"];

function redactBody(body) {
  const isString = typeof body === "string";
  if (!body || (typeof body !== "object" && !isString)) return body;

  let parsed;
  try {
    parsed = isString ? JSON.parse(body) : body;
  } catch {
    return body; // not JSON (e.g. multipart form-data for file uploads) — leave alone
  }

  for (const key of SENSITIVE_BODY_KEYS) {
    if (key in parsed) parsed[key] = "[redacted]";
  }
  return isString ? JSON.stringify(parsed) : parsed;
}

// A bare require() isn't available in Next's client bundle (it's an ES
// module, not CommonJS at runtime) — a real dynamic import() is what
// webpack actually knows how to code-split, so the SDK still isn't pulled
// into the initial bundle when nothing calls this. Cached so both
// initLogRocket() and identifyLogRocketUser() share one module instance
// instead of triggering two separate imports.
let logRocketModulePromise = null;
function loadLogRocket() {
  if (!logRocketModulePromise) {
    logRocketModulePromise = import("logrocket").then((m) => m.default);
  }
  return logRocketModulePromise;
}

let initialized = false;

// Production only — Next.js sets NODE_ENV to "production" for a real
// `next build`/`next start` and "development" for `next dev`, so this is a
// no-op for every local dev session regardless of the app ID above, and
// only actually records in a deployed environment.
export function isLogRocketConfigured() {
  return !!LOGROCKET_APP_ID && process.env.NODE_ENV === "production";
}

// Call once, client-side only (see pages/_app.jsx) — safe to call more than
// once, only the first call does anything.
export function initLogRocket() {
  if (!isLogRocketConfigured() || initialized || typeof window === "undefined") return;
  initialized = true;
  loadLogRocket().then((LogRocket) => {
    LogRocket.init(LOGROCKET_APP_ID, {
      dom: {
        // Masks every form input's value by default (respondent answers,
        // lead notes, AI prompts, everything) — explicit data-private on
        // non-input elements (rendered text, chat bubbles) still needed for
        // anything shown outside an actual <input>/<textarea>/<select>, see
        // FormResponses.jsx/Leads.jsx/Forms.jsx for those.
        inputSanitizer: true,
      },
      network: {
        requestSanitizer: (request) => {
          delete request.headers.Authorization;
          delete request.headers.Cookie;
          request.body = redactBody(request.body);
          return request;
        },
        // Login/signup/google/reset-password responses all include the raw
        // JWT (see routes/auth.js) — without this it'd sit in LogRocket's
        // network capture even though the request that carried the
        // password to get it was already sanitized above.
        responseSanitizer: (response) => {
          response.body = redactBody(response.body);
          return response;
        },
      },
    });
  });
}

// Call once a user is known (see AuthContext.jsx's persist()) — ties
// subsequent session recordings to who was actually using the product,
// not just an anonymous visitor id. Calls initLogRocket() first (safe/
// idempotent) so LogRocket.init() is always attached to loadLogRocket()'s
// promise before this identify call, regardless of which of the two
// effects (this one, or _app.jsx's) happens to run first — React fires
// child effects before parent ones, so AuthProvider's effect can actually
// run before MyApp's.
//
// Deliberately doesn't send name/email — LogRocket.identify() ties a
// session to a real person by design (that's the point of identifying at
// all), but that also means email ends up sitting in a third-party tool's
// dashboard. user.id + accountId is enough to find "this specific person's
// session in this specific tenant" from internal records without handing
// LogRocket PII it doesn't need.
export function identifyLogRocketUser(user) {
  if (!isLogRocketConfigured() || !user?.id || typeof window === "undefined") return;
  initLogRocket();
  loadLogRocket().then((LogRocket) => {
    LogRocket.identify(user.id, {
      accountId: user.accountId,
      authRole: user.authRole,
      isMasterAdmin: !!user.isMasterAdmin,
    });
  });
}
