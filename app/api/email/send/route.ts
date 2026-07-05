import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { emailLog, imapSettings, clients, companySettings } from "@/lib/schema";
import { emailSchema } from "@/types";
import { eq, desc } from "drizzle-orm";
import { decrypt } from "@/lib/crypto";
import nodemailer from "nodemailer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET: recupera le email inviate per un client */
export async function GET(request: NextRequest) {
  try {
    const authUser = await getAuthUser();
    if (!authUser) {
      return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
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
      .where(eq(emailLog.clientId, clientId))
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
    const { clientId, subject, body: emailBody, sender } = body;

    if (!clientId) {
      return NextResponse.json(
        { error: "clientId è obbligatorio" },
        { status: 400 }
      );
    }

    const parsed = emailSchema.parse({ subject, body: emailBody, sender });

    // Ottieni email del cliente
    const [client] = await db
      .select()
      .from(clients)
      .where(eq(clients.id, clientId))
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

    // Footer dati azienda
    const [companyRow] = await db
      .select()
      .from(companySettings)
      .where(eq(companySettings.id, "default"))
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

    // Leggi configurazione SMTP da imap_settings
    const rows = await db.select().from(imapSettings).limit(1);

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
      })
      .returning();

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
