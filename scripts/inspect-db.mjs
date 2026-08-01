import { createClient } from "@libsql/client";
const c = createClient({url: process.env.TURSO_DB_URL, authToken: process.env.TURSO_AUTH_TOKEN});

// Check _nn_users
try {
  const r = await c.execute("SELECT * FROM \"_nn_users\"");
  console.log("_nn_users:", r.rows.length, "rows");
  for (const row of r.rows) {
    console.log("  ", row.id, row.email, row.name, row.role, row.company_id);
  }
} catch(e) {
  console.log("_nn_users error:", e.message);
}

// Check companies
const r2 = await c.execute("SELECT * FROM companies");
console.log("\ncompanies:", r2.rows.length, "rows");
for (const row of r2.rows) {
  console.log("  ", row.id, row.name, row.slug);
}
