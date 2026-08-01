import { createClient } from "@libsql/client";
const c = createClient({url: process.env.TURSO_DB_URL, authToken: process.env.TURSO_AUTH_TOKEN});

const tables = ["users", "clients", "notes", "tasks", "imap_settings", "email_log", "email_templates", "company_settings"];
for (const t of tables) {
  const r = await c.execute(`SELECT sql FROM sqlite_master WHERE type='table' AND name='${t}'`);
  const sql = r.rows[0]?.sql;
  // Show just the first line
  const firstLine = sql?.split('\n')[0];
  console.log(`${t}: ${firstLine}`);
}
