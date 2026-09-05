#!/usr/bin/env node
/**
 * i18n VALUE gate (plan 45 item 1.1, audit H8).
 *
 * The key-parity gate (check-i18n-parity.mjs) proves every catalog has every
 * EN key. It says NOTHING about whether the VALUES are translated. A locale can
 * be at 100% key parity while shipping English strings in all of them.
 *
 * This gate flags catalog values that are byte-identical to the EN value, which
 * usually means "never translated". Legitimately-identical values (brand names,
 * loanwords, proper nouns, single-letter/emoji/placeholder-only strings) are
 * exempted two ways:
 *   1. Auto-exempt: values that are 100% placeholders / punctuation / digits /
 *      whitespace / emoji carry no translatable text, so identical is correct.
 *   2. Allowlist: scripts/i18n-value-allowlist.json maps key -> [locales] where
 *      identical-to-EN is a reviewed, defensible decision (e.g. "Wok" in de).
 *
 * The gate fails listing every non-allowlisted identical value, with a per-locale
 * summary. It also emits app/(root)/i18n/i18n-value-completeness.json (consumed by
 * the language picker to drive the honest "partly in English" label).
 *
 * Parsing mirrors check-i18n-parity.mjs: values are single-line string literals.
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CATALOGS_DIR = join(__dirname, '..', 'app', '(root)', 'i18n', 'catalogs');
const ALLOWLIST_PATH = join(__dirname, 'i18n-value-allowlist.json');
const MANIFEST_PATH = join(CATALOGS_DIR, '..', 'i18n-value-completeness.json');

/** Threshold above which a locale is labelled "partly in English" in the picker. */
const PARTIAL_THRESHOLD = 10;

function unescape(raw) {
  return raw
    .replace(/\\u([0-9a-fA-F]{4})/g, (_, h) => String.fromCharCode(Number.parseInt(h, 16)))
    .replace(/\\n/g, '\n')
    .replace(/\\t/g, '\t')
    .replace(/\\(['"\\])/g, '$1');
}

/**
 * Parse a catalog file into an ordered Map<key, value>. Only single-line string
 * values are captured (the catalogs use single-line values); a value that wraps
 * onto a second line is rare and, if present, simply not compared here (the key
 * parity gate still guards its presence).
 */
function parseCatalog(source) {
  const map = new Map();
  const re =
    /^\s+(?:'((?:[^'\\]|\\.)*)'|"((?:[^"\\]|\\.)*)"|([A-Za-z_][\w-]*)):\s*(?:'((?:[^'\\]|\\.)*)'|"((?:[^"\\]|\\.)*)")\s*,?\s*$/gm;
  let m;
  while ((m = re.exec(source)) !== null) {
    const rawKey = m[1] ?? m[2] ?? m[3];
    const key = m[3] !== undefined ? rawKey : unescape(rawKey);
    const val = unescape(m[4] ?? m[5] ?? '');
    map.set(key, val);
  }
  return map;
}

/**
 * A value carries no translatable text when, after removing {placeholders},
 * it has no letters left (only punctuation, digits, whitespace, symbols, emoji).
 * Such values are correctly identical across every locale.
 */
function isAutoExempt(value) {
  if (value.trim() === '') return true;
  const noPlaceholders = value.replace(/\{[^}]*\}/g, '');
  const noEmoji = noPlaceholders.replace(/\p{Extended_Pictographic}/gu, '');
  // Any Unicode letter means there is real text to translate.
  return !/\p{L}/u.test(noEmoji);
}

function loadAllowlist() {
  try {
    const parsed = JSON.parse(readFileSync(ALLOWLIST_PATH, 'utf-8'));
    const map = new Map();
    for (const [key, locales] of Object.entries(parsed)) {
      if (Array.isArray(locales)) map.set(key, new Set(locales));
    }
    return map;
  } catch {
    return new Map();
  }
}

const enSource = readFileSync(join(CATALOGS_DIR, 'en.ts'), 'utf-8');
const en = parseCatalog(enSource);
const allowlist = loadAllowlist();

const files = readdirSync(CATALOGS_DIR).filter(
  (f) => f.endsWith('.ts') && f !== 'en.ts' && f !== 'index.ts',
);

let hadViolation = false;
const perLocale = [];
const completeness = { en: { identical: 0, partial: false } };

for (const file of files.sort()) {
  const lang = file.replace(/\.ts$/, '');
  const cat = parseCatalog(readFileSync(join(CATALOGS_DIR, file), 'utf-8'));
  const violations = [];
  for (const [key, enVal] of en) {
    if (!cat.has(key)) continue; // key parity gate owns this
    if (cat.get(key) !== enVal) continue; // translated
    if (isAutoExempt(enVal)) continue; // no translatable text
    if (allowlist.get(key)?.has(lang)) continue; // reviewed loanword/brand
    violations.push({ key, value: enVal });
  }
  perLocale.push({ lang, violations });
  completeness[lang] = {
    identical: violations.length,
    partial: violations.length > PARTIAL_THRESHOLD,
  };
  if (violations.length > 0) hadViolation = true;
}

// The completeness manifest is checked in and consumed by the language picker
// at build time. Regenerating it unconditionally would let a stale committed
// manifest silently disagree with reality (the picker would then lie about
// which locales are complete). So by default we COMPARE the committed manifest
// against a freshly-computed one and FAIL on drift; only `--write` rewrites it.
const WRITE_MANIFEST = process.argv.includes('--write');
const manifestJson =
  JSON.stringify(
    {
      generatedBy: 'apps/bestchef/scripts/check-i18n-values.mjs',
      partialThreshold: PARTIAL_THRESHOLD,
      locales: completeness,
    },
    null,
    2,
  ) + '\n';

if (WRITE_MANIFEST) {
  writeFileSync(MANIFEST_PATH, manifestJson);
} else {
  let committed;
  try {
    committed = readFileSync(MANIFEST_PATH, 'utf-8');
  } catch {
    committed = undefined;
  }
  if (committed !== manifestJson) {
    console.error(
      `\ni18n-value-completeness.json is ${committed === undefined ? 'missing' : 'stale'} relative to the catalogs/allowlist.`,
    );
    console.error(
      'Regenerate and commit it: node apps/bestchef/scripts/check-i18n-values.mjs --write',
    );
    process.exit(1);
  }
}

console.log(`EN keys: ${en.size}   allowlist entries: ${allowlist.size}\n`);
console.log('lang       identical-to-EN (non-allowlisted)');
console.log('---------- ---------------------------------');
for (const { lang, violations } of perLocale) {
  console.log(`${lang.padEnd(10)} ${String(violations.length).padStart(6)}`);
}

if (hadViolation) {
  console.error('\nUntranslated (identical-to-EN) values detected:\n');
  for (const { lang, violations } of perLocale) {
    if (violations.length === 0) continue;
    console.error(`  ${lang}:`);
    for (const { key, value } of violations) {
      console.error(`    ${JSON.stringify(key)} = ${JSON.stringify(value)}`);
    }
  }
  console.error(
    '\nTranslate these values, or if identical-to-EN is legitimate (brand/loanword/proper noun),',
  );
  console.error(`add the key -> [locale] pair to ${ALLOWLIST_PATH}.`);
  process.exit(1);
} else {
  console.log('\nAll catalog values are translated or allowlisted.');
}
