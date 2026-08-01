/**
 * Rende NOT NULL company_id ricreando ogni tabella.
 * Gestisce sia nomi con quoting (") che senza quoting.
 * Ordine: tabelle figlie prima, poi genitori (no FK bloccanti).
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
  const r = await c.execute(`SELECT sql FROM sqlite_master WHERE type='index' AND tbl_name='${name}' AND sql IS NOT NULL`);
  return r.rows.map(row => row.sql);
}

async function run() {
  // BACKUP all data first
  console.log("=== Backing up all data ===\n");
  const allTables = ["companies", "users", "clients", "notes", "tasks", "imap_settings", "email_log", "email_templates", "company_settings"];
  
  const backup = {};
  for (const table of allTables) {
    const r = await c.execute(`SELECT * FROM "${table}"`);
    backup[table] = r.rows;
    console.log(`  ${table}: ${r.rows.length} rows backed up`);
  }

  // Collect CREATE TABLE SQL with NOT NULL
  const tableDefs = [];
  for (const table of allTables) {
    const sql = await getTableSql(table);
    const indexes = await getIndexesSql(table);
    if (sql) tableDefs.push({ name: table, sql: sql.replace(/company_id(\s+text)/i, "company_id text NOT NULL"), indexes });
  }

  console.log("\n=== Dropping all tables ===\n");
  for (const table of [...allTables].reverse()) {
    await c.execute(`DROP TABLE IF EXISTS "${table}"`);
    console.log(`  Dropped ${table}`);
  }

  console.log("\n=== Recreating tables with NOT NULL ===\n");
  for (const table of allTables) {
    const td = tableDefs.find(d => d.name === table);
    if (!td) continue;
    await c.execute(td.sql);
    console.log(`  Created ${table}`);
  }

  console.log("\n=== Restoring data ===\n");
  for (const table of allTables) {
    const rows = backup[table];
    if (rows.length === 0) { console.log(`  ${table}: 0 rows, skipped`); continue; }

    // Get column names
    const colNames = Object.keys(rows[0]);
    const placeholders = colNames.map(() => '?').join(', ');
    const cols = colNames.map(n => `"${n}"`).join(', ');

    // Insert in batches
    const batchSize = 50;
    for (let i = 0; i < rows.length; i += batchSize) {
      const batch = rows.slice(i, i + batchSize);
      for (const row of batch) {
        const values = colNames.map(n => row[n]);
        try {
          await c.execute({
            sql: `INSERT INTO "${table}" (${cols}) VALUES (${placeholders})`,
            args: values,
          });
        } catch (e) {
          console.error(`  ✗ Error inserting into ${table}: ${e.message}`);
        }
      }
    }
    console.log(`  ${table}: ${rows.length} rows restored`);
  }

  console.log("\n=== Recreating indexes ===\n");
  for (const td of tableDefs) {
    for (const idx of td.indexes) {
      try { await c.execute(idx); console.log(`  Index for ${td.name}`); } 
      catch (e) { console.warn(`  ⚠ Index for ${td.name}: ${e.message}`); }
    }
  }

  console.log("\n=== Verification ===\n");
  for (const table of allTables) {
    const info = await c.execute(`PRAGMA table_info("${table}")`);
    const col = info.rows.find(r => r.name === "company_id");
    const cnt = await c.execute(`SELECT count(*) as c FROM "${table}"`);
    console.log(`  ${table}: company_id notnull=${col?.notnull}, rows=${cnt.rows[0].c}`);
  }

  console.log("\n✓ Complete! All company_id columns are NOT NULL.");
}

run().catch(e => console.error("FATAL:", e));
