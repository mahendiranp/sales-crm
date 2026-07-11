// MongoDB-backed store. Keeps the same collection(name) API the whole
// backend was already written against (all/find/query/insert/update/
// remove/replaceAll/seedIfEmpty) — every method is now async since Mongo
// I/O is never synchronous, unlike the JSON file this replaced.
const { MongoClient } = require("mongodb");

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/sales_crm";

let db = null;
let io = null;

async function connectDB() {
  const client = new MongoClient(MONGODB_URI);
  await client.connect();
  db = client.db();
  return db;
}

// Called once at startup so mutations can broadcast live updates.
function setIO(server) {
  io = server;
}

function emit(name, action, record) {
  if (io) io.emit("db:change", { collection: name, action, record });
}

function collection(name) {
  const col = () => db.collection(name);

  return {
    async all() {
      return col().find({}, { projection: { _id: 0 } }).toArray();
    },
    async find(id) {
      return col().findOne({ id }, { projection: { _id: 0 } });
    },
    async query(predicate) {
      return (await this.all()).filter(predicate);
    },
    // Real DB-level pagination (skip/limit + countDocuments), not
    // fetch-everything-then-slice — the only way this stays fast once a
    // collection has thousands of records. `filter` is a raw Mongo filter
    // (scopedCollection.paginate below merges accountId into it).
    async paginate({ filter = {}, page = 1, limit = 50, sort = { createdAt: -1 } } = {}) {
      const safePage = Math.max(1, parseInt(page, 10) || 1);
      const safeLimit = Math.min(200, Math.max(1, parseInt(limit, 10) || 50));
      const [items, total] = await Promise.all([
        col()
          .find(filter, { projection: { _id: 0 } })
          .sort(sort)
          .skip((safePage - 1) * safeLimit)
          .limit(safeLimit)
          .toArray(),
        col().countDocuments(filter),
      ]);
      return { items, total, page: safePage, limit: safeLimit, totalPages: Math.ceil(total / safeLimit) || 1 };
    },
    async insert(record) {
      await col().insertOne({ ...record });
      emit(name, "insert", record);
      return record;
    },
    async update(id, patch) {
      const result = await col().findOneAndUpdate(
        { id },
        { $set: { ...patch, updatedAt: new Date().toISOString() } },
        { returnDocument: "after", projection: { _id: 0 } }
      );
      const updated = result?.value ?? result ?? null;
      if (updated) emit(name, "update", updated);
      return updated;
    },
    async remove(id) {
      await col().deleteOne({ id });
      emit(name, "remove", { id });
      return true;
    },
    async replaceAll(records) {
      await col().deleteMany({});
      if (records.length) await col().insertMany(records.map((r) => ({ ...r })));
      emit(name, "replace", null);
      return records;
    },
    async seedIfEmpty(records) {
      const count = await col().countDocuments();
      if (count === 0 && records.length) {
        await col().insertMany(records.map((r) => ({ ...r })));
      }
    },
  };
}

// Tenant-scoped wrapper around collection(name) — every read is filtered to
// records owned by accountId, every write is checked against it before
// applying (so record IDs can't be guessed/enumerated across tenants), and
// every insert is stamped with it regardless of what the client sent (spread
// order below means a client-supplied accountId in the body is overwritten).
function scopedCollection(name, accountId) {
  const base = collection(name);
  return {
    async all() {
      const all = await base.all();
      return all.filter((r) => r.accountId === accountId);
    },
    async find(id) {
      const record = await base.find(id);
      if (!record || record.accountId !== accountId) return null;
      return record;
    },
    async query(predicate) {
      return (await this.all()).filter(predicate);
    },
    async paginate(opts = {}) {
      return base.paginate({ ...opts, filter: { ...(opts.filter || {}), accountId } });
    },
    async insert(record) {
      return base.insert({ ...record, accountId });
    },
    async update(id, patch) {
      const existing = await base.find(id);
      if (!existing || existing.accountId !== accountId) return null;
      const { accountId: _ignored, ...safePatch } = patch;
      return base.update(id, safePatch);
    },
    async remove(id) {
      const existing = await base.find(id);
      if (!existing || existing.accountId !== accountId) return false;
      return base.remove(id);
    },
  };
}

module.exports = { connectDB, setIO, collection, scopedCollection };
