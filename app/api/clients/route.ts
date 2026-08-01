import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { clients, tasks } from "@/lib/schema";
import { clientSchema } from "@/types";
import { eq, desc, like, or, and, sql, type SQL } from "drizzle-orm";
import { getAuthUser, requireCompany } from "@/lib/auth";
import {
  checkMaxClients,
  MaxLimitError,
  checkFeatureEnabled,
  FeatureDisabledError,
} from "@/lib/company-rules";

export async function GET(request: NextRequest) {
  try {
    const authUser = await getAuthUser();
    if (!authUser) {
      return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
    }

    // Verifica feature abilitata
    try {
      await checkFeatureEnabled(authUser.companyId, "clienti");
    } catch (e) {
      if (e instanceof FeatureDisabledError) {
        return NextResponse.json({ error: e.message }, { status: 403 });
      }
      throw e;
    }

    const companyId = authUser.companyId;

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || "";
    const status = searchParams.get("status") || "";
    const categoria = searchParams.get("categoria") || "";
    const sort = searchParams.get("sort") || "createdAt";
    const order = searchParams.get("order") || "desc";
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "10");
    const offset = (page - 1) * limit;

    const conditions: (SQL | undefined)[] = [eq(clients.companyId, companyId)];
    if (search) {
      conditions.push(
        or(
          like(clients.name, `%${search}%`),
          like(clients.email, `%${search}%`),
          like(clients.company, `%${search}%`)
        )
      );
    }
    if (status && status !== "all") {
      conditions.push(eq(clients.status, status as any));
    }
    if (categoria && categoria !== "all") {
      conditions.push(like(clients.categoria, `%${categoria}%`));
    }
    // Filtra per user_id se l'utente non è admin: vede i non assegnati + i propri
    if (authUser.role !== "admin") {
      conditions.push(
        or(eq(clients.userId, authUser.id), sql`${clients.userId} IS NULL`)
      );
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const orderBy =
      order === "asc"
        ? (sql`${clients[sort as keyof typeof clients]} ASC` as any)
        : (sql`${clients[sort as keyof typeof clients]} DESC` as any);

    const data = await db
      .select()
      .from(clients)
      .where(where)
      .orderBy(orderBy)
      .limit(limit)
      .offset(offset);

    const totalResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(clients)
      .where(where);

    const total = Number(totalResult[0]?.count || 0);

    return NextResponse.json({ data, total, page, limit });
  } catch (error) {
    console.error("Error fetching clients:", error);
    return NextResponse.json(
      { error: "Errore nel caricamento dei clienti" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const authUser = await getAuthUser();
    if (!authUser) {
      return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
    }

    // Controlla limite massimo clienti
    try {
      await checkMaxClients(authUser.companyId);
    } catch (e) {
      if (e instanceof MaxLimitError) {
        return NextResponse.json({ error: e.message }, { status: 403 });
      }
      throw e;
    }

    const body = await request.json();
    const parsed = clientSchema.parse(body);

    const [client] = await db
      .insert(clients)
      .values({
        name: parsed.name,
        email: parsed.email || null,
        phone: parsed.phone || null,
        company: parsed.company || null,
        status: parsed.status,
        categoria: parsed.categoria || null,
        notes: parsed.notes || null,
        userId: authUser.role === "admin" ? null : authUser.id,
        companyId: authUser.companyId,
      })
      .returning();

    // Auto-create tasks for suspect and won
    if (client.status === "suspect") {
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 3);
      await db.insert(tasks).values({
        clientId: client.id,
        title: "Chiamata qualificazione",
        description: "Chiamata di qualificazione per il nuovo suspect",
        dueDate,
        priority: "high",
        companyId: authUser.companyId,
      });
    }

    if (client.status === "won") {
      const dueContract = new Date();
      dueContract.setDate(dueContract.getDate() + 2);
      const dueOnboarding = new Date();
      dueOnboarding.setDate(dueOnboarding.getDate() + 7);

      await db.insert(tasks).values([
        {
          clientId: client.id,
          title: "Invia contratto",
          description: "Inviare il contratto al cliente",
          dueDate: dueContract,
          priority: "high",
          companyId: authUser.companyId,
        },
        {
          clientId: client.id,
          title: "Onboarding",
          description: "Completare l'onboarding del cliente",
          dueDate: dueOnboarding,
          priority: "medium",
          companyId: authUser.companyId,
        },
      ]);
    }

    return NextResponse.json(client, { status: 201 });
  } catch (error: any) {
    if (error?.issues) {
      return NextResponse.json(
        { error: "Dati non validi", details: error.issues },
        { status: 400 }
      );
    }
    console.error("Error creating client:", error);
    return NextResponse.json(
      { error: "Errore nella creazione del cliente" },
      { status: 500 }
    );
  }
}
