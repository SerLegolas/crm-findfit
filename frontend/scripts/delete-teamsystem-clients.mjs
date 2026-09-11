import { config } from "dotenv";
import { createClient } from "@libsql/client";

config({ path: ".env.local" });

const commit = process.argv.includes("--commit");
const c = createClient({
  url: process.env.TURSO_DB_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

// 1) Trova i clienti con "teamsystem" nell'email
const sel = await c.execute({
  sql: "SELECT id, email, name FROM clients WHERE lower(email) LIKE '%teamsystem%' ORDER BY email",
  args: [],
});
const clients = sel.rows;
console.log(`Clienti con teamsystem: ${clients.length}`);
if (clients.length === 0) {
  console.log("Nessun cliente da eliminare.");
  process.exit(0);
}

const ids = clients.map((r) => r.id);
const placeholders = ids.map(() => "?").join(",");

// 2) Conta righe collegate (note, task, email_log, comunicazioni_batch)
const counts = {};
for (const table of ["notes", "tasks", "email_log", "comunicazioni_batch"]) {
  const res = await c.execute({
    sql: `SELECT COUNT(*) AS n FROM ${table} WHERE client_id IN (${placeholders})`,
    args: ids,
  });
  counts[table] = Number(res.rows[0].n);
}
console.log("Righe collegate da eliminare:", counts);

if (!commit) {
  console.log("\n⚠ DRY-RUN: nessuna eliminazione effettuata.");
  console.log('Esegui con "--commit" per eliminare davvero.');
  process.exit(0);
}

// 3) Elimina righe collegate (esplicito; le FK sono comunque CASCADE)
for (const table of ["notes", "tasks", "email_log", "comunicazioni_batch"]) {
  const res = await c.execute({
    sql: `DELETE FROM ${table} WHERE client_id IN (${placeholders})`,
    args: ids,
  });
  console.log(`Eliminati da ${table}: ${res.rowsAffected}`);
}

// 4) Elimina i clienti
const del = await c.execute({
  sql: `DELETE FROM clients WHERE id IN (${placeholders})`,
  args: ids,
});
console.log(`Clienti eliminati: ${del.rowsAffected}`);

// 5) Verifica
const check = await c.execute(
  "SELECT COUNT(*) AS n FROM clients WHERE lower(email) LIKE '%teamsystem%'"
);
console.log("Clienti teamsystem rimanenti:", check.rows[0].n);
