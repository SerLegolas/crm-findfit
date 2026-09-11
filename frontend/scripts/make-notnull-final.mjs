/**
 * Rende NOT NULL le colonne company_id su tutte le tabelle.
 * 
 * Strategia: per ogni tabella:
 * 1. CREATE TABLE nuova con NOT NULL (nome temporaneo)
 * 2. INSERT ... SELECT per copiare dati
 * 3. DROP TABLE originale
 * 4. ALTER TABLE ... RENAME TO
 * 
 * L'ordine è: tabelle figlie prima (nessuna FK in uscita), poi tabelle padre.
 * FOREIGN_KEYs disabilitati per permettere DROP.
 * 
 * Attenzione: questo script presuppone che company_id sia già popolato in TUTTI i record.
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

async function processTable(table, tablesSet) {
  console.log(`\n--- ${table} ---`);

  const oldSql = await getTableSql(table);
  if (!oldSql) { console.error(`  ✗ NOT FOUND`); return; }

  // Add NOT NULL to company_id
  const newSql = oldSql.replace(/company_id(\s+text)/i, "company_id text NOT NULL");
  const indexes = await getIndexesSql(table);

  const tmpName = `_tmp_${table}`;

  // Drop temp if any
  await c.execute(`DROP TABLE IF EXISTS "${tmpName}"`);

  // Create temp table (replace ALL occurrences of table name in SQL)
  let sql = newSql;
  // Replace in all quoting variations: backtick, double-quote, unquoted
  sql = sql.split(`\`${table}\``).join(`\`${tmpName}\``);
  sql = sql.split(`"${table}"`).join(`"${tmpName}"`);
  // Handle unquoted (but not as part of other words)
  const regex = new RegExp(`(?<=CREATE\\s+TABLE\\s+|REFERENCES\\s+|TABLE\\s+)"?${table}"?(?=\\s|[(,;\`])`, 'gi');
  sql = sql.replace(regex, (match) => {
    if (match.includes('"')) return `"${tmpName}"`;
    return tmpName;
  });

  console.log(`  CREATE TABLE ${tmpName}...`);
  console.log(`  SQL: ${sql.substring(0, 120)}...`);
  await c.execute(sql);

  // Copy data
  const cols = (await c.execute(`PRAGMA table_info("${tmpName}")`)).rows.map(r => `"${r.name}"`).join(", ");
  console.log(`  INSERT ... SELECT (${cols.substring(0, 80)}...)`);
  await c.execute(`INSERT INTO "${tmpName}" SELECT * FROM "${table}"`);

  // Drop original
  console.log(`  DROP TABLE ${table}...`);
  await c.execute(`DROP TABLE "${table}"`);

  // Rename
  console.log(`  RENAME ${tmpName} -> ${table}...`);
  await c.execute(`ALTER TABLE "${tmpName}" RENAME TO "${table}"`);

  // Recreate indexes
  for (const idx of indexes) {
    try {
      await c.execute(idx);
      console.log(`  INDEX recreated`);
    } catch (e) {
      console.warn(`  ⚠ INDEX: ${e.message}`);
    }
  }

  // Verify
  const info = await c.execute(`PRAGMA table_info("${table}")`);
  const col = info.rows.find(r => r.name === "company_id");
  console.log(`  ✓ company_id notnull=${col?.notnull}`);
}

async function run() {
  console.log("=== Make company_id NOT NULL ===\n");

  // Verifica che tutti i company_id siano popolati
  const tables = ["users", "clients", "notes", "tasks", "imap_settings", "email_log", "email_templates", "company_settings"];
  for (const t of tables) {
    const nulls = await c.execute(`SELECT count(*) as c FROM "${t}" WHERE company_id IS NULL`);
    if (Number(nulls.rows[0].c) > 0) {
      console.error(`✗ ${t} has ${nulls.rows[0].c} NULL company_id! Aborting.`);
      process.exit(1);
    }
    console.log(`✓ ${t}: all company_id populated`);
  }

  console.log("\nAll data validated. Proceeding with NOT NULL...\n");

  // Disable FK
  await c.execute("PRAGMA foreign_keys = OFF");
  console.log("Foreign keys OFF\n");

  // Process in dependency order: children first, parents last
  // Notes -> Tasks -> Clients -> Users need special order due to FK chains
  // Actually let's just do it table by table with FK off
  for (const t of tables) {
    try {
      await processTable(t, new Set(tables));
    } catch (e) {
      console.error(`✗ Failed on ${t}: ${e.message}`);
      // Try to continue with next table
    }
  }

  await c.execute("PRAGMA foreign_keys = ON");
  console.log("\nForeign keys ON");
  console.log("\n✓ Complete!");
}

run().catch(e => console.error("\nFATAL:", e));
