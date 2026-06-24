import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { imapSettings } from "@/lib/schema";
import { decrypt } from "@/lib/crypto";

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

    // Leggi API key dal database (decriptata)
    const rows = await db.select().from(imapSettings).limit(1);
    const apiKey = rows.length > 0 && rows[0].brevoApiKey ? decrypt(rows[0].brevoApiKey) : null;
    if (!apiKey) {
      return NextResponse.json(
        { error: "Chiave API Brevo non configurata. Vai su Admin > Configurazione IMAP per impostarla." },
        { status: 500 }
      );
    }

    const body = await request.json();
    const { sender, to, subject, htmlContent } = body;

    if (!sender || !to || !subject || !htmlContent) {
      return NextResponse.json(
        { error: "Campi obbligatori: sender, to, subject, htmlContent" },
        { status: 400 }
      );
    }

    const payload = {
      sender: { email: sender },
      to: [{ email: to }],
      subject,
      htmlContent,
    };

    const res = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "api-key": apiKey,
      },
      body: JSON.stringify(payload),
    });

    const data = await res.json();

    if (!res.ok) {
      console.error("[TEST-SEND] Brevo error:", data);
      return NextResponse.json(
        { error: data.message || "Errore nell'invio dell'email" },
        { status: res.status }
      );
    }

    return NextResponse.json({ success: true, messageId: data.messageId });
  } catch (error: any) {
    console.error("[TEST-SEND] Error:", error);
    return NextResponse.json(
      { error: error.message || "Errore interno" },
      { status: 500 }
    );
  }
}
