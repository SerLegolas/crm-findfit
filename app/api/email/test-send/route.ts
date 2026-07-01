import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { imapSettings } from "@/lib/schema";
import { decrypt } from "@/lib/crypto";
import nodemailer from "nodemailer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const authUser = await getAuthUser();
    if (!authUser) {
      return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
    }
    if (authUser.role !== "admin") {
      return NextResponse.json({ error: "Accesso negato" }, { status: 403 });
    }

    // Leggi configurazione SMTP da imap_settings
    const rows = await db.select().from(imapSettings).limit(1);
    if (rows.length === 0) {
      return NextResponse.json(
        { error: "Configurazione SMTP mancante. Vai su Admin > Configurazione Email per impostarla." },
        { status: 500 }
      );
    }

    const row = rows[0];
    const smtpHost = row.smtpHost ? decrypt(row.smtpHost) : decrypt(row.imapHost);
    const smtpPortStr = row.smtpPort ? decrypt(row.smtpPort) : decrypt(row.imapPort);
    const smtpPort = parseInt(smtpPortStr, 10);
    const smtpSecure = row.smtpSecure ?? (smtpPort === 465);
    const smtpUser = decrypt(row.user);
    const smtpPass = decrypt(row.password);

    const body = await request.json();
    const { sender, to, subject, htmlContent } = body;

    if (!sender || !to || !subject || !htmlContent) {
      return NextResponse.json(
        { error: "Campi obbligatori: sender, to, subject, htmlContent" },
        { status: 400 }
      );
    }

    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpSecure,
      auth: {
        user: smtpUser,
        pass: smtpPass,
      },
    });

    const info = await transporter.sendMail({
      from: sender,
      to,
      subject,
      html: htmlContent,
    });

    console.log("[TEST-SEND] Email sent:", info.messageId);
    return NextResponse.json({ success: true, messageId: info.messageId });
  } catch (error: any) {
    console.error("[TEST-SEND] Error:", error);
    return NextResponse.json(
      { error: error.message || "Errore interno" },
      { status: 500 }
    );
  }
}
