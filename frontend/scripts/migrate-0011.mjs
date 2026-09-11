import { createClient } from "@libsql/client";
import { config } from "dotenv";

config({ path: ".env.local" });

const client = createClient({
  url: process.env.TURSO_DB_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

const sql = `ALTER TABLE company_settings ADD COLUMN footer_attivo integer DEFAULT 0 NOT NULL`;

try {
  await client.execute(sql);
  console.log("✅ Colonna footer_attivo aggiunta a company_settings!");
} catch (err) {
  console.error("❌ Errore:", err.message);
}

client.close();
