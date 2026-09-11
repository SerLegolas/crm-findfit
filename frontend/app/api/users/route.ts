import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { users } from "@/lib/schema";
import { requireAuth, requireAdmin, requireCompany, hashPassword } from "@/lib/auth";
import { userSchema } from "@/types";
import { checkMaxUsers, MaxLimitError, checkAdminFeatureEnabled, FeatureDisabledError } from "@/lib/company-rules";
import { eq, desc } from "drizzle-orm";

export async function GET() {
  try {
    const authUser = await requireAuth();
    const companyId = authUser.companyId;

    // Verifica feature admin
    try {
      await checkAdminFeatureEnabled(authUser.companyId, "gestione_utenti");
    } catch (e) {
      if (e instanceof FeatureDisabledError) {
        return NextResponse.json({ error: e.message }, { status: 403 });
      }
      throw e;
    }

    const data = await db
      .select({
        id: users.id,
        email: users.email,
        name: users.name,
        role: users.role,
        isActive: users.isActive,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(eq(users.companyId, companyId))
      .orderBy(desc(users.createdAt));

    return NextResponse.json({ data });
  } catch (error: any) {
    if (error.message === "Unauthorized" || error.message === "Forbidden") {
      return NextResponse.json({ error: "Non autorizzato" }, { status: 403 });
    }
    console.error("Error fetching users:", error);
    return NextResponse.json(
      { error: "Errore nel caricamento degli utenti" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const authUser = await requireAdmin();
    const companyId = authUser.companyId;

    // Controlla limite massimo utenti
    try {
      await checkMaxUsers(companyId);
    } catch (e) {
      if (e instanceof MaxLimitError) {
        return NextResponse.json({ error: e.message }, { status: 403 });
      }
      throw e;
    }

    const body = await request.json();
    const parsed = userSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Dati non validi", details: parsed.error.issues },
        { status: 400 }
      );
    }

    const { email, password, name, role, isActive } = parsed.data;

    // Verifica email univoca (globale)
    const existing = await db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (existing.length > 0) {
      return NextResponse.json(
        { error: "Email già utilizzata" },
        { status: 409 }
      );
    }

    if (!password) {
      return NextResponse.json(
        { error: "La password è obbligatoria" },
        { status: 400 }
      );
    }

    const passwordHash = await hashPassword(password);

    const [user] = await db
      .insert(users)
      .values({
        email,
        passwordHash,
        name,
        role,
        isActive,
        companyId,
      })
      .returning();

    return NextResponse.json({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      isActive: user.isActive,
      createdAt: user.createdAt,
    });
  } catch (error: any) {
    if (error.message === "Unauthorized" || error.message === "Forbidden") {
      return NextResponse.json({ error: "Non autorizzato" }, { status: 403 });
    }
    console.error("Error creating user:", error);
    return NextResponse.json(
      { error: "Errore nella creazione dell'utente" },
      { status: 500 }
    );
  }
}
