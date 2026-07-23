// Auto-attached context for a feedback/issue ticket — collected instead of
// asked for, so a reporter never has to go dig up "what browser am I on"
// themselves. Browser/OS detection is a light heuristic over
// navigator.userAgent (not a full UA-parser dependency) — good enough for
// "which browser family, roughly which OS", which is all support actually
// needs to triage with; exact minor versions aren't worth a real parsing
// library for this.
function detectBrowser(ua) {
  if (/Edg\//.test(ua)) return "Edge";
  if (/OPR\//.test(ua)) return "Opera";
  if (/Chrome\//.test(ua) && !/Chromium/.test(ua)) return "Chrome";
  if (/Firefox\//.test(ua)) return "Firefox";
  if (/Safari\//.test(ua) && /Version\//.test(ua)) return "Safari";
  return "Unknown";
}

function detectOs(ua) {
  if (/Windows/.test(ua)) return "Windows";
  if (/Mac OS X/.test(ua) && !/iPhone|iPad/.test(ua)) return "macOS";
  if (/iPhone|iPad|iPod/.test(ua)) return "iOS";
  if (/Android/.test(ua)) return "Android";
  if (/Linux/.test(ua)) return "Linux";
  return "Unknown";
}

// `user` is the AuthContext user object — accountId doubles as the
// "workspace" id (this app's tenant concept), see middleware/auth.js.
export function collectDiagnostics(user, appVersion) {
  if (typeof window === "undefined") return null;
  const ua = window.navigator.userAgent;
  return {
    browser: detectBrowser(ua),
    os: detectOs(ua),
    screenResolution: `${window.screen.width}x${window.screen.height}`,
    url: window.location.href,
    appVersion,
    userId: user?.id || null,
    workspaceId: user?.accountId || null,
    time: new Date().toISOString(),
    language: window.navigator.language,
  };
}
