#!/usr/bin/env node
/**
 * Menu Sync — CRM FindFit
 *
 * Analizza e sincronizza i permessi menu tra:
 *  1. components/sidebar.tsx                      (voci menu)
 *  2. .github/menu-config.md                     (configurazione canonica)
 *  3. app/api/auth/register/route.ts             (features / featuresAdmin, default nuovi account)
 *  4. app/superuser/admin/[id]/page.tsx          (checkbox superuser)
 *  5. DB company_rules                           (stato per tutte le aziende)
 *
 * Comandi:
 *   node scripts/menu-sync.mjs analyze   → solo analisi, nessuna modifica
 *   node scripts/menu-sync.mjs status    → stato attuale dei permessi
 *   node scripts/menu-sync.mjs sync      → analisi + conferme + applica modifiche
 *
 * Npm scripts equivalenti: menu:analyze, menu:status, menu:sync
 */
import { readFileSync, writeFileSync, existsSync, readdirSync } from "node:fs";
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { createClient } from "@libsql/client";

const __dirname = dirname(fileURLToPath(import.meta.url));
// In questo monorepo lo script vive in frontend/scripts
const APP_ROOT = join(__dirname, ".."); // root del workspace frontend (Next app)
const REPO_ROOT = join(APP_ROOT, ".."); // root del monorepo

const SIDEBAR = join(APP_ROOT, "components", "sidebar.tsx");
const MENU_CONFIG = join(REPO_ROOT, ".github", "menu-config.md");
const REGISTER = join(APP_ROOT, "app", "api", "auth", "register", "route.ts");
const SUPERUSER_PAGE = join(APP_ROOT, "app", "superuser", "admin", "[id]", "page.tsx");
const MIGRATIONS_DIR = join(APP_ROOT, "drizzle");

const command = process.argv[2] || "analyze";

