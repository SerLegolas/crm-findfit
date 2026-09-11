import { createClient } from "@libsql/client";
const c = createClient({url: process.env.TURSO_DB_URL, authToken: process.env.TURSO_AUTH_TOKEN});

await c.execute("PRAGMA foreign_keys = OFF");
const r = await c.execute("PRAGMA foreign_keys");
console.log("After setting OFF:", JSON.stringify(r.rows[0]));
