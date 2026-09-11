import { config } from "dotenv";
import { createClient } from "@libsql/client";
import XLSX from "xlsx";
import { randomUUID } from "node:crypto";

config({ path: ".env.local" });

// Azienda FIND FIT
const COMPANY_ID = "7583a608-5da0-403e-9f9e-202aef9e8913";
const FILE = "C:\\Users\\User\\Downloads\\contatti evo.xlsx";
const BATCH = 500;
const NOTE_TEXT = "Importato da file.";

// Default: dry-run. Con "--commit" scrive davvero sul DB.
const commit = process.argv.includes("--commit");

const c = createClient({
  url: process.env.TURSO_DB_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

// ── Helpers di pulizia ──
// Estrae il valore dopo l'ultimo "->" (formato del foglio); se dopo "->" è vuoto
// usa la parte prima; altrimenti il valore intero
const cleanField = (raw) => {
  let s = String(raw ?? "").trim();
  if (!s || s === "-") return "";
  const idx = s.lastIndexOf("->");
  if (idx !== -1) {
    const before = s.slice(0, idx).trim();
    const after = s.slice(idx + 2).trim();
    if (after && after !== "-") return after;
    if (before) return before;
  }
  return s;
};

// Email: trimmata, minuscola, rimuove caratteri non validi (es. "<" finale)
const cleanEmail = (raw) => {
  const s = String(raw ?? "").trim().toLowerCase();
  const clean = s.replace(/[^a-z0-9._%+@-]/g, "");
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(clean) ? clean : "";
};

// Telefono: prende il PRIMO numero (i fogli separano più numeri con " - ")
const cleanPhone = (raw) => {
  const s = String(raw ?? "").trim();
  if (!s || s === "-") return "";
  const m = s.match(/(\+?\d[\d\s.]{6,})/);
  if (!m) return "";
  return m[1].replace(/[^\d+]/g, "");
};

// ── Lettura del file ──
const wb = XLSX.readFile(FILE);
const prepared = [];
const sheetConfig = [
  ["PT", "PT"],
  ["Palestra", "Palestra"],
];

for (const [sheetName, categoria] of sheetConfig) {
  const ws = wb.Sheets[sheetName];
  if (!ws) {
    console.log("Foglio mancante:", sheetName);
    continue;
  }
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });
  if (rows.length === 0) continue;
  const header = rows[0].map((h) => String(h).toLowerCase());
  const iUser = header.indexOf("username");
  const iNom = header.indexOf("nominativo");
  const iRag = header.indexOf("ragionesociale");
  const iTel = header.indexOf("telefono");

  for (const r of rows.slice(1)) {
    const email = cleanEmail(r[iUser]);
    if (!email) continue;
    const name = cleanField(r[iNom]) || cleanField(r[iRag]) || email;
    const company = cleanField(r[iRag]) || null;
    const phone = cleanPhone(r[iTel]) || null;
    prepared.push({ id: randomUUID(), email, name, company, phone, categoria });
  }
}

console.log(`Righe preparate dal file: ${prepared.length}`);

// ── Controllo email già esistenti nella company ──
const existing = await c.execute({
  sql: "SELECT lower(email) AS e FROM clients WHERE company_id = ?",
  args: [COMPANY_ID],
});
const existingSet = new Set(existing.rows.map((r) => String(r.e).toLowerCase()));

let skipped = 0;
const toInsert = [];
for (const row of prepared) {
  if (existingSet.has(row.email)) {
    skipped++;
    continue;
  }
  existingSet.add(row.email); // evita duplicati anche dentro il file
  toInsert.push(row);
}

console.log(`Già esistenti (skippati): ${skipped}`);
console.log(`Da inserire: ${toInsert.length}`);

if (toInsert.length === 0) {
  console.log("Nessun cliente da inserire. Fine.");
  process.exit(0);
}

console.log("\nEsempi (primi 5):");
toInsert.slice(0, 5).forEach((r, i) => {
  console.log(
    `  ${i + 1}. name="${r.name}" | email="${r.email}" | company="${r.company ?? ""}" | phone="${r.phone ?? ""}" | cat="${r.categoria}"`
  );
});

if (!commit) {
  console.log("\n⚠ DRY-RUN: nessuna scrittura effettuata.");
  console.log('Esegui con "--commit" per importare davvero.');
  process.exit(0);
}

// ── Import ──
const now = Date.now();
let insertedClients = 0;

// Clienti in batch
for (let i = 0; i < toInsert.length; i += BATCH) {
  const chunk = toInsert.slice(i, i + BATCH);
  const stmts = chunk.map((row) => ({
    sql: `INSERT INTO clients (id, name, email, phone, company, status, categoria, notes, user_id, company_id, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, 'lead', ?, NULL, NULL, ?, ?, ?)`,
    args: [
      row.id,
      row.name,
      row.email,
      row.phone,
      row.company,
      row.categoria,
      COMPANY_ID,
      now,
      now,
    ],
  }));
  await c.batch(stmts);
  insertedClients += chunk.length;
  console.log(`Clienti inseriti: ${insertedClients}/${toInsert.length}`);
}

// Note "Importato da file." in batch (client_id = id del cliente importato)
let insertedNotes = 0;
for (let i = 0; i < toInsert.length; i += BATCH) {
  const chunk = toInsert.slice(i, i + BATCH);
  const stmts = chunk.map((row) => ({
    sql: `INSERT INTO notes (id, client_id, content, type, author, company_id, created_at, updated_at)
          VALUES (?, ?, ?, 'conversazione', 'Utente', ?, ?, ?)`,
    args: [randomUUID(), row.id, NOTE_TEXT, COMPANY_ID, now, now],
  }));
  await c.batch(stmts);
  insertedNotes += chunk.length;
  console.log(`Note inserite: ${insertedNotes}/${toInsert.length}`);
}

console.log(`\n✅ Import completato: ${insertedClients} clienti, ${insertedNotes} note (${skipped} skippati).`);
