import "./chunk-UV2HVMKZ.mjs";

// server/runtime/migrate.ts
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
async function applyMigrations(database, migrationsDir) {
  const db = database.db;
  db.exec(
    "CREATE TABLE IF NOT EXISTS d1_migrations (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT UNIQUE, applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP)"
  );
  const applied = new Set(db.prepare("SELECT name FROM d1_migrations").all().map((row) => row.name));
  let order;
  try {
    const journal = JSON.parse(await readFile(join(migrationsDir, "meta", "_journal.json"), "utf8"));
    order = journal.entries.map((entry) => `${entry.tag}.sql`);
  } catch {
    order = [];
  }
  const files = (await readdir(migrationsDir)).filter((name) => name.endsWith(".sql")).sort();
  const names = [...order.filter((name) => files.includes(name)), ...files.filter((name) => !order.includes(name))];
  const ran = [];
  for (const name of names) {
    if (applied.has(name)) continue;
    const sql = await readFile(join(migrationsDir, name), "utf8");
    const statements = sql.split(/-->\s*statement-breakpoint/g).map((statement) => statement.trim()).filter((statement) => statement && !/^--/.test(statement.replace(/\n.*/gs, "")) || statement.includes("\n"));
    db.exec("BEGIN");
    try {
      for (const statement of statements) {
        const clean = statement.replace(/^\s*--.*$/gm, "").trim();
        if (clean) db.exec(clean);
      }
      db.prepare("INSERT INTO d1_migrations (name) VALUES (?)").run(name);
      db.exec("COMMIT");
    } catch (error) {
      db.exec("ROLLBACK");
      throw new Error(`Migration ${name} failed: ${error instanceof Error ? error.message : String(error)}`);
    }
    ran.push(name);
  }
  return ran;
}
export {
  applyMigrations
};
