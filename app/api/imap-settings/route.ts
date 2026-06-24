import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { imapSettings } from "@/lib/schema";
import { encrypt, decrypt } from "@/lib/crypto";
import { eq } from "drizzle-orm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET: recupera le impostazioni IMAP (decriptate) */
export async function GET() {
  try {
    const rows = await db.select().from(imapSettings).limit(1);
    if (rows.length === 0) {
      return NextResponse.json({ settings: null });
    }

    const row = rows[0];
    const settings = {
      id: row.id,
      host: decrypt(row.host),
      port: decrypt(row.port),
      user: decrypt(row.user),
      password: decrypt(row.password),
      filterFrom: decrypt(row.filterFrom),
      filterSubject: decrypt(row.filterSubject),
      brevoApiKey: row.brevoApiKey ? decrypt(row.brevoApiKey) : null,
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

/** PUT: salva (upsert) le impostazioni IMAP (criptate) */
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { host, port, user, password, filterFrom, filterSubject, brevoApiKey } = body;

    if (!host || !port || !user || !password) {
      return NextResponse.json(
        { error: "I campi host, port, user e password sono obbligatori" },
        { status: 400 }
      );
    }

    const encrypted = {
      host: encrypt(host),
      port: encrypt(port),
      user: encrypt(user),
      password: encrypt(password),
      filterFrom: encrypt(filterFrom || ""),
      filterSubject: encrypt(filterSubject || ""),
    };

    // Upsert: verifica se esiste già una riga
    const existing = await db.select().from(imapSettings).limit(1);

    if (existing.length > 0) {
      await db
        .update(imapSettings)
        .set({
          host: encrypted.host,
          port: encrypted.port,
          user: encrypted.user,
          password: encrypted.password,
          filterFrom: encrypted.filterFrom,
          filterSubject: encrypted.filterSubject,
          brevoApiKey: brevoApiKey ? encrypt(brevoApiKey) : null,
          updatedAt: new Date(),
        })
        .where(eq(imapSettings.id, existing[0].id));
    } else {
      await db.insert(imapSettings).values({
        host: encrypted.host,
        port: encrypted.port,
        user: encrypted.user,
        password: encrypted.password,
        filterFrom: encrypted.filterFrom,
        filterSubject: encrypted.filterSubject,
        brevoApiKey: brevoApiKey ? encrypt(brevoApiKey) : null,
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
