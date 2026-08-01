/**
 * Rende NOT NULL le colonne company_id usando PRAGMA writable_schema.
 * Questo modifica direttamente la definizione della tabella in sqlite_master.
 * È molto più veloce e sicuro del CTAS perché preserva indici e FK.
 */
import { createClient } from "@libsql/client";

const c = createClient({
  url: process.env.TURSO_DB_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

async function run() {
  const tables = [
    "users", "clients", "notes", "tasks",
    "imap_settings", "email_log", "email_templates", "company_settings",
  ];

  // Verify all company_id are populated first
  for (const t of tables) {
    const r = await c.execute(`SELECT count(*) as c FROM "${t}" WHERE company_id IS NULL`);
    if (Number(r.rows[0].c) > 0) {
      console.error(`✗ ${t} has NULL company_id! Run data migration first.`);
      process.exit(1);
    }
    console.log(`✓ ${t}: all ${r.rows[0].c} rows have company_id`);
  }

  console.log("\nEnabling writable_schema...");
  await c.execute("PRAGMA writable_schema = ON");

  for (const table of tables) {
    // Get current CREATE TABLE SQL
    const r = await c.execute(`SELECT sql FROM sqlite_master WHERE type='table' AND name='${table}'`);
    const oldSql = r.rows[0]?.sql;
    if (!oldSql) { console.error(`  ✗ ${table} not found`); continue; }

    // Replace "company_id text" with "company_id text NOT NULL"
    const newSql = oldSql.replace(/company_id(\s+text)/i, "company_id text NOT NULL");

    // Update the schema in sqlite_master
    await c.execute(`UPDATE sqlite_master SET sql='${newSql.replace(/'/g, "''")}' WHERE name='${table}' AND type='table'`);

    console.log(`  ✓ ${table}: updated`);
  }

  await c.execute("PRAGMA writable_schema = OFF");
  console.log("\nVerifying...");

  for (const table of tables) {
    const info = await c.execute(`PRAGMA table_info("${table}")`);
    const col = info.rows.find(r => r.name === "company_id");
    console.log(`  ${table}: company_id notnull=${col?.notnull}`);
  }

  console.log("\n✓ Done!");
}

run().catch(e => console.error("FATAL:", e));
