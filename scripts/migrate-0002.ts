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
  const sqlPath = resolve(__dirname, "../drizzle/0002_fast_wildside.sql");
  const sql = readFileSync(sqlPath, "utf-8");

  const statements = sql
    .split("--> statement-breakpoint")
    .map((s) => s.trim())
    .filter(Boolean);

  for (const stmt of statements) {
    try {
      await client.execute(stmt);
      console.log(`✓ ${stmt.slice(0, 80)}...`);
    } catch (err: any) {
      if (err.message?.includes("duplicate column")) {
        console.log(`- Skipped (already exists): ${stmt.slice(0, 80)}...`);
      } else {
        console.error(`✗ Error: ${err.message}`);
      }
    }
  }

  console.log("Migration 0002 done!");
  process.exit(0);
}

main();
