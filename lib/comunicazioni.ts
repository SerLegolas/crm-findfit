import { db } from "@/lib/db";
import { comunicazioni } from "@/lib/schema";
import { and, eq, gte, lte, ne, sql } from "drizzle-orm";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Risolve la data (solo giorno, "YYYY-MM-DD") nel timestamp completo di data_invio.
 *  - production: forza l'ora a 08:00:00 (fuso orario locale).
 *  - sviluppo (NODE_ENV !== "production"): usa l'ora corrente per permettere test manuali.
 *  Restituisce null se il formato non è valido.
 */
export function resolveDataInvio(dateStr: string): Date | null {
  if (!DATE_RE.test(dateStr)) return null;

  // dataInvio è "YYYY-MM-DD": new Date(dataInvio) viene interpretato come mezzanotte UTC
  // (ISO 8601 date-only). Con setHours impostiamo l'ora 08:00 nel FUSO ORARIO LOCALE,
  // quindi il timestamp salvato rappresenta le 08:00 locali del giorno scelto (non UTC).
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return null;

  console.log("[COMUNICAZIONI] data_invio (prima):", d.toISOString(), "| locale:", d.toString());
  // Sempre 08:00 locali (produzione e sviluppo): comportamento uniforme e prevedibile.
  // In sviluppo, per test manuali, programmare per oggi fa partire l'invio subito
  // (le 08:00 di oggi sono già passate) o comunque al primo cron successivo.
  d.setHours(8, 0, 0, 0);
  console.log(
    "[COMUNICAZIONI] data_invio (dopo setHours 08:00 locali):",
    d.toISOString(),
    "| locale:",
    d.toString()
  );
  return d;
}

/** Verifica se una data è già occupata da un'altra comunicazione "attiva"
 *  (stato diverso da "inviata" e "annullata" → cioè non completata né annullata).
 *  Permette di escludere la comunicazione corrente in modifica.
 */
export async function isDateOccupied(
  companyId: string,
  dateStr: string,
  excludeId?: string
): Promise<boolean> {
  if (!DATE_RE.test(dateStr)) return false;

  const start = new Date(`${dateStr}T00:00:00`);
  const end = new Date(`${dateStr}T23:59:59.999`);

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
