import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { isDateOccupied } from "@/lib/comunicazioni";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/comunicazioni/check-date?date=YYYY-MM-DD&excludeId=...
 *  Verifica se esiste già una comunicazione attiva (stato diverso da
 *  "inviata"/"annullata") per la data indicata.
 *  - excludeId (opzionale): esclude la comunicazione in modifica dal controllo.
 */
export async function GET(request: NextRequest) {
  try {
    const authUser = await getAuthUser();
    if (!authUser) {
      return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const date = searchParams.get("date") || "";
    const excludeId = searchParams.get("excludeId") || "";

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json(
        { error: "Data non valida (formato YYYY-MM-DD)" },
        { status: 400 }
      );
    }

    const occupied = await isDateOccupied(
      authUser.companyId,
      date,
      excludeId || undefined
    );

    return NextResponse.json({ date, occupied });
  } catch (error: any) {
    console.error("[COMUNICAZIONI] check-date errore:", error);
    return NextResponse.json(
      { error: "Errore nel controllo della data" },
      { status: 500 }
    );
  }
}
