import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { clients } from "@/lib/schema";
import { eq, and, sql } from "drizzle-orm";
import { getAuthUser } from "@/lib/auth";
import { checkFeatureEnabled, FeatureDisabledError } from "@/lib/company-rules";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET: elenco delle categorie univoche del campo `categoria` dei clienti
 * della company corrente (esclusi NULL e stringhe vuote).
 * Restituisce { categories: string[] } ordinato alfabeticamente.
 */
export async function GET(_request: NextRequest) {
  try {
    const authUser = await getAuthUser();
    if (!authUser) {
      return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
    }

    // Verifica feature abilitata (coerente con /api/clients)
    try {
      await checkFeatureEnabled(authUser.companyId, "clienti");
    } catch (e) {
      if (e instanceof FeatureDisabledError) {
        return NextResponse.json({ error: e.message }, { status: 403 });
      }
      throw e;
    }

    const rows = await db
      .selectDistinct({ categoria: clients.categoria })
      .from(clients)
      .where(
        and(
          eq(clients.companyId, authUser.companyId),
          sql`${clients.categoria} IS NOT NULL AND ${clients.categoria} != ''`
        )
      )
      .orderBy(clients.categoria);

    const categories = rows
      .map((r) => r.categoria)
      .filter((c): c is string => Boolean(c));

    return NextResponse.json({ categories });
  } catch (error: any) {
    console.error("[CLIENTS-CATEGORIES] Errore:", error);
    return NextResponse.json(
      { error: "Errore nel caricamento delle categorie" },
      { status: 500 }
    );
  }
}
