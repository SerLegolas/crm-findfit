import { createClient } from "@libsql/client";

const c = createClient({
  url: process.env.TURSO_DB_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

async function run() {
  // Create companies table
  await c.execute(`CREATE TABLE IF NOT EXISTS companies (
    id text PRIMARY KEY NOT NULL,
    name text NOT NULL,
    slug text NOT NULL,
    created_at integer NOT NULL
  )`);
  console.log("OK: companies table created");

  // Create unique index
  try {
    await c.execute(
      "CREATE UNIQUE INDEX IF NOT EXISTS companies_slug_unique ON companies (slug)"
    );
    console.log("OK: unique index created");
  } catch (e) {
    console.log("Index maybe exists:", e.message);
  }

  // Add company_id columns to all tables
  const tables = [
    "users",
    "clients",
    "notes",
    "tasks",
    "imap_settings",
    "email_log",
    "email_templates",
    "company_settings",
  ];

  for (const table of tables) {
    try {
      const cols = await c.execute(`PRAGMA table_info(${table})`);
      const hasCol = cols.rows.some((r) => r.name === "company_id");
      if (!hasCol) {
        await c.execute(
          `ALTER TABLE \`${table}\` ADD company_id text REFERENCES companies(id)`
        );
        console.log(`OK: added company_id to ${table}`);
      } else {
        console.log(`SKIP: company_id already in ${table}`);
      }
    } catch (e) {
      console.error(`ERR on ${table}:`, e.message);
    }
  }

  console.log("Migration SQL complete!");
}

run().catch((e) => console.error("FATAL:", e));
