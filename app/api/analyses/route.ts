import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { savedAnalyses, clients } from "@/lib/schema";
import { eq, or, desc, and, sql, type SQL } from "drizzle-orm";
import { getAuthUser } from "@/lib/auth";
import { buildClientWhere } from "@/lib/client-filters";
import { checkFeatureEnabled, FeatureDisabledError } from "@/lib/company-rules";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST: salva un'analisi (nome + filtri + lista clienti) per la company corrente */
export async function POST(request: NextRequest) {
  try {
    const authUser = await getAuthUser();
    if (!authUser) {
      return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
    }

    // Verifica feature abilitata
    try {
      await checkFeatureEnabled(authUser.companyId, "clienti");
    } catch (e) {
      if (e instanceof FeatureDisabledError) {
        return NextResponse.json({ error: e.message }, { status: 403 });
      }
      throw e;
    }

    const body = await request.json();
    const { name, filters, clientIds } = body;

    if (!name || typeof name !== "string" || !name.trim()) {
      return NextResponse.json(
        { error: "Il nome dell'analisi è obbligatorio" },
        { status: 400 }
      );
    }
    if (typeof filters !== "object" || filters === null || Array.isArray(filters)) {
      return NextResponse.json(
        { error: "Filtri non validi" },
        { status: 400 }
      );
    }
    if (!Array.isArray(clientIds)) {
      return NextResponse.json(
        { error: "clientIds deve essere un array" },
        { status: 400 }
      );
    }
    // Analisi dinamica se non ci sono clienti fissi: i filtri salvati
    // verranno ri-eseguiti al caricamento (isDynamic derivato da clientIds vuoto).
    const isDynamic = clientIds.length === 0;

    const [saved] = await db
      .insert(savedAnalyses)
      .values({
        name: name.trim(),
        companyId: authUser.companyId,
        userId: authUser.id,
        filters,
        clientIds,
      })
      .returning();

    return NextResponse.json({ ...saved, isDynamic }, { status: 201 });
  } catch (error: any) {
    console.error("[ANALYSES] POST errore:", error);
    return NextResponse.json(
      { error: "Errore nel salvataggio dell'analisi" },
      { status: 500 }
    );
  }
}

/** GET: elenco delle analisi salvate della company.
 *  Admin: tutte della company. Utente "user": solo le proprie. */
export async function GET() {
  try {
    const authUser = await getAuthUser();
    if (!authUser) {
      return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
    }

    // Verifica feature abilitata
    try {
      await checkFeatureEnabled(authUser.companyId, "clienti");
    } catch (e) {
      if (e instanceof FeatureDisabledError) {
        return NextResponse.json({ error: e.message }, { status: 403 });
      }
      throw e;
    }

    const conditions: (SQL | undefined)[] = [
      eq(savedAnalyses.companyId, authUser.companyId),
    ];
    if (authUser.role !== "admin") {
      conditions.push(
        or(
          eq(savedAnalyses.userId, authUser.id),
          sql`${savedAnalyses.userId} IS NULL`
        )
      );
    }

    const rows = await db
      .select()
      .from(savedAnalyses)
      .where(and(...conditions))
      .orderBy(desc(savedAnalyses.createdAt));

    // Converte i filtri salvati (oggetto) in URLSearchParams per buildClientWhere
    const filtersToParams = (filters: any): URLSearchParams => {
      const params = new URLSearchParams();
      const f = filters || {};
      if (f.search) params.set("search", String(f.search));
      if (f.status && f.status !== "all") params.set("status", String(f.status));
      const cat = Array.isArray(f.categoria) ? f.categoria : f.categoria ? [f.categoria] : [];
      for (const c of cat) params.append("categoria", c);
      const uids = Array.isArray(f.userId) ? f.userId : f.userId ? [f.userId] : [];
      for (const u of uids) params.append("userId", u);
      return params;
    };

    // Calcola conteggio clienti: statico (clientIds) o dinamico (query con filtri salvati).
    // Un'analisi è dinamica SOLO se non ha una lista fissa (clientIds vuoto).
    const result = await Promise.all(
      rows.map(async (row) => {
        const ids = Array.isArray(row.clientIds) ? row.clientIds : [];
        const isDynamic = ids.length === 0;
        let clientCount = ids.length;
        if (isDynamic) {
          const where = buildClientWhere(authUser, filtersToParams(row.filters));
          const [countRes] = await db
            .select({ count: sql<number>`count(*)` })
            .from(clients)
            .where(where);
          clientCount = Number(countRes?.count ?? 0);
        }
        return { ...row, isDynamic, clientCount };
      })
    );

    return NextResponse.json(result);
  } catch (error: any) {
    console.error("[ANALYSES] GET errore:", error);
    return NextResponse.json(
      { error: "Errore nel caricamento delle analisi salvate" },
      { status: 500 }
    );
  }
}
