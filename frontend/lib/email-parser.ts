import { db } from "@/lib/db";
import { clients, tasks } from "@/lib/schema";
import { eq } from "drizzle-orm";

export type ContactRequest = {
  nome: string;
  cognome: string;
  telefono: string;
  email: string;
  categoria: string;
  messaggio: string;
};

/**
 * Analizza il corpo dell'email per estrarre i dati di un nuovo contatto.
 * Atteso formato:
 *   Nuovo contatto da
 *   Nome: Mario
 *   Cognome: Rossi
 *   Telefono: 3331234567
 *   Email: mario@example.com
 *   Categoria: Privato
 *   Messaggio: Testo del messaggio
 */
export function parseContactRequest(bodyText: string): ContactRequest | null {
  if (!bodyText.includes("Nuovo contatto da")) return null;

  const nomeMatch = bodyText.match(/Nome:\s*(.+)/i);
  const cognomeMatch = bodyText.match(/Cognome:\s*(.+)/i);
  const telefonoMatch = bodyText.match(/Telefono:\s*(.+)/i);
  const emailMatch = bodyText.match(/Email:\s*(.+)/i);
  const categoriaMatch = bodyText.match(/Categoria:\s*(.+)/i);
  const msgMatch = bodyText.match(/Messaggio:\s*([\s\S]*)/i);

  if (!emailMatch || (!nomeMatch && !cognomeMatch)) return null;

  return {
    nome: nomeMatch ? nomeMatch[1].trim() : "",
    cognome: cognomeMatch ? cognomeMatch[1].trim() : "",
    telefono: telefonoMatch ? telefonoMatch[1].trim() : "",
    email: emailMatch[1].trim(),
    categoria: categoriaMatch ? categoriaMatch[1].trim() : "",
    messaggio: msgMatch ? msgMatch[1].trim() : "",
  };
}

/**
 * Verifica se un cliente esiste già per email, altrimenti lo crea.
 * In entrambi i casi crea un task appropriato.
 * Richiede companyId per associare i dati al tenant corretto.
 * Restituisce un summary testuale delle operazioni fatte.
 */
export async function processContactRequest(data: ContactRequest, companyId?: string): Promise<string> {
  const result = await processContactRequestWithCounts(data, companyId);
  return result.summary;
}

/**
 * Come processContactRequest ma restituisce anche i conteggi (clienti/task creati),
 * utile per il cron di sincronizzazione automatica delle email.
 */
export async function processContactRequestWithCounts(
  data: ContactRequest,
  companyId?: string
): Promise<{ clientsCreated: number; tasksCreated: number; summary: string }> {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  // Nome completo: "nome cognome" (con fallback se manca una parte)
  const fullName = [data.nome, data.cognome].filter(Boolean).join(" ");

  // Cerca cliente per email (email univoca a livello globale)
  const existing = await db
    .select()
    .from(clients)
    .where(eq(clients.email, data.email))
    .limit(1);

  if (existing.length === 0) {
    // Nuovo cliente
    const clientValues: any = {
      name: fullName,
      email: data.email,
      phone: data.telefono || null,
      categoria: data.categoria || null,
      company: data.nome,
      notes: `Richiesta via email: ${data.messaggio}`,
      status: "lead",
    };
    if (companyId) clientValues.companyId = companyId;

    const [newClient] = await db
      .insert(clients)
      .values(clientValues)
      .returning();

    // Task presentazione
    const taskValues: any = {
      clientId: newClient.id,
      title: "Inviare email di presentazione",
      description: `Contatto ricevuto via email da ${fullName} (${data.email}). Messaggio: ${data.messaggio}`,
      dueDate: today,
      priority: "high",
      status: "todo",
    };
    if (companyId) taskValues.companyId = companyId;

    await db.insert(tasks).values(taskValues);

    return {
      clientsCreated: 1,
      tasksCreated: 1,
      summary: `Nuovo cliente "${fullName}" creato + task presentazione`,
    };
  }

  // Cliente esistente → task qualificazione
  const client = existing[0];
  const taskValues: any = {
    clientId: client.id,
    title: "Chiamata di qualificazione da email",
    description: `Nuova email di richiesta dal cliente. Messaggio: ${data.messaggio}`,
    dueDate: today,
    priority: "high",
    status: "todo",
  };
  if (companyId) taskValues.companyId = companyId;

  await db.insert(tasks).values(taskValues);

  return {
    clientsCreated: 0,
    tasksCreated: 1,
    summary: `Task qualificazione aggiunto per cliente esistente "${client.name}"`,
  };
}
