import { NextResponse } from "next/server";
import { requireSuperUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { users, companies } from "@/lib/schema";
import { eq, desc } from "drizzle-orm";

export const dynamic = "force-dynamic";

// GET /api/superuser/admins/:id
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireSuperUser();

    const { id } = await params;

    // Prendi l'admin
    const [admin] = await db
      .select({
        id: users.id,
        email: users.email,
        name: users.name,
        companyId: users.companyId,
        companyName: companies.name,
        createdAt: users.createdAt,
      })
      .from(users)
      .innerJoin(companies, eq(users.companyId, companies.id))
      .where(eq(users.id, id))
      .limit(1);

    if (!admin) {
      return NextResponse.json({ error: "Admin non trovato" }, { status: 404 });
    }

    // Prendi tutti gli utenti (role = 'user') della stessa azienda
    const userList = await db
      .select({
        id: users.id,
        email: users.email,
        name: users.name,
        role: users.role,
        isActive: users.isActive,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(eq(users.companyId, admin.companyId))
      .orderBy(desc(users.createdAt));

    return NextResponse.json({
      ...admin,
      users: userList,
    });
  } catch (error: any) {
    if (error.message === "Unauthorized") {
      return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
    }
    console.error("Error fetching admin:", error);
    return NextResponse.json(
      { error: "Errore nel caricamento dell'admin" },
      { status: 500 }
    );
  }
}
