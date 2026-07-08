// Lightweight JSON-file database.
// Avoids native compilation (better-sqlite3) so the project runs anywhere
// with plain Node.js — no build tools required.
const fs = require("fs");
const path = require("path");

const DATA_DIR = path.join(__dirname, "data");
const DB_FILE = path.join(DATA_DIR, "db.json");

function ensureDb() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify({}, null, 2));
  }
}

function readAll() {
  ensureDb();
  const raw = fs.readFileSync(DB_FILE, "utf-8");
  return JSON.parse(raw || "{}");
}

function writeAll(data) {
  ensureDb();
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

// Simple in-process write queue to avoid race conditions on concurrent writes
let queue = Promise.resolve();
function withLock(fn) {
  queue = queue.then(fn, fn);
  return queue;
}

function collection(name) {
  return {
    all() {
      const data = readAll();
      return data[name] || [];
    },
    find(id) {
      return this.all().find((r) => r.id === id);
    },
    query(predicate) {
      return this.all().filter(predicate);
    },
    insert(record) {
      return withLock(() => {
        const data = readAll();
        if (!data[name]) data[name] = [];
        data[name].push(record);
        writeAll(data);
        return record;
      });
    },
    update(id, patch) {
      return withLock(() => {
        const data = readAll();
        const list = data[name] || [];
        const idx = list.findIndex((r) => r.id === id);
        if (idx === -1) return null;
        list[idx] = { ...list[idx], ...patch, updatedAt: new Date().toISOString() };
        data[name] = list;
        writeAll(data);
        return list[idx];
      });
    },
    remove(id) {
      return withLock(() => {
        const data = readAll();
        const list = data[name] || [];
        data[name] = list.filter((r) => r.id !== id);
        writeAll(data);
        return true;
      });
    },
    replaceAll(records) {
      return withLock(() => {
        const data = readAll();
        data[name] = records;
        writeAll(data);
        return records;
      });
    },
    seedIfEmpty(records) {
      const data = readAll();
      if (!data[name] || data[name].length === 0) {
        data[name] = records;
        writeAll(data);
      }
    },
  };
}

module.exports = { collection, readAll, writeAll };
