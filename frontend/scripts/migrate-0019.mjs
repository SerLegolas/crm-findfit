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
  join(__dirname, "..", "drizzle", "0019_faulty_mikhail_rasputin.sql"),
  "utf-8"
);

const statements = sql
  .split("--> statement-breakpoint")
  .map((s) => s.trim())
  .filter(Boolean);

for (const stmt of statements) {
  console.log("Esecuzione SQL:", stmt.trim());
  try {
    await client.execute(stmt.trim());
    console.log("✅ OK");
  } catch (err) {
    console.error("❌ Errore:", err.message);
  }
}

client.close();
console.log("Migrazione 0019 completata");
