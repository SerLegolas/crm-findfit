import { createClient } from "@libsql/client";
const c = createClient({url: process.env.TURSO_DB_URL, authToken: process.env.TURSO_AUTH_TOKEN});

const r = await c.execute("SELECT name FROM sqlite_master WHERE type='table' AND name LIKE '%tmp%'");
for (const row of r.rows) {
  await c.execute(`DROP TABLE IF EXISTS \`${row.name}\``);
  console.log(`Dropped ${row.name}`);
}
console.log("Done");
