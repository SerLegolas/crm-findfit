import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { emailTemplates, users } from "@/lib/schema";
import { emailTemplateSchema } from "@/types";
import { and, desc, eq, or, type SQL } from "drizzle-orm";
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

  console.error(`[email-templates] ${context}`, {
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
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };
}

/** OPTIONS: gestione preflight CORS */
export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders() });
}

/** GET: elenco di tutti i template (filtrati per company) */
export async function GET() {
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

    logError("GET - inizio caricamento template", null, {
      userId: authUser.id,
      userRole: authUser.role,
    });

    const conditions: (SQL | undefined)[] = [
      eq(emailTemplates.companyId, authUser.companyId),
    ];
    if (authUser.role !== "admin") {
      // L'utente "user" vede i propri template + quelli creati dall'admin della sua azienda
      const [admin] = await db
        .select({ id: users.id })
        .from(users)
        .where(
          and(
            eq(users.role, "admin"),
            eq(users.companyId, authUser.companyId)
          )
        )
        .limit(1);

      const ownOrAdmin = admin
        ? or(
            eq(emailTemplates.userId, authUser.id),
            eq(emailTemplates.userId, admin.id)
          )
        : eq(emailTemplates.userId, authUser.id);

      conditions.push(ownOrAdmin);
    }

    const templates = await db
      .select()
      .from(emailTemplates)
      .where(and(...conditions))
      .orderBy(desc(emailTemplates.createdAt));

    logError("GET - template caricati con successo", null, {
      count: templates.length,
    });

    return NextResponse.json(templates, { headers: corsHeaders() });
  } catch (error) {
    logError("GET - errore nel caricamento template", error);

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
      { error: "Errore nel caricamento dei template" },
      { status: 500, headers: corsHeaders() }
    );
  }
}

/** POST: crea un nuovo template */
export async function POST(request: NextRequest) {
  try {
    const authUser = await getAuthUser();
    if (!authUser) {
      return NextResponse.json(
        { error: "Non autenticato" },
        { status: 401, headers: corsHeaders() }
      );
    }

    // Verifica feature abilitata (nessun controllo admin)
    try {
      await checkFeatureEnabled(authUser.companyId, "email");
    } catch (e) {
      if (e instanceof FeatureDisabledError) {
        return NextResponse.json({ error: e.message }, { status: 403 });
      }
      throw e;
    }

    logError("POST - inizio creazione template", null, {
      userId: authUser.id,
      userRole: authUser.role,
    });

    // Parsing del body JSON
    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      logError("POST - JSON malformato", null, {
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
        logError("POST - validazione fallita", null, {
          errors: error.errors,
        });
        return handleZodError(error);
      }
      throw error;
    }

    logError("POST - inserimento nel database", null, {
      name: parsed.name,
      subject: parsed.subject,
    });

    const [template] = await db
      .insert(emailTemplates)
      .values({
        name: parsed.name,
        subject: parsed.subject,
        bodyHtml: parsed.bodyHtml,
        footerImageUrl: parsed.footerImageUrl ?? null,
        author: authUser.name,
        companyId: authUser.companyId,
        userId: authUser.id,
      })
      .returning();

    logError("POST - template creato con successo", null, {
      templateId: template.id,
    });

    return NextResponse.json(template, {
      status: 201,
      headers: corsHeaders(),
    });
  } catch (error) {
    logError("POST - errore nella creazione template", error);

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
      { error: "Errore nella creazione del template" },
      { status: 500, headers: corsHeaders() }
    );
  }
}
