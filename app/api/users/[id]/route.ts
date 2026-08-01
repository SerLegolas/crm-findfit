import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { users } from "@/lib/schema";
import { requireAdmin, hashPassword, getAuthUser } from "@/lib/auth";
import { eq, and } from "drizzle-orm";
import { userSchema } from "@/types";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authUser = await requireAdmin();
    const companyId = authUser.companyId;

    const { id } = await params;
    const body = await request.json();

    const existing = await db
      .select()
      .from(users)
      .where(and(eq(users.id, id), eq(users.companyId, companyId)))
      .limit(1);

    if (!existing.length) {
      return NextResponse.json(
        { error: "Utente non trovato" },
        { status: 404 }
      );
    }

    // Se si cambia email, verifica univocità (globale)
    if (body.email && body.email !== existing[0].email) {
      const duplicate = await db
        .select()
        .from(users)
        .where(eq(users.email, body.email))
        .limit(1);

      if (duplicate.length > 0) {
        return NextResponse.json(
          { error: "Email già utilizzata" },
          { status: 409 }
        );
      }
    }

    const updateData: Record<string, any> = {};
    const allowedFields = ["name", "email", "role", "isActive"];
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updateData[field] = body[field];
      }
    }

    if (body.password) {
      updateData.passwordHash = await hashPassword(body.password);
    }

    updateData.updatedAt = new Date();

    const [updated] = await db
      .update(users)
      .set(updateData)
      .where(and(eq(users.id, id), eq(users.companyId, companyId)))
      .returning();

    return NextResponse.json({
      id: updated.id,
      email: updated.email,
      name: updated.name,
      role: updated.role,
      isActive: updated.isActive,
      createdAt: updated.createdAt,
    });
  } catch (error: any) {
    if (error.message === "Unauthorized" || error.message === "Forbidden") {
      return NextResponse.json({ error: "Non autorizzato" }, { status: 403 });
    }
    console.error("Error updating user:", error);
    return NextResponse.json(
      { error: "Errore nell'aggiornamento dell'utente" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authUser = await requireAdmin();
    const companyId = authUser.companyId;

    const { id } = await params;

    // Impedisci auto-eliminazione
    const currentUser = await getAuthUser();
    if (currentUser?.id === id) {
      return NextResponse.json(
        { error: "Non puoi eliminare il tuo account" },
        { status: 400 }
      );
    }

    const existing = await db
      .select()
      .from(users)
      .where(and(eq(users.id, id), eq(users.companyId, companyId)))
      .limit(1);

    if (!existing.length) {
      return NextResponse.json(
        { error: "Utente non trovato" },
        { status: 404 }
      );
    }

    await db
      .delete(users)
      .where(and(eq(users.id, id), eq(users.companyId, companyId)));

    return NextResponse.json({ success: true });
  } catch (error: any) {
    if (error.message === "Unauthorized" || error.message === "Forbidden") {
      return NextResponse.json({ error: "Non autorizzato" }, { status: 403 });
    }
    console.error("Error deleting user:", error);
    return NextResponse.json(
      { error: "Errore nell'eliminazione dell'utente" },
      { status: 500 }
    );
  }
}
