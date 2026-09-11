import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { comunicazioni } from "@/lib/schema";
import { eq, and } from "drizzle-orm";
import { getAuthUser } from "@/lib/auth";
import { resolveDataInvio, isDateOccupied } from "@/lib/comunicazioni";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** PATCH: aggiorna una comunicazione programmata (titolo, template, analisi, data)
 *  oppure la annulla (stato → "annullata"). Bloccata se è in elaborazione (lock). */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authUser = await getAuthUser();
    if (!authUser) {
      return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
    }

    const [row] = await db
      .select()
      .from(comunicazioni)
      .where(
        and(
          eq(comunicazioni.id, params.id),
          eq(comunicazioni.companyId, authUser.companyId)
        )
      )
      .limit(1);
    if (!row) {
      return NextResponse.json({ error: "Comunicazione non trovata" }, { status: 404 });
    }

    // Lock attivo (cron in corso) → non modificabile/annullabile
    if (row.lock) {
      return NextResponse.json(
        { error: "Comunicazione in elaborazione: non modificabile" },
        { status: 409 }
      );
    }

    // Solo le comunicazioni non ancora inviate sono modificabili
    if (row.stato === "inviata" || row.stato === "inviata_parziale") {
      return NextResponse.json(
        { error: "Comunicazione già inviata: non modificabile" },
        { status: 409 }
      );
    }

    const body = await request.json();
    const updates: Record<string, unknown> = {};

    // Annullamento
    if (body.stato === "annullata") {
      updates.stato = "annullata";
    }

    // Modifica dei campi (solo se non già inviata/annullata)
    if (row.stato !== "annullata") {
      if (body.titolo !== undefined) {
        if (typeof body.titolo !== "string" || !body.titolo.trim()) {
          return NextResponse.json(
            { error: "Il titolo è obbligatorio" },
            { status: 400 }
          );
        }
        updates.titolo = body.titolo.trim();
      }
      if (body.templateId !== undefined) updates.templateId = body.templateId || null;
      if (body.analisiId !== undefined) updates.analisiId = body.analisiId || null;
      if (body.dataInvio !== undefined) {
        if (typeof body.dataInvio !== "string") {
          return NextResponse.json(
            { error: "Data di invio non valida (formato YYYY-MM-DD)" },
            { status: 400 }
          );
        }
        const d = resolveDataInvio(body.dataInvio);
        if (!d) {
          return NextResponse.json(
            { error: "Data di invio non valida (formato YYYY-MM-DD)" },
            { status: 400 }
          );
        }
        // Una comunicazione attiva al giorno: esclude la comunicazione corrente
        const occupied = await isDateOccupied(
          authUser.companyId,
          body.dataInvio,
          params.id
        );
        if (occupied) {
          return NextResponse.json(
            { error: "Per questa data è già presente un'altra comunicazione" },
            { status: 400 }
          );
        }
        updates.dataInvio = d;
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "Nessun campo da aggiornare" }, { status: 400 });
    }

    const [updated] = await db
      .update(comunicazioni)
      .set(updates)
      .where(eq(comunicazioni.id, params.id))
      .returning();

    return NextResponse.json(updated);
  } catch (error: any) {
    console.error("[COMUNICAZIONI] PATCH errore:", error);
    return NextResponse.json(
      { error: "Errore nell'aggiornamento della comunicazione" },
      { status: 500 }
    );
  }
}

/** DELETE: elimina una comunicazione (e il suo batch, per cascade).
 *  Bloccata se in elaborazione (lock). */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authUser = await getAuthUser();
    if (!authUser) {
      return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
    }

    const [row] = await db
      .select()
      .from(comunicazioni)
      .where(
        and(
          eq(comunicazioni.id, params.id),
          eq(comunicazioni.companyId, authUser.companyId)
        )
      )
      .limit(1);
    if (!row) {
      return NextResponse.json({ error: "Comunicazione non trovata" }, { status: 404 });
    }
    if (row.lock) {
      return NextResponse.json(
        { error: "Comunicazione in elaborazione: non eliminabile" },
        { status: 409 }
      );
    }

    await db
      .delete(comunicazioni)
      .where(
        and(
          eq(comunicazioni.id, params.id),
          eq(comunicazioni.companyId, authUser.companyId)
        )
      );

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("[COMUNICAZIONI] DELETE errore:", error);
    return NextResponse.json(
      { error: "Errore nell'eliminazione della comunicazione" },
      { status: 500 }
    );
  }
}
