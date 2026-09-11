import { clients } from "@/lib/schema";
import { eq, or, like, and, sql, inArray, type SQL } from "drizzle-orm";
import type { AuthUser } from "@/lib/auth";

/**
 * Costruisce la clausola WHERE per filtrare i clienti della company corrente.
 * Supporta i filtri anagrafici (search, status, categoria), i filtri sui task
 * (hasTask, taskStatus, taskPriority, taskDueDate) e i filtri sulle note
 * (hasNote, noteType, noteDateRange).
 *
 * Per gli utenti non-admin limita ai propri clienti + quelli non assegnati
 * (stessa regola della lista clienti).
 */
export function buildClientWhere(
  authUser: AuthUser,
  searchParams: URLSearchParams
): SQL | undefined {
  const companyId = authUser.companyId;
  const conditions: (SQL | undefined)[] = [eq(clients.companyId, companyId)];

  // ── Anagrafici ──
  const search = searchParams.get("search") || "";
  const status = searchParams.get("status") || "";
  // Categoria: il multiselect invia più parametri "categoria" → filtro esatto con inArray.
  // Un singolo valore (es. ricerca libera nella lista clienti) mantiene il match parziale (like).
  const categorie = searchParams
    .getAll("categoria")
    .filter((c) => c && c !== "all");

  if (search) {
    conditions.push(
      or(
        like(clients.name, `%${search}%`),
        like(clients.email, `%${search}%`),
        like(clients.company, `%${search}%`),
        like(clients.phone, `%${search}%`)
      )
    );
  }
  if (status && status !== "all") {
    conditions.push(eq(clients.status, status as any));
  }
  if (categorie.length > 1) {
    // Più categorie selezionate: corrispondenza esatta su una delle categorie
    conditions.push(inArray(clients.categoria, categorie));
  } else if (categorie.length === 1) {
    // Singola categoria (legacy): match parziale come in precedenza
    conditions.push(like(clients.categoria, `%${categorie[0]}%`));
  }

  // ── Filtro "Assegnato a" (userId) ──
  // "__none__" → clienti non assegnati (userId IS NULL); gli altri → IN (userId)
  const userIds = searchParams
    .getAll("userId")
    .filter((v) => v && v !== "all");
  if (userIds.length > 0) {
    const orUser: SQL[] = [];
    if (userIds.includes("__none__")) {
      orUser.push(sql`${clients.userId} IS NULL`);
    }
    const realIds = userIds.filter((v) => v !== "__none__");
    if (realIds.length > 0) {
      orUser.push(inArray(clients.userId, realIds));
    }
    if (orUser.length > 0) {
      conditions.push(or(...orUser));
    }
  }

  // ── Filtro Consenso email (opt-out) ──
  // "true" → solo consenzienti, "false" → solo non consenzienti
  const consent = searchParams.get("consent") || "";
  if (consent === "true") {
    conditions.push(eq(clients.emailConsent, true));
  } else if (consent === "false") {
    conditions.push(eq(clients.emailConsent, false));
  }

  // ── Filtri Task (EXISTS) ──
  const hasTask = searchParams.get("hasTask");
  const taskStatus = searchParams.get("taskStatus") || "";
  const taskPriority = searchParams.get("taskPriority") || "";
  const taskDueDate = searchParams.get("taskDueDate") || "";

  if (hasTask === "true" || hasTask === "1") {
    conditions.push(
      sql`EXISTS (SELECT 1 FROM tasks t WHERE t.client_id = ${clients.id} AND t.company_id = ${companyId})`
    );
  }
  if (taskStatus && taskStatus !== "all") {
    conditions.push(
      sql`EXISTS (SELECT 1 FROM tasks t WHERE t.client_id = ${clients.id} AND t.company_id = ${companyId} AND t.status = ${taskStatus})`
    );
  }
  if (taskPriority && taskPriority !== "all") {
    conditions.push(
      sql`EXISTS (SELECT 1 FROM tasks t WHERE t.client_id = ${clients.id} AND t.company_id = ${companyId} AND t.priority = ${taskPriority})`
    );
  }
  if (taskDueDate) {
    const now = new Date();
    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);
    const endOfToday = new Date(now);
    endOfToday.setHours(23, 59, 59, 999);

    let dueCond: SQL | undefined;
    if (taskDueDate === "overdue") {
      dueCond = sql`t.due_date < ${startOfToday}`;
    } else if (taskDueDate === "today") {
      dueCond = sql`t.due_date >= ${startOfToday} AND t.due_date <= ${endOfToday}`;
    } else if (taskDueDate === "upcoming") {
      dueCond = sql`t.due_date >= ${endOfToday}`;
    } else if (/^\d{4}-\d{2}-\d{2}$/.test(taskDueDate)) {
      const start = new Date(`${taskDueDate}T00:00:00`);
      const end = new Date(`${taskDueDate}T23:59:59.999`);
      dueCond = sql`t.due_date >= ${start} AND t.due_date <= ${end}`;
    }

    if (dueCond) {
      conditions.push(
        sql`EXISTS (SELECT 1 FROM tasks t WHERE t.client_id = ${clients.id} AND t.company_id = ${companyId} AND ${dueCond})`
      );
    }
  }

  // ── Filtri Note (EXISTS) ──
  const hasNote = searchParams.get("hasNote");
  const noteType = searchParams.get("noteType") || "";
  const noteDateRange = searchParams.get("noteDateRange") || "";

  if (hasNote === "true" || hasNote === "1") {
    conditions.push(
      sql`EXISTS (SELECT 1 FROM notes n WHERE n.client_id = ${clients.id} AND n.company_id = ${companyId})`
    );
  }
  if (noteType && noteType !== "all") {
    conditions.push(
      sql`EXISTS (SELECT 1 FROM notes n WHERE n.client_id = ${clients.id} AND n.company_id = ${companyId} AND n.type = ${noteType})`
    );
  }
  if (noteDateRange) {
    const [fromStr, toStr] = noteDateRange.split(",");
    let dateCond: SQL | undefined;
    if (fromStr && toStr) {
      dateCond = sql`n.created_at >= ${new Date(`${fromStr}T00:00:00`)} AND n.created_at <= ${new Date(`${toStr}T23:59:59.999`)}`;
    } else if (fromStr) {
      dateCond = sql`n.created_at >= ${new Date(`${fromStr}T00:00:00`)}`;
    } else if (toStr) {
      dateCond = sql`n.created_at <= ${new Date(`${toStr}T23:59:59.999`)}`;
    }
    if (dateCond) {
      conditions.push(
        sql`EXISTS (SELECT 1 FROM notes n WHERE n.client_id = ${clients.id} AND n.company_id = ${companyId} AND ${dateCond})`
      );
    }
  }

  // ── Scoping per ruolo ──
  // Utente "user": vede i non assegnati + i propri (stessa regola della lista)
  if (authUser.role !== "admin") {
    conditions.push(
      or(eq(clients.userId, authUser.id), sql`${clients.userId} IS NULL`)
    );
  }

  return and(...conditions);
}
