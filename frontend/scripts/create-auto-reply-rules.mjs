/**
 * Applica la migrazione 0022_goofy_diamondback.sql (tabella auto_reply_rules)
 * al DB Turso. Idempotente: se la tabella/l'indice esistono già, non fa nulla.
 *
 * Uso:  cd frontend && node scripts/create-auto-reply-rules.mjs
 * (drizzle-kit push non funziona su Turso)
 */
import { createClient } from "@libsql/client";
import { config } from "dotenv";

config({ path: ".env.local" });

const client = createClient({
  url: process.env.TURSO_DB_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

const existing = await client.execute(
  "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'auto_reply_rules'"
);

if (existing.rows.length > 0) {
  console.log("Tabella auto_reply_rules già presente: nessuna azione.");
} else {
  await client.execute(`
    CREATE TABLE \`auto_reply_rules\` (
      \`id\` text PRIMARY KEY NOT NULL,
      \`company_id\` text NOT NULL,
      \`categoria\` text NOT NULL,
      \`template_id\` text NOT NULL,
      \`follow_up_days\` integer DEFAULT 1 NOT NULL,
      \`follow_up_task_title\` text DEFAULT 'Ricontattare cliente' NOT NULL,
      \`enabled\` integer DEFAULT true NOT NULL,
      \`created_at\` integer NOT NULL,
      \`updated_at\` integer NOT NULL,
      FOREIGN KEY (\`company_id\`) REFERENCES \`companies\`(\`id\`) ON UPDATE no action ON DELETE cascade,
      FOREIGN KEY (\`template_id\`) REFERENCES \`email_templates\`(\`id\`) ON UPDATE no action ON DELETE cascade
    )
  `);
  console.log("Tabella auto_reply_rules creata.");
}

const index = await client.execute(
  "SELECT name FROM sqlite_master WHERE type = 'index' AND name = 'auto_reply_rules_company_categoria_idx'"
);

if (index.rows.length > 0) {
  console.log("Indice auto_reply_rules_company_categoria_idx già presente.");
} else {
  await client.execute(
    "CREATE UNIQUE INDEX `auto_reply_rules_company_categoria_idx` ON `auto_reply_rules` (`company_id`,`categoria`)"
  );
  console.log("Indice unico (company_id, categoria) creato.");
}

const cols = await client.execute("PRAGMA table_info(auto_reply_rules)");
console.log("Colonne:", cols.rows.map((r) => r.name).join(", "));
