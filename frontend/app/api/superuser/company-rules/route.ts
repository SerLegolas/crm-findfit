import { NextRequest, NextResponse } from "next/server";
import { requireSuperUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { companyRules } from "@/lib/schema";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

// GET /api/superuser/company-rules?companyId=xxx
export async function GET(request: NextRequest) {
  try {
    await requireSuperUser();

    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get("companyId");

    if (companyId) {
      const [rule] = await db
        .select()
        .from(companyRules)
        .where(eq(companyRules.companyId, companyId))
        .limit(1);

      return NextResponse.json(rule || null);
    }

    const allRules = await db.select().from(companyRules);
    return NextResponse.json(allRules);
  } catch (error: any) {
    if (error.message === "Unauthorized") {
      return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
    }
    console.error("Error fetching company rules:", error);
    return NextResponse.json(
      { error: "Errore nel caricamento delle regole" },
      { status: 500 }
    );
  }
}

// POST /api/superuser/company-rules
export async function POST(request: NextRequest) {
  try {
    await requireSuperUser();

    const body = await request.json();
    const { companyId, maxUsers, maxClients, maxTasks, features } = body;

    if (!companyId) {
      return NextResponse.json(
        { error: "companyId è obbligatorio" },
        { status: 400 }
      );
    }

    // Upsert: se esiste già una regola per questa company, aggiornala
    const existing = await db
      .select()
      .from(companyRules)
      .where(eq(companyRules.companyId, companyId))
      .limit(1);

    if (existing.length > 0) {
      const [updated] = await db
        .update(companyRules)
        .set({
          maxUsers: maxUsers ?? existing[0].maxUsers,
          maxClients: maxClients ?? existing[0].maxClients,
          maxTasks: maxTasks ?? existing[0].maxTasks,
          features: features ?? existing[0].features,
          updatedAt: new Date(),
        })
        .where(eq(companyRules.id, existing[0].id))
        .returning();

      return NextResponse.json(updated);
    }

    const [rule] = await db
      .insert(companyRules)
      .values({
        companyId,
        maxUsers: maxUsers ?? 0,
        maxClients: maxClients ?? 0,
        maxTasks: maxTasks ?? 0,
        features: features ?? {},
      })
      .returning();

    return NextResponse.json(rule, { status: 201 });
  } catch (error: any) {
    if (error.message === "Unauthorized") {
      return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
    }
    console.error("Error saving company rules:", error);
    return NextResponse.json(
      { error: "Errore nel salvataggio delle regole" },
      { status: 500 }
    );
  }
}
