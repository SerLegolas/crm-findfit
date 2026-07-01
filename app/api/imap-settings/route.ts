import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { imapSettings } from "@/lib/schema";
import { encrypt, decrypt } from "@/lib/crypto";
import { eq } from "drizzle-orm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET: recupera le impostazioni IMAP/SMTP (decriptate) */
export async function GET() {
  try {
    const rows = await db.select().from(imapSettings).limit(1);
    if (rows.length === 0) {
      return NextResponse.json({ settings: null });
    }

    const row = rows[0];
    const settings = {
      id: row.id,
      imapHost: decrypt(row.imapHost),
      imapPort: decrypt(row.imapPort),
      user: decrypt(row.user),
      password: decrypt(row.password),
      filterFrom: decrypt(row.filterFrom),
      filterSubject: decrypt(row.filterSubject),
      smtpHost: row.smtpHost ? decrypt(row.smtpHost) : null,
      smtpPort: row.smtpPort ? decrypt(row.smtpPort) : null,
      smtpSecure: row.smtpSecure ?? false,
    };

    return NextResponse.json({ settings });
  } catch (error: any) {
    console.error("Errore lettura impostazioni IMAP:", error);
    return NextResponse.json(
      { error: `Errore: ${error.message || "Errore sconosciuto"}` },
      { status: 500 }
    );
  }
}

/** PUT: salva (upsert) le impostazioni IMAP/SMTP (criptate) */
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { imapHost, imapPort, user, password, filterFrom, filterSubject, smtpHost, smtpPort, smtpSecure } = body;

    if (!imapHost || !imapPort || !user || !password) {
      return NextResponse.json(
        { error: "I campi imapHost, imapPort, user e password sono obbligatori" },
        { status: 400 }
      );
    }

    const encrypted = {
      imapHost: encrypt(imapHost),
      imapPort: encrypt(imapPort),
      user: encrypt(user),
      password: encrypt(password),
      filterFrom: encrypt(filterFrom || ""),
      filterSubject: encrypt(filterSubject || ""),
      smtpHost: smtpHost ? encrypt(smtpHost) : null,
      smtpPort: smtpPort ? encrypt(smtpPort) : null,
      smtpSecure: smtpSecure ?? false,
    };

    // Upsert: verifica se esiste già una riga
    const existing = await db.select().from(imapSettings).limit(1);

    if (existing.length > 0) {
      await db
        .update(imapSettings)
        .set({ ...encrypted, updatedAt: new Date() })
        .where(eq(imapSettings.id, existing[0].id));
    } else {
      await db.insert(imapSettings).values({
        ...encrypted,
        id: "default",
      });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Errore salvataggio impostazioni IMAP:", error);
    return NextResponse.json(
      { error: `Errore: ${error.message || "Errore sconosciuto"}` },
      { status: 500 }
    );
  }
}
