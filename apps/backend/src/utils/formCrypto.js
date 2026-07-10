// AES-256-GCM field-level encryption for form response answers (customer
// data submitted through public forms). Encrypted at rest in Mongo — every
// route that reads answers must decrypt them before use/search/export.
const crypto = require("crypto");

const ALGO = "aes-256-gcm";

if (!process.env.FORM_ENCRYPTION_KEY && process.env.NODE_ENV === "production") {
  throw new Error("FORM_ENCRYPTION_KEY must be set in production — refusing to encrypt customer data with a default key.");
}
if (!process.env.FORM_ENCRYPTION_KEY) {
  // eslint-disable-next-line no-console
  console.warn(
    "⚠️  FORM_ENCRYPTION_KEY is not set — using an insecure default key (dev only). " +
    "Set FORM_ENCRYPTION_KEY in your .env for real protection."
  );
}
const KEY = crypto.createHash("sha256").update(process.env.FORM_ENCRYPTION_KEY || "dev-only-insecure-default-key").digest();

const PREFIX = "enc:v1:";

function encrypt(value) {
  if (value === null || value === undefined) return value;
  const plain = JSON.stringify(value);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGO, KEY, iv);
  const encrypted = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${PREFIX}${iv.toString("hex")}:${tag.toString("hex")}:${encrypted.toString("hex")}`;
}

function decrypt(value) {
  if (typeof value !== "string" || !value.startsWith(PREFIX)) return value;
  const [ivHex, tagHex, dataHex] = value.slice(PREFIX.length).split(":");
  try {
    const iv = Buffer.from(ivHex, "hex");
    const tag = Buffer.from(tagHex, "hex");
    const data = Buffer.from(dataHex, "hex");
    const decipher = crypto.createDecipheriv(ALGO, KEY, iv);
    decipher.setAuthTag(tag);
    const decrypted = Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
    return JSON.parse(decrypted);
  } catch {
    return "[unable to decrypt]";
  }
}

function encryptAnswers(answers) {
  const out = {};
  Object.entries(answers || {}).forEach(([k, v]) => {
    out[k] = encrypt(v);
  });
  return out;
}

function decryptAnswers(answers) {
  const out = {};
  Object.entries(answers || {}).forEach(([k, v]) => {
    out[k] = decrypt(v);
  });
  return out;
}

function decryptResponse(response) {
  if (!response) return response;
  return { ...response, answers: decryptAnswers(response.answers) };
}

module.exports = { encrypt, decrypt, encryptAnswers, decryptAnswers, decryptResponse };