// ─────────────────────────────────────────────
// Ambiente (carica .env.local come gli altri script)
// ─────────────────────────────────────────────
function loadEnv() {
  const envPath = join(APP_ROOT, ".env.local");
  if (!existsSync(envPath)) return;
  const content = readFileSync(envPath, "utf8");
  for (const line of content.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (m) {
      process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  }
}

// ─────────────────────────────────────────────
// Util / parsing generico
// ─────────────────────────────────────────────
function findMatchingClose(src, openIdx) {
  const open = src[openIdx];
  const close = open === "{" ? "}" : "]";
  let depth = 0;
  for (let i = openIdx; i < src.length; i++) {
    if (src[i] === open) depth++;
    else if (src[i] === close) {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

// Estrae un blocco "{ ... }" a partire da un marker (es. "features: {")
function extractBraceBlock(src, marker) {
  const start = src.indexOf(marker);
  if (start < 0) return null;
  const openIdx = src.indexOf("{", start);
  if (openIdx < 0) return null;
  const closeIdx = findMatchingClose(src, openIdx);
  if (closeIdx < 0) return null;
  return {
    start,
    openIdx,
    closeIdx,
    innerStart: openIdx + 1,
    innerEnd: closeIdx,
    block: src.slice(openIdx + 1, closeIdx),
  };
}

// Estrae un array "[ ... ]" a partire dal marker (es. "const FEATURE_OPTIONS = [")
function extractArrayBlock(src, marker) {
  const start = src.indexOf(marker);
  if (start < 0) return null;
  const openIdx = src.indexOf("[", start);
  if (openIdx < 0) return null;
  const closeIdx = findMatchingClose(src, openIdx);
  if (closeIdx < 0) return null;
  return {
    start,
    openIdx,
    closeIdx,
    innerStart: openIdx + 1,
    innerEnd: closeIdx,
    block: src.slice(openIdx + 1, closeIdx),
  };
}

// ─────────────────────────────────────────────
// Lettura sorgenti
// ─────────────────────────────────────────────

/** Sidebar: chiavi nav (navFeatureMap) e admin (adminLinkFeature) + etichette navItems */
function readSidebar() {
  const src = readFileSync(SIDEBAR, "utf8");
  const navKeys = new Set();
  const navMatch = src.match(/const navFeatureMap: Record<string, string> = \{([\s\S]*?)\};/);
  if (navMatch) {
    for (const [, , key] of navMatch[1].matchAll(/"([^"]+)":\s*"([^"]+)"/g)) navKeys.add(key);
  }
  const adminKeys = new Set();
  const adminMatch = src.match(/const adminLinkFeature: Record<string, string> = \{([\s\S]*?)\};/);
  if (adminMatch) {
    for (const [, , key] of adminMatch[1].matchAll(/"([^"]+)":\s*"([^"]+)"/g)) adminKeys.add(key);
  }
  // Etichette dai navItems: { href: "/x", label: "Y" }
  const labels = {};
  const itemsMatch = src.match(/const navItems = \[([\s\S]*?)\];/);
  if (itemsMatch) {
    for (const [, href, label] of itemsMatch[1].matchAll(/href: "([^"]+)", label: "([^"]+)"/g)) {
      labels[href] = label;
    }
  }
  // Map chiave nav → etichetta della voce (per mostrare etichette leggibili)
  const navHref = {};
  const navKeyLabels = {};
  if (navMatch) {
    for (const [, href, key] of navMatch[1].matchAll(/"([^"]+)":\s*"([^"]+)"/g)) {
      navHref[key] = href;
      navKeyLabels[key] = labels[href] || key;
    }
  }
  return { navKeys, adminKeys, labels, navHref, navKeyLabels };
}

/** Register: features e featuresAdmin come Map(key → value) */
function readRegister() {
  const src = readFileSync(REGISTER, "utf8");
  const parseBlock = (marker) => {
    const b = extractBraceBlock(src, marker);
    if (!b) return new Map();
    const map = new Map();
    for (const [, key, val] of b.block.matchAll(/\b([A-Za-z0-9_]+):\s*(true|false)\b/g)) {
      map.set(key, val === "true");
    }
    return map;
  };
  return { features: parseBlock("features: {"), featuresAdmin: parseBlock("featuresAdmin: {") };
}

/** Superuser page: FEATURE_OPTIONS e ADMIN_FEATURE_OPTIONS (key → label) */
function readSuperuser() {
  const src = readFileSync(SUPERUSER_PAGE, "utf8");
  const parseArray = (marker) => {
    const a = extractArrayBlock(src, marker);
    if (!a) return new Map();
    const map = new Map();
    for (const [, key, label] of a.block.matchAll(/key: "([^"]+)", label: "([^"]+)"/g)) {
      map.set(key, label);
    }
    return map;
  };
  return {
    features: parseArray("const FEATURE_OPTIONS = ["),
    featuresAdmin: parseArray("const ADMIN_FEATURE_OPTIONS = ["),
  };
}

/** menu-config.md: sezioni "## Moduli (features)" e "## Moduli Admin (featuresAdmin)" */
function readMenuConfig() {
  const out = { features: new Map(), featuresAdmin: new Map() };
  if (!existsSync(MENU_CONFIG)) return out;
  const lines = readFileSync(MENU_CONFIG, "utf8").split(/\r?\n/);
  let section = null;
  for (const line of lines) {
    if (/^## Moduli \(features\)/.test(line)) section = "features";
    else if (/^## Moduli Admin \(featuresAdmin\)/.test(line)) section = "featuresAdmin";
    else if (/^##\s/.test(line)) section = null;
    else if (section) {
      const m = line.match(/^\s*-\s*([A-Za-z0-9_]+)\s*:\s*(.*)$/);
      if (m) out[section].set(m[1], m[2].trim());
    }
  }
  return out;
}

/** DB: company_rules per tutte le aziende (features / features_admin JSON) */
async function readDbRules() {
  loadEnv();
  if (!process.env.TURSO_DB_URL) return null;
  const c = createClient({
    url: process.env.TURSO_DB_URL,
    authToken: process.env.TURSO_AUTH_TOKEN,
  });
  const r = await c.execute(
    "SELECT company_id, features, features_admin FROM company_rules ORDER BY company_id"
  );
  return r.rows.map((row) => ({
    companyId: String(row.company_id),
    features: safeJson(row.features),
    featuresAdmin: safeJson(row.features_admin),
  }));
}

function safeJson(v) {
  if (!v) return {};
  if (typeof v === "object") return v;
  try {
    return JSON.parse(v);
  } catch {
    return {};
  }
}

// ─────────────────────────────────────────────
// Logica di confronto
// ─────────────────────────────────────────────
function buildCanonical(register, superuser, config, sidebar) {
  const allKeys = (m) => [...m.keys()];
  const featureKeys = [
    ...new Set([
      ...allKeys(register.features),
      ...allKeys(superuser.features),
      ...allKeys(config.features),
    ]),
  ];
  const adminKeys = [
    ...new Set([
      ...allKeys(register.featuresAdmin),
      ...allKeys(superuser.featuresAdmin),
      ...allKeys(config.featuresAdmin),
    ]),
  ];

  // Etichette leggibili: superuser page > sidebar (features) > chiave
  const features = new Map();
  for (const k of featureKeys) {
    features.set(k, superuser.features.get(k) || sidebar.navKeyLabels[k] || k);
  }
  const featuresAdmin = new Map();
  for (const k of adminKeys) {
    featuresAdmin.set(k, superuser.featuresAdmin.get(k) || k);
  }

  // Default booleani: da register se presente, altrimenti true (features) / false (featuresAdmin)
  const featureDefaults = new Map();
  for (const k of featureKeys) {
    featureDefaults.set(k, register.features.has(k) ? register.features.get(k) : true);
  }
  const adminDefaults = new Map();
  for (const k of adminKeys) {
    adminDefaults.set(k, register.featuresAdmin.has(k) ? register.featuresAdmin.get(k) : false);
  }

  return {
    features,
    featuresAdmin,
    featureDefaults,
    adminDefaults,
    sidebarNavKeys: sidebar.navKeys,
    sidebarAdminKeys: sidebar.adminKeys,
  };
}

function missingKeys(canonical, source, sourceName) {
  return [...canonical.keys()].filter((k) => !source.has(k));
}

function computeDiff(canonical, register, superuser, config, dbRules, sidebar) {
  const diff = {
    registerMissingFeatures: missingKeys(canonical.features, register.features),
    registerMissingAdmin: missingKeys(canonical.featuresAdmin, register.featuresAdmin),
    superuserMissingFeatures: missingKeys(canonical.features, superuser.features),
    superuserMissingAdmin: missingKeys(canonical.featuresAdmin, superuser.featuresAdmin),
    configMissingFeatures: missingKeys(canonical.features, config.features),
    configMissingAdmin: missingKeys(canonical.featuresAdmin, config.featuresAdmin),
    sidebarMissingFeatures: [...canonical.features.keys()].filter((k) => !sidebar.navKeys.has(k) && !["dashboard", "email"].includes(k)),
    sidebarMissingAdmin: missingKeys(canonical.featuresAdmin, sidebar.adminKeys),
    // Extra: chiavi presenti in register ma assenti dalla config canonica
    extraInRegisterFeatures: [...register.features.keys()].filter((k) => !config.features.has(k)),
    extraInRegisterAdmin: [...register.featuresAdmin.keys()].filter((k) => !config.featuresAdmin.has(k)),
  };

  // Diff DB per azienda
  diff.db = [];
  if (dbRules) {
    for (const company of dbRules) {
      const missingF = [...canonical.features.keys()].filter((k) => !(k in company.features));
      const missingA = [...canonical.featuresAdmin.keys()].filter((k) => !(k in company.featuresAdmin));
      const extraF = Object.keys(company.features).filter((k) => !canonical.features.has(k));
      const extraA = Object.keys(company.featuresAdmin).filter((k) => !canonical.featuresAdmin.has(k));
      if (missingF.length || missingA.length || extraF.length || extraA.length) {
        diff.db.push({ companyId: company.companyId, missingF, missingA, extraF, extraA });
      }
    }
  }
  return diff;
}

// ─────────────────────────────────────────────
// Stampa report
// ─────────────────────────────────────────────
function printSection(title) {
  console.log(`\n${title}`);
}
function printList(items, note) {
  if (items.length === 0) {
    console.log("  ✅ Nessun elemento");
    return;
  }
  for (const i of items) console.log(`  - ${i}${note ? ` → ${note}` : ""}`);
}

function printReport(diff, canonical, dbRules, showDb) {
  console.log("📊 ANALISI PERMESSI MENU");
  console.log("🔍 CONFRONTO COMPLETO:");

  printSection("[MANCANTI IN REGISTER]");
  printList(diff.registerMissingFeatures.map((k) => `${k} → DA AGGIUNGERE a features in register/route.ts`));
  printList(diff.registerMissingAdmin.map((k) => `${k} → DA AGGIUNGERE a featuresAdmin in register/route.ts`));

  printSection("[MANCANTI IN SUPERUSER PAGE]");
  printList(diff.superuserMissingFeatures.map((k) => `${k} → DA AGGIUNGERE a features checkbox`));
  printList(diff.superuserMissingAdmin.map((k) => `${k} → DA AGGIUNGERE a featuresAdmin checkbox`));

  if (showDb && dbRules) {
    printSection("[MANCANTI IN DB (aziende esistenti)]");
    if (diff.db.length === 0) {
      console.log("  ✅ Tutte le aziende sono allineate");
    } else {
      const agg = {};
      for (const d of diff.db) {
        for (const k of [...d.missingF, ...d.missingA]) agg[k] = (agg[k] || 0) + 1;
      }
      for (const [k, count] of Object.entries(agg).sort()) {
        console.log(`  - ${k} → MANCANTE in ${count} aziende`);
      }
    }
  }

  printSection("[EXTRA IN REGISTER (non in menu-config)]");
  printList(
    [...diff.extraInRegisterFeatures, ...diff.extraInRegisterAdmin].map(
      (k) => `${k} → NON ESISTE più in sidebar, da RIMUOVERE`
    )
  );

  printSection("[MENU-CONFIG vs SORGENTI]");
  printList(diff.configMissingFeatures.map((k) => `${k} → DA AGGIUNGERE a menu-config (features)`));
  printList(diff.configMissingAdmin.map((k) => `${k} → DA AGGIUNGERE a menu-config (featuresAdmin)`));
  printList(diff.sidebarMissingFeatures.map((k) => `${k} → presente in config ma senza voce sidebar (info)`));
  printList(diff.sidebarMissingAdmin.map((k) => `${k} → presente in config ma senza link admin (info)`));
}

// ─────────────────────────────────────────────
// Applicazione modifiche
// ─────────────────────────────────────────────

/** Aggiunge/rimuove chiavi nel blocco "key: bool" di register/route.ts */
function editRegisterBlock(src, marker, toAdd, toRemove) {
  const b = extractBraceBlock(src, marker);
  if (!b) return src;
  const lines = b.block.split("\n");
  const entries = new Map();
  let indent = "          ";
  for (const line of lines) {
    const m = line.match(/^\s*([A-Za-z0-9_]+):\s*(true|false)\s*,?\s*$/);
    if (m) {
      if (!entries.has(m[1])) indent = line.slice(0, line.search(/\S/)) || indent;
      entries.set(m[1], m[2] === "true");
    }
  }
  for (const [k, v] of toAdd) if (!entries.has(k)) entries.set(k, v);
  for (const k of toRemove) entries.delete(k);

  const rebuilt =
    "\n" +
    [...entries.entries()].map(([k, v]) => `${indent}${k}: ${v},`).join("\n") +
    "\n        ";
  return src.slice(0, b.innerStart) + rebuilt + src.slice(b.innerEnd);
}

/** Aggiunge voci a FEATURE_OPTIONS / ADMIN_FEATURE_OPTIONS della superuser page */
function editSuperuserArray(src, marker, toAdd) {
  const a = extractArrayBlock(src, marker);
  if (!a) return src;
  const lines = a.block.split("\n");
  const entries = new Map();
  let indent = "    ";
  for (const line of lines) {
    const m = line.match(/key: "([^"]+)", label: "([^"]+)"/);
    if (m) {
      if (!entries.has(m[1])) indent = line.slice(0, line.search(/\S/)) || indent;
      entries.set(m[1], m[2]);
    }
  }
  for (const [k, label] of toAdd) if (!entries.has(k)) entries.set(k, label);

  const rebuilt =
    "\n" +
    [...entries.entries()].map(([k, l]) => `${indent}{ key: "${k}", label: "${l}" },`).join("\n") +
    "\n  ";
  return src.slice(0, a.innerStart) + rebuilt + src.slice(a.innerEnd);
}

/** Riscrive menu-config.md partendo dalla lista canonica */
function writeMenuConfig(canonical) {
  const lines = [];
  lines.push("# Configurazione Menu — CRM FindFit");
  lines.push("");
  lines.push("Fonte di verità per i permessi menu del CRM. Mantenuta sincronizzata con:");
  lines.push("- `components/sidebar.tsx` (voci menu mostrate)");
  lines.push("- `app/api/auth/register/route.ts` (default per i nuovi account: `features` e `featuresAdmin`)");
  lines.push("- `app/superuser/admin/[id]/page.tsx` (checkbox per il superuser)");
  lines.push("- DB `company_rules` (stato effettivo per ogni azienda)");
  lines.push("");
  lines.push("> Gestione tramite `npm run menu:analyze` (analisi), `npm run menu:sync` (sincronizza) e `npm run menu:status` (stato attuale).");
  lines.push("");
  lines.push("## Moduli (features)");
  lines.push("");
  lines.push("Moduli attivabili per azienda (modello opt-in: visibili solo se `true`).");
  lines.push("");
  for (const [k, l] of canonical.features) lines.push(`- ${k}: ${l}`);
  lines.push("");
  lines.push("## Moduli Admin (featuresAdmin)");
  lines.push("");
  lines.push("Funzionalità admin opzionali per azienda (modello opt-in).");
  lines.push("");
  for (const [k, l] of canonical.featuresAdmin) lines.push(`- ${k}: ${l}`);
  lines.push("");
  writeFileSync(MENU_CONFIG, lines.join("\n"), "utf8");
}

/** Aggiorna company_rules nel DB: aggiunge SOLO le chiavi confermate (mantiene le altre) */
async function applyDbSync(dbRules, canonical, changedCompanies, confirmedKeys) {
  loadEnv();
  const c = createClient({
    url: process.env.TURSO_DB_URL,
    authToken: process.env.TURSO_AUTH_TOKEN,
  });
  const now = Date.now();
  const canonF = Object.fromEntries(canonical.featureDefaults);
  const canonA = Object.fromEntries(canonical.adminDefaults);
  for (const company of dbRules) {
    if (!changedCompanies.has(company.companyId)) continue;
    const features = { ...company.features };
    const featuresAdmin = { ...company.featuresAdmin };
    for (const k of confirmedKeys) {
      if (canonF[k] !== undefined) features[k] = canonF[k];
      if (canonA[k] !== undefined) featuresAdmin[k] = canonA[k];
    }
    await c.execute({
      sql: "UPDATE company_rules SET features = ?, features_admin = ?, updated_at = ? WHERE company_id = ?",
      args: [JSON.stringify(features), JSON.stringify(featuresAdmin), now, company.companyId],
    });
  }
}

/** Genera la migrazione Drizzle (data migration) con le UPDATE per le aziende aggiornate */
function writeMigration(dbRules, canonical, changedCompanies, confirmedKeys) {
  if (changedCompanies.size === 0 || confirmedKeys.size === 0) return null;
  const files = readdirSync(MIGRATIONS_DIR).filter((f) => /^\d{4}_/.test(f));
  const nextIdx = files.length
    ? Math.max(...files.map((f) => parseInt(f.slice(0, 4), 10))) + 1
    : 0;
  const name = `${String(nextIdx).padStart(4, "0")}_sync_menus`;
  const filePath = join(MIGRATIONS_DIR, `${name}.sql`);
  const canonF = Object.fromEntries(canonical.featureDefaults);
  const canonA = Object.fromEntries(canonical.adminDefaults);
  const stmts = [];
  stmts.push(`-- Sincronizzazione menu CRM FindFit (generata da scripts/menu-sync.mjs)`);
  stmts.push(`-- Data migration: allinea company_rules alle chiavi canoniche di .github/menu-config.md`);
  stmts.push(`-- NOTA: se hai eseguito "npm run menu:sync" le aziende indicate sono GIÀ aggiornate nel DB.`);
  stmts.push(`-- Questo file è il record riproducibile per gli altri ambienti.`);
  stmts.push(``);
  for (const company of dbRules) {
    if (!changedCompanies.has(company.companyId)) continue;
    const features = { ...company.features };
    const featuresAdmin = { ...company.featuresAdmin };
    for (const k of confirmedKeys) {
      if (canonF[k] !== undefined) features[k] = canonF[k];
      if (canonA[k] !== undefined) featuresAdmin[k] = canonA[k];
    }
    const esc = (s) => s.replace(/'/g, "''");
    stmts.push(
      `UPDATE company_rules SET features = '${esc(JSON.stringify(features))}', ` +
        `features_admin = '${esc(JSON.stringify(featuresAdmin))}', updated_at = strftime('%s','now')*1000 ` +
        `WHERE company_id = '${esc(company.companyId)}';`
    );
  }
  stmts.push(``);
  writeFileSync(filePath, stmts.join("\n"), "utf8");
  return `${name}.sql`;
}

// ─────────────────────────────────────────────
// Prompt conferme
// ─────────────────────────────────────────────
async function confirm(rl, question) {
  const answer = await rl.question(`${question} [S/n]: `);
  return !/^n/i.test(answer.trim());
}

// ─────────────────────────────────────────────
// Comando: status
// ─────────────────────────────────────────────
async function runStatus() {
  const sidebar = readSidebar();
  const register = readRegister();
  const superuser = readSuperuser();
  const config = readMenuConfig();
  let dbRules = null;
  try {
    dbRules = await readDbRules();
  } catch (e) {
    console.error("DB non raggiungibile:", e.message);
  }

  const canonical = buildCanonical(register, superuser, config, sidebar);
  console.log("📊 STATO PERMESSI MENU");
  console.log(`\n[Moduli (features)] — ${canonical.features.size} totali`);
  for (const [k, l] of canonical.features) {
    const inRegister = register.features.has(k);
    const inSuper = superuser.features.has(k);
    const inConfig = config.features.has(k);
    console.log(`  - ${k}${l && l !== k ? ` (${l})` : ""}  register:${inRegister ? "✅" : "❌"} superuser:${inSuper ? "✅" : "❌"} config:${inConfig ? "✅" : "❌"}`);
  }
  console.log(`\n[Moduli Admin (featuresAdmin)] — ${canonical.featuresAdmin.size} totali`);
  for (const [k, l] of canonical.featuresAdmin) {
    const inRegister = register.featuresAdmin.has(k);
    const inSuper = superuser.featuresAdmin.has(k);
    const inConfig = config.featuresAdmin.has(k);
    console.log(`  - ${k}${l && l !== k ? ` (${l})` : ""}  register:${inRegister ? "✅" : "❌"} superuser:${inSuper ? "✅" : "❌"} config:${inConfig ? "✅" : "❌"}`);
  }

  if (dbRules) {
    console.log(`\n[DB company_rules] — ${dbRules.length} aziende`);
    const diff = computeDiff(canonical, register, superuser, config, dbRules, sidebar);
    if (diff.db.length === 0) {
      console.log("  ✅ Tutte le aziende allineate");
    } else {
      for (const d of diff.db) {
        const parts = [];
        if (d.missingF.length) parts.push(`mancano features: ${d.missingF.join(", ")}`);
        if (d.missingA.length) parts.push(`mancano admin: ${d.missingA.join(", ")}`);
        if (d.extraF.length) parts.push(`extra features: ${d.extraF.join(", ")}`);
        if (d.extraA.length) parts.push(`extra admin: ${d.extraA.join(", ")}`);
        console.log(`  - ${d.companyId} → ${parts.join("; ")}`);
      }
    }
  } else {
    console.log("\n[DB company_rules] ⚠️  non disponibile (manca TURSO_DB_URL o DB non raggiungibile)");
  }
}

// ─────────────────────────────────────────────
// Comando: analyze / sync
// ─────────────────────────────────────────────
async function runAnalyze({ apply = false } = {}) {
  const sidebar = readSidebar();
  const register = readRegister();
  const superuser = readSuperuser();
  const config = readMenuConfig();

  let dbRules = null;
  try {
    dbRules = await readDbRules();
  } catch (e) {
    console.error("DB non raggiungibile:", e.message);
  }

  const canonical = buildCanonical(register, superuser, config, sidebar);
  const diff = computeDiff(canonical, register, superuser, config, dbRules, sidebar);
  printReport(diff, canonical, dbRules, true);

  if (!apply) {
    console.log("\n💡 Nessuna modifica apportata. Per sincronizzare usa: npm run menu:sync");
    return;
  }

  // ── Sincronizzazione con conferme ──
  const rl = createInterface({ input, output });
  let registerSrc = readFileSync(REGISTER, "utf8");
  let superSrc = readFileSync(SUPERUSER_PAGE, "utf8");
  let registerChanged = false;
  let superChanged = false;
  let configChanged = false;
  const changedCompanies = new Set();

  // Register: aggiungi chiavi mancanti (features → true, featuresAdmin → false)
  const addRegisterF = [];
  for (const k of diff.registerMissingFeatures) {
    if (await confirm(rl, `[Aggiungere ${k} a register/route.ts (features)?]`)) addRegisterF.push([k, true]);
  }
  const addRegisterA = [];
  for (const k of diff.registerMissingAdmin) {
    if (await confirm(rl, `[Aggiungere ${k} a register/route.ts (featuresAdmin)?]`)) addRegisterA.push([k, false]);
  }
  if (addRegisterF.length || addRegisterA.length) {
    registerSrc = editRegisterBlock(registerSrc, "features: {", addRegisterF, []);
    registerSrc = editRegisterBlock(registerSrc, "featuresAdmin: {", addRegisterA, []);
    registerChanged = true;
  }

  // Register: rimuovi extra non in menu-config
  const removeExtra = [...diff.extraInRegisterFeatures, ...diff.extraInRegisterAdmin];
  const toRemove = [];
  for (const k of removeExtra) {
    if (await confirm(rl, `[Rimuovere ${k} da register/route.ts?]`)) toRemove.push(k);
  }
  if (toRemove.length) {
    registerSrc = editRegisterBlock(registerSrc, "features: {", [], toRemove);
    registerSrc = editRegisterBlock(registerSrc, "featuresAdmin: {", [], toRemove);
    registerChanged = true;
  }

  // Superuser page: aggiungi chiavi mancanti
  const addSuperF = [];
  for (const k of diff.superuserMissingFeatures) {
    if (await confirm(rl, `[Aggiungere ${k} a superuser page (features checkbox)?]`)) {
      addSuperF.push([k, canonical.features.get(k) || k]);
    }
  }
  const addSuperA = [];
  for (const k of diff.superuserMissingAdmin) {
    if (await confirm(rl, `[Aggiungere ${k} a superuser page (featuresAdmin checkbox)?]`)) {
      addSuperA.push([k, canonical.featuresAdmin.get(k) || k]);
    }
  }
  if (addSuperF.length) {
    superSrc = editSuperuserArray(superSrc, "const FEATURE_OPTIONS = [", addSuperF);
    superChanged = true;
  }
  if (addSuperA.length) {
    superSrc = editSuperuserArray(superSrc, "const ADMIN_FEATURE_OPTIONS = [", addSuperA);
    superChanged = true;
  }

  // DB: aggiorna le aziende con chiavi mancanti (per chiave mancante, conferma una volta)
  const confirmedDbKeys = new Set();
  if (dbRules && diff.db.length > 0) {
    const missingAll = new Set();
    for (const d of diff.db) {
      for (const k of [...d.missingF, ...d.missingA]) missingAll.add(k);
    }
    for (const k of missingAll) {
      if (await confirm(rl, `[Aggiungere ${k} a TUTTE le aziende esistenti?]`)) {
        confirmedDbKeys.add(k);
        for (const d of diff.db) changedCompanies.add(d.companyId);
      }
    }
  }

  rl.close();

  // Applica su file
  if (registerChanged) writeFileSync(REGISTER, registerSrc, "utf8");
  if (superChanged) writeFileSync(SUPERUSER_PAGE, superSrc, "utf8");

  // Aggiorna menu-config.md (sempre, per mantenerla allineata alla lista canonica)
  const canonical2 = buildCanonical(readRegister(), readSuperuser(), readMenuConfig(), readSidebar());
  writeMenuConfig(canonical2);
  configChanged = true;

  // Aggiorna DB
  let migration = null;
  if (dbRules && changedCompanies.size > 0 && confirmedDbKeys.size > 0) {
    await applyDbSync(dbRules, canonical2, changedCompanies, confirmedDbKeys);
    migration = writeMigration(dbRules, canonical2, changedCompanies, confirmedDbKeys);
  }

  // ── Report finale ──
  const addedRegister = addRegisterF.length + addRegisterA.length;
  const addedSuper = addSuperF.length + addSuperA.length;
  console.log("\n✅ Sincronizzazione completata!");
  console.log(`- Register aggiornato: ${addedRegister > 0 ? `+${addedRegister} menu` : "nessuna modifica"}`);
  console.log(`- Superuser page aggiornato: ${addedSuper > 0 ? `+${addedSuper} checkbox` : "nessuna modifica"}`);
  if (dbRules) {
    const total = dbRules.length;
    console.log(`- Aziende aggiornate: ${changedCompanies.size}/${total}`);
  }
  console.log(`- Migrazione creata: ${migration || "nessuna (nessun cambio DB)"}`);
  if (migration) console.log("- Prossimo passo: applicare la migrazione nell'ambiente di destinazione");
  console.log("\nFatto. Ora tutti i menu sono allineati tra sidebar, register, superuser page e DB.");
}

// ─────────────────────────────────────────────
// Entry point
// ─────────────────────────────────────────────
try {
  if (command === "status") {
    await runStatus();
  } else if (command === "sync") {
    await runAnalyze({ apply: true });
  } else {
    await runAnalyze({ apply: false });
  }
} catch (error) {
  console.error("\nErrore:", error.message || error);
  process.exit(1);
}
