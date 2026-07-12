// Server-side re-check for form "file" field answers — the client already
// enforces this (FormFieldInput.jsx), but that's just UX; a submission can
// be crafted directly against the API, so the real gate has to live here.
// This is a file-type allowlist + size cap + magic-byte sniff, not a virus
// scanner (there's no AV engine available in plain Node.js) — it stops the
// common attack shape of "rename a script/executable to look like a safe
// file", not signature-based malware detection.

const MAX_FILE_BYTES = 3 * 1024 * 1024; // 3MB, matches the client-side cap

// Extension -> allowed MIME prefixes/exact types. Executable, script, and
// installer formats are deliberately excluded — nothing here should ever
// be capable of running as code if someone opens it.
const ALLOWED_EXTENSIONS = {
  jpg: ["image/jpeg"],
  jpeg: ["image/jpeg"],
  png: ["image/png"],
  gif: ["image/gif"],
  webp: ["image/webp"],
  pdf: ["application/pdf"],
  doc: ["application/msword"],
  docx: ["application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
  xls: ["application/vnd.ms-excel"],
  xlsx: ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"],
  ppt: ["application/vnd.ms-powerpoint"],
  pptx: ["application/vnd.openxmlformats-officedocument.presentationml.presentation"],
  csv: ["text/csv", "application/vnd.ms-excel"],
  txt: ["text/plain"],
  zip: ["application/zip", "application/x-zip-compressed"],
};

// First few bytes of common formats — confirms the actual file content
// matches what it claims to be, catching the simplest "rename a .exe to
// .jpg" trick. Text formats (csv/txt) have no reliable magic number, so
// they're allowed through on extension/MIME alone.
const MAGIC_BYTES = {
  "image/jpeg": [[0xff, 0xd8, 0xff]],
  "image/png": [[0x89, 0x50, 0x4e, 0x47]],
  "image/gif": [[0x47, 0x49, 0x46, 0x38]],
  "image/webp": [[0x52, 0x49, 0x46, 0x46]], // "RIFF" — WEBP-specific bytes follow at offset 8, close enough here
  "application/pdf": [[0x25, 0x50, 0x44, 0x46]], // "%PDF"
  // .docx/.xlsx/.pptx/.zip are all zip containers under the hood, same signature.
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [[0x50, 0x4b, 0x03, 0x04]],
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [[0x50, 0x4b, 0x03, 0x04]],
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": [[0x50, 0x4b, 0x03, 0x04]],
  "application/zip": [[0x50, 0x4b, 0x03, 0x04]],
  "application/x-zip-compressed": [[0x50, 0x4b, 0x03, 0x04]],
};

function extensionOf(name) {
  const dot = (name || "").lastIndexOf(".");
  return dot === -1 ? "" : name.slice(dot + 1).toLowerCase();
}

function matchesMagicBytes(buffer, mime) {
  const signatures = MAGIC_BYTES[mime];
  if (!signatures) return true; // no known signature for this type (e.g. plain text) — nothing to check
  return signatures.some((sig) => sig.every((byte, i) => buffer[i] === byte));
}

const IMAGE_EXTENSIONS = ["jpg", "jpeg", "png", "gif", "webp"];

// Validates one { name, type, dataUrl } file answer. Returns an error
// string, or null if it passes every check. `allowedExtensions` narrows
// the allowlist for contexts that only want a subset (e.g. images for a
// feedback-ticket attachment) — defaults to every type forms support.
function validateFileAnswer(fieldLabel, answer, allowedExtensions = Object.keys(ALLOWED_EXTENSIONS)) {
  if (!answer || typeof answer !== "object" || !answer.dataUrl) return null; // not a file answer — nothing to check
  const { name = "", type = "", dataUrl } = answer;

  const match = /^data:([^;]+);base64,(.+)$/.exec(dataUrl);
  if (!match) return `"${fieldLabel}": invalid file upload.`;
  const [, declaredMime, base64] = match;

  const ext = extensionOf(name);
  const allowedMimes = allowedExtensions.includes(ext) ? ALLOWED_EXTENSIONS[ext] : null;
  if (!allowedMimes) {
    return `"${fieldLabel}": file type ".${ext || "unknown"}" isn't allowed. Allowed: ${allowedExtensions.join(", ")}.`;
  }
  if (!allowedMimes.includes(declaredMime) && !allowedMimes.includes(type)) {
    return `"${fieldLabel}": file content doesn't match its extension.`;
  }

  const buffer = Buffer.from(base64, "base64");
  if (buffer.length > MAX_FILE_BYTES) {
    return `"${fieldLabel}": file is too large — max ${MAX_FILE_BYTES / (1024 * 1024)}MB.`;
  }
  if (!matchesMagicBytes(buffer, declaredMime)) {
    return `"${fieldLabel}": file content doesn't match its extension.`;
  }

  return null;
}

// Convenience wrapper for image-only contexts (feedback ticket attachments).
function validateImageAnswer(fieldLabel, answer) {
  return validateFileAnswer(fieldLabel, answer, IMAGE_EXTENSIONS);
}

module.exports = { validateFileAnswer, validateImageAnswer, MAX_FILE_BYTES, ALLOWED_EXTENSIONS, IMAGE_EXTENSIONS };
