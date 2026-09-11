import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  emailLog,
  imapSettings,
  clients,
  companySettings,
  emailTemplates,
} from "@/lib/schema";
import { emailSchema } from "@/types";
import { eq, and, desc } from "drizzle-orm";
import { randomUUID } from "crypto";
import { trackingPixelUrl } from "@/lib/tracking";
import { optOutBlock } from "@/lib/opt-out";
import { decrypt } from "@/lib/crypto";
import nodemailer from "nodemailer";
import { checkFeatureEnabled, FeatureDisabledError } from "@/lib/company-rules";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET: recupera le email inviate per un client */
export async function GET(request: NextRequest) {
  try {
    const authUser = await getAuthUser();
    if (!authUser) {
      return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
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

    const { searchParams } = new URL(request.url);
    const clientId = searchParams.get("clientId");

    if (!clientId) {
      return NextResponse.json(
        { error: "clientId è obbligatorio" },
        { status: 400 }
      );
    }

    const emails = await db
      .select()
      .from(emailLog)
      .where(
        and(
          eq(emailLog.clientId, clientId),
          eq(emailLog.companyId, authUser.companyId)
        )
      )
      .orderBy(desc(emailLog.sentAt));

    return NextResponse.json(emails);
  } catch (error) {
    console.error("Error fetching email logs:", error);
    return NextResponse.json(
      { error: "Errore nel caricamento delle email" },
      { status: 500 }
    );
  }
}

/** POST: invia un'email via SMTP Aruba e salva nel log */
export async function POST(request: NextRequest) {
  try {
    const authUser = await getAuthUser();
    if (!authUser) {
      return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
    }

    const body = await request.json();
    const { clientId, subject, body: emailBody, sender, templateId } = body;

    if (!clientId) {
      return NextResponse.json(
        { error: "clientId è obbligatorio" },
        { status: 400 }
      );
    }

    const parsed = emailSchema.parse({ subject, body: emailBody, sender });

    // Ottieni email del cliente (scoped per company)
    const [client] = await db
      .select()
      .from(clients)
      .where(
        and(
          eq(clients.id, clientId),
          eq(clients.companyId, authUser.companyId)
        )
      )
      .limit(1);

    if (!client) {
      return NextResponse.json(
        { error: "Cliente non trovato" },
        { status: 404 }
      );
    }

    if (!client.email) {
      return NextResponse.json(
        { error: "Il cliente non ha un indirizzo email" },
        { status: 400 }
      );
    }

    // Controllo consenso email (opt-out)
    if (client.emailConsent === false) {
      return NextResponse.json(
        { error: "Cliente non consenziente" },
        { status: 400 }
      );
    }

    // Sostituisci placeholder (@name, @company, @oggetto, @data)
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

    const resolvedSubject = replaceTags(parsed.subject);
    let resolvedBody = replaceTags(parsed.body);

    // Recupera il template (se indicato) per l'immagine footer
    let templateFooterImageUrl: string | null = null;
    if (templateId) {
      const [tmpl] = await db
        .select()
        .from(emailTemplates)
        .where(
          and(
            eq(emailTemplates.id, templateId),
            eq(emailTemplates.companyId, authUser.companyId)
          )
        )
        .limit(1);
      if (tmpl) templateFooterImageUrl = tmpl.footerImageUrl ?? null;
    }

    // Immagine footer del template (se configurata) — prima del footer azienda
    if (templateFooterImageUrl) {
      resolvedBody += `
<div style="margin-top:32px;text-align:center">
  <img src="${templateFooterImageUrl}" alt="" style="max-width:100%;height:auto" />
</div>`;
    }

    // Link opt-out (prima del footer azienda)
    resolvedBody += optOutBlock(client.id);

    // Footer dati azienda
    const [companyRow] = await db
      .select()
      .from(companySettings)
      .where(eq(companySettings.companyId, authUser.companyId))
      .limit(1);

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
        resolvedBody += footer;
      }
    }

    // Tracking: UUID univoco + pixel invisibile in coda all'email
    const trackingId = randomUUID();
    resolvedBody += `<img src="${trackingPixelUrl(trackingId)}" alt="" width="1" height="1" style="display:none" />`;

    // Leggi configurazione SMTP da imap_settings (della company corrente)
    const rows = await db
      .select()
      .from(imapSettings)
      .where(eq(imapSettings.companyId, authUser.companyId))
      .limit(1);

    if (rows.length === 0 || !rows[0].imapHost || !rows[0].imapPort || !rows[0].user || !rows[0].password) {
      return NextResponse.json(
        { error: "Configurazione SMTP mancante. Vai su Impostazioni per configurarla." },
        { status: 500 }
      );
    }

    const row = rows[0];
    const smtpHost = row.smtpHost ? decrypt(row.smtpHost) : decrypt(row.imapHost);
    const smtpPortStr = row.smtpPort ? decrypt(row.smtpPort) : decrypt(row.imapPort);
    const smtpPort = parseInt(smtpPortStr, 10);
    const smtpSecure = row.smtpSecure ?? (smtpPort === 465);

    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpSecure,
      auth: {
        user: decrypt(row.user),
        pass: decrypt(row.password),
      },
    });

    let status: "sent" | "pending" | "failed" = "sent";
    let sentAt = new Date();

    try {
      await transporter.sendMail({
        from: `"${authUser.name}" <${parsed.sender}>`,
        to: client.email,
        subject: resolvedSubject,
        html: resolvedBody,
      });
    } catch (sendErr) {
      console.error("[EMAIL-SEND] SMTP error:", sendErr);
      status = "failed";
    }

    // Salva nel log
    const [saved] = await db
      .insert(emailLog)
      .values({
        clientId,
        subject: resolvedSubject,
        body: resolvedBody,
        sender: parsed.sender,
        author: authUser.name,
        status,
        sentAt,
        trackingId,
        companyId: authUser.companyId,
      })
      .returning();

    // Segna come consegnata se l'invio è riuscito
    if (status === "sent" && saved) {
      await db
        .update(emailLog)
        .set({ deliveredAt: new Date() })
        .where(eq(emailLog.id, saved.id));
    }

    return NextResponse.json(saved, { status: 201 });
  } catch (error: any) {
    if (error?.issues) {
      return NextResponse.json(
        { error: "Dati non validi", details: error.issues },
        { status: 400 }
      );
    }
    console.error("Error sending email:", error);
    return NextResponse.json(
      { error: "Errore nell'invio dell'email" },
      { status: 500 }
    );
  }
}
