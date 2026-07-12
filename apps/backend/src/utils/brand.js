// Single place to change the product's name in backend-generated text
// (startup log, transactional emails). Mirrors apps/web/src/lib/brand.js —
// keep both in sync when the real brand name is confirmed.
const APP_NAME = process.env.APP_NAME || "Flowora";

module.exports = { APP_NAME };
