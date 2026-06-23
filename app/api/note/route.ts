import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { notes, clients } from "@/lib/schema";
import { noteSchema } from "@/types";
import { eq, desc, like, and, gte, sql, or } from "drizzle-orm";
import { getAuthUser } from "@/lib/auth";

export async function GET(request: NextRequest) {
  try {
    const authUser = await getAuthUser();
    if (!authUser) {
      return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || "";
    const type = searchParams.get("type") || "";
    const clientId = searchParams.get("clientId") || "";
    const days = parseInt(searchParams.get("days") || "30");

    const dateThreshold = new Date();
    dateThreshold.setDate(dateThreshold.getDate() - days);

    const conditions = [gte(notes.createdAt, dateThreshold)];

    if (type) {
      conditions.push(eq(notes.type, type as any));
    }

    if (clientId) {
      conditions.push(eq(notes.clientId, clientId));
    }

    // Filtra per user_id se non admin: vede i non assegnati + i propri
    if (authUser.role !== "admin") {
      conditions.push(
        sql`(${clients.userId} = ${authUser.id} OR ${clients.userId} IS NULL)`
      );
    }

    const data = await db
      .select({
        id: notes.id,
        content: notes.content,
        type: notes.type,
        author: notes.author,
        clientId: notes.clientId,
        createdAt: notes.createdAt,
        updatedAt: notes.updatedAt,
        clientName: clients.name,
      })
      .from(notes)
      .leftJoin(clients, eq(notes.clientId, clients.id))
      .where(
        search
          ? and(
              ...conditions,
              like(notes.content, `%${search}%`)
            )
          : and(...conditions)
      )
      .orderBy(desc(notes.createdAt));

    return NextResponse.json(data);
  } catch (error) {
    console.error("Error fetching notes:", error);
    return NextResponse.json(
      { error: "Errore nel caricamento delle note" },
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

    const body = await request.json();
    const parsed = noteSchema.parse(body);

    // Auto-assign: se utente non-admin e cliente senza userId, assegna a lui
    if (authUser.role !== "admin" && body.clientId) {
      const [client] = await db
        .select({ userId: clients.userId })
        .from(clients)
        .where(eq(clients.id, body.clientId))
        .limit(1);

      if (client && !client.userId) {
        await db
          .update(clients)
          .set({ userId: authUser.id, updatedAt: new Date() })
          .where(eq(clients.id, body.clientId));
      }
    }

    const [note] = await db
      .insert(notes)
      .values({
        clientId: body.clientId,
        content: parsed.content,
        type: parsed.type,
        author: parsed.author,
      })
      .returning();

    return NextResponse.json(note, { status: 201 });
  } catch (error: any) {
    if (error?.issues) {
      return NextResponse.json(
        { error: "Dati non validi", details: error.issues },
        { status: 400 }
      );
    }
    console.error("Error creating note:", error);
    return NextResponse.json(
      { error: "Errore nella creazione della nota" },
      { status: 500 }
    );
  }
}
