import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  comunicazioni,
  comunicazioniBatch,
  clients,
  emailLog,
} from "@/lib/schema";
import { eq, and, inArray, desc } from "drizzle-orm";
import { getAuthUser } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET: dettaglio invii di una comunicazione.
 *  Restituisce le righe di comunicazioni_batch con join su clients (nome, email)
 *  e i dati di tracking dal relativo record di email_log (consegnata/aperta).
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authUser = await getAuthUser();
    if (!authUser) {
      return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
    }

    // Verifica che la comunicazione appartenga alla company corrente
    const [com] = await db
      .select({ id: comunicazioni.id, titolo: comunicazioni.titolo })
      .from(comunicazioni)
      .where(
        and(
          eq(comunicazioni.id, params.id),
          eq(comunicazioni.companyId, authUser.companyId)
        )
      )
      .limit(1);
    if (!com) {
      return NextResponse.json({ error: "Comunicazione non trovata" }, { status: 404 });
    }

    // Riga batch + cliente
    const rows = await db
      .select({
        id: comunicazioniBatch.id,
        clientId: comunicazioniBatch.clientId,
        stato: comunicazioniBatch.stato,
        tentativi: comunicazioniBatch.tentativi,
        errore: comunicazioniBatch.errore,
        updatedAt: comunicazioniBatch.updatedAt,
        createdAt: comunicazioniBatch.createdAt,
        clienteNome: clients.name,
        clienteEmail: clients.email,
      })
      .from(comunicazioniBatch)
      .leftJoin(clients, eq(comunicazioniBatch.clientId, clients.id))
      .where(eq(comunicazioniBatch.comunicazioneId, params.id))
      .orderBy(desc(comunicazioniBatch.createdAt));

    const clientIds = rows.map((r) => r.clientId);

    // Tracking: ultimo email_log per cliente (match sul sentAt più vicino
    // all'aggiornamento della riga batch) → consegnata/aperta.
    const trackingByClient = new Map<
      string,
      { trackingId: string; openedAt: Date | null; deliveredAt: Date | null }
    >();
    if (clientIds.length > 0) {
      const logs = await db
        .select({
          clientId: emailLog.clientId,
          trackingId: emailLog.trackingId,
          openedAt: emailLog.openedAt,
          deliveredAt: emailLog.deliveredAt,
          sentAt: emailLog.sentAt,
        })
        .from(emailLog)
        .where(
          and(
            eq(emailLog.companyId, authUser.companyId),
            inArray(emailLog.clientId, clientIds)
          )
        )
        .orderBy(desc(emailLog.sentAt));

      // Per ogni cliente sceglie il log con sentAt più vicino alla data di invio del batch
      for (const r of rows) {
        const batchTime = r.updatedAt?.getTime() ?? 0;
        const candidates = logs.filter((l) => l.clientId === r.clientId);
        if (candidates.length === 0) continue;
        const best = candidates.reduce((a, b) => {
          const da = Math.abs((a.sentAt?.getTime() ?? 0) - batchTime);
          const db = Math.abs((b.sentAt?.getTime() ?? 0) - batchTime);
          return da <= db ? a : b;
        });
        trackingByClient.set(r.clientId, {
          trackingId: best.trackingId || "",
          openedAt: best.openedAt,
          deliveredAt: best.deliveredAt,
        });
      }
    }

    const result = rows.map((r) => {
      const tracking = trackingByClient.get(r.clientId);
      return {
        id: r.id,
        clientId: r.clientId,
        clienteNome: r.clienteNome,
        clienteEmail: r.clienteEmail,
        stato: r.stato,
        tentativi: r.tentativi,
        errore: r.errore,
        inviatoIl: r.updatedAt,
        createdAt: r.createdAt,
        trackingId: tracking?.trackingId ?? null,
        consegnata: tracking?.deliveredAt ?? null,
        aperta: tracking?.openedAt ?? null,
      };
    });

    return NextResponse.json({ comunicazione: com, invii: result });
  } catch (error: any) {
    console.error("[COMUNICAZIONI] GET invii errore:", error);
    return NextResponse.json(
      { error: "Errore nel caricamento degli invii" },
      { status: 500 }
    );
  }
}
