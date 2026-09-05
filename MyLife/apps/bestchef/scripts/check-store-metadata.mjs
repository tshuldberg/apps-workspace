#!/usr/bin/env node
/**
 * BestChef App Store metadata gate (plan 45 item 1.4, audit M13).
 *
 * Validates apps/bestchef/store-metadata/<locale>.json for all 21 launch
 * locales: structural completeness (every locale has every field, every
 * app locale has a file), ASC character limits, no placeholder text, and
 * that the generated store.config.json (what `eas metadata:push` reads)
 * is not stale relative to the per-locale source files. Wired into the
 * root `check:parity` chain next to check:i18n-parity.
 *
 * Exits 1 with a specific violation listing on failure.
 */

import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ASC_LOCALE_MAP, buildStoreConfig, loadLocaleFiles } from './generate-store-config.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const APP_ROOT = join(__dirname, '..');
const METADATA_DIR = join(APP_ROOT, 'store-metadata');
const STORE_CONFIG_PATH = join(APP_ROOT, 'store.config.json');

const REQUIRED_FIELDS = ['name', 'subtitle', 'description', 'keywords', 'promotionalText', 'releaseNotes'];

const CHAR_LIMITS = {
  name: 30,
  subtitle: 30,
  keywords: 100,
  description: 4000,
  promotionalText: 170,
  releaseNotes: 4000,
};

// Case-SENSITIVE, uppercase-only for TODO/TBD/FIXME/XXX: several launch
// locales are Romance languages where the lowercase word "todo"/"toda"
// means "all/every" and appears legitimately in real copy (e.g. Spanish
// "de todo el mundo" = "from all over the world"). A real placeholder
// TODO is conventionally shouted in caps, so anchoring on case avoids
// false positives across the corpus without missing real placeholders.
const PLACEHOLDER_PATTERNS = [
  /\bTODO\b/,
  /\bTBD\b/,
  /\bFIXME\b/,
  /lorem ipsum/i,
  /\bPLACEHOLDER\b/i,
  /\bXXX\b/,
  /\[.*?\]/, // bracketed tokens like [insert here]
];

const EXPECTED_LOCALES = Object.keys(ASC_LOCALE_MAP);

function fail(errors) {
  console.error(`Store metadata check FAILED (${errors.length} issue${errors.length === 1 ? '' : 's'}):\n`);
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}

const errors = [];

// 1. Every expected locale has a file, and no unexpected extra files.
const files = readdirSync(METADATA_DIR).filter((f) => f.endsWith('.json'));
const foundLocales = files.map((f) => f.replace(/\.json$/, ''));

for (const locale of EXPECTED_LOCALES) {
  if (!foundLocales.includes(locale)) {
    errors.push(`Missing store-metadata/${locale}.json (expected one file per app locale)`);
  }
}
for (const locale of foundLocales) {
  if (!EXPECTED_LOCALES.includes(locale)) {
    errors.push(`Unexpected store-metadata/${locale}.json (not one of the app's 21 supported locales)`);
  }
}

// 2. Per-locale structural completeness, char limits, placeholder scan.
const byLocale = {};
for (const locale of foundLocales) {
  let data;
  try {
    data = JSON.parse(readFileSync(join(METADATA_DIR, `${locale}.json`), 'utf-8'));
  } catch (e) {
    errors.push(`store-metadata/${locale}.json is not valid JSON: ${e.message}`);
    continue;
  }
  byLocale[locale] = data;

  for (const field of REQUIRED_FIELDS) {
    if (typeof data[field] !== 'string' || data[field].trim().length === 0) {
      errors.push(`store-metadata/${locale}.json: field "${field}" is missing or empty`);
      continue;
    }

    const limit = CHAR_LIMITS[field];
    if (limit && data[field].length > limit) {
      errors.push(
        `store-metadata/${locale}.json: field "${field}" is ${data[field].length} chars, exceeds ASC limit of ${limit}`,
      );
    }

    for (const pattern of PLACEHOLDER_PATTERNS) {
      if (pattern.test(data[field])) {
        errors.push(`store-metadata/${locale}.json: field "${field}" matches placeholder pattern ${pattern}`);
      }
    }
  }

  if (data.name && data.name.trim() !== 'BestChef') {
    errors.push(`store-metadata/${locale}.json: "name" must be exactly "BestChef" (found "${data.name}")`);
  }
}

// 3. store.config.json (the file eas metadata:push actually reads) must
//    not be stale relative to the per-locale source files.
if (errors.length === 0) {
  let existing;
  try {
    existing = readFileSync(STORE_CONFIG_PATH, 'utf-8');
  } catch {
    errors.push('store.config.json does not exist. Run: node scripts/generate-store-config.mjs');
  }

  if (existing !== undefined) {
    const regenerated = JSON.stringify(buildStoreConfig(loadLocaleFiles()), null, 2) + '\n';
    if (existing !== regenerated) {
      errors.push(
        'store.config.json is stale relative to store-metadata/*.json. Run: node scripts/generate-store-config.mjs and commit the result.',
      );
    }
  }
}

if (errors.length > 0) fail(errors);

console.log(`Store metadata OK: ${EXPECTED_LOCALES.length}/${EXPECTED_LOCALES.length} locales, all fields within ASC limits, store.config.json in sync.`);
