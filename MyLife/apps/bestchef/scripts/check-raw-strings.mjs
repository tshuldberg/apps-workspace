#!/usr/bin/env node
/**
 * BestChef raw-string gate (plan 33 Phase 3.2, N15).
 *
 * Holds the line on the hardcoded-English classes that keep regressing:
 *   1. Alert.alert('...') / Alert.alert("...") with a raw string literal
 *   2. accessibilityLabel="..." raw string props
 *   3. placeholder="..." props whose value is PROSE (format examples such
 *      as bare numbers, URLs, and digit strings are locale-neutral and pass)
 *
 * Every user-facing string must route through t()/tp(). Deliberate
 * exceptions go into ALLOWED_LITERALS with a reason.
 *
 * Exits 1 with a file:line listing when a violation is found. Wired into
 * the root check:parity chain next to check:i18n-parity.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const APP_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', 'app', '(root)');

/** Deliberate literal exceptions (value -> reason). */
const ALLOWED_LITERALS = new Map([
  // none currently; add sparingly with a reason
]);

/** Locale-neutral placeholder formats: digits, URLs, emails, short codes. */
function isFormatExample(value) {
  if (/^[\d\s.,:%/-]*$/.test(value)) return true; // numbers and separators
  if (/^https?:\/\//.test(value)) return true; // URL examples
  if (/^[\w.+-]+@[\w.-]+$/.test(value)) return true; // email examples
  return false;
}

function* walk(dir) {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    const stats = statSync(path);
    if (stats.isDirectory()) {
      if (entry === '__tests__' || entry === 'node_modules') continue;
      yield* walk(path);
    } else if (/\.(ts|tsx)$/.test(entry) && !entry.endsWith('.d.ts')) {
      yield path;
    }
  }
}

const CHECKS = [
  {
    name: 'raw Alert.alert literal (route through t())',
    pattern: /Alert\.alert\(\s*['"]/g,
  },
  {
    name: 'raw accessibilityLabel literal (route through t())',
    pattern: /accessibilityLabel="[^"]*"/g,
  },
  {
    name: 'prose placeholder literal (route through t())',
    pattern: /placeholder="([^"]+)"/g,
    accept: (match) => isFormatExample(match[1]),
  },
];

const violations = [];

for (const file of walk(APP_ROOT)) {
  // The catalogs themselves are string data, not UI code.
  if (file.includes(`${join('i18n', 'catalogs')}`)) continue;
  const source = readFileSync(file, 'utf8');
  for (const check of CHECKS) {
    check.pattern.lastIndex = 0;
    let match;
    while ((match = check.pattern.exec(source)) !== null) {
      if (check.accept?.(match)) continue;
      if (ALLOWED_LITERALS.has(match[0])) continue;
      const line = source.slice(0, match.index).split('\n').length;
      violations.push(
        `${relative(process.cwd(), file)}:${line} ${check.name}\n    ${match[0].slice(0, 90)}`,
      );
    }
  }
}

if (violations.length > 0) {
  console.error(`Raw-string gate: ${violations.length} violation(s)\n`);
  for (const violation of violations) console.error(`  ${violation}`);
  console.error(
    '\nRoute user-facing strings through t()/tp() and add real translations to all 21 catalogs.',
  );
  process.exit(1);
}

console.log('Raw-string gate: clean (Alert.alert, accessibilityLabel, prose placeholders).');
