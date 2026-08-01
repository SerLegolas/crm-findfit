import { NextRequest, NextResponse } from "next/server";
import { SUPERUSER_USERNAME, generateSuperPassword, createSuperSession } from "@/lib/auth";

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

    const expectedPassword = generateSuperPassword();
    if (password !== expectedPassword) {
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
