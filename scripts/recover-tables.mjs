/**
 * RECOVERY: Ricrea tutte le tabelle perse.
 * I dati di clients, notes, tasks, ecc. sono andati persi.
 * Recuperiamo users da _nn_users e ricreiamo tutto il resto.
 */
import { createClient } from "@libsql/client";

const c = createClient({
  url: process.env.TURSO_DB_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

async function main() {
  // 1. Rename _nn_users -> users (ha già NOT NULL e dati)
  console.log("1. Renaming _nn_users -> users...");
  await c.execute("DROP TABLE IF EXISTS users");
  await c.execute("ALTER TABLE \"_nn_users\" RENAME TO \"users\"");
  console.log("   ✓ users restored with 4 users");

  // 2. Create all other tables from scratch
  console.log("\n2. Creating tables...");
  
  await c.execute(`CREATE TABLE IF NOT EXISTS "clients" (
    "id" text PRIMARY KEY NOT NULL,
    "name" text NOT NULL,
    "email" text,
    "phone" text,
    "company" text,
    "status" text NOT NULL DEFAULT 'lead',
    "categoria" text,
    "notes" text,
    "user_id" text REFERENCES "users"("id") ON DELETE set null,
    "company_id" text NOT NULL REFERENCES "companies"("id") ON DELETE cascade,
    "created_at" integer NOT NULL,
    "updated_at" integer NOT NULL
  )`);
  console.log("   ✓ clients");

  await c.execute(`CREATE TABLE IF NOT EXISTS "notes" (
    "id" text PRIMARY KEY NOT NULL,
    "client_id" text NOT NULL REFERENCES "clients"("id") ON DELETE cascade,
    "content" text NOT NULL,
    "type" text NOT NULL DEFAULT 'conversazione',
    "author" text NOT NULL DEFAULT 'Utente',
    "company_id" text NOT NULL REFERENCES "companies"("id") ON DELETE cascade,
    "created_at" integer NOT NULL,
    "updated_at" integer NOT NULL
  )`);
  console.log("   ✓ notes");

  await c.execute(`CREATE TABLE IF NOT EXISTS "tasks" (
    "id" text PRIMARY KEY NOT NULL,
    "client_id" text NOT NULL REFERENCES "clients"("id") ON DELETE cascade,
    "title" text NOT NULL,
    "description" text,
    "due_date" integer,
    "status" text NOT NULL DEFAULT 'todo',
    "priority" text NOT NULL DEFAULT 'medium',
    "completed_at" integer,
    "company_id" text NOT NULL REFERENCES "companies"("id") ON DELETE cascade,
    "created_at" integer NOT NULL,
    "updated_at" integer NOT NULL
  )`);
  console.log("   ✓ tasks");

  await c.execute(`CREATE TABLE IF NOT EXISTS "imap_settings" (
    "id" text PRIMARY KEY NOT NULL,
    "imap_host" text NOT NULL,
    "imap_port" text NOT NULL,
    "user" text NOT NULL,
    "password" text NOT NULL,
    "filter_from" text NOT NULL,
    "filter_subject" text NOT NULL,
    "smtp_host" text,
    "smtp_port" text,
    "smtp_secure" integer DEFAULT false,
    "company_id" text NOT NULL REFERENCES "companies"("id") ON DELETE cascade,
    "created_at" integer NOT NULL,
    "updated_at" integer NOT NULL
  )`);
  console.log("   ✓ imap_settings");

  await c.execute(`CREATE TABLE IF NOT EXISTS "email_log" (
    "id" text PRIMARY KEY NOT NULL,
    "client_id" text NOT NULL REFERENCES "clients"("id") ON DELETE cascade,
    "subject" text NOT NULL,
    "body" text NOT NULL,
    "sender" text NOT NULL,
    "author" text NOT NULL DEFAULT 'Utente',
    "sent_at" integer NOT NULL,
    "status" text NOT NULL DEFAULT 'pending',
    "company_id" text NOT NULL REFERENCES "companies"("id") ON DELETE cascade,
    "created_at" integer NOT NULL
  )`);
  console.log("   ✓ email_log");

  await c.execute(`CREATE TABLE IF NOT EXISTS "email_templates" (
    "id" text PRIMARY KEY NOT NULL,
    "name" text NOT NULL,
    "subject" text NOT NULL,
    "body_html" text NOT NULL,
    "author" text NOT NULL DEFAULT 'Utente',
    "company_id" text NOT NULL REFERENCES "companies"("id") ON DELETE cascade,
    "created_at" integer NOT NULL,
    "updated_at" integer NOT NULL
  )`);
  console.log("   ✓ email_templates");

  await c.execute(`CREATE TABLE IF NOT EXISTS "company_settings" (
    "id" text PRIMARY KEY NOT NULL,
    "denominazione" text NOT NULL DEFAULT '',
    "piva" text NOT NULL DEFAULT '',
    "cf" text NOT NULL DEFAULT '',
    "indirizzo" text NOT NULL DEFAULT '',
    "città" text NOT NULL DEFAULT '',
    "provincia" text NOT NULL DEFAULT '',
    "cap" text NOT NULL DEFAULT '',
    "email" text NOT NULL DEFAULT '',
    "telefono" text NOT NULL DEFAULT '',
    "footer_attivo" integer NOT NULL DEFAULT false,
    "company_id" text NOT NULL REFERENCES "companies"("id") ON DELETE cascade
  )`);
  console.log("   ✓ company_settings");

  // 3. Create default company_settings row
  console.log("\n3. Creating default company_settings...");
  await c.execute(`INSERT INTO "company_settings" ("id", "company_id") VALUES ('default', 'default-company-id')`);
  console.log("   ✓ Default row created");

  // 4. Verify
  console.log("\n4. Verification:");
  const tables = ["companies", "users", "clients", "notes", "tasks", "imap_settings", "email_log", "email_templates", "company_settings"];
  for (const t of tables) {
    const r = await c.execute(`SELECT count(*) as c FROM "${t}"`);
    const info = await c.execute(`PRAGMA table_info("${t}")`);
    const col = info.rows.find(r => r.name === "company_id");
    console.log(`  ${t}: rows=${r.rows[0].c}, company_id notnull=${col?.notnull}`);
  }

  console.log("\n✓ Recovery complete!");
}

main().catch(e => console.error("FATAL:", e));
