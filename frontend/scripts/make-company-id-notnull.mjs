/**
 * Rende NOT NULL le colonne company_id su tutte le tabelle.
 * Usa CREATE TABLE ... AS SELECT ricreando la tabella con NOT NULL.
 * Preserva foreign keys e indici esistenti.
 */
import { createClient } from "@libsql/client";

const c = createClient({
  url: process.env.TURSO_DB_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

async function getTableSql(name) {
  const r = await c.execute(`SELECT sql FROM sqlite_master WHERE type='table' AND name='${name}'`);
  return r.rows[0]?.sql;
}

async function getIndexesSql(name) {
  const r = await c.execute(
    `SELECT sql FROM sqlite_master WHERE type='index' AND tbl_name='${name}' AND sql IS NOT NULL`
  );
  return r.rows.map(row => row.sql);
}

async function run() {
  // Order: leaf tables first (no children), parents last
  const tables = [
    "imap_settings", "email_log", "email_templates", "company_settings",
    "notes", "tasks", "clients", "users",
  ];

  // Disable foreign keys temporarily
  await c.execute("PRAGMA foreign_keys = OFF");
  console.log("Foreign keys disabled");

  for (const table of tables) {
    console.log(`Processing ${table}...`);

    // Get current CREATE TABLE SQL
    const oldSql = await getTableSql(table);
    if (!oldSql) { console.error(`  ✗ Cannot find table ${table}`); continue; }

    // Make company_id NOT NULL in the SQL
    const newSql = oldSql.replace(/company_id\s+text/i, "company_id text NOT NULL");

    // Get indexes to recreate
    const indexes = await getIndexesSql(table);

    const tmpName = `${table}_tmp_nn`;

    // Drop temp if exists
    await c.execute(`DROP TABLE IF EXISTS \`${tmpName}\``);

    // Create temp table with NOT NULL
    let createSql = newSql.replaceAll(`\`${table}\``, `\`${tmpName}\``);
    createSql = createSql.replaceAll(`"${table}"`, `"${tmpName}"`);
    await c.execute(createSql);

    // Copy data
    await c.execute(`INSERT INTO \`${tmpName}\` SELECT * FROM \`${table}\``);

    // Drop original
    await c.execute(`DROP TABLE \`${table}\``);

    // Rename temp to original
    await c.execute(`ALTER TABLE \`${tmpName}\` RENAME TO \`${table}\``);

    // Recreate indexes
    for (const idxSql of indexes) {
      try {
        await c.execute(idxSql);
      } catch (e) {
        console.warn(`  ⚠ Index recreate warning: ${e.message}`);
      }
    }

    console.log(`  ✓ ${table}: company_id is now NOT NULL`);
  }

  await c.execute("PRAGMA foreign_keys = ON");
  console.log("Foreign keys re-enabled");

  console.log("\n✓ Done! All company_id columns are now NOT NULL.");
}

run().catch((e) => console.error("FATAL:", e));
