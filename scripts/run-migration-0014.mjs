import { createClient } from "@libsql/client";
const c = createClient({url: process.env.TURSO_DB_URL, authToken: process.env.TURSO_AUTH_TOKEN});

await c.execute(`CREATE TABLE IF NOT EXISTS "global_settings" (
  "id" text PRIMARY KEY NOT NULL,
  "key" text NOT NULL,
  "value" text NOT NULL,
  "updated_at" integer NOT NULL
)`);
await c.execute(`CREATE UNIQUE INDEX IF NOT EXISTS "global_settings_key_unique" ON "global_settings" ("key")`);

// Inserisci riga iniziale showRegisterButton
const existing = await c.execute("SELECT count(*) as c FROM global_settings WHERE key='showRegisterButton'");
if (Number(existing.rows[0].c) === 0) {
  await c.execute("INSERT INTO global_settings (id, key, value, updated_at) VALUES ('show-reg-btn', 'showRegisterButton', 'true', " + Date.now() + ")");
  console.log("Inserita riga iniziale showRegisterButton=true");
}

console.log("Migrazione 0014 completata");
