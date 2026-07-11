const http = require("http");
const { Server } = require("socket.io");
const app = require("./app");
const { connectDB, setIO } = require("./db/store");
const { seed } = require("./db/seed");
const { verifyToken } = require("./middleware/auth");

const PORT = process.env.PORT || 4000;

const httpServer = http.createServer(app);
const io = new Server(httpServer, { cors: { origin: "*" } });
// Live-update broadcasts carry real CRM data — reject unauthenticated
// socket connections instead of letting anyone with the URL listen in.
io.use((socket, next) => {
  try {
    const token = socket.handshake.auth?.token;
    if (!token) throw new Error("no token");
    socket.user = verifyToken(token);
    next();
  } catch {
    next(new Error("Authentication required"));
  }
});
setIO(io);

async function main() {
  await connectDB();
  await seed(); // seeds demo data on first run (no-op once collections are populated)
  httpServer.listen(PORT, () => {
    console.log(`🚀 Sales CRM API running at http://localhost:${PORT}`);
  });
}

main().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
