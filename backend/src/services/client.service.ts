import { and, asc, desc, eq, isNull, like, or, sql, type SQL } from "drizzle-orm";
import { db } from "../db.js";
import { clients, notes as notesTable, tasks } from "@crm/shared/db/schema";
import type { ClientStatus } from "@crm/shared/types/clients";

export type ClientRow = typeof clients.$inferSelect;

export class ClientError extends Error {
  statusCode: number;
  constructor(statusCode: number, message: string) {
    super(message);
    this.name = "ClientError";
    this.statusCode = statusCode;
  }
}

export class NotFoundError extends ClientError {
  constructor(message = "Cliente non trovato") {
    super(404, message);
  }
}

export class BadRequestError extends ClientError {
  constructor(message: string) {
    super(400, message);
  }
}

// Transizioni di stato consentite (specchio frontend/types)
const allowedTransitions: Record<ClientStatus, ClientStatus[]> = {
  lead: ["suspect", "won", "closed_lost"],
  suspect: ["lead", "won", "closed_lost"],
  won: ["lead", "suspect", "closed_lost"],
  closed_lost: ["lead", "suspect", "won"],
};

// Chiudere (-> closed_lost) da lead/suspect richiede una nota
function requiresNoteForTransition(from: ClientStatus, to: ClientStatus): boolean {
  return (from === "lead" || from === "suspect") && to === "closed_lost";
}

const sortMap: Record<string, unknown> = {
  name: clients.name,
  email: clients.email,
  company: clients.company,
  status: clients.status,
  categoria: clients.categoria,
  createdAt: clients.createdAt,
  updatedAt: clients.updatedAt,
};

// Utente non-admin: vede i propri clienti + quelli non assegnati
function roleScope(actorUserId: string | undefined, isAdmin: boolean): SQL | undefined {
  if (isAdmin || !actorUserId) return undefined;
  return or(eq(clients.userId, actorUserId), isNull(clients.userId)) as SQL;
}

function byIdWhere(id: string, companyId: string, actorUserId: string, isAdmin: boolean): SQL | undefined {
  return and(eq(clients.id, id), eq(clients.companyId, companyId), roleScope(actorUserId, isAdmin));
}

export interface ListClientsParams {
  companyId: string;
  userId?: string;
  page: number;
  limit: number;
  search?: string;
  status?: ClientStatus;
  categoria?: string;
  consent?: boolean;
  sort: string;
  order: "asc" | "desc";
}

export interface CreateClientParams {
  name: string;
  email: string;
  phone?: string | null;
  company?: string | null;
  status?: ClientStatus;
  categoria?: string | null;
  notes?: string | null;
  companyId: string;
  userId: string | null; // admin => null
}

export interface UpdateClientParams {
  id: string;
  name?: string;
  email?: string;
  phone?: string | null;
  company?: string | null;
  status?: ClientStatus;
  categoria?: string | null;
  notes?: string | null;
  noteContent?: string;
  emailConsent?: boolean;
  companyId: string;
  userId: string; // id dell'utente che agisce
  isAdmin: boolean;
}

