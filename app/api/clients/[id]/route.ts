import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { clients, tasks } from "@/lib/schema";
import { clientSchema, allowedTransitions, requiresNoteForTransition } from "@/types";
import { eq, and, sql } from "drizzle-orm";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const client = await db
      .select()
      .from(clients)
      .where(eq(clients.id, params.id))
      .limit(1);

    if (!client.length) {
      return NextResponse.json(
        { error: "Cliente non trovato" },
        { status: 404 }
      );
    }

    return NextResponse.json(client[0]);
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
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const existing = await db
      .select()
      .from(clients)
      .where(eq(clients.id, params.id))
      .limit(1);

    if (!existing.length) {
      return NextResponse.json(
        { error: "Cliente non trovato" },
        { status: 404 }
      );
    }

    const currentClient = existing[0];

    // Handle status transitions
    if (body.status && body.status !== currentClient.status) {
      const allowed = allowedTransitions[currentClient.status];
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
    const allowedFields = ["name", "email", "phone", "company", "status", "notes"];
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updateData[field] = body[field] || null;
      }
    }
    updateData.updatedAt = new Date();

    const [updated] = await db
      .update(clients)
      .set(updateData)
      .where(eq(clients.id, params.id))
      .returning();

    // Create note if transition requires it
    if (body.status && body.status !== currentClient.status && body.noteContent) {
      const { notes: notesTable } = await import("@/lib/schema");
      await db.insert(notesTable).values({
        clientId: params.id,
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
        clientId: params.id,
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
          clientId: params.id,
          title: "Invia contratto",
          description: "Inviare il contratto al cliente",
          dueDate: dueContract,
          priority: "high",
        },
        {
          clientId: params.id,
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
  { params }: { params: { id: string } }
) {
  try {
    await db.delete(clients).where(eq(clients.id, params.id));
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting client:", error);
    return NextResponse.json(
      { error: "Errore nell'eliminazione del cliente" },
      { status: 500 }
    );
  }
}
