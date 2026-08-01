import { NextRequest, NextResponse } from "next/server";
import { getAuthUser, requireSuperUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { companyRules } from "@/lib/schema";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

// GET /api/company-rules — restituisce le regole per la company dell'utente autenticato
export async function GET() {
  try {
    const authUser = await getAuthUser();
    if (!authUser) {
      return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
    }

    const [rule] = await db
      .select()
      .from(companyRules)
      .where(eq(companyRules.companyId, authUser.companyId))
      .limit(1);

    // Se non esiste riga, restituisce default (tutti abilitati)
    if (!rule) {
      return NextResponse.json({
        id: null,
        companyId: authUser.companyId,
        maxUsers: 2,
        maxClients: 10,
        maxTasks: 10,
        features: {
          dashboard: true,
          clienti: true,
          kanban: true,
          task: true,
          note: true,
          email: true,
          impostazioni: true,
        },
        featuresAdmin: {
          gestione_utenti: true,
          configurazione_email: true,
          recupero_email: true,
          facebook_post: true,
        },
      });
    }

    return NextResponse.json(rule);
  } catch (error: any) {
    console.error("Error fetching company rules:", error);
    return NextResponse.json(
      { error: "Errore nel caricamento delle regole" },
      { status: 500 }
    );
  }
}

// PUT /api/company-rules — aggiorna le regole per una company (solo superuser)
export async function PUT(request: NextRequest) {
  try {
    await requireSuperUser();

    const body = await request.json();
    const { companyId, maxUsers, maxClients, maxTasks, features, featuresAdmin } = body;

    // Validazione
    if (!companyId) {
      return NextResponse.json(
        { error: "companyId è obbligatorio" },
        { status: 400 }
      );
    }

    if (
      (maxUsers !== undefined && (typeof maxUsers !== "number" || maxUsers < 0)) ||
      (maxClients !== undefined && (typeof maxClients !== "number" || maxClients < 0)) ||
      (maxTasks !== undefined && (typeof maxTasks !== "number" || maxTasks < 0))
    ) {
      return NextResponse.json(
        { error: "I valori devono essere numeri >= 0" },
        { status: 400 }
      );
    }

    if (features !== undefined && (typeof features !== "object" || Array.isArray(features))) {
      return NextResponse.json(
        { error: "features deve essere un oggetto" },
        { status: 400 }
      );
    }

    if (featuresAdmin !== undefined && (typeof featuresAdmin !== "object" || Array.isArray(featuresAdmin))) {
      return NextResponse.json(
        { error: "featuresAdmin deve essere un oggetto" },
        { status: 400 }
      );
    }

    // Upsert
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
          featuresAdmin: featuresAdmin ?? existing[0].featuresAdmin,
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
        featuresAdmin: featuresAdmin ?? {},
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
