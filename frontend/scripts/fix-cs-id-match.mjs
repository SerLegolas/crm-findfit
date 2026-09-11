import { createClient } from "@libsql/client";
const c = createClient({url: process.env.TURSO_DB_URL, authToken: process.env.TURSO_AUTH_TOKEN});

// Leggi tutte le righe
const rows = await c.execute("SELECT id, company_id, denominazione FROM company_settings");
console.log("Stato attuale:");
for (const row of rows.rows) {
  console.log("  id=" + row.id, "company_id=" + row.company_id, "denom=" + row.denominazione);
}

// Se id != company_id, aggiorna id = company_id
for (const row of rows.rows) {
  if (row.id !== row.company_id) {
    // Delete e reinsert per evitare UNIQUE constraint
    await c.execute("DELETE FROM company_settings WHERE id = '" + row.id + "'");
    await c.execute("INSERT INTO company_settings (id, company_id, denominazione) VALUES ('" + row.company_id + "', '" + row.company_id + "', '" + (row.denominazione || '').replace(/'/g, "''") + "')");
    console.log("  -> Aggiornato: nuovo id=" + row.company_id);
  }
}

// Verifica finale
const final = await c.execute("SELECT id, company_id, denominazione FROM company_settings");
console.log("\nStato finale:");
for (const row of final.rows) {
  console.log("  id=" + row.id, "company_id=" + row.company_id, "denom=" + row.denominazione);
}
