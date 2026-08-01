import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { companySettings } from "@/lib/schema";
import { eq } from "drizzle-orm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET: restituisce i dati azienda per la company corrente */
export async function GET() {
  try {
    const authUser = await getAuthUser();
    if (!authUser) {
      return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
    }

    const companyId = authUser.companyId;

    let [settings] = await db
      .select()
      .from(companySettings)
      .where(eq(companySettings.companyId, companyId))
      .limit(1);

    // Se non esiste, crea riga per questa company (id = companyId)
    if (!settings) {
      [settings] = await db
        .insert(companySettings)
        .values({ id: companyId, companyId })
        .returning();
    }

    return NextResponse.json(settings);
  } catch (error) {
    console.error("Error fetching company settings:", error);
    return NextResponse.json(
      { error: "Errore nel caricamento dei dati azienda" },
      { status: 500 }
    );
  }
}

/** PUT: aggiorna i dati azienda (solo admin) - multipart/form-data */
export async function PUT(request: NextRequest) {
  try {
    const authUser = await getAuthUser();
    if (!authUser) {
      return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
    }
    if (authUser.role !== "admin") {
      return NextResponse.json({ error: "Accesso negato" }, { status: 403 });
    }

    const companyId = authUser.companyId;
    const formData = await request.formData();

    const fields: Record<string, string> = {
      denominazione: "",
      piva: "",
      cf: "",
      indirizzo: "",
      città: "",
      provincia: "",
      cap: "",
      email: "",
      telefono: "",
    };

    for (const key of Object.keys(fields)) {
      const val = formData.get(key);
      fields[key] = typeof val === "string" ? val : "";
    }

    const footerAttivo = formData.get("footerAttivo") === "true";

    const updateData: Record<string, any> = { ...fields, footerAttivo };

    // Assicura che la riga per questa company esista
    const [existing] = await db
      .select()
      .from(companySettings)
      .where(eq(companySettings.companyId, companyId))
      .limit(1);

    if (!existing) {
      await db.insert(companySettings).values({ id: companyId, companyId, ...updateData });
    } else {
      await db
        .update(companySettings)
        .set(updateData)
        .where(eq(companySettings.companyId, companyId));
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error updating company settings:", error);
    return NextResponse.json(
      { error: "Errore nell'aggiornamento dei dati azienda" },
      { status: 500 }
    );
  }
}
