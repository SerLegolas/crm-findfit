import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { notes, clients } from "@/lib/schema";
import { noteSchema } from "@/types";
import { eq, desc, like, and, gte, sql } from "drizzle-orm";

export async function GET(request: NextRequest) {
  try {
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
    const body = await request.json();
    const parsed = noteSchema.parse(body);

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
