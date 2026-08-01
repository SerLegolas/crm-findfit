import { createClient } from "@libsql/client";
const c = createClient({url: process.env.TURSO_DB_URL, authToken: process.env.TURSO_AUTH_TOKEN});
const r = await c.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name");
console.log("Tables:", r.rows.map(x => x.name));
