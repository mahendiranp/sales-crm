// Google Forms has no public API for reading someone else's form by URL —
// the only way to get a form's questions out of just a link is scraping the
// FB_PUBLIC_LOAD_DATA_ variable Google embeds in the page's own HTML/JS.
// This is a reverse-engineered, completely undocumented format that Google
// is free to change at any time without notice — if imports start failing
// across the board, this file (the regex/indices below) is the first place
// to check, not routes/import.js.
const FORM_URL_PATTERN = /^https:\/\/docs\.google\.com\/forms\/(d\/e\/|d\/)[\w-]+\/(viewform|edit)/i;

function isGoogleFormUrl(url) {
  return typeof url === "string" && FORM_URL_PATTERN.test(url.trim());
}

// Returns { title, description, questions: [{ label, helpText, options, required }] }.
// Deliberately doesn't try to map Google's internal numeric question-type
// codes (short answer/paragraph/choice/grid/etc.) to Flowora's own field
// types itself — that mapping is exactly what Gemini already does for
// PDFs/Word docs/images in routes/import.js, so a Google Form is normalized
// through that same AI step instead of a second, parallel hand-rolled one.
async function fetchGoogleForm(url) {
  let res;
  try {
    res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 (compatible; FloworaImporter/1.0)" } });
  } catch {
    throw new Error("Couldn't reach that URL — check your connection and the link, then try again.");
  }

  if (res.status === 404) {
    throw new Error("That Google Form doesn't exist (it may have been deleted).");
  }
  if (!res.ok) {
    throw new Error(`Google returned an error (${res.status}) loading that form.`);
  }

  const html = await res.text();

  // A private form, or one restricted to a specific organization, redirects
  // to a sign-in / "you need permission" page instead of rendering the form
  // — neither of those pages contains this variable at all.
  const match = html.match(/FB_PUBLIC_LOAD_DATA_\s*=\s*(\[.+\]);/s);
  if (!match) {
    throw new Error("Couldn't read that form — it may be private, restricted to an organization, or not accepting responses.");
  }

  let data;
  try {
    data = JSON.parse(match[1]);
  } catch {
    throw new Error("Google's form data wasn't in the expected format — this may be a form type this importer doesn't understand yet.");
  }

  const title = (data?.[3] || data?.[1]?.[8] || "Imported Google Form").trim();
  const description = (data?.[1]?.[0] || "").trim();
  const questions = (data?.[1]?.[1] || [])
    .map((q) => ({
      label: q?.[1] || "",
      helpText: q?.[2] || "",
      options: (q?.[4]?.[0]?.[1] || []).map((o) => o?.[0]).filter((v) => typeof v === "string" && v),
      required: !!q?.[4]?.[0]?.[2],
    }))
    .filter((q) => q.label);

  if (questions.length === 0) {
    throw new Error("Couldn't find any questions in that form.");
  }

  return { title, description, questions };
}

module.exports = { isGoogleFormUrl, fetchGoogleForm };
