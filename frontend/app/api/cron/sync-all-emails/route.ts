import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { imapSettings, cronLog } from "@/lib/schema";
import { eq } from "drizzle-orm";
import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";
import { decrypt } from "@/lib/crypto";
import { parseContactRequest, processContactRequestWithCounts } from "@/lib/email-parser";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Cron di sincronizzazione automatica email per TUTTE le aziende.
 * Invocato via GET con ?secret=CRON_SECRET_TOKEN (es. da Aruba con wget).
 * Per ogni azienda con impostazioni IMAP:
 *  - legge le email non lette, applica i filtri,
 *  - elabora le richieste di contatto (parseContactRequest + processContactRequest),
 *  - registra tutto in cron_log.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const secret = searchParams.get("secret");

  if (!process.env.CRON_SECRET_TOKEN || secret !== process.env.CRON_SECRET_TOKEN) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const summary = {
    companies: 0,
    emailsFound: 0,
    clientsCreated: 0,
    tasksCreated: 0,
    errors: 0,
  };

  try {
    const rows = await db.select().from(imapSettings);
    summary.companies = rows.length;

    for (const row of rows) {
      // a) Record di log per questa azienda
      const [log] = await db
        .insert(cronLog)
        .values({ companyId: row.companyId, startedAt: new Date() })
        .returning();

      // g) Gestione errore: salva il messaggio e marca completato
      const fail = async (message: string) => {
        await db
          .update(cronLog)
          .set({ error: message, completedAt: new Date() })
          .where(eq(cronLog.id, log.id));
        summary.errors++;
      };

      try {
        // Decripta le impostazioni IMAP/SMTP della riga
        const host = decrypt(row.imapHost);
        const port = parseInt(decrypt(row.imapPort), 10);
        const user = decrypt(row.user);
        const password = decrypt(row.password);
        const filterFrom = (decrypt(row.filterFrom) || "").toLowerCase();
        const filterSubject = (decrypt(row.filterSubject) || "").toLowerCase();

        let emailsFound = 0;
        let clientsCreated = 0;
        let tasksCreated = 0;

        const client = new ImapFlow({
          host,
          port,
          secure: port === 993,
          auth: { user, pass: password },
          logger: false,
          connectionTimeout: 30000,
        });

        try {
          // b) Connessione IMAP
          await client.connect();

          // c) Recupera email non lette
          const lock = await client.getMailboxLock("INBOX");
          try {
            const rawResult = await client.search({ unseen: true } as any);
            const uidList = Array.isArray(rawResult) ? rawResult : [];

            for (const uid of uidList) {
              let message: any;
              try {
                message = await client.fetchOne(uid, { source: true });
              } catch {
                continue;
              }

              let parsed: any;
              try {
                parsed = await simpleParser(message.source as Buffer);
              } catch {
                continue;
              }

              // d) Filtri
              const fromAddress = parsed.from?.value?.[0]?.address?.toLowerCase() || "";
              if (filterFrom && fromAddress !== filterFrom) continue;

              const oggetto = parsed.subject || "";
              if (filterSubject && !oggetto.toLowerCase().includes(filterSubject)) continue;

              const bodyText = (parsed.text || parsed.html || "").trim();

              // e) Elabora la richiesta di contatto
              const contactData = parseContactRequest(bodyText);
              if (!contactData) continue;

              const result = await processContactRequestWithCounts(contactData, row.companyId);

              // Segna come letta per non rielaborarla al prossimo giro
              try {
                await client.messageFlagsAdd(uid, ["\\Seen"]);
              } catch {}

              emailsFound++;
              clientsCreated += result.clientsCreated;
              tasksCreated += result.tasksCreated;
            }
          } finally {
            lock.release();
          }
        } catch (error: any) {
          await fail(error?.message || "Errore durante la connessione IMAP.");
          continue;
        } finally {
          try {
            await client.logout();
          } catch {
            // Connessione mai stabilita: ignora
          }
        }

        // f) Aggiorna il log con i risultati
        await db
          .update(cronLog)
          .set({ emailsFound, clientsCreated, tasksCreated, completedAt: new Date() })
          .where(eq(cronLog.id, log.id));

        summary.emailsFound += emailsFound;
        summary.clientsCreated += clientsCreated;
        summary.tasksCreated += tasksCreated;
      } catch (error: any) {
        await fail(error?.message || "Errore durante l'elaborazione delle impostazioni.");
      }
    }

    // h) Pulizia log più vecchi di 5 giorni dopo ogni esecuzione (non bloccante)
    try {
      const base = new URL(request.url).origin;
      await fetch(`${base}/api/cron/cleanup`, {
        cache: "no-store",
        headers: { "x-cron-secret": process.env.CRON_SECRET_TOKEN || "" },
      });
    } catch {
      // La pulizia non deve interrompere la risposta del cron
    }

    return NextResponse.json({ success: true, ...summary });
  } catch (error: any) {
    console.error("Errore cron sync-all-emails:", error);
    return NextResponse.json(
      { success: false, error: error?.message || "Errore sconosciuto" },
      { status: 500 }
    );
  }
}
