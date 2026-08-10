import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { emailTemplates } from "@/lib/schema";
import { emailTemplateSchema } from "@/types";
import { eq, and } from "drizzle-orm";
import { ZodError } from "zod";
import { getAuthUser } from "@/lib/auth";
import { checkFeatureEnabled, FeatureDisabledError } from "@/lib/company-rules";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ── Helpers ──

function logError(context: string, error: unknown, details?: Record<string, unknown>) {
  const safeError =
    error instanceof Error
      ? { name: error.name, message: error.message, stack: error.stack }
      : { name: "UnknownError", message: String(error) };

  console.error(`[email-templates-id] ${context}`, {
    ...safeError,
    ...details,
    timestamp: new Date().toISOString(),
  });
}

function handleZodError(error: ZodError) {
  const errors = error.errors.map((e) => ({
    campo: e.path.join("."),
    messaggio: e.message,
  }));
  return NextResponse.json(
    { error: "Dati non validi", dettagli: errors },
    { status: 400 }
  );
}

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, PATCH, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };
}

/** OPTIONS: gestione preflight CORS */
export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders() });
}

/** GET: recupera un singolo template (company-scoped) */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authUser = await getAuthUser();
    if (!authUser) {
      return NextResponse.json(
        { error: "Non autenticato" },
        { status: 401, headers: corsHeaders() }
      );
    }

    // Verifica feature abilitata
    try {
      await checkFeatureEnabled(authUser.companyId, "email");
    } catch (e) {
      if (e instanceof FeatureDisabledError) {
        return NextResponse.json({ error: e.message }, { status: 403 });
      }
      throw e;
    }

    const { id } = await params;

    logError("GET - inizio caricamento template", null, {
      templateId: id,
      userId: authUser.id,
    });

    const [template] = await db
      .select()
      .from(emailTemplates)
      .where(
        and(eq(emailTemplates.id, id), eq(emailTemplates.companyId, authUser.companyId))
      );

    if (!template) {
      logError("GET - template non trovato", null, { templateId: id });
      return NextResponse.json(
        { error: "Template non trovato" },
        { status: 404, headers: corsHeaders() }
      );
    }

    return NextResponse.json(template, { headers: corsHeaders() });
  } catch (error) {
    logError("GET - errore nel caricamento del template", error);

    if (error instanceof Error && error.message?.includes("fetch")) {
      return NextResponse.json(
        {
          error: "Errore di connessione al database",
          message:
            "Impossibile contattare il database. Verifica che Turso sia raggiungibile.",
        },
        { status: 503, headers: corsHeaders() }
      );
    }

    return NextResponse.json(
      { error: "Errore nel caricamento del template" },
      { status: 500, headers: corsHeaders() }
    );
  }
}

/** PATCH: aggiorna un template */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authUser = await getAuthUser();
    if (!authUser) {
      return NextResponse.json(
        { error: "Non autenticato" },
        { status: 401, headers: corsHeaders() }
      );
    }

    const { id } = await params;

    logError("PATCH - inizio aggiornamento", null, {
      templateId: id,
      userId: authUser.id,
    });

    // Parsing del body JSON
    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      logError("PATCH - JSON malformato", null, {
        templateId: id,
        contentType: request.headers.get("content-type"),
      });
      return NextResponse.json(
        { error: "Il corpo della richiesta non è un JSON valido" },
        { status: 400, headers: corsHeaders() }
      );
    }

    // Validazione con Zod
    let parsed;
    try {
      parsed = emailTemplateSchema.parse(body);
    } catch (error) {
      if (error instanceof ZodError) {
        logError("PATCH - validazione fallita", null, {
          templateId: id,
          errors: error.errors,
        });
        return handleZodError(error);
      }
      throw error;
    }

    logError("PATCH - aggiornamento nel database", null, {
      templateId: id,
      name: parsed.name,
    });

    const [template] = await db
      .update(emailTemplates)
      .set({
        name: parsed.name,
        subject: parsed.subject,
        bodyHtml: parsed.bodyHtml,
        footerImageUrl: parsed.footerImageUrl ?? null,
        updatedAt: new Date(),
      })
      .where(and(eq(emailTemplates.id, id), eq(emailTemplates.companyId, authUser.companyId)))
      .returning();

    if (!template) {
      logError("PATCH - template non trovato", null, { templateId: id });
      return NextResponse.json(
        { error: "Template non trovato" },
        { status: 404, headers: corsHeaders() }
      );
    }

    logError("PATCH - template aggiornato con successo", null, {
      templateId: template.id,
    });

    return NextResponse.json(template, { headers: corsHeaders() });
  } catch (error) {
    logError("PATCH - errore nell'aggiornamento", error);

    if (error instanceof Error && error.message?.includes("fetch")) {
      return NextResponse.json(
        {
          error: "Errore di connessione al database",
          message:
            "Impossibile contattare il database. Verifica che Turso sia raggiungibile.",
        },
        { status: 503, headers: corsHeaders() }
      );
    }

    return NextResponse.json(
      { error: "Errore nell'aggiornamento del template" },
      { status: 500, headers: corsHeaders() }
    );
  }
}

/** DELETE: elimina un template */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authUser = await getAuthUser();
    if (!authUser) {
      return NextResponse.json(
        { error: "Non autenticato" },
        { status: 401, headers: corsHeaders() }
      );
    }

    const { id } = await params;

    logError("DELETE - inizio eliminazione", null, {
      templateId: id,
      userId: authUser.id,
    });

    const [template] = await db
      .delete(emailTemplates)
      .where(and(eq(emailTemplates.id, id), eq(emailTemplates.companyId, authUser.companyId)))
      .returning();

    if (!template) {
      logError("DELETE - template non trovato", null, { templateId: id });
      return NextResponse.json(
        { error: "Template non trovato" },
        { status: 404, headers: corsHeaders() }
      );
    }

    logError("DELETE - template eliminato con successo", null, {
      templateId: id,
    });

    return NextResponse.json(
      { success: true },
      { headers: corsHeaders() }
    );
  } catch (error) {
    logError("DELETE - errore nell'eliminazione", error);

    if (error instanceof Error && error.message?.includes("fetch")) {
      return NextResponse.json(
        {
          error: "Errore di connessione al database",
          message:
            "Impossibile contattare il database. Verifica che Turso sia raggiungibile.",
        },
        { status: 503, headers: corsHeaders() }
      );
    }

    return NextResponse.json(
      { error: "Errore nell'eliminazione del template" },
      { status: 500, headers: corsHeaders() }
    );
  }
}
