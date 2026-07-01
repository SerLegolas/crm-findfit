import { createClient } from "@libsql/client";
import { config } from "dotenv";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

config({ path: ".env.local" });

const __dirname = dirname(fileURLToPath(import.meta.url));

const client = createClient({
  url: process.env.TURSO_DB_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

const sqlPath = join(__dirname, "..", "drizzle", "0007_heavy_azazel.sql");
const sql = readFileSync(sqlPath, "utf-8");

try {
  await client.execute(sql);
  console.log("✅ Migrazione 0007 applicata con successo");
} catch (err) {
  console.error("❌ Errore:", err.message);
}

await client.close();
