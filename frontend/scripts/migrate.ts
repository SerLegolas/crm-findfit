import { createClient } from "@libsql/client";
import { config } from "dotenv";
import { readFileSync } from "fs";
import { resolve } from "path";

config({ path: ".env.local" });

const client = createClient({
  url: process.env.TURSO_DB_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

async function main() {
  const sqlPath = resolve(__dirname, "../drizzle/0001_charming_madripoor.sql");
  const sql = readFileSync(sqlPath, "utf-8");

  const statements = sql
    .split("--> statement-breakpoint")
    .map((s) => s.trim())
    .filter(Boolean);

  for (const stmt of statements) {
    console.log("Executing:", stmt.slice(0, 80) + "...");
    try {
      await client.execute(stmt);
      console.log("  ✓ OK");
    } catch (e: any) {
      console.error("  ✗ Error:", e.message);
    }
  }

  console.log("Migration done!");
}

main().catch(console.error);
