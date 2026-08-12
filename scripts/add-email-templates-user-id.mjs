import { config } from "dotenv";
import { createClient } from "@libsql/client";

config({ path: ".env.local" });

const c = createClient({
  url: process.env.TURSO_DB_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

console.log("== Aggiunta user_id a email_templates ==");

// 1) Verifica se la colonna esiste già
const info = await c.execute('PRAGMA table_info("email_templates")');
const hasUserId = info.rows.some((r) => r.name === "user_id");
console.log("Colonna user_id già presente:", hasUserId);

if (!hasUserId) {
  console.log("Aggiungo colonna user_id...");
  await c.execute(
    "ALTER TABLE `email_templates` ADD COLUMN `user_id` text REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null"
  );
  console.log("Colonna aggiunta.");
} else {
  console.log("Colonna già presente, salto ALTER.");
}

// 2) Backfill: associa user_id tramite il nome autore (snapshot all'epoca della creazione),
//    ma SOLO all'interno della stessa company (evita match con omonimi di altre aziende).
console.log("Backfill user_id da author (company-scoped)...");
const upd = await c.execute(`
  UPDATE email_templates
  SET user_id = (
    SELECT u.id FROM users u
    WHERE u.name = email_templates.author
      AND u.company_id = email_templates.company_id
    LIMIT 1
  )
  WHERE user_id IS NULL
     OR NOT EXISTS (
       SELECT 1 FROM users u2
       WHERE u2.id = email_templates.user_id
         AND u2.company_id = email_templates.company_id
     )
`);
console.log("Righe aggiornate:", upd.rowsAffected);

// 3) Verifica finale
console.log("\nTemplate e utente associato:");
const rows = await c.execute(`
  SELECT t.name, t.author, t.user_id, u.name AS user_name
  FROM email_templates t
  LEFT JOIN users u ON u.id = t.user_id
  ORDER BY t.created_at
`);
for (const r of rows.rows) {
  console.log("  ", r.name, "| autore:", r.author, "| user_id:", r.user_id ?? "NULL", "| utente:", r.user_name ?? "—");
}

console.log("\nFatto.");