export const ClientService = {
  async list(params: ListClientsParams) {
    const { companyId, userId, page, limit, search, status, categoria, consent, sort, order } = params;
    const conditions: (SQL | undefined)[] = [eq(clients.companyId, companyId)];

    if (search) {
      conditions.push(
        or(
          like(clients.name, `%${search}%`),
          like(clients.email, `%${search}%`),
          like(clients.company, `%${search}%`)
        ) as SQL
      );
    }
    if (status) conditions.push(eq(clients.status, status));
    if (categoria) conditions.push(like(clients.categoria, `%${categoria}%`));
    if (consent !== undefined) conditions.push(eq(clients.emailConsent, consent));
    if (userId) {
      conditions.push(or(eq(clients.userId, userId), isNull(clients.userId)) as SQL);
    }

    const where = and(...conditions);
    const column = (sortMap[sort] as typeof clients.createdAt) ?? clients.createdAt;
    const orderBy = order === "asc" ? asc(column) : desc(column);

    const data = await db.select().from(clients).where(where).orderBy(orderBy).limit(limit).offset((page - 1) * limit);
    const [totalRow] = await db.select({ count: sql<number>`count(*)` }).from(clients).where(where);

    return { data, total: Number(totalRow?.count ?? 0), page, limit };
  },

  async findById(id: string, companyId: string, userId: string, isAdmin: boolean): Promise<ClientRow | null> {
    const [row] = await db.select().from(clients).where(byIdWhere(id, companyId, userId, isAdmin)).limit(1);
    return row ?? null;
  },

  async create(params: CreateClientParams): Promise<ClientRow> {
    const [client] = await db
      .insert(clients)
      .values({
        name: params.name,
        email: params.email || null,
        phone: params.phone || null,
        company: params.company || null,
        status: params.status ?? "lead",
        categoria: params.categoria || null,
        notes: params.notes || null,
        userId: params.userId,
        companyId: params.companyId,
      })
      .returning();

    // Task automatici per i nuovi status (specchio frontend)
    if (client.status === "suspect") {
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 3);
      await db.insert(tasks).values({
        clientId: client.id,
        title: "Chiamata qualificazione",
        description: "Chiamata di qualificazione per il nuovo suspect",
        dueDate,
        priority: "high",
        companyId: params.companyId,
      });
    } else if (client.status === "won") {
      const dueContract = new Date();
      dueContract.setDate(dueContract.getDate() + 2);
      const dueOnboarding = new Date();
      dueOnboarding.setDate(dueOnboarding.getDate() + 7);
      await db.insert(tasks).values([
        {
          clientId: client.id,
          title: "Invia contratto",
          description: "Inviare il contratto al cliente",
          dueDate: dueContract,
          priority: "high",
          companyId: params.companyId,
        },
        {
          clientId: client.id,
          title: "Onboarding",
          description: "Completare l'onboarding del cliente",
          dueDate: dueOnboarding,
          priority: "medium",
          companyId: params.companyId,
        },
      ]);
    }

    return client;
  },

  async update(params: UpdateClientParams): Promise<ClientRow> {
    const current = await this.findById(params.id, params.companyId, params.userId, params.isAdmin);
    if (!current) throw new NotFoundError();

    const data = params as unknown as Record<string, unknown>;
    const statusChanged = data.status !== undefined && data.status !== current.status;

    // Validazione transizioni di stato
    if (statusChanged) {
      const from = current.status as ClientStatus;
      const to = data.status as ClientStatus;
      const allowed = allowedTransitions[from];
      if (!allowed.includes(to)) {
        throw new BadRequestError(`Transizione da "${from}" a "${to}" non consentita`);
      }
      if (requiresNoteForTransition(from, to) && !data.noteContent) {
        throw new BadRequestError("Per chiudere un cliente è necessario aggiungere una nota di motivazione");
      }
    }

    // Aggiorna solo i campi forniti
    const updateData: Record<string, unknown> = {};
    const allowedFields = ["name", "email", "phone", "company", "status", "categoria", "notes", "userId"];
    for (const field of allowedFields) {
      if (data[field] !== undefined) {
        updateData[field] = (data[field] as string | null) || null;
      }
    }
    updateData.updatedAt = new Date();

    // Consenso email: booleano gestito separatamente (evita il "|| null")
    if (data.emailConsent !== undefined) {
      updateData.emailConsent = !!data.emailConsent;
    }

    // Auto-assign: utente non-admin su un cliente senza proprietario
    if (!params.isAdmin && !current.userId) {
      updateData.userId = params.userId;
    }

    const [updated] = await db
      .update(clients)
      .set(updateData as never)
      .where(eq(clients.id, params.id))
      .returning();

    // Nota di motivazione per la chiusura
    if (statusChanged && data.noteContent) {
      await db.insert(notesTable).values({
        clientId: params.id,
        content: String(data.noteContent),
        type: "decisione",
        author: "Sistema",
        companyId: current.companyId,
      });
    }

    // Task automatici al cambio di status
    if (statusChanged && data.status === "suspect") {
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 3);
      await db.insert(tasks).values({
        clientId: params.id,
        title: "Chiamata qualificazione",
        description: "Chiamata di qualificazione per il nuovo suspect",
        dueDate,
        priority: "high",
        companyId: current.companyId,
      });
    } else if (statusChanged && data.status === "won") {
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
          companyId: current.companyId,
        },
        {
          clientId: params.id,
          title: "Onboarding",
          description: "Completare l'onboarding del cliente",
          dueDate: dueOnboarding,
          priority: "medium",
          companyId: current.companyId,
        },
      ]);
    }

    return updated;
  },

  async delete(id: string, companyId: string, userId: string, isAdmin: boolean): Promise<void> {
    const current = await this.findById(id, companyId, userId, isAdmin);
    if (!current) throw new NotFoundError();
    await db.delete(clients).where(eq(clients.id, id));
  },
};
