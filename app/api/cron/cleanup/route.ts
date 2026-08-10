import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { cronLog } from "@/lib/schema";
import { lt } from "drizzle-orm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET: pulizia dei log cron più vecchi di 5 giorni (createdAt < NOW() - INTERVAL 5 DAY).
 * Protetto da CRON_SECRET_TOKEN, viene chiamato dopo ogni esecuzione del cron
 * di sincronizzazione email.
 */
export async function GET(request: NextRequest) {
  const secret = request.headers.get("x-cron-secret");

  if (!process.env.CRON_SECRET_TOKEN || secret !== process.env.CRON_SECRET_TOKEN) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const cutoff = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000);
    const result = await db.delete(cronLog).where(lt(cronLog.createdAt, cutoff));

    return NextResponse.json({
      success: true,
      deleted: result.rowsAffected ?? 0,
    });
  } catch (error: any) {
    console.error("Errore cleanup cron_log:", error);
    return NextResponse.json(
      { success: false, error: error?.message || "Errore sconosciuto" },
      { status: 500 }
    );
  }
}
