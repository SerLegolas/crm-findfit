import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { users } from "@/lib/schema";
import { requireAuth } from "@/lib/auth";
import { eq } from "drizzle-orm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET: elenco utenti (id + nome) della company corrente.
 * Accessibile a QUALSIASI utente autenticato (anche ruolo "user"),
 * senza il controllo admin `gestione_utenti`: serve a mostrare i nomi
 * nei filtri "Assegnato a" e nelle colonne utente.
 */
export async function GET() {
  try {
    const authUser = await requireAuth();

    const data = await db
      .select({ id: users.id, name: users.name })
      .from(users)
      .where(eq(users.companyId, authUser.companyId))
      .orderBy(users.name);

    return NextResponse.json({ data });
  } catch (error: any) {
    if (error.message === "Unauthorized" || error.message === "Forbidden") {
      return NextResponse.json({ error: "Non autorizzato" }, { status: 403 });
    }
    console.error("Error fetching user names:", error);
    return NextResponse.json(
      { error: "Errore nel caricamento degli utenti" },
      { status: 500 }
    );
  }
}
