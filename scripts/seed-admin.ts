import { createClient } from "@libsql/client";
import { config } from "dotenv";
import bcrypt from "bcryptjs";
import { randomUUID } from "crypto";

config({ path: ".env.local" });

const client = createClient({
  url: process.env.TURSO_DB_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

async function main() {
  const email = process.argv[2] || "admin@findfit.it";
  const password = process.argv[3] || "admin123";
  const name = process.argv[4] || "Amministratore";

  // Se ADMIN_PASSWORD_HASH è impostato in env, usalo direttamente (utile su Vercel)
  const hash = process.env.ADMIN_PASSWORD_HASH || await bcrypt.hash(password, 12);

  try {
    await client.execute({
      sql: `INSERT INTO users (id, email, password_hash, name, role, is_active, created_at, updated_at)
            VALUES (?, ?, ?, ?, 'admin', 1, ?, ?)`,
      args: [
        randomUUID(),
        email,
        hash,
        name,
        Date.now(),
        Date.now(),
      ],
    });
    console.log(`✓ Admin creato: ${email} / ${password}`);
  } catch (e: any) {
    if (e.message?.includes("UNIQUE")) {
      console.log("! L'admin esiste già");
    } else {
      console.error("Errore:", e.message);
    }
  }
}

main().catch(console.error);
