import { db } from "@/lib/db";
import { clients, tasks } from "@/lib/schema";
import { eq } from "drizzle-orm";

export type ContactRequest = {
  nome: string;
  email: string;
  messaggio: string;
};

/**
 * Analizza il corpo dell'email per estrarre i dati di un nuovo contatto.
 * Atteso formato:
 *   Nuovo contatto da
 *   Nome: Mario Rossi
 *   Email: mario@example.com
 *   Messaggio: Testo del messaggio
 */
export function parseContactRequest(bodyText: string): ContactRequest | null {
  if (!bodyText.includes("Nuovo contatto da")) return null;

  const nomeMatch = bodyText.match(/Nome:\s*(.+)/i);
  const emailMatch = bodyText.match(/Email:\s*(.+)/i);
  const msgMatch = bodyText.match(/Messaggio:\s*([\s\S]*)/i);

  if (!nomeMatch || !emailMatch) return null;

  return {
    nome: nomeMatch[1].trim(),
    email: emailMatch[1].trim(),
    messaggio: msgMatch ? msgMatch[1].trim() : "",
  };
}

/**
 * Verifica se un cliente esiste già per email, altrimenti lo crea.
 * In entrambi i casi crea un task appropriato.
 * Restituisce un summary testuale delle operazioni fatte.
 */
export async function processContactRequest(data: ContactRequest): Promise<string> {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  // Cerca cliente per email
  const existing = await db
    .select()
    .from(clients)
    .where(eq(clients.email, data.email))
    .limit(1);

  if (existing.length === 0) {
    // Nuovo cliente
    const [newClient] = await db
      .insert(clients)
      .values({
        name: "",
        email: data.email,
        company: data.nome,
        notes: `Richiesta via email: ${data.messaggio}`,
        status: "lead",
      })
      .returning();

    // Task presentazione
    await db.insert(tasks).values({
      clientId: newClient.id,
      title: "Inviare email di presentazione",
      description: `Contatto ricevuto via email da ${data.nome} (${data.email}). Messaggio: ${data.messaggio}`,
      dueDate: today,
      priority: "high",
      status: "todo",
    });

    return `Nuovo cliente "${data.nome}" creato + task presentazione`;
  }

  // Cliente esistente → task qualificazione
  const client = existing[0];
  await db.insert(tasks).values({
    clientId: client.id,
    title: "Chiamata di qualificazione da email",
    description: `Nuova email di richiesta dal cliente. Messaggio: ${data.messaggio}`,
    dueDate: today,
    priority: "high",
    status: "todo",
  });

  return `Task qualificazione aggiunto per cliente esistente "${client.name}"`;
}
