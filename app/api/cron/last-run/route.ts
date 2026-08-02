import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { cronLog } from "@/lib/schema";
import { eq, desc } from "drizzle-orm";
import { getAuthUser } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET: ultimo record di cron_log per la company dell'utente corrente.
 * Usato dalla topbar per mostrare lo stato della sincronizzazione email.
 * Restituisce { run } oppure { run: null } se non ci sono esecuzioni.
 */
export async function GET() {
  try {
    const authUser = await getAuthUser();
    if (!authUser) {
      return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
    }

    const [run] = await db
      .select({
        id: cronLog.id,
        startedAt: cronLog.startedAt,
        completedAt: cronLog.completedAt,
        emailsFound: cronLog.emailsFound,
        clientsCreated: cronLog.clientsCreated,
        tasksCreated: cronLog.tasksCreated,
        error: cronLog.error,
      })
      .from(cronLog)
      .where(eq(cronLog.companyId, authUser.companyId))
      .orderBy(desc(cronLog.createdAt))
      .limit(1);

    return NextResponse.json({ run: run ?? null });
  } catch (error: any) {
    console.error("Errore lettura ultimo cron_log:", error);
    return NextResponse.json(
      { error: "Errore nel caricamento dell'ultima esecuzione" },
      { status: 500 }
    );
  }
}
