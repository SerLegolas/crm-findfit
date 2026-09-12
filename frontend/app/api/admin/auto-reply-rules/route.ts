import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { autoReplyRules, emailTemplates } from "@/lib/schema";
import { autoReplyRuleSchema } from "@/types";
import { and, asc, eq } from "drizzle-orm";
import { requireAdmin } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Traduce gli errori di autenticazione/autorizzazione in risposte HTTP. */
function authError(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  if (message === "Unauthorized") {
    return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
  }
  if (message === "Forbidden") {
    return NextResponse.json(
      { error: "Solo gli amministratori possono gestire le regole di risposta automatica" },
      { status: 403 }
    );
  }
  return null;
}

/** GET: elenco delle regole della company (con nome del template) */
export async function GET() {
  try {
    const authUser = await requireAdmin();

    const rules = await db
      .select({
        id: autoReplyRules.id,
        companyId: autoReplyRules.companyId,
        categoria: autoReplyRules.categoria,
        templateId: autoReplyRules.templateId,
        templateName: emailTemplates.name,
        followUpDays: autoReplyRules.followUpDays,
        followUpTaskTitle: autoReplyRules.followUpTaskTitle,
        enabled: autoReplyRules.enabled,
        createdAt: autoReplyRules.createdAt,
        updatedAt: autoReplyRules.updatedAt,
      })
      .from(autoReplyRules)
      .leftJoin(
        emailTemplates,
        and(
          eq(emailTemplates.id, autoReplyRules.templateId),
          eq(emailTemplates.companyId, authUser.companyId)
        )
      )
      .where(eq(autoReplyRules.companyId, authUser.companyId))
      .orderBy(asc(autoReplyRules.categoria));

    return NextResponse.json(rules);
  } catch (error) {
    const response = authError(error);
    if (response) return response;
    console.error("[auto-reply-rules] GET error:", error);
    return NextResponse.json(
      { error: "Errore nel caricamento delle regole" },
      { status: 500 }
    );
  }
}

/** POST: crea una nuova regola di risposta automatica */
export async function POST(request: NextRequest) {
  try {
    const authUser = await requireAdmin();
    const companyId = authUser.companyId;

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Il corpo della richiesta non è un JSON valido" },
        { status: 400 }
      );
    }

    const parsed = autoReplyRuleSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Dati non validi", dettagli: parsed.error.issues },
        { status: 400 }
      );
    }

    const { categoria, templateId, followUpDays, followUpTaskTitle, enabled } =
      parsed.data;

    // Il template deve appartenere alla stessa company
    const [template] = await db
      .select({ id: emailTemplates.id })
      .from(emailTemplates)
      .where(
        and(
          eq(emailTemplates.id, templateId),
          eq(emailTemplates.companyId, companyId)
        )
      )
      .limit(1);

    if (!template) {
      return NextResponse.json(
        { error: "Template non trovato" },
        { status: 400 }
      );
    }

    // Una sola regola per (companyId, categoria)
    const [duplicate] = await db
      .select({ id: autoReplyRules.id })
      .from(autoReplyRules)
      .where(
        and(
          eq(autoReplyRules.companyId, companyId),
          eq(autoReplyRules.categoria, categoria)
        )
      )
      .limit(1);

    if (duplicate) {
      return NextResponse.json(
        { error: "Esiste già una regola per questa categoria" },
        { status: 409 }
      );
    }

    const [rule] = await db
      .insert(autoReplyRules)
      .values({
        companyId,
        categoria,
        templateId,
        followUpDays,
        followUpTaskTitle,
        enabled,
      })
      .returning();

    return NextResponse.json(rule, { status: 201 });
  } catch (error) {
    const response = authError(error);
    if (response) return response;
    console.error("[auto-reply-rules] POST error:", error);
    return NextResponse.json(
      { error: "Errore nella creazione della regola" },
      { status: 500 }
    );
  }
}
