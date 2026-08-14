import { config } from "dotenv";
import { createClient } from "@libsql/client";

config({ path: ".env.local" });

const c = createClient({
  url: process.env.TURSO_DB_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

// 1) Verifica se la colonna esiste già
const info = await c.execute({
  sql: 'PRAGMA table_info("clients")',
  args: [],
});
const hasCol = info.rows.some((r) => r.name === "email_consent");
console.log("email_consent già presente:", hasCol);

if (!hasCol) {
  await c.execute({
    sql: 'ALTER TABLE `clients` ADD `email_consent` integer DEFAULT true NOT NULL',
    args: [],
  });
  console.log("Colonna email_consent aggiunta.");
} else {
  console.log("Colonna già presente, salto ALTER.");
}

// 2) Verifica
const check = await c.execute({
  sql: 'PRAGMA table_info("clients")',
  args: [],
});
for (const r of check.rows) {
  if (r.name === "email_consent") {
    console.log("  email_consent:", "type=", r.type, "notnull=", r.notnull, "dflt=", r.dflt_value);
  }
}

// 3) Conteggio consenzienti / non consenzienti
const cnt = await c.execute({
  sql: "SELECT email_consent, COUNT(*) AS n FROM clients GROUP BY email_consent",
  args: [],
});
for (const r of cnt.rows) console.log("  email_consent =", r.email_consent, "->", r.n);
