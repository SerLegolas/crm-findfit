/**
 * Genera il bcrypt hash di una password per usarlo come ADMIN_PASSWORD_HASH in .env.local
 * Uso: npx tsx scripts/generate-hash.ts <password>
 */
import bcrypt from "bcryptjs";

async function main() {
  const password = process.argv[2] || "admin123";
  const hash = await bcrypt.hash(password, 12);
  console.log(`\nADMIN_PASSWORD_HASH=${hash}\n`);
  console.log(`Aggiungi questa riga a .env.local per usarla in produzione.\n`);
}

main().catch(console.error);
