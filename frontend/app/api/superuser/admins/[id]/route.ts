import { NextResponse } from "next/server";
import { requireSuperUser } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  users,
  companies,
  clients,
  tasks,
  notes,
  emailLog,
  emailTemplates,
  imapSettings,
  companySettings,
  companyRules,
  cronLog,
  comunicazioni,
  comunicazioniBatch,
  savedAnalyses,
} from "@/lib/schema";
import { eq, desc, inArray } from "drizzle-orm";
import { getCompanyCounts } from "@/lib/company-counts";

export const dynamic = "force-dynamic";

// GET /api/superuser/admins/:id
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireSuperUser();

    const { id } = await params;

    // Prendi l'admin
    const [admin] = await db
      .select({
        id: users.id,
        email: users.email,
        name: users.name,
        companyId: users.companyId,
        companyName: companies.name,
        createdAt: users.createdAt,
      })
      .from(users)
      .innerJoin(companies, eq(users.companyId, companies.id))
      .where(eq(users.id, id))
      .limit(1);

    if (!admin) {
      return NextResponse.json({ error: "Admin non trovato" }, { status: 404 });
    }

    // Prendi tutti gli utenti (role = 'user') della stessa azienda
    const userList = await db
      .select({
        id: users.id,
        email: users.email,
        name: users.name,
        role: users.role,
        isActive: users.isActive,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(eq(users.companyId, admin.companyId))
      .orderBy(desc(users.createdAt));

    return NextResponse.json({
      ...admin,
      users: userList,
    });
  } catch (error: any) {
    if (error.message === "Unauthorized") {
      return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
    }
    console.error("Error fetching admin:", error);
    return NextResponse.json(
      { error: "Errore nel caricamento dell'admin" },
      { status: 500 }
    );
  }
}

// DELETE /api/superuser/admins/:id — elimina l'azienda dell'admin e tutti i dati collegati
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireSuperUser();

    const { id } = await params;

    // Recupera admin + azienda
    const [admin] = await db
      .select({
        id: users.id,
        email: users.email,
        companyId: users.companyId,
        companyName: companies.name,
      })
      .from(users)
      .innerJoin(companies, eq(users.companyId, companies.id))
      .where(eq(users.id, id))
      .limit(1);

    if (!admin) {
      return NextResponse.json({ error: "Admin non trovato" }, { status: 404 });
    }

    // Conteggi prima dell'eliminazione (per il log dell'operazione)
    const counts = await getCompanyCounts(admin.companyId);

    // Elimina tutti i dati collegati in ordine di dipendenza
    // (il DB non garantisce ON DELETE CASCADE su tutte le FK)
    await db.transaction(async (tx) => {
      // comunicazioni_batch: nessuna company_id → recupera gli id delle comunicazioni della company
      const comIds = await tx
        .select({ id: comunicazioni.id })
        .from(comunicazioni)
        .where(eq(comunicazioni.companyId, admin.companyId));
      const ids = comIds.map((r) => r.id);
      if (ids.length > 0) {
        await tx
          .delete(comunicazioniBatch)
          .where(inArray(comunicazioniBatch.comunicazioneId, ids));
      }

      await tx
        .delete(comunicazioni)
        .where(eq(comunicazioni.companyId, admin.companyId));
      await tx.delete(emailLog).where(eq(emailLog.companyId, admin.companyId));
      await tx.delete(notes).where(eq(notes.companyId, admin.companyId));
      await tx.delete(tasks).where(eq(tasks.companyId, admin.companyId));
      await tx
        .delete(emailTemplates)
        .where(eq(emailTemplates.companyId, admin.companyId));
      await tx
        .delete(savedAnalyses)
        .where(eq(savedAnalyses.companyId, admin.companyId));
      await tx
        .delete(imapSettings)
        .where(eq(imapSettings.companyId, admin.companyId));
      await tx
        .delete(companySettings)
        .where(eq(companySettings.companyId, admin.companyId));
      await tx
        .delete(companyRules)
        .where(eq(companyRules.companyId, admin.companyId));
      await tx.delete(cronLog).where(eq(cronLog.companyId, admin.companyId));
      await tx.delete(clients).where(eq(clients.companyId, admin.companyId));
      await tx.delete(users).where(eq(users.companyId, admin.companyId));
      await tx.delete(companies).where(eq(companies.id, admin.companyId));
    });

    // Log operazione
    console.log(
      `[SUPERUSER] Azienda eliminata: company=${admin.companyId} (${admin.companyName}) ` +
        `admin=${admin.email} counts=${JSON.stringify(counts)} ts=${new Date().toISOString()}`
    );

    return NextResponse.json({ success: true, counts });
  } catch (error: any) {
    if (error.message === "Unauthorized") {
      return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
    }
    console.error("Error deleting admin:", error);
    return NextResponse.json(
      { error: "Errore nell'eliminazione dell'azienda" },
      { status: 500 }
    );
  }
}
