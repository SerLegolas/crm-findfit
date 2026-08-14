/**
 * Conteggi dati per azienda (companyId).
 * Usato dal SuperAdmin per mostrare i dati prima dell'eliminazione
 * e per il log dell'operazione.
 */
import { db } from "@/lib/db";
import { count, eq } from "drizzle-orm";
import {
  users,
  clients,
  tasks,
  notes,
  emailLog,
  emailTemplates,
  imapSettings,
  companySettings,
  companyRules,
  cronLog,
  comunicazioni,
  comunicazioniBatch,
  savedAnalyses,
} from "@/lib/schema";

export interface CompanyCounts {
  users: number;
  clients: number;
  tasks: number;
  notes: number;
  emailLog: number;
  emailTemplates: number;
  imapSettings: number;
  companySettings: number;
  companyRules: number;
  cronLog: number;
  comunicazioni: number;
  comunicazioniBatch: number;
  savedAnalyses: number;
}

/**
 * Conta le righe per ogni tabella collegata alla company.
 * `comunicazioni_batch` non ha company_id: conta via join su comunicazioni.
 */
export async function getCompanyCounts(
  companyId: string
): Promise<CompanyCounts> {
  const [u, c, t, n, e, et, im, cs, cr, cl, com, batch, sa] =
    await Promise.all([
      db.select({ n: count() }).from(users).where(eq(users.companyId, companyId)),
      db.select({ n: count() }).from(clients).where(eq(clients.companyId, companyId)),
      db.select({ n: count() }).from(tasks).where(eq(tasks.companyId, companyId)),
      db.select({ n: count() }).from(notes).where(eq(notes.companyId, companyId)),
      db.select({ n: count() }).from(emailLog).where(eq(emailLog.companyId, companyId)),
      db
        .select({ n: count() })
        .from(emailTemplates)
        .where(eq(emailTemplates.companyId, companyId)),
      db
        .select({ n: count() })
        .from(imapSettings)
        .where(eq(imapSettings.companyId, companyId)),
      db
        .select({ n: count() })
        .from(companySettings)
        .where(eq(companySettings.companyId, companyId)),
      db
        .select({ n: count() })
        .from(companyRules)
        .where(eq(companyRules.companyId, companyId)),
      db.select({ n: count() }).from(cronLog).where(eq(cronLog.companyId, companyId)),
      db
        .select({ n: count() })
        .from(comunicazioni)
        .where(eq(comunicazioni.companyId, companyId)),
      db
        .select({ n: count() })
        .from(comunicazioniBatch)
        .innerJoin(
          comunicazioni,
          eq(comunicazioniBatch.comunicazioneId, comunicazioni.id)
        )
        .where(eq(comunicazioni.companyId, companyId)),
      db
        .select({ n: count() })
        .from(savedAnalyses)
        .where(eq(savedAnalyses.companyId, companyId)),
    ]);

  const num = (r: { n: number }[]) => Number(r[0]?.n ?? 0);

  return {
    users: num(u),
    clients: num(c),
    tasks: num(t),
    notes: num(n),
    emailLog: num(e),
    emailTemplates: num(et),
    imapSettings: num(im),
    companySettings: num(cs),
    companyRules: num(cr),
    cronLog: num(cl),
    comunicazioni: num(com),
    comunicazioniBatch: num(batch),
    savedAnalyses: num(sa),
  };
}
