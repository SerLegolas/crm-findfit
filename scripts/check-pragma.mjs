import { createClient } from "@libsql/client";
const c = createClient({url: process.env.TURSO_DB_URL, authToken: process.env.TURSO_AUTH_TOKEN});

const r = await c.execute("PRAGMA foreign_keys");
console.log("foreign_keys:", JSON.stringify(r.rows[0]));
