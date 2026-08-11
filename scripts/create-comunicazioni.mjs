// Crea le tabelle comunicazioni e comunicazioni_batch su Turso (SQL diretto,
// il drizzle-kit push non funziona su Turso).
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
CREATE TABLE IF NOT EXISTS comunicazioni (
  id TEXT PRIMARY KEY,
  titolo TEXT NOT NULL,
  template_id TEXT REFERENCES email_templates(id) ON DELETE SET NULL,
  analisi_id TEXT REFERENCES saved_analyses(id) ON DELETE SET NULL,
  data_invio INTEGER NOT NULL,
  stato TEXT NOT NULL DEFAULT 'programmata',
  lock INTEGER NOT NULL DEFAULT 0,
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS comunicazioni_batch (
  id TEXT PRIMARY KEY,
  comunicazione_id TEXT NOT NULL REFERENCES comunicazioni(id) ON DELETE CASCADE,
  client_id TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  stato TEXT NOT NULL DEFAULT 'pending',
  tentativi INTEGER NOT NULL DEFAULT 0,
  errore TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_comunicazioni_company ON comunicazioni(company_id);
CREATE INDEX IF NOT EXISTS idx_comunicazioni_data_invio ON comunicazioni(data_invio);
CREATE INDEX IF NOT EXISTS idx_comunicazioni_batch_comm ON comunicazioni_batch(comunicazione_id);
`;

await c.executeMultiple(sql);
console.log("Tabelle comunicazioni / comunicazioni_batch create/verificate OK");

const tables = await c.execute(
  "SELECT name FROM sqlite_master WHERE type='table' AND name IN ('comunicazioni','comunicazioni_batch') ORDER BY name"
);
console.log("Tabelle esistenti:", tables.rows.map((r) => r.name));
