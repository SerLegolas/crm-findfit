import { createClient } from "@libsql/client";
const c = createClient({url: process.env.TURSO_DB_URL, authToken: process.env.TURSO_AUTH_TOKEN});

// Delete in order (children first)
for (const table of ["company_settings", "companies"]) {
  const before = await c.execute(`SELECT count(*) as c FROM "${table}"`);
  await c.execute(`DELETE FROM "${table}"`);
  const after = await c.execute(`SELECT count(*) as c FROM "${table}"`);
  console.log(`${table}: ${before.rows[0].c} eliminati, rimasti ${after.rows[0].c}`);
}
