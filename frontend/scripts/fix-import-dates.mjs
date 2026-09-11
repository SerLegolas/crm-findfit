import { config } from "dotenv";
import { createClient } from "@libsql/client";

config({ path: ".env.local" });

const commit = process.argv.includes("--commit");
const c = createClient({
  url: process.env.TURSO_DB_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

// ── Conteggio righe con created_at = 0 o NULL ──
const countClients = await c.execute({
  sql: "SELECT COUNT(*) AS n FROM clients WHERE created_at IS NULL OR created_at = 0",
  args: [],
});
const countNotes = await c.execute({
  sql: "SELECT COUNT(*) AS n FROM notes WHERE created_at IS NULL OR created_at = 0",
  args: [],
});

console.log("Clienti con created_at 0/NULL:", countClients.rows[0].n);
console.log("Note con created_at 0/NULL:", countNotes.rows[0].n);

if (!commit) {
  console.log("\n⚠ DRY-RUN: nessuna modifica. Esegui con --commit.");
  process.exit(0);
}

// ── Correzione: timestamp UNIX in SECONDI (lo schema drizzle `mode: "timestamp"` usa secondi) ──
// NOTA: i millisecondi (> 1e12) vanno convertiti con fix-import-ms-dates.mjs
const updClients = await c.execute({
  sql: "UPDATE clients SET created_at = strftime('%s','now') WHERE created_at IS NULL OR created_at = 0",
  args: [],
});
const updNotes = await c.execute({
  sql: "UPDATE notes SET created_at = strftime('%s','now') WHERE created_at IS NULL OR created_at = 0",
  args: [],
});

console.log(`\nClienti aggiornati: ${updClients.rowsAffected}`);
console.log(`Note aggiornate: ${updNotes.rowsAffected}`);

// ── Verifica finale ──
const check = await c.execute({
  sql: `SELECT
          (SELECT COUNT(*) FROM clients WHERE created_at IS NULL OR created_at = 0) AS clienti_invalidi,
          (SELECT COUNT(*) FROM notes WHERE created_at IS NULL OR created_at = 0) AS note_invalide`,
  args: [],
});
console.log("\nRimasti con created_at 0/NULL → clienti:", check.rows[0].clienti_invalidi, "| note:", check.rows[0].note_invalide);

// Campione per confermare che i timestamp siano validi e recenti
const sample = await c.execute({
  sql: `SELECT 'clients' AS tabella, name, created_at FROM clients WHERE created_at > 0 ORDER BY created_at DESC LIMIT 3`,
  args: [],
});
for (const r of sample.rows) console.log("  cliente:", r.name, "| created_at:", r.created_at);
