import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { autoReplyRules, emailTemplates } from "@/lib/schema";
import { autoReplyRuleSchema } from "@/types";
import { and, eq, ne } from "drizzle-orm";
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

/** PATCH: aggiorna una regola della propria company */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authUser = await requireAdmin();
    const companyId = authUser.companyId;
    const ruleId = params.id;

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Il corpo della richiesta non è un JSON valido" },
        { status: 400 }
      );
    }

    const parsed = autoReplyRuleSchema.partial().safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Dati non validi", dettagli: parsed.error.issues },
        { status: 400 }
      );
    }

    // La regola deve appartenere alla company dell'utente
    const [existingRule] = await db
      .select()
      .from(autoReplyRules)
      .where(
        and(
          eq(autoReplyRules.id, ruleId),
          eq(autoReplyRules.companyId, companyId)
        )
      )
      .limit(1);

    if (!existingRule) {
      return NextResponse.json({ error: "Regola non trovata" }, { status: 404 });
    }

    const updates: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(parsed.data)) {
      if (value !== undefined) updates[key] = value;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: "Nessun campo da aggiornare" },
        { status: 400 }
      );
    }

    // Il template (se presente) deve appartenere alla stessa company
    if (typeof updates.templateId === "string") {
      const [template] = await db
        .select({ id: emailTemplates.id })
        .from(emailTemplates)
        .where(
          and(
            eq(emailTemplates.id, updates.templateId),
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
    }

    // Una sola regola per (companyId, categoria)
    if (typeof updates.categoria === "string") {
      const [duplicate] = await db
        .select({ id: autoReplyRules.id })
        .from(autoReplyRules)
        .where(
          and(
            eq(autoReplyRules.companyId, companyId),
            eq(autoReplyRules.categoria, updates.categoria),
            ne(autoReplyRules.id, ruleId)
          )
        )
        .limit(1);

      if (duplicate) {
        return NextResponse.json(
          { error: "Esiste già una regola per questa categoria" },
          { status: 409 }
        );
      }
    }

    const [rule] = await db
      .update(autoReplyRules)
      .set({ ...updates, updatedAt: new Date() })
      .where(
        and(
          eq(autoReplyRules.id, ruleId),
          eq(autoReplyRules.companyId, companyId)
        )
      )
      .returning();

    return NextResponse.json(rule);
  } catch (error) {
    const response = authError(error);
    if (response) return response;
    console.error("[auto-reply-rules] PATCH error:", error);
    return NextResponse.json(
      { error: "Errore nell'aggiornamento della regola" },
      { status: 500 }
    );
  }
}

/** DELETE: elimina una regola della propria company */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authUser = await requireAdmin();
    const companyId = authUser.companyId;
    const ruleId = params.id;

    const [deleted] = await db
      .delete(autoReplyRules)
      .where(
        and(
          eq(autoReplyRules.id, ruleId),
          eq(autoReplyRules.companyId, companyId)
        )
      )
      .returning({ id: autoReplyRules.id });

    if (!deleted) {
      return NextResponse.json({ error: "Regola non trovata" }, { status: 404 });
    }

    return NextResponse.json({ success: true, id: deleted.id });
  } catch (error) {
    const response = authError(error);
    if (response) return response;
    console.error("[auto-reply-rules] DELETE error:", error);
    return NextResponse.json(
      { error: "Errore nell'eliminazione della regola" },
      { status: 500 }
    );
  }
}
