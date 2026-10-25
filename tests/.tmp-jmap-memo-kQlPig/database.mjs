import "./chunk-UV2HVMKZ.mjs";

// server/runtime/sqlite-database.ts
import Database from "better-sqlite3";
function meta(info) {
  return {
    duration: 0,
    size_after: 0,
    rows_read: 0,
    rows_written: info?.changes ?? 0,
    last_row_id: Number(info?.lastInsertRowid ?? 0),
    changed_db: (info?.changes ?? 0) > 0,
    changes: info?.changes ?? 0
  };
}
function normalizeParam(value) {
  if (value instanceof Date) return Math.floor(value.getTime() / 1e3);
  if (typeof value === "boolean") return value ? 1 : 0;
  if (value instanceof ArrayBuffer) return Buffer.from(value);
  if (ArrayBuffer.isView(value)) return Buffer.from(value.buffer, value.byteOffset, value.byteLength);
  return value;
}
var SqlitePreparedStatement = class _SqlitePreparedStatement {
  constructor(db, sql, params = []) {
    this.db = db;
    this.sql = sql;
    this.params = params;
  }
  db;
  sql;
  params;
  bind(...values) {
    return new _SqlitePreparedStatement(this.db, this.sql, values.map(normalizeParam));
  }
  statement() {
    const cache = this.db.__statements ?? (this.db.__statements = /* @__PURE__ */ new Map());
    let statement = cache.get(this.sql);
    if (!statement) {
      statement = this.db.prepare(this.sql);
      cache.set(this.sql, statement);
    }
    return statement;
  }
  isRead() {
    return /^\s*(select|with|pragma|explain)\b/i.test(this.sql) || /\breturning\b/i.test(this.sql);
  }
  async first(column) {
    const row = this.statement().raw(false).get(...this.params);
    if (!row) return null;
    return column ? row[column] : row;
  }
  async run() {
    if (this.isRead()) {
      const results = this.statement().raw(false).all(...this.params);
      return { results, success: true, meta: meta() };
    }
    const info = this.statement().run(...this.params);
    return { results: [], success: true, meta: meta(info) };
  }
  async all() {
    return this.run();
  }
  async raw(options) {
    if (!this.isRead()) {
      this.statement().run(...this.params);
      return [];
    }
    const statement = this.statement();
    const rows = statement.raw(true).all(...this.params);
    if (options?.columnNames) {
      const names = statement.columns().map((column) => column.name);
      return [names, ...rows];
    }
    return rows;
  }
};
var SqliteDatabase = class {
  db;
  constructor(filename) {
    this.db = new Database(filename);
    this.db.__statements = /* @__PURE__ */ new Map();
    this.db.pragma("journal_mode = WAL");
    this.db.pragma("foreign_keys = ON");
    this.db.pragma("busy_timeout = 5000");
    const cacheKb = Number(process.env.SQLITE_CACHE_KB ?? 0);
    const mmapBytes = Number(process.env.SQLITE_MMAP_BYTES ?? 0);
    const synchronous = (process.env.SQLITE_SYNCHRONOUS ?? "").toUpperCase();
    if (Number.isFinite(cacheKb) && cacheKb > 0) this.db.pragma(`cache_size = -${Math.floor(cacheKb)}`);
    if (Number.isFinite(mmapBytes) && mmapBytes > 0) this.db.pragma(`mmap_size = ${Math.floor(mmapBytes)}`);
    if ((process.env.SQLITE_TEMP_STORE ?? "").toLowerCase() === "memory") this.db.pragma("temp_store = memory");
    if (synchronous === "NORMAL" || synchronous === "OFF") this.db.pragma(`synchronous = ${synchronous}`);
  }
  prepare(sql) {
    return new SqlitePreparedStatement(this.db, sql);
  }
  /** Run statements atomically, like D1's batch. */
  async batch(statements) {
    const results = [];
    this.db.exec("BEGIN");
    try {
      for (const statement of statements) results.push(await statement.all());
      this.db.exec("COMMIT");
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
    return results;
  }
  async exec(sql) {
    this.db.exec(sql);
    return { count: 0, duration: 0 };
  }
  async dump() {
    const buffer = this.db.serialize();
    return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
  }
  withSession() {
    return this;
  }
};
function openSqliteDatabase(filename) {
  return new SqliteDatabase(filename);
}
export {
  SqliteDatabase,
  openSqliteDatabase
};
