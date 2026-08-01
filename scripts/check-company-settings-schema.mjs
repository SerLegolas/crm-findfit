import { createClient } from "@libsql/client";
const c = createClient({url: process.env.TURSO_DB_URL, authToken: process.env.TURSO_AUTH_TOKEN});

const r = await c.execute("SELECT sql FROM sqlite_master WHERE type='table' AND name='company_settings'");
console.log(r.rows[0]?.sql);

const r2 = await c.execute("SELECT * FROM company_settings");
console.log("\nData:", JSON.stringify(r2.rows, null, 2));
