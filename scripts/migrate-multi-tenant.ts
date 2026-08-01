/**
 * Script di migrazione multi-tenant.
 * 
 * 1. Crea l'azienda "default" se non esiste
 * 2. Aggiorna TUTTI i record esistenti con companyId = id azienda default
 * 3. Rende NOT NULL le colonne company_id (tramite recreate delle tabelle via Drizzle push)
 * 
 * Uso: npx tsx scripts/migrate-multi-tenant.ts
 */
import { db } from "../lib/db";
import { 
  companies, users, clients, notes, tasks, 
  imapSettings, emailLog, emailTemplates, companySettings 
} from "../lib/schema";
import { eq, isNull, sql } from "drizzle-orm";

const DEFAULT_COMPANY_ID = "default-company-id";

async function main() {
  console.log("=== Migrazione Multi-Tenant ===");
  console.log("");

  // 1. Crea azienda default se non esiste
  console.log("1. Verifica/creazione azienda default...");
  const [existingCompany] = await db
    .select()
    .from(companies)
    .where(eq(companies.id, DEFAULT_COMPANY_ID))
    .limit(1);

  let companyId: string;
  if (!existingCompany) {
    const [newCompany] = await db
      .insert(companies)
      .values({
        id: DEFAULT_COMPANY_ID,
        name: "Azienda Default",
        slug: "default",
      })
      .returning();
    companyId = newCompany.id;
    console.log(`   ✓ Azienda default creata con ID: ${companyId}`);
  } else {
    companyId = existingCompany.id;
    console.log(`   ✓ Azienda default già esistente: ${companyId}`);
  }

  // 2. Aggiorna tutti i record esistenti
  console.log("");
  console.log("2. Aggiornamento record esistenti...");

  // Users
  const usersToUpdate = await db
    .select({ id: users.id })
    .from(users)
    .where(isNull(users.companyId));
  
  for (const u of usersToUpdate) {
    await db
      .update(users)
      .set({ companyId })
      .where(eq(users.id, u.id));
  }
  console.log(`   ✓ Users aggiornati: ${usersToUpdate.length}`);

  // Clients
  const clientsToUpdate = await db
    .select({ id: clients.id })
    .from(clients)
    .where(isNull(clients.companyId));
  
  for (const c of clientsToUpdate) {
    await db
      .update(clients)
      .set({ companyId })
      .where(eq(clients.id, c.id));
  }
  console.log(`   ✓ Clients aggiornati: ${clientsToUpdate.length}`);

  // Notes
  const notesToUpdate = await db
    .select({ id: notes.id })
    .from(notes)
    .where(isNull(notes.companyId));
  
  for (const n of notesToUpdate) {
    await db
      .update(notes)
      .set({ companyId })
      .where(eq(notes.id, n.id));
  }
  console.log(`   ✓ Notes aggiornati: ${notesToUpdate.length}`);

  // Tasks
  const tasksToUpdate = await db
    .select({ id: tasks.id })
    .from(tasks)
    .where(isNull(tasks.companyId));
  
  for (const t of tasksToUpdate) {
    await db
      .update(tasks)
      .set({ companyId })
      .where(eq(tasks.id, t.id));
  }
  console.log(`   ✓ Tasks aggiornati: ${tasksToUpdate.length}`);

  // ImapSettings
  const imapToUpdate = await db
    .select({ id: imapSettings.id })
    .from(imapSettings)
    .where(isNull(imapSettings.companyId));
  
  for (const i of imapToUpdate) {
    await db
      .update(imapSettings)
      .set({ companyId })
      .where(eq(imapSettings.id, i.id));
  }
  console.log(`   ✓ ImapSettings aggiornati: ${imapToUpdate.length}`);

  // EmailLog
  const emailLogToUpdate = await db
    .select({ id: emailLog.id })
    .from(emailLog)
    .where(isNull(emailLog.companyId));
  
  for (const e of emailLogToUpdate) {
    await db
      .update(emailLog)
      .set({ companyId })
      .where(eq(emailLog.id, e.id));
  }
  console.log(`   ✓ EmailLog aggiornati: ${emailLogToUpdate.length}`);

  // EmailTemplates
  const templatesToUpdate = await db
    .select({ id: emailTemplates.id })
    .from(emailTemplates)
    .where(isNull(emailTemplates.companyId));
  
  for (const t of templatesToUpdate) {
    await db
      .update(emailTemplates)
      .set({ companyId })
      .where(eq(emailTemplates.id, t.id));
  }
  console.log(`   ✓ EmailTemplates aggiornati: ${templatesToUpdate.length}`);

  // CompanySettings
  const settingsToUpdate = await db
    .select({ id: companySettings.id })
    .from(companySettings)
    .where(isNull(companySettings.companyId));
  
  for (const s of settingsToUpdate) {
    await db
      .update(companySettings)
      .set({ companyId })
      .where(eq(companySettings.id, s.id));
  }
  console.log(`   ✓ CompanySettings aggiornati: ${settingsToUpdate.length}`);

  console.log("");
  console.log("=== Migrazione completata con successo! ===");
  console.log(`   Company ID usato: ${companyId}`);
  console.log("");
  console.log("Ora esegui: npx drizzle-kit push");
  console.log("per rendere NOT NULL le colonne company_id.");
}

main().catch(console.error);
