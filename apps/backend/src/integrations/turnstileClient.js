// Cloudflare Turnstile — bot-protection widget on signup and public form
// submissions. Same "fail closed, never mock success" philosophy as
// razorpayClient.js: without TURNSTILE_SECRET_KEY set, verification is
// treated as unconfigured and the caller decides whether to block or allow
// (see isConfigured() usage at each call site) rather than silently
// pretending every token is valid.
function isConfigured() {
  if (process.env.NODE_ENV === "test") return false;
  return !!process.env.TURNSTILE_SECRET_KEY;
}

// Cloudflare's own verification endpoint — the widget token proves a real
// browser solved the challenge, but only Cloudflare (via this server-to-
// server call, using the secret key the browser never has) can confirm the
// token itself wasn't forged or replayed.
async function verifyToken(token, remoteip) {
  if (!token) return false;
  const body = new URLSearchParams({ secret: process.env.TURNSTILE_SECRET_KEY, response: token });
  if (remoteip) body.set("remoteip", remoteip);

  try {
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
    const data = await res.json();
    return !!data.success;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("Turnstile verification request failed:", err);
    return false;
  }
}

module.exports = { isConfigured, verifyToken };
