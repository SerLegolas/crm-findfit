import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  comunicazioni,
  comunicazioniBatch,
  emailTemplates,
  savedAnalyses,
} from "@/lib/schema";
import { eq, and, desc, inArray, sql } from "drizzle-orm";
import { getAuthUser } from "@/lib/auth";
import { resolveDataInvio, isDateOccupied } from "@/lib/comunicazioni";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST: crea una comunicazione programmata per la company corrente.
 *  La generazione del batch e l'invio avvengono nel cron /api/cron/send-communications. */
export async function POST(request: NextRequest) {
  try {
    const authUser = await getAuthUser();
    if (!authUser) {
      return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
    }

    const body = await request.json();
    const { titolo, templateId, analisiId, dataInvio } = body;

    if (!titolo || typeof titolo !== "string" || !titolo.trim()) {
      return NextResponse.json(
        { error: "Il titolo è obbligatorio" },
        { status: 400 }
      );
    }
    if (!templateId) {
      return NextResponse.json(
        { error: "Seleziona un template email" },
        { status: 400 }
      );
    }
    if (!analisiId) {
      return NextResponse.json(
        { error: "Seleziona un'analisi" },
        { status: 400 }
      );
    }
    // dataInvio è una sola data (YYYY-MM-DD); l'ora viene decisa in base all'ambiente
    if (typeof dataInvio !== "string") {
      return NextResponse.json(
        { error: "Data di invio non valida (formato YYYY-MM-DD)" },
        { status: 400 }
      );
    }
    const dataInvioDate = resolveDataInvio(dataInvio);
    if (!dataInvioDate) {
      return NextResponse.json(
        { error: "Data di invio non valida (formato YYYY-MM-DD)" },
        { status: 400 }
      );
    }

    // Una comunicazione attiva al giorno: la data non deve essere già occupata
    const occupied = await isDateOccupied(authUser.companyId, dataInvio);
    if (occupied) {
      return NextResponse.json(
        { error: "Per questa data è già presente una comunicazione" },
        { status: 400 }
      );
    }

    // Verifica che template e analisi appartengano alla company corrente
    const [template] = await db
      .select({ id: emailTemplates.id })
      .from(emailTemplates)
      .where(
        and(
          eq(emailTemplates.id, templateId),
          eq(emailTemplates.companyId, authUser.companyId)
        )
      )
      .limit(1);
    if (!template) {
      return NextResponse.json({ error: "Template non trovato" }, { status: 404 });
    }

    const [analisi] = await db
      .select({ id: savedAnalyses.id })
      .from(savedAnalyses)
      .where(
        and(
          eq(savedAnalyses.id, analisiId),
          eq(savedAnalyses.companyId, authUser.companyId)
        )
      )
      .limit(1);
    if (!analisi) {
      return NextResponse.json({ error: "Analisi non trovata" }, { status: 404 });
    }

    const [row] = await db
      .insert(comunicazioni)
      .values({
        titolo: titolo.trim(),
        templateId,
        analisiId,
        dataInvio: dataInvioDate,
        stato: "programmata",
        lock: false,
        companyId: authUser.companyId,
      })
      .returning();

    return NextResponse.json({ ...row, batchStats: null }, { status: 201 });
  } catch (error: any) {
    console.error("[COMUNICAZIONI] POST errore:", error);
    return NextResponse.json(
      { error: "Errore nella creazione della comunicazione" },
      { status: 500 }
    );
  }
}

/** GET: elenco comunicazioni della company con nome template/analisi e statistiche batch */
export async function GET() {
  try {
    const authUser = await getAuthUser();
    if (!authUser) {
      return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
    }

    const rows = await db
      .select({
        id: comunicazioni.id,
        titolo: comunicazioni.titolo,
        templateId: comunicazioni.templateId,
        analisiId: comunicazioni.analisiId,
        dataInvio: comunicazioni.dataInvio,
        stato: comunicazioni.stato,
        lock: comunicazioni.lock,
        companyId: comunicazioni.companyId,
        createdAt: comunicazioni.createdAt,
        updatedAt: comunicazioni.updatedAt,
        templateName: emailTemplates.name,
        analisiName: savedAnalyses.name,
      })
      .from(comunicazioni)
      .leftJoin(
        emailTemplates,
        eq(comunicazioni.templateId, emailTemplates.id)
      )
      .leftJoin(savedAnalyses, eq(comunicazioni.analisiId, savedAnalyses.id))
      .where(eq(comunicazioni.companyId, authUser.companyId))
      .orderBy(desc(comunicazioni.dataInvio));

    const ids = rows.map((r) => r.id);

    // Statistiche batch aggregate (una riga per comunicazione)
    const stats: Record<
      string,
      { total: number; sent: number; failed: number; pending: number }
    > = {};
    if (ids.length > 0) {
      const agg = await db
        .select({
          comunicazioneId: comunicazioniBatch.comunicazioneId,
          stato: comunicazioniBatch.stato,
          count: sql<number>`count(*)`,
        })
        .from(comunicazioniBatch)
        .where(inArray(comunicazioniBatch.comunicazioneId, ids))
        .groupBy(
          comunicazioniBatch.comunicazioneId,
          comunicazioniBatch.stato
        );

      for (const row of agg) {
        const s = stats[row.comunicazioneId] || {
          total: 0,
          sent: 0,
          failed: 0,
          pending: 0,
        };
        const n = Number(row.count ?? 0);
        s.total += n;
        if (row.stato === "sent") s.sent += n;
        else if (row.stato === "failed") s.failed += n;
        else s.pending += n;
        stats[row.comunicazioneId] = s;
      }
    }

    const result = rows.map((r) => {
      const { templateName, analisiName, ...rest } = r;
      return {
        ...rest,
        templateName,
        analisiName,
        batchStats: stats[r.id] || { total: 0, sent: 0, failed: 0, pending: 0 },
      };
    });

    return NextResponse.json(result);
  } catch (error: any) {
    console.error("[COMUNICAZIONI] GET errore:", error);
    return NextResponse.json(
      { error: "Errore nel caricamento delle comunicazioni" },
      { status: 500 }
    );
  }
}
