import { NextRequest, NextResponse } from "next/server";
import { getAuthUser, hashPassword } from "@/lib/auth";
import { db } from "@/lib/db";
import { users } from "@/lib/schema";
import { eq } from "drizzle-orm";

export async function PATCH(request: NextRequest) {
  try {
    const authUser = await getAuthUser();
    if (!authUser) {
      return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
    }

    const { newPassword, confirmPassword } = await request.json();

    if (!newPassword || newPassword.length < 6) {
      return NextResponse.json(
        { error: "La nuova password deve essere di almeno 6 caratteri" },
        { status: 400 }
      );
    }

    if (newPassword !== confirmPassword) {
      return NextResponse.json(
        { error: "Le password non coincidono" },
        { status: 400 }
      );
    }

    const passwordHash = await hashPassword(newPassword);

    await db
      .update(users)
      .set({ passwordHash })
      .where(eq(users.id, authUser.id));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Change password error:", error);
    return NextResponse.json(
      { error: "Errore durante il cambio password" },
      { status: 500 }
    );
  }
}
