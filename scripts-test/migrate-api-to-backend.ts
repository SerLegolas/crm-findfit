#!/usr/bin/env tsx
/**
 * Migra le API dal frontend Next.js al backend standalone
 * 
 * Uso: npx tsx scripts-test/migrate-api-to-backend.ts
 * 
 * Questo script:
 * 1. Legge tutte le route da app/api/
 * 2. Le converte in formato Fastify
 * 3. Le salva in backend/src/routes/
 */

import { readdirSync, readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

const API_SOURCE = join(process.cwd(), 'frontend/app/api');
const API_DEST = join(process.cwd(), 'backend/src/routes');

// Mappa dei file da migrare
const MIGRATION_MAP: Record<string, string> = {
  'auth/login/route.ts': 'auth.ts',
  'auth/me/route.ts': 'auth.ts',
  'auth/register/route.ts': 'auth.ts',
  'clients/route.ts': 'clients.ts',
  'clients/[id]/route.ts': 'clients.ts',
  'clients/export/route.ts': 'clients.ts',
  'tasks/route.ts': 'tasks.ts',
  'tasks/[id]/route.ts': 'tasks.ts',
  'note/route.ts': 'notes.ts',
  'note/[id]/route.ts': 'notes.ts',
  'users/route.ts': 'users.ts',
  'users/[id]/route.ts': 'users.ts',
  'email/send/route.ts': 'email.ts',
  'email/send-bulk/route.ts': 'email.ts',
  'email/track/[id].png/route.ts': 'email.ts',
  'email/templates/route.ts': 'templates.ts',
  'email/templates/[id]/route.ts': 'templates.ts',
  'imap-settings/route.ts': 'imap.ts',
  'imap/test/route.ts': 'imap.ts',
  'company-settings/route.ts': 'company.ts',
  'comunicazioni/route.ts': 'communications.ts',
  'comunicazioni/[id]/route.ts': 'communications.ts',
  'comunicazioni/[id]/invii/route.ts': 'communications.ts',
  'analyses/route.ts': 'analytics.ts',
  'analyses/[id]/route.ts': 'analytics.ts',
};

console.log('🚀 Migrazione API → Backend');
console.log('============================\n');

// Crea la cartella di destinazione
if (!existsSync(API_DEST)) {
  mkdirSync(API_DEST, { recursive: true });
}

let migrated = 0;
let skipped = 0;

for (const [source, dest] of Object.entries(MIGRATION_MAP)) {
  const sourcePath = join(API_SOURCE, source);
  const destPath = join(API_DEST, dest);
  
  if (!existsSync(sourcePath)) {
    console.log(`⚠️  File non trovato: ${source}`);
    skipped++;
    continue;
  }
  
  console.log(`📄 Migrando: ${source} → ${dest}`);
  
  // Leggi il file sorgente
  const content = readFileSync(sourcePath, 'utf-8');
  
  // TODO: Converti da Next.js API route a Fastify
  // Questa è una conversione base, da perfezionare
  const converted = content
    .replace(/export async function (\w+)/g, 'fastify.$1')
    .replace(/NextResponse.json/g, 'reply.send')
    .replace(/NextResponse/g, 'reply')
    .replace(/const authUser = await getAuthUser\(\);?/g, 'const authUser = request.user;')
    .replace(/return NextResponse.json\(([^,]+), \{ status: (\d+) \}\)/g, 'return reply.code($2).send($1)');
  
  // Salva il file convertito
  writeFileSync(destPath, converted, 'utf-8');
  
  console.log(`✅ Convertito: ${dest}`);
  migrated++;
}

console.log(`\n📊 Riepilogo:`);
console.log(`  ✅ Migrate: ${migrated}`);
console.log(`  ⏭️  Saltati: ${skipped}`);
console.log(`\n✨ Migrazione completata!`);
console.log(`📝 Ricordati di:`);
console.log(`  1. Verificare le conversioni manualmente`);
console.log(`  2. Aggiornare le importazioni`);
console.log(`  3. Aggiungere i tipi Zod`);
console.log(`  4. Testare le API con ./scripts-test/test-api.sh`);
