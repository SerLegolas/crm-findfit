import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { cronLog, companies } from "@/lib/schema";
import { eq, desc, gte, and, type SQL } from "drizzle-orm";
import { requireSuperUser } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET: elenco delle esecuzioni del cron (solo superadmin) con filtri.
 * - days (1|3|5, default 1): ultimi N giorni includendo oggi.
 * - companyId (opzionale): filtra per azienda.
 * Restituisce { logs, companies } dove companies è la lista DISTINCT
 * delle aziende presenti in cron_log (per il dropdown).
 */
export async function GET(request: NextRequest) {
  try {
    await requireSuperUser();
  } catch (e: any) {
    if (e.message === "Unauthorized") {
      return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
    }
    if (e.message === "Forbidden") {
      return NextResponse.json({ error: "Accesso negato" }, { status: 403 });
    }
    return NextResponse.json({ error: e.message || "Errore" }, { status: 500 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const rawDays = parseInt(searchParams.get("days") || "1", 10);
    const days = [1, 3, 5].includes(rawDays) ? rawDays : 1;
    const companyId = searchParams.get("companyId") || "";

    // Ultimi N giorni includendo oggi: da mezzanotte di oggi indietro di (days-1) giorni
    const now = new Date();
    const startOfToday = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
    );
    const threshold = new Date(
      startOfToday.getTime() - (days - 1) * 24 * 60 * 60 * 1000
    );

    const conditions: (SQL | undefined)[] = [gte(cronLog.createdAt, threshold)];
    if (companyId) conditions.push(eq(cronLog.companyId, companyId));

    const logs = await db
      .select({
        id: cronLog.id,
        companyId: cronLog.companyId,
        companyName: companies.name,
        startedAt: cronLog.startedAt,
        completedAt: cronLog.completedAt,
        emailsFound: cronLog.emailsFound,
        clientsCreated: cronLog.clientsCreated,
        tasksCreated: cronLog.tasksCreated,
        error: cronLog.error,
        createdAt: cronLog.createdAt,
      })
      .from(cronLog)
      .leftJoin(companies, eq(cronLog.companyId, companies.id))
      .where(and(...conditions))
      .orderBy(desc(cronLog.createdAt))
      .limit(200);

    // Dropdown aziende: SELECT DISTINCT company_id FROM cron_log JOIN companies
    const companiesList = await db
      .selectDistinct({
        id: cronLog.companyId,
        name: companies.name,
      })
      .from(cronLog)
      .innerJoin(companies, eq(cronLog.companyId, companies.id))
      .orderBy(companies.name);

    return NextResponse.json({ logs, companies: companiesList });
  } catch (error: any) {
    console.error("Errore lettura cron_log:", error);
    return NextResponse.json(
      { error: "Errore nel caricamento dei log cron" },
      { status: 500 }
    );
  }
}
