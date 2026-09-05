#!/usr/bin/env node

/**
 * Guard against the @mylife/ui bare-barrel RN regression on web.
 *
 * Background: the @mylife/ui barrel (packages/ui/src/index.ts) re-exports both
 * pure design tokens (colors, spacing, typography, theme presets) AND React
 * Native components (Card, Button, Text, etc.) that import `react-native`.
 * Mobile imports the barrel freely. The Next.js web app must NOT import the
 * bare barrel for a VALUE, because doing so pulls react-native into the web
 * bundle and reintroduces the RN 500 cascade that WEB-FIX-1 fixed.
 *
 * The intended rule (documented in apps/web/next.config.ts) is: web code
 * imports tokens/constants from explicit subpaths only, e.g.
 *   import { fontStacks } from '@mylife/ui/src/tokens/typography';
 *   import { BRAND_DOMAIN } from '@mylife/ui/src/constants/brand';
 * and never the bare specifier '@mylife/ui' for a runtime value.
 *
 * This script scans every apps/web source file and FAILS if it finds a value
 * import (or re-export, or dynamic import, or require) of the bare '@mylife/ui'
 * specifier. Type-only imports (`import type { ... } from '@mylife/ui'`) are
 * allowed because they are erased at build time and never reach the bundle.
 *
 * Subpath imports like '@mylife/ui/src/tokens/colors' are always allowed.
 *
 * Run directly: node scripts/check-web-ui-barrel-imports.mjs
 * Run via shared wrapper: bash scripts/perf-audit/run-js.sh scripts/check-web-ui-barrel-imports.mjs
 */

import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

const ROOT = resolve(process.cwd());
const WEB_APP = resolve(ROOT, 'apps', 'web');

// Directories under apps/web to scan for source files. We deliberately skip
// build output, dependencies, and test snapshots so the guard only sees
// hand-written source.
const SCAN_DIRS = ['app', 'components', 'lib', 'test'];

// Directory names that never contain hand-written source we care about.
const SKIP_DIR_NAMES = new Set([
  'node_modules',
  '.next',
  '.turbo',
  'dist',
  'build',
  'coverage',
  'playwright-report',
  'test-results',
]);

const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs']);

const BARE_SPECIFIER = '@mylife/ui';

function out(line) {
  process.stdout.write(`${line}\n`);
}

function err(line) {
  process.stderr.write(`${line}\n`);
}

function hasSourceExtension(name) {
  const dot = name.lastIndexOf('.');
  if (dot === -1) return false;
  return SOURCE_EXTENSIONS.has(name.slice(dot));
}

function collectSourceFiles(dir, acc) {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return acc;
  }
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (SKIP_DIR_NAMES.has(entry.name)) continue;
      collectSourceFiles(full, acc);
    } else if (entry.isFile() && hasSourceExtension(entry.name)) {
      acc.push(full);
    }
  }
  return acc;
}

/**
 * Returns true when the given module specifier is the bare @mylife/ui barrel
 * (and not a subpath like @mylife/ui/src/tokens/...).
 */
function isBareBarrel(specifier) {
  return specifier === BARE_SPECIFIER;
}

/**
 * Strip block and line comments from a single physical line so commented-out
 * imports do not trip the guard. This is intentionally lightweight: it handles
 * the common cases (`// ...`, `/* ... *\/` on one line) without a full parser.
 */
function stripLineComments(line) {
  let result = line;
  // Remove single-line block comments first (greedy within the line).
  result = result.replace(/\/\*.*?\*\//g, '');
  // Remove trailing line comments.
  const lineComment = result.indexOf('//');
  if (lineComment !== -1) {
    result = result.slice(0, lineComment);
  }
  return result;
}

/**
 * Detect a violating reference to the bare barrel on a single line.
 * Allowed: `import type ... from '@mylife/ui'`, `export type ... from '@mylife/ui'`,
 *          and any '@mylife/ui/<subpath>' import.
 * Disallowed: value `import`/`export`-from, dynamic `import('@mylife/ui')`,
 *             and `require('@mylife/ui')`.
 *
 * Returns a short reason string when the line violates, otherwise null.
 */
function findViolation(rawLine) {
  const line = stripLineComments(rawLine);
  if (!line.includes(BARE_SPECIFIER)) return null;

  // Match the module specifier in single or double quotes and capture it so we
  // can distinguish the bare barrel from a subpath.
  const specifierMatch = line.match(/['"](@mylife\/ui(?:\/[^'"]*)?)['"]/);
  if (!specifierMatch) return null;
  const specifier = specifierMatch[1];
  if (!isBareBarrel(specifier)) return null; // subpath import is fine

  // require('@mylife/ui') -- always a value import.
  if (/\brequire\s*\(\s*['"]@mylife\/ui['"]\s*\)/.test(line)) {
    return 'require() of the bare @mylife/ui barrel';
  }

  // Dynamic import('@mylife/ui') -- always a value import.
  if (/\bimport\s*\(\s*['"]@mylife\/ui['"]\s*\)/.test(line)) {
    return 'dynamic import() of the bare @mylife/ui barrel';
  }

  // Static import/export ... from '@mylife/ui'
  const isImportFrom = /^\s*import\b[\s\S]*from\s*['"]@mylife\/ui['"]/.test(line);
  const isExportFrom = /^\s*export\b[\s\S]*from\s*['"]@mylife\/ui['"]/.test(line);
  const isBareSideEffectImport = /^\s*import\s+['"]@mylife\/ui['"]\s*;?\s*$/.test(line);

  if (isBareSideEffectImport) {
    return 'side-effect import of the bare @mylife/ui barrel';
  }

  if (isImportFrom || isExportFrom) {
    // Allow type-only statements: `import type ...` / `export type ...`.
    const keyword = isImportFrom ? 'import' : 'export';
    const typeOnly = new RegExp(`^\\s*${keyword}\\s+type\\b`).test(line);
    if (typeOnly) return null;
    return `value ${keyword} from the bare @mylife/ui barrel`;
  }

  return null;
}

function main() {
  const files = [];
  for (const dir of SCAN_DIRS) {
    collectSourceFiles(join(WEB_APP, dir), files);
  }

  const violations = [];
  for (const file of files) {
    let contents;
    try {
      contents = readFileSync(file, 'utf8');
    } catch {
      continue;
    }
    if (!contents.includes(BARE_SPECIFIER)) continue;
    const lines = contents.split('\n');
    for (let i = 0; i < lines.length; i += 1) {
      const reason = findViolation(lines[i]);
      if (reason) {
        violations.push({
          file: relative(ROOT, file),
          line: i + 1,
          reason,
          text: lines[i].trim(),
        });
      }
    }
  }

  out(`Scanned ${files.length} apps/web source files for bare @mylife/ui value imports.`);

  if (violations.length === 0) {
    out('OK   No bare @mylife/ui value imports in apps/web.');
    out('     (Import tokens from @mylife/ui/src/tokens/* subpaths instead.)');
    process.exit(0);
  }

  err('');
  err(`FAIL ${violations.length} bare @mylife/ui value import(s) found in apps/web.`);
  err('     The bare @mylife/ui barrel pulls react-native into the web bundle');
  err('     and reintroduces the RN 500 cascade. Import design tokens from an');
  err("     explicit subpath instead, e.g. '@mylife/ui/src/tokens/typography'.");
  err('');
  for (const v of violations) {
    err(`  ${v.file}:${v.line}  ${v.reason}`);
    err(`      ${v.text}`);
  }
  err('');
  process.exit(1);
}

main();
