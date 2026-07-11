const http = require("http");
const { Server } = require("socket.io");

const PORT = process.env.PORT || 4000;

// No MONGODB_URI set locally? Spin up a throwaway in-memory MongoDB instead
// of requiring a real local/remote instance — dev-only, never used when
// MONGODB_URI is actually configured (e.g. in production on Vercel).
async function ensureMongoUri() {
  if (process.env.MONGODB_URI) return;
  if (process.env.NODE_ENV === "production") {
    throw new Error("MONGODB_URI is required in production");
  }
  const { MongoMemoryServer } = require("mongodb-memory-server");
  const mongod = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mongod.getUri("sales_crm_dev");
  console.log("⚠️  No MONGODB_URI set — using an in-memory MongoDB for local dev (data resets on restart).");
}

async function main() {
  await ensureMongoUri();
  // Required after MONGODB_URI is set, since db/store.js reads it at module load.
  const app = require("./app");
  const { connectDB, setIO } = require("./db/store");
  const { seed } = require("./db/seed");
  const { verifyToken } = require("./middleware/auth");

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
