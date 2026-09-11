// Corregge l'ora di data_invio delle comunicazioni PROGRAMMATE salvate prima del fix
// del fuso orario: portale alle 08:00 del fuso Europe/Rome (non 08:00 UTC).
// Tocco SOLO le righe con stato 'programmata'/'in_elaborazione' (non quelle già inviate).
import { readFileSync } from "node:fs";
import { createClient } from "@libsql/client";

const env = readFileSync(".env.local", "utf8");
for (const line of env.split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
  if (m) process.env[m[1]] = m[2];
}

const TZ = process.env.COMUNICAZIONI_TIME_ZONE || "Europe/Rome";
const c = createClient({
  url: process.env.TURSO_DB_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

// Data (ms) -> "YYYY-MM-DD" nel fuso TZ
function toTzDateKey(ms, tz) {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = dtf.formatToParts(new Date(ms));
  const get = (t) => parts.find((p) => p.type === t)?.value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}

// Timestamp UTC (ms) corrispondente a dateStr alle ore h nel fuso TZ
function dateAtInTimeZone(dateStr, tz, hour, minute = 0, second = 0, ms = 0) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  const T0 = Date.UTC(y, m - 1, d, hour, minute, second, ms);
  const parts = dtf.formatToParts(new Date(T0));
  const get = (t) => Number(parts.find((p) => p.type === t)?.value ?? 0);
  const wallAsUTC = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    get("hour"),
    get("minute"),
    get("second")
  );
  return T0 - (wallAsUTC - T0); // ms
}

(async () => {
  const rows = (
    await c.execute(
      "SELECT id, titolo, data_invio FROM comunicazioni WHERE stato IN ('programmata','in_elaborazione')"
    )
  ).rows;

  let fixed = 0;
  for (const row of rows) {
    const storedSec = Number(row.data_invio);
    const storedMs = storedSec > 1e12 ? storedSec : storedSec * 1000;
    const dateKey = toTzDateKey(storedMs, TZ);
    const expectedMs = dateAtInTimeZone(dateKey, TZ, 8);
    const expectedSec = Math.floor(expectedMs / 1000);

    if (storedSec !== expectedSec) {
      await c.execute(
        "UPDATE comunicazioni SET data_invio = ?, updated_at = ? WHERE id = ?",
        [expectedSec, Math.floor(Date.now() / 1000), row.id]
      );
      console.log(
        `[FIX] ${row.titolo}: ${new Date(storedMs).toISOString()} (Roma ${new Date(
          storedMs
        ).toLocaleString("it-IT", { timeZone: TZ })}) -> ${new Date(expectedMs).toISOString()} (Roma ${new Date(
          expectedMs
        ).toLocaleString("it-IT", { timeZone: TZ })})`
      );
      fixed++;
    } else {
      console.log(
        `[OK ] ${row.titolo}: già corretto ${new Date(storedMs).toISOString()}`
      );
    }
  }

  console.log(`\nRighe corrette: ${fixed}`);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
