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
  const d = new Date(`${dateStr}T00:00:00`);
  if (Number.isNaN(d.getTime())) return null;

  if (process.env.NODE_ENV === "production") {
    d.setHours(8, 0, 0, 0);
  } else {
    const now = new Date();
    d.setHours(now.getHours(), now.getMinutes(), now.getSeconds(), now.getMilliseconds());
  }
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
