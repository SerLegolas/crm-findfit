import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { imapSettings } from "@/lib/schema";
import { eq } from "drizzle-orm";
import { getAuthUser } from "@/lib/auth";
import { decrypt } from "@/lib/crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET: indica al client se l'invio email è configurato per la company corrente,
 * SENZA esporre segreti (host/port/password). Accessibile a qualsiasi utente
 * autenticato (l'invio via POST /api/email/send è permesso a tutti i ruoli).
 *
 * "configurato" = esiste la riga imap_settings con imapHost/imapPort/user/password.
 * L'invio usa smtpHost/smtpPort se presenti, altrimenti ricade su imapHost/imapPort
 * (stessa logica di POST /api/email/send).
 */
export async function GET() {
  try {
    const authUser = await getAuthUser();
    if (!authUser) {
      return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
    }

    const rows = await db
      .select()
      .from(imapSettings)
      .where(eq(imapSettings.companyId, authUser.companyId))
      .limit(1);

    const row = rows[0];
    const configured = !!(
      row && row.imapHost && row.imapPort && row.user && row.password
    );

    // Mittente predefinito (l'account email, non un segreto). Se la decriptazione
    // fallisce (es. ENCRYPTION_KEY diversa), non blocchiamo il "configured".
    let sender: string | null = null;
    if (row?.user) {
      try {
        sender = decrypt(row.user);
      } catch {
        sender = null;
      }
    }

    return NextResponse.json({ configured, sender });
  } catch (error) {
    console.error("Errore lettura stato configurazione email:", error);
    // Non far fallire il client: rispondi "non configurato" e lascia che
    // l'invio (se tentato) mostri l'errore reale del server.
    return NextResponse.json({ configured: false, sender: null });
  }
}
