import { NextResponse } from "next/server";
import { requireSuperUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { users, companies } from "@/lib/schema";
import { eq, desc } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requireSuperUser();

    // Prendi tutti gli admin con la loro company
    const admins = await db
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
      .where(eq(users.role, "admin"))
      .orderBy(desc(users.createdAt));

    // Per ogni admin, prendi i suoi utenti (role = 'user') nella stessa azienda
    const result = [];
    for (const admin of admins) {
      const userList = await db
        .select({
          id: users.id,
          email: users.email,
          name: users.name,
          createdAt: users.createdAt,
        })
        .from(users)
        .where(eq(users.companyId, admin.companyId))
        .orderBy(desc(users.createdAt));

      result.push({
        ...admin,
        users: userList,
      });
    }

    return NextResponse.json(result);
  } catch (error: any) {
    if (error.message === "Unauthorized") {
      return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
    }
    console.error("Error fetching admins:", error);
    return NextResponse.json(
      { error: "Errore nel caricamento degli admin" },
      { status: 500 }
    );
  }
}
