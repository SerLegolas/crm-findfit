import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { emailLog, imapSettings, clients } from "@/lib/schema";
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
        subject: parsed.subject,
        text: parsed.body,
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
        subject: parsed.subject,
        body: parsed.body,
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
