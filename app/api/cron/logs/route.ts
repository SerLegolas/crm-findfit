import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { cronLog, companies } from "@/lib/schema";
import { eq, desc } from "drizzle-orm";
import { requireSuperUser } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET: elenco delle esecuzioni del cron (solo superadmin) */
export async function GET() {
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
      .orderBy(desc(cronLog.createdAt))
      .limit(200);

    return NextResponse.json({ logs });
  } catch (error: any) {
    console.error("Errore lettura cron_log:", error);
    return NextResponse.json(
      { error: "Errore nel caricamento dei log cron" },
      { status: 500 }
    );
  }
}
