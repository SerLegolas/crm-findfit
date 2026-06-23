import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { clients, tasks } from "@/lib/schema";
import { clientSchema, allowedTransitions, requiresNoteForTransition } from "@/types";
import { eq, and, or, sql } from "drizzle-orm";
import { getAuthUser } from "@/lib/auth";

async function getClientIfAuthorized(id: string) {
  const authUser = await getAuthUser();
  if (!authUser) return null;

  const where =
    authUser.role === "admin"
      ? eq(clients.id, id)
      : and(
          eq(clients.id, id),
          or(eq(clients.userId, authUser.id), sql`${clients.userId} IS NULL`)
        );

  const [client] = await db.select().from(clients).where(where).limit(1);
  return client || null;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const client = await getClientIfAuthorized(id);

    if (!client) {
      return NextResponse.json(
        { error: "Cliente non trovato" },
        { status: 404 }
      );
    }

    return NextResponse.json(client);
  } catch (error) {
    console.error("Error fetching client:", error);
    return NextResponse.json(
      { error: "Errore nel caricamento del cliente" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const existing = await getClientIfAuthorized(id);

    if (!existing) {
      return NextResponse.json(
        { error: "Cliente non trovato" },
        { status: 404 }
      );
    }

    const currentClient = existing!;

    // Handle status transitions
    if (body.status && body.status !== currentClient.status) {
      const allowed = allowedTransitions[currentClient.status as keyof typeof allowedTransitions];
      if (!allowed.includes(body.status)) {
        return NextResponse.json(
          {
            error: `Transizione da "${currentClient.status}" a "${body.status}" non consentita`,
          },
          { status: 400 }
        );
      }

      if (requiresNoteForTransition(currentClient.status, body.status) && !body.noteContent) {
        return NextResponse.json(
          {
            error:
              "Per chiudere un cliente è necessario aggiungere una nota di motivazione",
          },
          { status: 400 }
        );
      }
    }

    // Prepare update data (only provided fields)
    const updateData: Record<string, any> = {};
    const allowedFields = ["name", "email", "phone", "company", "status", "notes", "userId"];
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updateData[field] = body[field] || null;
      }
    }
    updateData.updatedAt = new Date();

    // Auto-assign: se utente non-admin e cliente senza userId, assegna a lui
    const authUser = await getAuthUser();
    if (authUser && authUser.role !== "admin" && !currentClient.userId) {
      updateData.userId = authUser.id;
    }

    const [updated] = await db
      .update(clients)
      .set(updateData)
      .where(eq(clients.id, id))
      .returning();

    // Create note if transition requires it
    if (body.status && body.status !== currentClient.status && body.noteContent) {
      const { notes: notesTable } = await import("@/lib/schema");
      await db.insert(notesTable).values({
        clientId: id,
        content: body.noteContent,
        type: "decisione",
        author: "Sistema",
      });
    }

    // Create automatic tasks on new status
    if (body.status === "suspect" && body.status !== currentClient.status) {
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 3);
      await db.insert(tasks).values({
        clientId: id,
        title: "Chiamata qualificazione",
        description: "Chiamata di qualificazione per il nuovo suspect",
        dueDate,
        priority: "high",
      });
    }

    if (body.status === "won" && body.status !== currentClient.status) {
      const dueContract = new Date();
      dueContract.setDate(dueContract.getDate() + 2);
      const dueOnboarding = new Date();
      dueOnboarding.setDate(dueOnboarding.getDate() + 7);

      await db.insert(tasks).values([
        {
          clientId: id,
          title: "Invia contratto",
          description: "Inviare il contratto al cliente",
          dueDate: dueContract,
          priority: "high",
        },
        {
          clientId: id,
          title: "Onboarding",
          description: "Completare l'onboarding del cliente",
          dueDate: dueOnboarding,
          priority: "medium",
        },
      ]);
    }

    return NextResponse.json(updated);
  } catch (error: any) {
    if (error?.issues) {
      return NextResponse.json(
        { error: "Dati non validi", details: error.issues },
        { status: 400 }
      );
    }
    console.error("Error updating client:", error);
    return NextResponse.json(
      { error: "Errore nell'aggiornamento del cliente" },
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
    const existing = await getClientIfAuthorized(id);

    if (!existing) {
      return NextResponse.json(
        { error: "Cliente non trovato" },
        { status: 404 }
      );
    }

    await db.delete(clients).where(eq(clients.id, id));
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting client:", error);
    return NextResponse.json(
      { error: "Errore nell'eliminazione del cliente" },
      { status: 500 }
    );
  }
}
