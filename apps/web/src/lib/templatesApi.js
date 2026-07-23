// Server-side-only helpers for the public template marketplace's
// getStaticProps/getStaticPaths — these run in Node at build/ISR time, not
// in the browser, so they hit the backend directly (same BACKEND_URL
// next.config.js uses for the /api rewrite) instead of going through the
// client-side axios instance in api/client.js, which assumes a same-origin
// "/api" path that only resolves inside a browser request.
const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:4000";

// Never throw out of these — a failed fetch here (backend unreachable from
// the build machine, e.g. Vercel's build step has no BACKEND_URL pointed
// at a live backend yet) must not crash the whole `next build`. Callers
// treat an empty list / null template as "resolve this at request time"
// (see getStaticPaths's fallback: "blocking"), not as a hard error.
export async function fetchTemplateList() {
  try {
    const res = await fetch(`${BACKEND_URL}/api/forms/templates`);
    if (!res.ok) throw new Error(`Failed to fetch templates: ${res.status}`);
    const templates = await res.json();
    // "Blank Form" is a builder starting point, not a marketplace listing.
    return templates.filter((t) => t.key !== "blank");
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn(`fetchTemplateList: couldn't reach backend at ${BACKEND_URL}, continuing with an empty list —`, err.message);
    return [];
  }
}

export async function fetchTemplate(key) {
  try {
    const res = await fetch(`${BACKEND_URL}/api/forms/templates/${key}`);
    if (!res.ok) return null;
    return res.json();
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn(`fetchTemplate(${key}): couldn't reach backend at ${BACKEND_URL} —`, err.message);
    return null;
  }
}
