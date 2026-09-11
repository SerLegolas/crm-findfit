import { createClient } from "@libsql/client";
const c = createClient({url: process.env.TURSO_DB_URL, authToken: process.env.TURSO_AUTH_TOKEN});

const before = await c.execute("SELECT count(*) as c FROM users");
console.log("Utenti prima:", before.rows[0].c);

await c.execute("DELETE FROM users");

const after = await c.execute("SELECT count(*) as c FROM users");
console.log("Utenti dopo:", after.rows[0].c);
