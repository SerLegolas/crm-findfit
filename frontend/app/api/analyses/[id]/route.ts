import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { savedAnalyses } from "@/lib/schema";
import { eq, and } from "drizzle-orm";
import { getAuthUser } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** DELETE: elimina un'analisi salvata (solo della propria company / propria se user) */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authUser = await getAuthUser();
    if (!authUser) {
      return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
    }

    const conditions: any[] = [
      eq(savedAnalyses.id, params.id),
      eq(savedAnalyses.companyId, authUser.companyId),
    ];
    if (authUser.role !== "admin") {
      conditions.push(eq(savedAnalyses.userId, authUser.id));
    }

    await db.delete(savedAnalyses).where(and(...conditions));

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("[ANALYSES] DELETE errore:", error);
    return NextResponse.json(
      { error: "Errore nell'eliminazione dell'analisi" },
      { status: 500 }
    );
  }
}
