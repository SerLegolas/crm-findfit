import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { SUPERUSER_USERNAME, SUPER_PASSWORD, createSuperSession } from "@/lib/auth";

export async function POST(request: NextRequest) {
  try {
    const { username, password } = await request.json();

    if (!username || !password) {
      return NextResponse.json(
        { error: "Inserisci username e password" },
        { status: 400 }
      );
    }

    if (username !== SUPERUSER_USERNAME) {
      return NextResponse.json(
        { error: "Credenziali non valide" },
        { status: 401 }
      );
    }

    // Verifica a tempo costante: SUPER_PASSWORD deve essere configurata in env
    if (
      !SUPER_PASSWORD ||
      typeof password !== "string" ||
      password.length !== SUPER_PASSWORD.length ||
      !timingSafeEqual(Buffer.from(password), Buffer.from(SUPER_PASSWORD))
    ) {
      return NextResponse.json(
        { error: "Credenziali non valide" },
        { status: 401 }
      );
    }

    await createSuperSession();

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Superuser login error:", error);
    return NextResponse.json(
      { error: "Errore durante il login" },
      { status: 500 }
    );
  }
}
