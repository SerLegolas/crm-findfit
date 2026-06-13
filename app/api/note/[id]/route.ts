import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { notes } from "@/lib/schema";
import { noteSchema } from "@/types";
import { eq } from "drizzle-orm";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const parsed = noteSchema.partial().parse(body);

    const [updated] = await db
      .update(notes)
      .set({ ...parsed, updatedAt: new Date() })
      .where(eq(notes.id, id))
      .returning();

    if (!updated) {
      return NextResponse.json(
        { error: "Nota non trovata" },
        { status: 404 }
      );
    }

    return NextResponse.json(updated);
  } catch (error: any) {
    if (error?.issues) {
      return NextResponse.json(
        { error: "Dati non validi", details: error.issues },
        { status: 400 }
      );
    }
    console.error("Error updating note:", error);
    return NextResponse.json(
      { error: "Errore nell'aggiornamento della nota" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await db.delete(notes).where(eq(notes.id, id));
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting note:", error);
    return NextResponse.json(
      { error: "Errore nell'eliminazione della nota" },
      { status: 500 }
    );
  }
}
