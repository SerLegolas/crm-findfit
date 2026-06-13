import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { tasks } from "@/lib/schema";
import { taskSchema } from "@/types";
import { eq } from "drizzle-orm";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const parsed = taskSchema.partial().parse(body);

    // Get current task to check status change
    const existing = await db
      .select()
      .from(tasks)
      .where(eq(tasks.id, id))
      .limit(1);

    if (!existing.length) {
      return NextResponse.json(
        { error: "Task non trovato" },
        { status: 404 }
      );
    }

    const updateData: Record<string, any> = {
      ...parsed,
      updatedAt: new Date(),
    };

    // Handle completion
    if (body.status === "completed" && existing[0].status !== "completed") {
      updateData.completedAt = new Date();
    } else if (body.status && body.status !== "completed") {
      updateData.completedAt = null;
    }

    if (parsed.dueDate) {
      updateData.dueDate = new Date(parsed.dueDate);
    }

    const [updated] = await db
      .update(tasks)
      .set(updateData)
      .where(eq(tasks.id, id))
      .returning();

    return NextResponse.json(updated);
  } catch (error: any) {
    if (error?.issues) {
      return NextResponse.json(
        { error: "Dati non validi", details: error.issues },
        { status: 400 }
      );
    }
    console.error("Error updating task:", error);
    return NextResponse.json(
      { error: "Errore nell'aggiornamento del task" },
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
    await db.delete(tasks).where(eq(tasks.id, id));
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting task:", error);
    return NextResponse.json(
      { error: "Errore nell'eliminazione del task" },
      { status: 500 }
    );
  }
}
