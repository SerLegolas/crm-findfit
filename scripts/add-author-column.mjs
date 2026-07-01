import { createClient } from "@libsql/client";
import { config } from "dotenv";

config({ path: ".env.local" });

const client = createClient({
  url: process.env.TURSO_DB_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

try {
  await client.execute(
    `ALTER TABLE email_log ADD COLUMN author text DEFAULT 'Utente' NOT NULL`
  );
  console.log("✅ Colonna 'author' aggiunta con successo a email_log");
} catch (err) {
  if (err.message?.includes("duplicate column")) {
    console.log("ℹ️ La colonna 'author' esiste già");
  } else {
    console.error("❌ Errore:", err.message);
  }
}

await client.close();
