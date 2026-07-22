// Server-side-only helpers for the public template marketplace's
// getStaticProps/getStaticPaths — these run in Node at build/ISR time, not
// in the browser, so they hit the backend directly (same BACKEND_URL
// next.config.js uses for the /api rewrite) instead of going through the
// client-side axios instance in api/client.js, which assumes a same-origin
// "/api" path that only resolves inside a browser request.
const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:4000";

export async function fetchTemplateList() {
  const res = await fetch(`${BACKEND_URL}/api/forms/templates`);
  if (!res.ok) throw new Error(`Failed to fetch templates: ${res.status}`);
  const templates = await res.json();
  // "Blank Form" is a builder starting point, not a marketplace listing.
  return templates.filter((t) => t.key !== "blank");
}

export async function fetchTemplate(key) {
  const res = await fetch(`${BACKEND_URL}/api/forms/templates/${key}`);
  if (!res.ok) return null;
  return res.json();
}
