import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { db } from "@/lib/db";
import { clients, tasks, notes, users } from "@/lib/schema";
import { eq, and, inArray, or, sql, desc } from "drizzle-orm";
import { getAuthUser } from "@/lib/auth";
import { buildClientWhere } from "@/lib/client-filters";
import { checkFeatureEnabled, FeatureDisabledError } from "@/lib/company-rules";
import type { ClientStatus } from "@/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STATUS_LABELS: Record<ClientStatus, string> = {
  lead: "Lead",
  suspect: "Suspect",
  won: "Won",
  closed_lost: "Closed Lost",
};

const formatIt = (d: Date | number | null | undefined): string => {
  if (!d) return "";
  return new Date(d).toLocaleDateString("it-IT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
};

/** GET: esporta i clienti in Excel (.xlsx) generato in memoria.
 *  Accetta gli stessi filtri di /api/clients oppure ?clientIds=id1,id2,...
 *  Nessun file system: il buffer viene restituito direttamente nella Response.
 */
export async function GET(request: NextRequest) {
  try {
    const authUser = await getAuthUser();
    if (!authUser) {
      return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
    }

    try {
      await checkFeatureEnabled(authUser.companyId, "clienti");
    } catch (e) {
      if (e instanceof FeatureDisabledError) {
        return NextResponse.json({ error: e.message }, { status: 403 });
      }
      throw e;
    }

    const { searchParams } = new URL(request.url);
    const clientIdsParam = searchParams.get("clientIds");

    let where;
    if (clientIdsParam) {
      const ids = clientIdsParam.split(",").map((s) => s.trim()).filter(Boolean);
      if (ids.length === 0) {
        return NextResponse.json({ error: "clientIds vuoto" }, { status: 400 });
      }
      const conditions: any[] = [
        eq(clients.companyId, authUser.companyId),
        inArray(clients.id, ids),
      ];
      if (authUser.role !== "admin") {
        conditions.push(
          or(eq(clients.userId, authUser.id), sql`${clients.userId} IS NULL`)
        );
      }
      where = and(...conditions);
    } else {
      where = buildClientWhere(authUser, searchParams);
    }

    const clientRows = await db
      .select()
      .from(clients)
      .where(where)
      .orderBy(desc(clients.createdAt));

    // Aggregati (solo colonne necessarie)
    const taskRows = await db
      .select({
        clientId: tasks.clientId,
        title: tasks.title,
        createdAt: tasks.createdAt,
      })
      .from(tasks)
      .where(eq(tasks.companyId, authUser.companyId));

    const noteRows = await db
      .select({
        clientId: notes.clientId,
        content: notes.content,
        createdAt: notes.createdAt,
      })
      .from(notes)
      .where(eq(notes.companyId, authUser.companyId));

    const userRows = await db
      .select({ id: users.id, name: users.name })
      .from(users)
      .where(eq(users.companyId, authUser.companyId));

    // Rielaborazione in memoria
    const taskAgg: Record<string, { count: number; lastTitle: string; lastDate: number }> = {};
    for (const t of taskRows) {
      const cur = taskAgg[t.clientId] || { count: 0, lastTitle: "", lastDate: 0 };
      cur.count++;
      const time = new Date(t.createdAt).getTime();
      if (time >= cur.lastDate) {
        cur.lastDate = time;
        cur.lastTitle = t.title;
      }
      taskAgg[t.clientId] = cur;
    }

    const noteAgg: Record<string, { count: number; lastContent: string; lastDate: number }> = {};
    for (const n of noteRows) {
      const cur = noteAgg[n.clientId] || { count: 0, lastContent: "", lastDate: 0 };
      cur.count++;
      const time = new Date(n.createdAt).getTime();
      if (time >= cur.lastDate) {
        cur.lastDate = time;
        cur.lastContent = n.content.length > 100 ? n.content.slice(0, 100) + "…" : n.content;
      }
      noteAgg[n.clientId] = cur;
    }

    const userMap: Record<string, string> = {};
    for (const u of userRows) userMap[u.id] = u.name;

    const rows = clientRows.map((c) => ({
      Nome: c.name,
      Email: c.email || "",
      Telefono: c.phone || "",
      Azienda: c.company || "",
      Status: STATUS_LABELS[c.status as ClientStatus] || c.status,
      Categoria: c.categoria || "",
      "Assegnato a": c.userId ? userMap[c.userId] || "" : "",
      "Data creazione": formatIt(c.createdAt),
      "Conteggio task": taskAgg[c.id]?.count ?? 0,
      "Conteggio note": noteAgg[c.id]?.count ?? 0,
      "Ultimo task": taskAgg[c.id]?.lastTitle ?? "",
      "Ultima nota": noteAgg[c.id]?.lastContent ?? "",
    }));

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, "Clienti");

    // Buffer generato interamente in memoria (nessun file system, adatto a Vercel)
    const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;

    const dateStr = new Date().toISOString().slice(0, 10);
    const filename = `clienti_${dateStr}.xlsx`;

    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error: any) {
    console.error("[CLIENTS-EXPORT] Errore:", error);
    return NextResponse.json(
      { error: "Errore nell'esportazione dei clienti" },
      { status: 500 }
    );
  }
}
