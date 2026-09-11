import { createClient } from "@libsql/client";
const c = createClient({url: process.env.TURSO_DB_URL, authToken: process.env.TURSO_AUTH_TOKEN});

const tables = ["users", "clients", "notes", "tasks", "imap_settings", "email_log", "email_templates", "company_settings", "companies"];
for (const table of tables) {
  const r = await c.execute(`SELECT count(*) as cnt FROM \`${table}\``);
  console.log(`${table}: ${r.rows[0].cnt} rows`);
}
