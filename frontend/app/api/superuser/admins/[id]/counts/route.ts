import { NextResponse } from "next/server";
import { requireSuperUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { users } from "@/lib/schema";
import { eq } from "drizzle-orm";
import { getCompanyCounts } from "@/lib/company-counts";

export const dynamic = "force-dynamic";

// GET /api/superuser/admins/:id/counts
// Conteggi dei dati collegati all'azienda dell'admin (per il modal di conferma)
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireSuperUser();

    const { id } = await params;

    const [admin] = await db
      .select({ companyId: users.companyId })
      .from(users)
      .where(eq(users.id, id))
      .limit(1);

    if (!admin) {
      return NextResponse.json({ error: "Admin non trovato" }, { status: 404 });
    }

    const counts = await getCompanyCounts(admin.companyId);

    return NextResponse.json({ companyId: admin.companyId, counts });
  } catch (error: any) {
    if (error.message === "Unauthorized") {
      return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
    }
    console.error("Error fetching company counts:", error);
    return NextResponse.json(
      { error: "Errore nel calcolo dei conteggi" },
      { status: 500 }
    );
  }
}
