#!/usr/bin/env node
import { readdirSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CATALOGS_DIR = join(__dirname, '..', 'app', '(root)', 'i18n', 'catalogs');

// Keys may be single-quoted, double-quoted, or bare identifiers, and may
// contain \uXXXX escapes or escaped quotes. Compare PARSED key strings so
// source quoting/escaping style can never hide a key from the gate
// (plan 33 Phase 3.5 review F3: 6 keys were invisible for months).
function unescapeKey(raw) {
  return raw
    .replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) => String.fromCharCode(Number.parseInt(hex, 16)))
    .replace(/\\(['"\\])/g, '$1');
}

function extractKeys(source) {
  const keys = new Set();
  const re = /^\s+(?:'((?:[^'\\]|\\.)+)'|"((?:[^"\\]|\\.)+)"|([A-Za-z_][\w-]*)):\s/gm;
  let match;
  while ((match = re.exec(source)) !== null) {
    const raw = match[1] ?? match[2] ?? match[3];
    keys.add(match[3] !== undefined ? raw : unescapeKey(raw));
  }
  return keys;
}

const enSource = readFileSync(join(CATALOGS_DIR, 'en.ts'), 'utf-8');
const enKeys = extractKeys(enSource);

const files = readdirSync(CATALOGS_DIR).filter(
  (f) => f.endsWith('.ts') && f !== 'en.ts' && f !== 'index.ts',
);

let hadDrift = false;
const report = [];

for (const file of files) {
  const lang = file.replace(/\.ts$/, '');
  const src = readFileSync(join(CATALOGS_DIR, file), 'utf-8');
  const langKeys = extractKeys(src);
  const missing = [...enKeys].filter((k) => !langKeys.has(k));
  const extra = [...langKeys].filter((k) => !enKeys.has(k));
  const pct = enKeys.size === 0 ? 0 : ((enKeys.size - missing.length) / enKeys.size) * 100;
  report.push({ lang, total: langKeys.size, pct: pct.toFixed(1), missing: missing.length, extra: extra.length });
  if (missing.length > 0 || extra.length > 0) hadDrift = true;
}

console.log(`EN keys: ${enKeys.size}\n`);
console.log('lang       total   coverage   missing   extra');
console.log('---------- ------- ---------- --------- -----');
for (const r of report.sort((a, b) => a.lang.localeCompare(b.lang))) {
  console.log(
    `${r.lang.padEnd(10)} ${String(r.total).padStart(6)} ${(r.pct + '%').padStart(9)} ${String(r.missing).padStart(8)} ${String(r.extra).padStart(5)}`,
  );
}

if (hadDrift) {
  console.error('\nDrift detected. Update non-EN catalogs to match EN keys.');
  process.exit(1);
} else {
  console.log('\nAll catalogs at 100% key parity with EN.');
}
