import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  emailLog,
  imapSettings,
  clients,
  emailTemplates,
  companySettings,
} from "@/lib/schema";
import { eq, and, inArray, or, sql } from "drizzle-orm";
import { decrypt } from "@/lib/crypto";
import { randomUUID } from "crypto";
import { trackingPixelUrl } from "@/lib/tracking";
import { optOutBlock } from "@/lib/opt-out";
import nodemailer from "nodemailer";
import { getAuthUser } from "@/lib/auth";
import { checkFeatureEnabled, FeatureDisabledError } from "@/lib/company-rules";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BATCH_SIZE = 10;

/** POST: invio in batch di una email (template) a più clienti.
 *  Risponde in streaming NDJSON con il progresso dopo ogni batch.
 */
export async function POST(request: NextRequest) {
  try {
    const authUser = await getAuthUser();
    if (!authUser) {
      return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
    }

    // Solo gli admin possono inviare email in batch
    if (authUser.role !== "admin") {
      return NextResponse.json({ error: "Accesso negato" }, { status: 403 });
    }

    // Verifica feature abilitata
    try {
      await checkFeatureEnabled(authUser.companyId, "email");
    } catch (e) {
      if (e instanceof FeatureDisabledError) {
        return NextResponse.json({ error: e.message }, { status: 403 });
      }
      throw e;
    }

    const body = await request.json();
    const { clientIds, templateId } = body;

    if (!Array.isArray(clientIds) || clientIds.length === 0) {
      return NextResponse.json(
        { error: "clientIds è obbligatorio" },
        { status: 400 }
      );
    }
    if (!templateId) {
      return NextResponse.json(
        { error: "templateId è obbligatorio" },
        { status: 400 }
      );
    }

    // Template della company corrente
    const [template] = await db
      .select()
      .from(emailTemplates)
      .where(
        and(
          eq(emailTemplates.id, templateId),
          eq(emailTemplates.companyId, authUser.companyId)
        )
      )
      .limit(1);
    if (!template) {
      return NextResponse.json({ error: "Template non trovato" }, { status: 404 });
    }

    // Configurazione SMTP della company corrente
    const [imapRow] = await db
      .select()
      .from(imapSettings)
      .where(eq(imapSettings.companyId, authUser.companyId))
      .limit(1);

    if (!imapRow || !imapRow.imapHost || !imapRow.imapPort || !imapRow.user || !imapRow.password) {
      return NextResponse.json(
        { error: "Configurazione SMTP mancante. Configura un servizio email." },
        { status: 500 }
      );
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

    // Footer dati azienda
    const [companyRow] = await db
      .select()
      .from(companySettings)
      .where(eq(companySettings.companyId, authUser.companyId))
      .limit(1);

    // Clienti target: solo visibili alla company + (per user) propri/non assegnati
    const roleCond =
      authUser.role !== "admin"
        ? or(eq(clients.userId, authUser.id), sql`${clients.userId} IS NULL`)
        : undefined;

    const targetWhere = and(
      inArray(clients.id, clientIds),
      eq(clients.companyId, authUser.companyId),
      roleCond
    );

    const targetClients = await db.select().from(clients).where(targetWhere);

    const encoder = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        let sent = 0;
        let failed = 0;
        let skipped = 0;
        let processed = 0;
        const total = targetClients.length;

        try {
          for (let i = 0; i < targetClients.length; i += BATCH_SIZE) {
            const batch = targetClients.slice(i, i + BATCH_SIZE);

            await Promise.all(
              batch.map(async (client) => {
                // Opt-out: salta i clienti non consenzienti (nessun email_log)
                if (client.emailConsent === false) {
                  skipped++;
                  processed++;
                  return;
                }

                const today = new Date().toLocaleDateString("it-IT", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                });
                const replaceTags = (text: string) =>
                  text
                    .replace(/@name/g, client.name || "")
                    .replace(/@company/g, client.company || "")
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

                // Link opt-out (prima del footer azienda)
                bodyHtml += optOutBlock(client.id);

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

                let status: "sent" | "failed" = "sent";
                try {
                  if (!client.email) {
                    throw new Error("Cliente senza email");
                  }
                  await transporter.sendMail({
                    from: `"${authUser.name}" <${sender}>`,
                    to: client.email,
                    subject,
                    html: bodyHtml,
                  });
                } catch (err) {
                  console.error("[EMAIL-SEND-BULK] Errore invio a", client.email, err);
                  status = "failed";
                }

                await db.insert(emailLog).values({
                  clientId: client.id,
                  subject,
                  body: bodyHtml,
                  sender,
                  author: authUser.name,
                  status,
                  sentAt: new Date(),
                  trackingId,
                  companyId: authUser.companyId,
                });

                // Segna come consegnata se l'invio è riuscito
                if (status === "sent") {
                  await db
                    .update(emailLog)
                    .set({ deliveredAt: new Date() })
                    .where(eq(emailLog.trackingId, trackingId));
                }

                if (status === "sent") sent++;
                else failed++;
                processed++;
              })
            );

            controller.enqueue(
              encoder.encode(
                JSON.stringify({ type: "progress", processed, sent, failed, skipped, total }) + "\n"
              )
            );
          }

          controller.enqueue(
            encoder.encode(
              JSON.stringify({ type: "done", processed, sent, failed, skipped, total }) + "\n"
            )
          );
          controller.close();
        } catch (error: any) {
          console.error("[EMAIL-SEND-BULK] Errore:", error);
          controller.enqueue(
            encoder.encode(
              JSON.stringify({ type: "error", message: error?.message || "Errore durante l'invio" }) + "\n"
            )
          );
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "application/x-ndjson; charset=utf-8",
      },
    });
  } catch (error: any) {
    console.error("[EMAIL-SEND-BULK] Errore:", error);
    return NextResponse.json(
      { error: "Errore nell'invio delle email" },
      { status: 500 }
    );
  }
}
