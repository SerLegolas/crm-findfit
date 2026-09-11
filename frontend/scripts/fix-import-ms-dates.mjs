import { config } from "dotenv";
import { createClient } from "@libsql/client";

config({ path: ".env.local" });

const commit = process.argv.includes("--commit");
const c = createClient({
  url: process.env.TURSO_DB_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

// Diagnosi: valori in millisecondi (> 1e12) — lo schema drizzle "timestamp" usa SECONDI
const d = await c.execute({
  sql: `SELECT
          (SELECT COUNT(*) FROM clients WHERE created_at > 1000000000000) AS clients_created_ms,
          (SELECT COUNT(*) FROM clients WHERE updated_at > 1000000000000) AS clients_updated_ms,
          (SELECT COUNT(*) FROM notes WHERE created_at > 1000000000000) AS notes_created_ms,
          (SELECT COUNT(*) FROM notes WHERE updated_at > 1000000000000) AS notes_updated_ms`,
  args: [],
});
const r = d.rows[0];
console.log("Clienti con created_at in ms:", r.clients_created_ms);
console.log("Clienti con updated_at in ms:", r.clients_updated_ms);
console.log("Note con created_at in ms   :", r.notes_created_ms);
console.log("Note con updated_at in ms   :", r.notes_updated_ms);

if (!commit) {
  console.log("\n⚠ DRY-RUN. Esegui con --commit per convertire ms → secondi.");
  process.exit(0);
}

// Conversione: ms → secondi (divide per 1000, tronca) SOLO dove il valore è in ms
const c1 = await c.execute({
  sql: "UPDATE clients SET created_at = CAST(created_at/1000 AS INTEGER) WHERE created_at > 1000000000000",
  args: [],
});
const c2 = await c.execute({
  sql: "UPDATE clients SET updated_at = CAST(updated_at/1000 AS INTEGER) WHERE updated_at > 1000000000000",
  args: [],
});
const n1 = await c.execute({
  sql: "UPDATE notes SET created_at = CAST(created_at/1000 AS INTEGER) WHERE created_at > 1000000000000",
  args: [],
});
const n2 = await c.execute({
  sql: "UPDATE notes SET updated_at = CAST(updated_at/1000 AS INTEGER) WHERE updated_at > 1000000000000",
  args: [],
});

console.log(`\nClienti created_at corretti: ${c1.rowsAffected}`);
console.log(`Clienti updated_at corretti: ${c2.rowsAffected}`);
console.log(`Note created_at corrette  : ${n1.rowsAffected}`);
console.log(`Note updated_at corrette  : ${n2.rowsAffected}`);

// Verifica
const v = await c.execute({
  sql: `SELECT
          (SELECT COUNT(*) FROM clients WHERE created_at > 1000000000000) AS clients_created_ms,
          (SELECT COUNT(*) FROM notes WHERE created_at > 1000000000000) AS notes_created_ms,
          (SELECT COUNT(*) FROM clients WHERE created_at IS NULL OR created_at = 0) AS clients_zero,
          (SELECT COUNT(*) FROM notes WHERE created_at IS NULL OR created_at = 0) AS notes_zero`,
  args: [],
});
console.log("\nVerifica — ancora in ms → clienti:", v.rows[0].clients_created_ms, "| note:", v.rows[0].notes_created_ms);
console.log("Verifica — 0/NULL → clienti:", v.rows[0].clients_zero, "| note:", v.rows[0].notes_zero);
