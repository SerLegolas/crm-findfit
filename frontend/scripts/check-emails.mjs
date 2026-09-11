import { createClient } from "@libsql/client";
const c = createClient({url: process.env.TURSO_DB_URL, authToken: process.env.TURSO_AUTH_TOKEN});

const r = await c.execute("SELECT id, email, name, role FROM users");
console.log("Email nel DB:");
for (const row of r.rows) {
  console.log(`  - "${row.email}" (${row.role}, ${row.name})`);
}
console.log(`\nTotale: ${r.rows.length} utenti`);
