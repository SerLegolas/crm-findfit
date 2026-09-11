import { createClient } from "@libsql/client";
import { config } from "dotenv";

config({ path: ".env.local" });

const client = createClient({
  url: process.env.TURSO_DB_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

const sql = `CREATE TABLE IF NOT EXISTS email_templates (
  id text PRIMARY KEY NOT NULL,
  name text NOT NULL,
  subject text NOT NULL,
  body_html text NOT NULL,
  created_at integer NOT NULL,
  updated_at integer NOT NULL
);`;

try {
  await client.execute(sql);
  console.log("✅ Tabella email_templates creata con successo!");
} catch (err) {
  console.error("❌ Errore:", err.message);
}

client.close();
