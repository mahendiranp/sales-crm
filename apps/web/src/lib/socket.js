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
const socket = io(SOCKET_URL, {
  autoConnect: true,
  auth: (cb) => cb({ token: getToken() }),
});

// Call after login/signup/logout so the socket reconnects with the
// current (or now-absent) token instead of the one it started with.
export function reconnectSocket() {
  socket.disconnect();
  socket.connect();
}

export default socket;
