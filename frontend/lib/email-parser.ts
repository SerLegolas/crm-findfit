import { db } from "@/lib/db";
import {
  autoReplyRules,
  clients,
  companySettings,
  emailLog,
  emailTemplates,
  imapSettings,
  notes,
  tasks,
  type Client,
} from "@/lib/schema";
import { eq, and } from "drizzle-orm";
import { randomUUID } from "crypto";
import nodemailer from "nodemailer";
import { decrypt } from "@/lib/crypto";
import { trackingPixelUrl } from "@/lib/tracking";
import { optOutBlock } from "@/lib/opt-out";

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
 * Invia una risposta automatica a un nuovo cliente in base alla regola
 * configurata per la sua categoria.
 *
 * Ritorna `null` se non c'è nessuna regola attiva per la categoria o se
 * la configurazione SMTP non è disponibile (nessun invio).
 * Se l'invio SMTP fallisce la riga in email_log viene comunque salvata
 * con status "failed" e il risultato ha `sent: false`.
 */
export async function sendAutoReply(
  client: Client,
  companyId?: string
): Promise<{
  sent: boolean;
  templateName: string;
  followUpDays: number;
  followUpTaskTitle: string;
} | null> {
  const cid = companyId || client.companyId;
  if (!cid || !client.categoria || !client.email) return null;

  // Regola attiva per la categoria del cliente (stessa company)
  const [rule] = await db
    .select()
    .from(autoReplyRules)
    .where(
      and(
        eq(autoReplyRules.companyId, cid),
        eq(autoReplyRules.categoria, client.categoria),
        eq(autoReplyRules.enabled, true)
      )
    )
    .limit(1);

  if (!rule) return null;

  // Template della stessa company
  const [template] = await db
    .select()
    .from(emailTemplates)
    .where(
      and(
        eq(emailTemplates.id, rule.templateId),
        eq(emailTemplates.companyId, cid)
      )
    )
    .limit(1);

  if (!template) {
    console.error(
      `[email-parser] Template ${rule.templateId} non trovato per la company ${cid}`
    );
    return null;
  }

  // Configurazione SMTP (imap_settings della company)
  const [settings] = await db
    .select()
    .from(imapSettings)
    .where(eq(imapSettings.companyId, cid))
    .limit(1);

  if (
    !settings ||
    !settings.imapHost ||
    !settings.imapPort ||
    !settings.user ||
    !settings.password
  ) {
    console.error(
      `[email-parser] Configurazione SMTP mancante per la company ${cid}: impossibile inviare la risposta automatica`
    );
    return null;
  }

  const [companyRow] = await db
    .select()
    .from(companySettings)
    .where(eq(companySettings.companyId, cid))
    .limit(1);

  const today = new Date().toLocaleDateString("it-IT", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const replaceTags = (text: string) =>
    text
      .replace(/@name/g, client.name || "")
      .replace(/@company/g, client.company || "")
      .replace(/@data/g, today);

  const subject = replaceTags(template.subject);
  let html = replaceTags(template.bodyHtml);

  // Link opt-out + pixel di tracking
  html += optOutBlock(client.id);
  const trackingId = randomUUID();
  html += `<img src="${trackingPixelUrl(trackingId)}" alt="" width="1" height="1" style="display:none" />`;

  // Footer dati azienda (se attivo)
  if (companyRow?.footerAttivo && companyRow.denominazione) {
    const parts = [
      companyRow.denominazione,
      [companyRow.indirizzo, companyRow.città, companyRow.provincia]
        .filter(Boolean)
        .join(", ") + (companyRow.cap ? ` ${companyRow.cap}` : ""),
      `Tel: ${companyRow.telefono} - Email: ${companyRow.email}`,
      `P.IVA: ${companyRow.piva} - C.F.: ${companyRow.cf}`,
    ].filter(Boolean);

    if (parts.length > 0) {
      html += `
<hr />
<div style="text-align:center;font-size:12px;color:#888;">
${parts.join("<br />")}
</div>`;
    }
  }

  const smtpHost = settings.smtpHost
    ? decrypt(settings.smtpHost)
    : decrypt(settings.imapHost);
  const smtpPort = parseInt(
    settings.smtpPort ? decrypt(settings.smtpPort) : decrypt(settings.imapPort),
    10
  );
  const smtpSecure = settings.smtpSecure ?? smtpPort === 465;
  const sender = decrypt(settings.user);

  const transporter = nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpSecure,
    auth: {
      user: sender,
      pass: decrypt(settings.password),
    },
  });

  let sent = false;
  try {
    await transporter.sendMail({
      from: companyRow?.denominazione
        ? `"${companyRow.denominazione}" <${sender}>`
        : sender,
      to: client.email,
      subject,
      html,
    });
    sent = true;
  } catch (sendErr) {
    console.error("[email-parser] Errore invio risposta automatica:", sendErr);
  }

  // Traccia l'invio (anche in caso di errore)
  await db.insert(emailLog).values({
    clientId: client.id,
    subject,
    body: html,
    sender,
    author: "Sistema (auto-reply)",
    status: sent ? "sent" : "failed",
    sentAt: new Date(),
    trackingId,
    companyId: cid,
    ...(sent ? { deliveredAt: new Date() } : {}),
  });

  return {
    sent,
    templateName: template.name,
    followUpDays: rule.followUpDays,
    followUpTaskTitle: rule.followUpTaskTitle,
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
    .where(
      companyId
        ? and(eq(clients.email, data.email), eq(clients.companyId, companyId))
        : eq(clients.email, data.email)
    )
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

    // Risposta automatica (solo se il cliente ha dato il consenso email)
    const effectiveCompanyId = companyId || newClient.companyId;
    let autoReply: Awaited<ReturnType<typeof sendAutoReply>> = null;
    if (newClient.emailConsent !== false) {
      try {
        autoReply = await sendAutoReply(newClient, effectiveCompanyId);
      } catch (autoReplyErr) {
        console.error(
          "[email-parser] Errore durante la risposta automatica:",
          autoReplyErr
        );
        autoReply = null;
      }
    }

    if (autoReply?.sent) {
      // Nota: email di risposta automatica inviata
      await db.insert(notes).values({
        clientId: newClient.id,
        content: `Inviata email in data: ${now.toLocaleString("it-IT", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        })}`,
        type: "promemoria",
        author: "Sistema",
        companyId: effectiveCompanyId,
      });

      // Task di ricontatto (al posto del task "email di presentazione")
      const followUpDate = new Date(today);
      followUpDate.setDate(
        followUpDate.getDate() + (autoReply.followUpDays ?? 1)
      );

      await db.insert(tasks).values({
        clientId: newClient.id,
        title: autoReply.followUpTaskTitle,
        description: `Risposta automatica inviata (template "${autoReply.templateName}") a ${fullName} (${data.email}). Messaggio: ${data.messaggio}`,
        dueDate: followUpDate,
        priority: "medium",
        status: "todo",
        companyId: effectiveCompanyId,
      });

      return {
        clientsCreated: 1,
        tasksCreated: 1,
        summary: `Nuovo cliente "${fullName}" creato + risposta automatica "${autoReply.templateName}" + task ricontatto`,
      };
    }

    // Nessuna regola attiva o invio fallito → task presentazione
    const taskValues: any = {
      clientId: newClient.id,
      title: "Inviare email di presentazione",
      description: `Contatto ricevuto via email da ${fullName} (${data.email}). Messaggio: ${data.messaggio}`,
      dueDate: today,
      priority: "high",
      status: "todo",
    };
    if (effectiveCompanyId) taskValues.companyId = effectiveCompanyId;

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
