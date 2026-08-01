/**
 * Rende NOT NULL company_id su tutte le tabelle.
 * 
 * Per ogni tabella:
 * 1. PRAGMA foreign_keys = OFF
 * 2. CREATE TABLE _new with NOT NULL company_id  
 * 3. INSERT ... SELECT (copia dati)
 * 4. DROP TABLE originale
 * 5. ALTER TABLE _new RENAME TO originale
 * 6. PRAGMA foreign_keys = ON
 */
import { createClient } from "@libsql/client";

const c = createClient({
  url: process.env.TURSO_DB_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

async function run() {
  // Ordine: tabelle senza dipendenti prima
  const tables = [
    "imap_settings", "email_log", "email_templates", "company_settings",
    "notes", "tasks", "clients", "users",
  ];

  await c.execute("PRAGMA foreign_keys = OFF");
  console.log("foreign_keys = OFF\n");

  for (const table of tables) {
    process.stdout.write(`${table}: `);

    // Get current CREATE TABLE SQL
    const [r] = (await c.execute(`SELECT sql FROM sqlite_master WHERE type='table' AND name='${table}'`)).rows;
    if (!r) { console.log("SKIP - not found"); continue; }
    const oldSql = r.sql;

    // Add NOT NULL to company_id
    const newSql = oldSql.replace(/company_id(\s+text)/i, "company_id text NOT NULL");

    // Get indexes
    const idxRows = (await c.execute(`SELECT sql FROM sqlite_master WHERE type='index' AND tbl_name='${table}' AND sql IS NOT NULL`)).rows;

    const tmpName = `_new_${table}`;

    // Drop temp if exists
    await c.execute(`DROP TABLE IF EXISTS "${tmpName}"`);

    // Replace table name in CREATE - handle both "TABLE" quoted and unquoted
    let createSql = newSql;
    createSql = createSql.replace(`CREATE TABLE "${table}"`, `CREATE TABLE "${tmpName}"`);
    createSql = createSql.replace(`CREATE TABLE ${table}(`, `CREATE TABLE ${tmpName}(`);
    createSql = createSql.replace(`CREATE TABLE ${table} `, `CREATE TABLE ${tmpName} `);

    // Replace REFERENCES
    createSql = createSql.replace(new RegExp(`REFERENCES\\s+"${table}"`, 'g'), `REFERENCES "${tmpName}"`);
    createSql = createSql.replace(new RegExp(`REFERENCES\\s+${table}(\\s|\\(|\`)`, 'g'), `REFERENCES ${tmpName}$1`);

    await c.execute(createSql);

    // Copy data
    await c.execute(`INSERT INTO "${tmpName}" SELECT * FROM "${table}"`);

    // Drop original
    await c.execute(`DROP TABLE "${table}"`);

    // Rename
    await c.execute(`ALTER TABLE "${tmpName}" RENAME TO "${table}"`);

    // Recreate indexes
    for (const idxRow of idxRows) {
      try { await c.execute(idxRow.sql); } catch (e) { /* skip */ }
    }

    console.log("✓ NOT NULL");
  }

  await c.execute("PRAGMA foreign_keys = ON");
  console.log("\nforeign_keys = ON");

  // Verify
  console.log("\nVerification:");
  for (const table of tables) {
    const info = await c.execute(`PRAGMA table_info("${table}")`);
    const col = info.rows.find(r => r.name === "company_id");
    const cnt = await c.execute(`SELECT count(*) as c FROM "${table}"`);
    console.log(`  ${table}: notnull=${col?.notnull}, rows=${cnt.rows[0].c}`);
  }

  console.log("\n✓ Done!");
}

run().catch(e => console.error("\nFATAL:", e));
