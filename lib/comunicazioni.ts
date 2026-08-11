import { db } from "@/lib/db";
import { comunicazioni } from "@/lib/schema";
import { and, eq, gte, lte, ne, sql } from "drizzle-orm";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// Fuso orario di riferimento per l'invio (default Europe/Rome, l'orario aziendale).
// Il server (es. Vercel) gira in UTC: va impostato esplicitamente, altrimenti
// "08:00 locali del server" = 08:00 UTC = 10:00 in Italia.
const COMUNICAZIONI_TZ = process.env.COMUNICAZIONI_TIME_ZONE || "Europe/Rome";

/** Restituisce il timestamp UTC corrispondente a una data (YYYY-MM-DD) alle ore
 *  indicate nel fuso orario `tz`. Gestisce correttamente l'ora legale (DST). */
function dateAtInTimeZone(
  dateStr: string,
  tz: string,
  hour: number,
  minute = 0,
  second = 0,
  ms = 0
): Date {
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

  // T0 = istante UTC di prova; confrontandolo con la sua rappresentazione nel fuso
  // ricaviamo l'offset del fuso alla data scelta (incluso DST) e lo applichiamo.
  const T0 = Date.UTC(y, m - 1, d, hour, minute, second, ms);
  const parts = dtf.formatToParts(new Date(T0));
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
  const wallAsUTC = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    get("hour"),
    get("minute"),
    get("second")
  );
  const offset = wallAsUTC - T0; // offset del fuso rispetto a UTC alla data scelta
  return new Date(T0 - offset);
}

/** Risolve la data (solo giorno, "YYYY-MM-DD") nel timestamp completo di data_invio:
 *  SEMPRE alle 08:00 del fuso orario configurato (default Europe/Rome).
 *  In sviluppo, programmare per oggi fa partire l'invio al primo cron
 *  (le 08:00 di oggi sono già passate). Restituisce null se il formato non è valido.
 */
export function resolveDataInvio(dateStr: string): Date | null {
  if (!DATE_RE.test(dateStr)) return null;

  const d = dateAtInTimeZone(dateStr, COMUNICAZIONI_TZ, 8);
  if (Number.isNaN(d.getTime())) return null;

  console.log(
    `[COMUNICAZIONI] data_invio ${dateStr} 08:00 (${COMUNICAZIONI_TZ}) =>`,
    d.toISOString(),
    "| locale:",
    d.toLocaleString("it-IT", { timeZone: COMUNICAZIONI_TZ })
  );
  return d;
}

/** Verifica se una data è già occupata da un'altra comunicazione "attiva"
 *  (stato diverso da "inviata" e "annullata" → cioè non completata né annullata).
 *  L'intervallo della giornata è calcolato nel fuso orario di riferimento,
 *  così da essere coerente con l'ora salvata (08:00 del fuso).
 *  Permette di escludere la comunicazione corrente in modifica.
 */
export async function isDateOccupied(
  companyId: string,
  dateStr: string,
  excludeId?: string
): Promise<boolean> {
  if (!DATE_RE.test(dateStr)) return false;

  const start = dateAtInTimeZone(dateStr, COMUNICAZIONI_TZ, 0);
  const end = dateAtInTimeZone(dateStr, COMUNICAZIONI_TZ, 23, 59, 59, 999);

  const conditions: any[] = [
    eq(comunicazioni.companyId, companyId),
    gte(comunicazioni.dataInvio, start),
    lte(comunicazioni.dataInvio, end),
    sql`${comunicazioni.stato} NOT IN ('inviata', 'annullata')`,
  ];
  if (excludeId) {
    conditions.push(ne(comunicazioni.id, excludeId));
  }

  const [row] = await db
    .select({ id: comunicazioni.id })
    .from(comunicazioni)
    .where(and(...conditions))
    .limit(1);

  return !!row;
}
