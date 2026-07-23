// Cloudflare R2 — S3-compatible object storage for uploaded files (form
// file-answers, branding logos, feedback attachments). Unlike razorpayClient
// or turnstileClient (security-critical, fail closed when unconfigured),
// R2 is a storage backend choice: unconfigured just means callers fall back
// to today's inline-base64-in-Mongo behavior instead — see isConfigured()
// usage in utils/fileUploads.js.
const { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");

let client = null;

function isConfigured() {
  return !!(
    process.env.R2_ACCOUNT_ID &&
    process.env.R2_ACCESS_KEY_ID &&
    process.env.R2_SECRET_ACCESS_KEY &&
    process.env.R2_BUCKET_NAME &&
    process.env.R2_ENDPOINT
  );
}

function getClient() {
  if (!client) {
    client = new S3Client({
      region: "auto", // R2 ignores region but the SDK requires one
      endpoint: process.env.R2_ENDPOINT,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
      },
    });
  }
  return client;
}

async function uploadBuffer({ key, buffer, contentType }) {
  await getClient().send(
    new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      Key: key,
      Body: buffer,
      ContentType: contentType,
    })
  );
  return key;
}

// Short-lived (default 1h) signed GET URL — generated fresh on every read
// rather than stored, so access can't outlive a reasonable window even if
// a URL leaks (e.g. pasted into a chat, cached by a browser extension).
async function getSignedReadUrl(key, { expiresIn = 3600 } = {}) {
  const command = new GetObjectCommand({ Bucket: process.env.R2_BUCKET_NAME, Key: key });
  return getSignedUrl(getClient(), command, { expiresIn });
}

async function deleteObject(key) {
  await getClient().send(new DeleteObjectCommand({ Bucket: process.env.R2_BUCKET_NAME, Key: key }));
}

module.exports = { isConfigured, uploadBuffer, getSignedReadUrl, deleteObject };
