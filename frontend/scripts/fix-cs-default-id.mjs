import { createClient } from "@libsql/client";
import { randomUUID } from "crypto";
const c = createClient({url: process.env.TURSO_DB_URL, authToken: process.env.TURSO_AUTH_TOKEN});

// Aggiorna la riga con id='default' a un UUID
const newId = randomUUID();
await c.execute("UPDATE company_settings SET id = '" + newId + "' WHERE id = 'default'");
console.log("Aggiornato id=default -> " + newId);

// Verifica
const r = await c.execute("SELECT id, company_id FROM company_settings");
console.log("\nStato finale:");
for (const row of r.rows) console.log("  id=" + row.id, "company=" + row.company_id);
