/**
 * Fix: sostituisce company_settings.id="default" con UUID univoci.
 * Poi genera la nuova migrazione Drizzle.
 */
import { createClient } from "@libsql/client";
import { randomUUID } from "crypto";

const c = createClient({url: process.env.TURSO_DB_URL, authToken: process.env.TURSO_AUTH_TOKEN});

import { randomUUID } from "crypto";

const c = createClient({url: process.env.TURSO_DB_URL, authToken: process.env.TURSO_AUTH_TOKEN});

// 1. Leggi tutte le righe
const rows = await c.execute("SELECT id, company_id FROM company_settings");
console.log("Righe trovate:", rows.rows.length);

// 2. Per ogni riga, aggiorna id con un UUID (usa l'id corrente come filtro)
for (const row of rows.rows) {
  const newId = randomUUID();
  await c.execute("UPDATE company_settings SET id = '" + newId + "' WHERE id = '" + row.id + "'");
  console.log("  " + row.id + " -> " + newId + " (company=" + row.company_id + ")");
}

// 3. Verifica
const verify = await c.execute("SELECT id, company_id FROM company_settings");
console.log("\nVerifica:");
for (const row of verify.rows) {
  console.log("  id=" + row.id + " company_id=" + row.company_id);
}
