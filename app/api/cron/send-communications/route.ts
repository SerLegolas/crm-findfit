import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  comunicazioni,
  comunicazioniBatch,
  emailTemplates,
  savedAnalyses,
  clients,
  imapSettings,
  companySettings,
  emailLog,
  notes,
} from "@/lib/schema";
import { eq, and, inArray, lte, sql } from "drizzle-orm";
import { decrypt } from "@/lib/crypto";
import { randomUUID } from "crypto";
import { trackingPixelUrl } from "@/lib/tracking";
import nodemailer from "nodemailer";
import { buildClientWhere } from "@/lib/client-filters";
import type { AuthUser } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BATCH_SIZE = 20; // clienti per lotto
const PAUSE_MS = 1000; // pausa tra un lotto e l'altro
const LOCK_STALE_MS = 2 * 60 * 60 * 1000; // 2 ore: lock "incastrati" dopo un crash

/** Converte i filtri salvati dell'analisi (oggetto) in URLSearchParams
 *  per buildClientWhere (stessa conversione usata in /api/analyses). */
function filtersToParams(filters: any): URLSearchParams {
  const params = new URLSearchParams();
  const f = filters || {};
  if (f.search) params.set("search", String(f.search));
  if (f.status && f.status !== "all") params.set("status", String(f.status));
  const cat = Array.isArray(f.categoria) ? f.categoria : f.categoria ? [f.categoria] : [];
  for (const c of cat) params.append("categoria", c);
  const uids = Array.isArray(f.userId) ? f.userId : f.userId ? [f.userId] : [];
  for (const u of uids) params.append("userId", u);
  return params;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Cron esterno di invio comunicazioni programmate (es. ogni 4 ore).
 * Invocato via GET con ?secret=CRON_SECRET_TOKEN.
 *
 * Per ogni comunicazione con data_invio <= adesso (stato programmata, o in_elaborazione
 * rimasta "incastrata" dopo un crash), in sequenza:
 *  1. Acquisisce il lock (UPDATE atomico lock=false → true) per evitare sovrapposizioni.
 *  2. Risolve l'analisi → lista clienti (fissa o dinamica via filtri salvati).
 *  3. Genera le righe batch "pending" (una per cliente, idempotente).
 *  4. Elabora lotti da 20 clienti con pausa di 1s, logica identica a send-bulk:
 *     sostituzione tag, footer azienda, pixel di tracking, invio SMTP, email_log.
 *  5. Aggiorna gli stati batch (sent/failed) e della comunicazione, poi rilascia il lock.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const secret = searchParams.get("secret");

  if (!process.env.CRON_SECRET_TOKEN || secret !== process.env.CRON_SECRET_TOKEN) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const summary = {
    comunicazioni: 0,
    lotti: 0,
    inviate: 0,
    fallite: 0,
    errors: 0,
  };

  try {
    const now = new Date();

    // ── Reset lock "stale": un processo morto lascerebbe lock=true per sempre ──
    await db
      .update(comunicazioni)
      .set({ lock: false })
      .where(
        and(
          eq(comunicazioni.lock, true),
          sql`${comunicazioni.updatedAt} < ${new Date(now.getTime() - LOCK_STALE_MS)}`
        )
      );

    // ── Comunicazioni in scadenza, non lockate ──
    const due = await db
      .select()
      .from(comunicazioni)
      .where(
        and(
          lte(comunicazioni.dataInvio, now),
          inArray(comunicazioni.stato, ["programmata", "in_elaborazione"]),
          eq(comunicazioni.lock, false)
        )
      );

    for (const com of due) {
      // ── Acquisisci il lock (atomico: solo se ancora libero) ──
      const [acquired] = await db
        .update(comunicazioni)
        .set({ lock: true, stato: "in_elaborazione" })
        .where(
          and(eq(comunicazioni.id, com.id), eq(comunicazioni.lock, false))
        )
        .returning({ id: comunicazioni.id });

      if (!acquired) {
        // Un altro processo lo sta già elaborando
        continue;
      }

      summary.comunicazioni++;

      // Stato finale: fallita se tutto fallisce
      const fail = async (message: string) => {
        await db
          .update(comunicazioni)
          .set({ stato: "fallita", lock: false })
          .where(eq(comunicazioni.id, com.id));
        console.error(
          `[SEND-COMMUNICATIONS] Comunicazione ${com.id} fallita: ${message}`
        );
        summary.errors++;
      };

      try {
        // ── Template e analisi della comunicazione ──
        const [template] = com.templateId
          ? await db
              .select()
              .from(emailTemplates)
              .where(eq(emailTemplates.id, com.templateId))
              .limit(1)
          : [];
        if (!template) {
          await fail("Template non trovato");
          continue;
        }

        const [analisi] = com.analisiId
          ? await db
              .select()
              .from(savedAnalyses)
              .where(eq(savedAnalyses.id, com.analisiId))
              .limit(1)
          : [];
        if (!analisi) {
          await fail("Analisi non trovata");
          continue;
        }

        // ── Risolvi i clienti target dall'analisi ──
        const authUser: AuthUser = {
          id: "cron",
          email: "cron",
          name: "Cron",
          role: "admin",
          companyId: com.companyId,
        };

        const fixedIds = Array.isArray(analisi.clientIds) ? analisi.clientIds : [];
        let targetClients = [];
        if (fixedIds.length > 0) {
          targetClients = await db
            .select()
            .from(clients)
            .where(
              and(
                inArray(clients.id, fixedIds),
                eq(clients.companyId, com.companyId)
              )
            );
        } else {
          const where = buildClientWhere(authUser, filtersToParams(analisi.filters));
          targetClients = await db.select().from(clients).where(where);
        }

        if (targetClients.length === 0) {
          await fail("Nessun cliente nell'analisi selezionata");
          continue;
        }

        // ── Genera le righe batch "pending" (idempotente: solo clienti mancanti) ──
        const existing = await db
          .select({ clientId: comunicazioniBatch.clientId })
          .from(comunicazioniBatch)
          .where(eq(comunicazioniBatch.comunicazioneId, com.id));
        const existingIds = new Set(existing.map((e) => e.clientId));
        const toInsert = targetClients
          .filter((c) => !existingIds.has(c.id))
          .map((c) => ({
            comunicazioneId: com.id,
            clientId: c.id,
            stato: "pending" as const,
            tentativi: 0,
          }));
        if (toInsert.length > 0) {
          await db.insert(comunicazioniBatch).values(toInsert);
        }

        // ── Configurazione SMTP della company ──
        const [imapRow] = await db
          .select()
          .from(imapSettings)
          .where(eq(imapSettings.companyId, com.companyId))
          .limit(1);

        if (
          !imapRow ||
          !imapRow.imapHost ||
          !imapRow.imapPort ||
          !imapRow.user ||
          !imapRow.password
        ) {
          await fail("Configurazione SMTP mancante per l'azienda");
          continue;
        }

        const sender = decrypt(imapRow.user);
        const smtpHost = imapRow.smtpHost ? decrypt(imapRow.smtpHost) : decrypt(imapRow.imapHost);
        const smtpPortStr = imapRow.smtpPort ? decrypt(imapRow.smtpPort) : decrypt(imapRow.imapPort);
        const smtpPort = parseInt(smtpPortStr, 10);
        const smtpSecure = imapRow.smtpSecure ?? smtpPort === 465;

        const transporter = nodemailer.createTransport({
          host: smtpHost,
          port: smtpPort,
          secure: smtpSecure,
          auth: {
            user: sender,
            pass: decrypt(imapRow.password),
          },
        });

        const [companyRow] = await db
          .select()
          .from(companySettings)
          .where(eq(companySettings.companyId, com.companyId))
          .limit(1);

        const senderName = companyRow?.denominazione?.trim() || "CRM FindFit";

        // ── Righe batch da elaborare ──
        const pending = await db
          .select()
          .from(comunicazioniBatch)
          .where(
            and(
              eq(comunicazioniBatch.comunicazioneId, com.id),
              eq(comunicazioniBatch.stato, "pending")
            )
          );

        if (pending.length === 0) {
          // Tutto già elaborato in un giro precedente
          await db
            .update(comunicazioni)
            .set({ stato: "inviata", lock: false })
            .where(eq(comunicazioni.id, com.id));
          continue;
        }

        const clientById = new Map(targetClients.map((c) => [c.id, c]));
        let sent = 0;
        let failed = 0;

        for (let i = 0; i < pending.length; i += BATCH_SIZE) {
          const batch = pending.slice(i, i + BATCH_SIZE);

          await Promise.all(
            batch.map(async (row) => {
              const client = clientById.get(row.clientId);
              const today = new Date().toLocaleDateString("it-IT", {
                day: "numeric",
                month: "long",
                year: "numeric",
              });
              const replaceTags = (text: string) =>
                text
                  .replace(/@name/g, client?.name || "")
                  .replace(/@company/g, client?.company || "")
                  .replace(/@data/g, today);

              const subject = replaceTags(template.subject);
              let bodyHtml = replaceTags(template.bodyHtml);

              // Immagine footer del template (se configurata) — prima del footer azienda
              if (template.footerImageUrl) {
                bodyHtml += `
<div style="margin-top:32px;text-align:center">
  <img src="${template.footerImageUrl}" alt="" style="max-width:100%;height:auto" />
</div>`;
              }

              if (companyRow?.footerAttivo && companyRow.denominazione) {
                const parts = [
                  companyRow.denominazione,
                  [companyRow.indirizzo, companyRow.città, companyRow.provincia].filter(Boolean).join(", ") +
                    (companyRow.cap ? ` ${companyRow.cap}` : ""),
                  `Tel: ${companyRow.telefono} - Email: ${companyRow.email}`,
                  `P.IVA: ${companyRow.piva} - C.F.: ${companyRow.cf}`,
                ].filter(Boolean);
                if (parts.length > 0) {
                  const footer = `
<hr />
<div style="text-align:center;font-size:12px;color:#888;">
${parts.join("<br />")}
</div>`;
                  bodyHtml += footer;
                }
              }

              // Tracking: UUID univoco + pixel invisibile in coda all'email
              const trackingId = randomUUID();
              bodyHtml += `<img src="${trackingPixelUrl(trackingId)}" alt="" width="1" height="1" style="display:none" />`;

              let rowStato: "sent" | "failed" = "sent";
              let errore: string | null = null;
              try {
                if (!client?.email) {
                  throw new Error("Cliente senza email");
                }
                await transporter.sendMail({
                  from: `"${senderName}" <${sender}>`,
                  to: client.email,
                  subject,
                  html: bodyHtml,
                });

                // Nota automatica al cliente dopo invio riuscito
                await db.insert(notes).values({
                  clientId: client.id,
                  content: `Inviata email da comunicazioni automatiche: ${template.name}`,
                  type: "promemoria",
                  author: "Sistema",
                  companyId: com.companyId,
                });
              } catch (err: any) {
                console.error(
                  "[SEND-COMMUNICATIONS] Errore invio a",
                  client?.email,
                  err
                );
                rowStato = "failed";
                errore = err?.message || "Errore invio";
              }

              const tentativi = (row.tentativi ?? 0) + 1;
              await db
                .update(comunicazioniBatch)
                .set({ stato: rowStato, tentativi, errore })
                .where(eq(comunicazioniBatch.id, row.id));

              await db.insert(emailLog).values({
                clientId: client?.id || row.clientId,
                subject,
                body: bodyHtml,
                sender,
                author: "Cron",
                status: rowStato,
                sentAt: new Date(),
                trackingId,
                companyId: com.companyId,
              });

              // Segna come consegnata se l'invio è riuscito
              if (rowStato === "sent") {
                await db
                  .update(emailLog)
                  .set({ deliveredAt: new Date() })
                  .where(eq(emailLog.trackingId, trackingId));
              }

              if (rowStato === "sent") sent++;
              else failed++;
            })
          );

          summary.lotti++;

          // Pausa tra un lotto e l'altro
          if (i + BATCH_SIZE < pending.length) {
            await sleep(PAUSE_MS);
          }
        }

        summary.inviate += sent;
        summary.fallite += failed;

        // ── Stato finale della comunicazione ──
        const finalStato =
          sent === 0 ? "fallita" : failed === 0 ? "inviata" : "inviata_parziale";
        await db
          .update(comunicazioni)
          .set({ stato: finalStato, lock: false })
          .where(eq(comunicazioni.id, com.id));
      } catch (error: any) {
        await fail(error?.message || "Errore durante l'invio");
      }
    }

    return NextResponse.json({ success: true, ...summary });
  } catch (error: any) {
    console.error("[SEND-COMMUNICATIONS] Errore:", error);
    return NextResponse.json(
      { success: false, error: "Errore nell'elaborazione delle comunicazioni" },
      { status: 500 }
    );
  }
}
