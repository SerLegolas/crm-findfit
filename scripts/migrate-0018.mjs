import { createClient } from "@libsql/client";
import { config } from "dotenv";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: join(__dirname, "..", ".env.local") });

const client = createClient({
  url: process.env.TURSO_DB_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

const sql = readFileSync(
  join(__dirname, "..", "drizzle", "0018_plain_tony_stark.sql"),
  "utf-8"
);

console.log("Esecuzione SQL:", sql.trim());

try {
  const result = await client.execute(sql.trim());
  console.log("✅ Migrazione completata:", result);
} catch (err) {
  console.error("❌ Errore:", err.message);
}

client.close();
