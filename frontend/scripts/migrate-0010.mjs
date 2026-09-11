import { createClient } from "@libsql/client";
import { config } from "dotenv";

config({ path: ".env.local" });

const client = createClient({
  url: process.env.TURSO_DB_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

const sql = `ALTER TABLE email_templates ADD COLUMN author text DEFAULT 'Utente' NOT NULL`;

try {
  await client.execute(sql);
  console.log("✅ Colonna author aggiunta a email_templates!");
} catch (err) {
  console.error("❌ Errore:", err.message);
}

client.close();
