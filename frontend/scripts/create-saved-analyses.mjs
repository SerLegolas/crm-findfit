// USO: solo per bootstrap manuale su Turso. Usare Drizzle migrate per le modifiche.
// Crea la tabella saved_analyses su Turso (SQL diretto, come per cron_log)
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
CREATE TABLE IF NOT EXISTS saved_analyses (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  filters TEXT NOT NULL,
  client_ids TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
`;

await c.execute(sql);
console.log("saved_analyses: tabella pronta");
