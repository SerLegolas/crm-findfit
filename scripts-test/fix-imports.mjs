#!/usr/bin/env node
/**
 * Fix import ESM/NodeNext: aggiunge l'estensione .js alle importazioni relative
 * (./ e ../) nei sorgenti TypeScript di backend e shared.
 * Idempotente: salta gli specifier che hanno già un'estensione.
 *
 * Uso: node scripts-test/fix-imports.mjs
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const roots = ['backend/src', 'shared/src'];
const skipDirs = new Set(['node_modules', 'dist']);

function walk(dir, acc = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) {
      if (!skipDirs.has(e.name)) walk(p, acc);
    } else if (e.name.endsWith('.ts')) {
      acc.push(p);
    }
  }
  return acc;
}

// Cattura "from '...'" o "import('...')" con specifier relativo tra apici
const RE = /(\bfrom\s*)(['"])(\.[^'"]+)\2|(\bimport\s*\(\s*)(['"])(\.[^'"]+)\5/g;

const files = roots.flatMap((r) => walk(r));
let changed = 0;

for (const file of files) {
  const src = readFileSync(file, 'utf8');
  const out = src.replace(RE, (m, fromKw, q1, spec1, importKw, q2, spec2) => {
    const spec = spec1 ?? spec2;
    const q = q1 ?? q2;
    const kw = fromKw ?? importKw;
    if (!spec.startsWith('.')) return m;
    if (/\.(m?[jt]s|cjs|json)(\?.*)?$/.test(spec)) return m;
    return `${kw}${q}${spec}.js${q}`;
  });
  if (out !== src) {
    writeFileSync(file, out);
    console.log('fixed:', file);
    changed++;
  }
}

console.log(`\n✅ Aggiornati ${changed} file.`);
