import { createClient } from "@libsql/client";
const c = createClient({url: process.env.TURSO_DB_URL, authToken: process.env.TURSO_AUTH_TOKEN});

const r = await c.execute("SELECT id, name, slug FROM companies");
console.log("Companies nel DB:");
for (const row of r.rows) {
  console.log(`  - id="${row.id}" name="${row.name}" slug="${row.slug}"`);
}
