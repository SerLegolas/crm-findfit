import { createClient } from "@libsql/client";
const c = createClient({url: process.env.TURSO_DB_URL, authToken: process.env.TURSO_AUTH_TOKEN});

// Users
const u = await c.execute("SELECT id, email, name, role, company_id FROM users");
console.log("=== UTENTI ===");
for (const row of u.rows) {
  console.log(`  "${row.email}" | role=${row.role} | company=${row.company_id}`);
}

// Companies
const comp = await c.execute("SELECT id, name, slug FROM companies");
console.log("\n=== AZIENDE ===");
for (const row of comp.rows) {
  console.log(`  "${row.name}" | slug="${row.slug}" | id=${row.id}`);
}
