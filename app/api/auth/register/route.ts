import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { users, companies } from "@/lib/schema";
import { eq } from "drizzle-orm";
import { createSession, hashPassword } from "@/lib/auth";
import { z } from "zod";

const registerSchema = z.object({
  companyName: z.string().min(1, "Tutti i campi sono obbligatori"),
  email: z.string().min(1, "Tutti i campi sono obbligatori").email("Inserisci un'email valida"),
  password: z.string().min(1, "Tutti i campi sono obbligatori").min(6, "Minimo 6 caratteri"),
  confirmPassword: z.string().min(1, "Tutti i campi sono obbligatori"),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Le password non coincidono",
  path: ["confirmPassword"],
});

function extractFirstError(issues: z.ZodIssue[]): string {
  for (const issue of issues) {
    if (issue.message !== "Le password non coincidono") {
      return issue.message;
    }
  }
  return "Dati non validi";
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = registerSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: extractFirstError(parsed.error.issues) },
        { status: 400 }
      );
    }

    const { companyName, email, password } = parsed.data;

    // Verifica email univoca (globale, cross-tenant)
    const existingUser = await db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (existingUser.length > 0) {
      return NextResponse.json(
        { error: `Email già utilizzata: ${email}` },
        { status: 409 }
      );
    }

    // Genera slug dall'azienda
    let slug = companyName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 50) || `company-${Date.now()}`;

    // Se lo slug esiste già, appende timestamp
    const existingSlug = await db
      .select()
      .from(companies)
      .where(eq(companies.slug, slug))
      .limit(1);

    if (existingSlug.length > 0) {
      slug = `${slug}-${Date.now()}`;
    }

    // Crea l'azienda
    const [company] = await db
      .insert(companies)
      .values({
        name: companyName,
        slug,
      })
      .returning();

    // Crea l'utente admin associato all'azienda
    const passwordHash = await hashPassword(password);

    const [user] = await db
      .insert(users)
      .values({
        email,
        passwordHash,
        name: "Admin",
        role: "admin",
        isActive: true,
        companyId: company.id,
      })
      .returning();

    // Crea riga company_settings per la nuova azienda (id = stesso id azienda)
    const { companySettings, companyRules } = await import("@/lib/schema");
    await db
      .insert(companySettings)
      .values({
        id: company.id,
        companyId: company.id,
        denominazione: companyName,
      });

    // Crea riga company_rules con default (tutti i moduli abilitati)
    await db
      .insert(companyRules)
      .values({
        companyId: company.id,
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
          analisi: true,
          template: true,
          comunicazioni: true,
          impostazioni: true,
        },
        featuresAdmin: {
          gestione_utenti: true,
          configurazione_email: false,
          recupero_email: false,
          facebook_post: false,
        },
      });

    // Login automatico
    await createSession({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role as "admin" | "user",
      companyId: user.companyId,
    });

    return NextResponse.json({ success: true, companyId: company.id });
  } catch (error) {
    console.error("Register error:", error);
    return NextResponse.json(
      { error: "Errore durante la registrazione" },
      { status: 500 }
    );
  }
}
