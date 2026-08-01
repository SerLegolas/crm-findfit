import { createClient } from "@libsql/client";
import { randomUUID } from "crypto";
const c = createClient({url: process.env.TURSO_DB_URL, authToken: process.env.TURSO_AUTH_TOKEN});

// Mostra stato attuale
let r = await c.execute("SELECT id, company_id FROM company_settings");
console.log("STATO ATTUALE:", r.rows.length, "righe");
for (const row of r.rows) console.log("  id=" + row.id, "company=" + row.company_id);

// Trova company che non hanno ancora una riga
const companies = await c.execute("SELECT id, name FROM companies");
const settingsCompanies = await c.execute("SELECT company_id FROM company_settings");
const existingIds = settingsCompanies.rows.map(r => r.company_id);

for (const comp of companies.rows) {
  if (!existingIds.includes(comp.id)) {
    const newId = randomUUID();
    await c.execute("INSERT INTO company_settings (id, company_id) VALUES ('" + newId + "', '" + comp.id + "')");
    console.log("Creata riga per company:", comp.name, "(" + comp.id + ")");
  }
}

// Mostra stato finale
r = await c.execute("SELECT id, company_id FROM company_settings");
console.log("\nSTATO FINALE:", r.rows.length, "righe");
for (const row of r.rows) console.log("  id=" + row.id, "company=" + row.company_id);
