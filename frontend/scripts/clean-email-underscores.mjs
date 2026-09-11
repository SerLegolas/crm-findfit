import { config } from "dotenv";
import { createClient } from "@libsql/client";

config({ path: ".env.local" });

const commit = process.argv.includes("--commit");
const c = createClient({
  url: process.env.TURSO_DB_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

// Email con underscore iniziali o finali (gli underscore interni restano invariati)
const sel = await c.execute({
  sql: `SELECT id, email, company_id FROM clients
        WHERE email IS NOT NULL AND email != ltrim(rtrim(email, '_'), '_')
        ORDER BY email`,
  args: [],
});

console.log(`Email da ripulire: ${sel.rows.length}`);
for (const r of sel.rows) {
  const cleaned = String(r.email).replace(/^_+/, "").replace(/_+$/, "");
  console.log(`  ${r.email}  →  ${cleaned}  (company ${r.company_id})`);
}

if (!commit) {
  console.log("\n⚠ DRY-RUN: nessuna modifica effettuata.");
  console.log('Esegui con "--commit" per applicare la pulizia.');
  process.exit(0);
}

// Applica: rimuove underscore iniziali e finali, mantenendo quelli interni
const upd = await c.execute({
  sql: `UPDATE clients
        SET email = ltrim(rtrim(email, '_'), '_')
        WHERE email IS NOT NULL AND email != ltrim(rtrim(email, '_'), '_')`,
  args: [],
});
console.log(`\nEmail aggiornate: ${upd.rowsAffected}`);

// Verifica
const check = await c.execute({
  sql: `SELECT COUNT(*) AS n FROM clients
        WHERE email IS NOT NULL AND email != ltrim(rtrim(email, '_'), '_')`,
  args: [],
});
console.log("Email ancora con underscore iniziali/finali:", check.rows[0].n);
