import { createClient } from "@libsql/client";
const c = createClient({url: process.env.TURSO_DB_URL, authToken: process.env.TURSO_AUTH_TOKEN});

const users = await c.execute("SELECT id, email, company_id FROM users WHERE company_id != 'default-company-id'");
console.log("Utenti con company non-default:", users.rows.length);

for (const u of users.rows) {
  const cs = await c.execute("SELECT count(*) as c FROM company_settings WHERE company_id = '" + u.company_id + "'");
  if (Number(cs.rows[0].c) === 0) {
    await c.execute("INSERT INTO company_settings (id, company_id) VALUES ('default', '" + u.company_id + "')");
    console.log("  " + u.email + " -> Creata riga company_settings per " + u.company_id);
  } else {
    console.log("  " + u.email + " -> Già presente");
  }
}

// Verifica finale
const all = await c.execute("SELECT * FROM company_settings");
console.log("\nTotale righe company_settings:", all.rows.length);
for (const row of all.rows) {
  console.log("  company_id=" + row.company_id + " denominazione='" + row.denominazione + "'");
}
