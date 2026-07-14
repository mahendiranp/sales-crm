import { io } from "socket.io-client";

// Connects directly to the backend origin — Next.js's /api rewrite only
// proxies HTTP fetches, not WebSocket upgrades, so the socket bypasses it.
const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:4000";

function getToken() {
  if (typeof window === "undefined") return null;
  try {
    const stored = localStorage.getItem("pipeline_auth_user");
    return stored ? JSON.parse(stored).token : null;
  } catch {
    return null;
  }
}

// `auth` as a function is re-evaluated on every (re)connect attempt, so a
// token that didn't exist yet at module load (page loaded logged-out) or
// one that changes after login/logout is picked up automatically.
//
// autoConnect is off — connecting is opt-in via reconnectSocket(), called
// by AuthContext once it knows whether a session exists. Without this, the
// socket dialed out (and got rejected with "Authentication required") on
// every page load, including the public landing page where no one is
// logged in at all.
const socket = io(SOCKET_URL, {
  autoConnect: false,
  auth: (cb) => cb({ token: getToken() }),
  // Skips socket.io's default polling-then-upgrade handshake (several
  // sequential HTTP round-trips before it ever opens a WebSocket) and
  // dials straight into a WebSocket connection instead.
  transports: ["websocket"],
});

// Call after login/signup/logout, and once on app load, so the socket's
// connection state matches whether a session actually exists — connected
// with the current token, or not connected at all when logged out.
export function reconnectSocket() {
  socket.disconnect();
  if (getToken()) socket.connect();
}

export default socket;
