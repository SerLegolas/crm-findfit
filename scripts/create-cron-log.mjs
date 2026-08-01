// Crea la tabella cron_log su Turso (SQL diretto, il drizzle-kit push non funziona su Turso)
import { readFileSync } from "node:fs";
import { createClient } from "@libsql/client";

const env = readFileSync(".env.local", "utf8");
for (const line of env.split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
  if (m) process.env[m[1]] = m[2];
}

const c = createClient({
  url: process.env.TURSO_DB_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

const sql = `
CREATE TABLE IF NOT EXISTS cron_log (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  started_at INTEGER NOT NULL,
  completed_at INTEGER,
  emails_found INTEGER NOT NULL DEFAULT 0,
  clients_created INTEGER NOT NULL DEFAULT 0,
  tasks_created INTEGER NOT NULL DEFAULT 0,
  error TEXT,
  created_at INTEGER NOT NULL
);
`;

await c.execute(sql);
console.log("Tabella cron_log creata/verificata OK");

const check = await c.execute(
  "SELECT name FROM sqlite_master WHERE type='table' AND name='cron_log'"
);
console.log("Esiste:", check.rows.length === 1);
