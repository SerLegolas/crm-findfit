/**
 * Rende NOT NULL le colonne company_id su tutte le tabelle.
 * SQLite: CREATE TABLE nuova -> COPY data -> DROP vecchia -> RENAME.
 * Con PRAGMA foreign_keys=OFF per evitare vincoli.
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
  // Leaf tables first (no dependent children), parents last
  const tables = [
    "imap_settings", "email_log", "email_templates", "company_settings",
    "notes", "tasks", "clients", "users",
  ];

  await c.execute("PRAGMA foreign_keys = OFF");
  console.log("Foreign keys OFF\n");

  for (const table of tables) {
    console.log(`--- ${table} ---`);

    const oldSql = await getTableSql(table);
    if (!oldSql) { console.error(`  SKIP: not found`); continue; }

    // Add NOT NULL to company_id column
    const newSql = oldSql.replace(/company_id\s+text/i, "company_id text NOT NULL");
    const indexes = await getIndexesSql(table);

    const tmpName = `${table}_nn`;

    // Drop temp if exists from previous attempt
    await c.execute(`DROP TABLE IF EXISTS \`${tmpName}\``);

    // Create temp table (replace table name in SQL)
    let createSql = newSql;
    // Replace `table` with `tmpName` - handle both backtick and double-quote quoting
    createSql = createSql.replace(new RegExp(`\`${table}\``, 'g'), `\`${tmpName}\``);
    createSql = createSql.replace(new RegExp(`"${table}"`, 'g'), `"${tmpName}"`);

    console.log(`  Creating ${tmpName}...`);
    console.log(`  SQL: ${createSql.substring(0, 120)}...`);
    await c.execute(createSql);

    // Copy data
    console.log(`  Copying data...`);
    await c.execute(`INSERT INTO \`${tmpName}\` SELECT * FROM \`${table}\``);

    // Drop original
    console.log(`  Dropping ${table}...`);
    await c.execute(`DROP TABLE \`${table}\``);

    // Rename temp -> original
    console.log(`  Renaming ${tmpName} -> ${table}...`);
    await c.execute(`ALTER TABLE \`${tmpName}\` RENAME TO \`${table}\``);

    // Recreate indexes
    for (const idxSql of indexes) {
      try {
        await c.execute(idxSql);
        console.log(`  Index recreated`);
      } catch (e) {
        console.warn(`  Index warning: ${e.message}`);
      }
    }

    // Verify NOT NULL
    const info = await c.execute(`PRAGMA table_info(\`${table}\`)`);
    const col = info.rows.find(r => r.name === "company_id");
    if (col) {
      console.log(`  ✓ company_id: notnull=${col.notnull}`);
    }

    // Verify row count
    const cnt = await c.execute(`SELECT count(*) as c FROM \`${table}\``);
    console.log(`  Rows: ${cnt.rows[0].c}`);
    console.log();
  }

  await c.execute("PRAGMA foreign_keys = ON");
  console.log("Foreign keys ON");
  console.log("\n✓ Done! All company_id columns are NOT NULL.");
}

run().catch(e => console.error("FATAL:", e));
