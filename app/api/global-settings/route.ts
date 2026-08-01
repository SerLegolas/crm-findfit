import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { globalSettings } from "@/lib/schema";
import { eq } from "drizzle-orm";
import { requireSuperUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

/** GET: restituisce il valore di una key (accesso pubblico per showRegisterButton) */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const key = searchParams.get("key");

    if (!key) {
      return NextResponse.json(
        { error: "Il parametro key è obbligatorio" },
        { status: 400 }
      );
    }

    const [setting] = await db
      .select()
      .from(globalSettings)
      .where(eq(globalSettings.key, key))
      .limit(1);

    return NextResponse.json({
      key,
      value: setting?.value ?? null,
    });
  } catch (error) {
    console.error("Error fetching global setting:", error);
    return NextResponse.json(
      { error: "Errore nel caricamento dell'impostazione" },
      { status: 500 }
    );
  }
}

/** PUT: aggiorna una key (solo superuser) */
export async function PUT(request: NextRequest) {
  try {
    await requireSuperUser();

    const body = await request.json();
    const { key, value } = body;

    if (!key || value === undefined) {
      return NextResponse.json(
        { error: "key e value sono obbligatori" },
        { status: 400 }
      );
    }

    // Upsert
    const [existing] = await db
      .select()
      .from(globalSettings)
      .where(eq(globalSettings.key, key))
      .limit(1);

    if (existing) {
      await db
        .update(globalSettings)
        .set({ value, updatedAt: new Date() })
        .where(eq(globalSettings.key, key));
    } else {
      await db
        .insert(globalSettings)
        .values({ key, value });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    if (error.message === "Unauthorized") {
      return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
    }
    console.error("Error updating global setting:", error);
    return NextResponse.json(
      { error: "Errore nell'aggiornamento dell'impostazione" },
      { status: 500 }
    );
  }
}
