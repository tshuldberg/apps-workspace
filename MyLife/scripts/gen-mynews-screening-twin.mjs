#!/usr/bin/env node
/**
 * Generates the Deno edge twin of the MyNews screening engine
 * (supabase/functions/_shared/mynews-screening.ts) from the canonical module
 * sources in modules/mynews/src/screening/ (plan 48 WP8).
 *
 * Why generate instead of hand-maintaining a twin: the other MyNews twins
 * (_shared/mynews-bounds.ts, mynews-cred.ts, mynews-dupes.ts) are small enough
 * that a pinned parity test catches drift. A screening engine is not: it is
 * lexicon data plus scoring across seven files, and a hand-copied twin would
 * drift silently in exactly the direction that matters (the engine at the edge
 * scoring differently from the engine the tests exercise).
 *
 * The transform is deliberately dumb, so its output is auditable:
 *   concatenate the source files in dependency order
 *   drop the intra-directory import statements (everything is in one scope)
 *   leave every other byte alone
 *
 * screening/__tests__/edge-twin.test.ts regenerates in memory and asserts the
 * committed file matches byte for byte, so the twin cannot be edited by hand
 * and cannot fall behind the module.
 *
 * Usage: node scripts/gen-mynews-screening-twin.mjs [--check]
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
export const SCREENING_DIR = resolve(HERE, '../modules/mynews/src/screening');
export const TWIN_PATH = resolve(HERE, '../supabase/functions/_shared/mynews-screening.ts');

/** Dependency order. types has no dependencies; provider depends on engine. */
export const SOURCE_FILES = [
  'types.ts',
  'normalize.ts',
  'lexicons.ts',
  'matcher.ts',
  'urls.ts',
  'signature.ts',
  'engine.ts',
  'provider.ts',
];

const HEADER = `// GENERATED FILE. Do not edit.
//
// Deno twin of the MyNews screening engine in
// modules/mynews/src/screening/, produced by
// scripts/gen-mynews-screening-twin.mjs. The edge functions cannot import from
// modules/, so the engine is inlined here as one scope: same source, same
// scoring, same lexicons, no hand-copied drift.
//
// Regenerate with:  node scripts/gen-mynews-screening-twin.mjs
// The byte-for-byte check lives in
// modules/mynews/src/screening/__tests__/edge-twin.test.ts.

`;

/**
 * Drops import statements that reference a sibling file inside the screening
 * directory. Cross-package imports would be a build error at the edge and there
 * are none; if one is ever added, this throws rather than emitting a twin that
 * cannot run under Deno.
 */
function stripLocalImports(source, fileName) {
  const withoutLocal = source.replace(
    /^import\s+(?:type\s+)?[\s\S]*?from\s+'\.\/[^']+';\n/gm,
    '',
  );
  const remaining = withoutLocal.match(/^import\s[\s\S]*?;$/gm);
  if (remaining && remaining.length > 0) {
    throw new Error(
      `gen-mynews-screening-twin: ${fileName} has a non-local import the edge twin cannot resolve:\n${remaining.join('\n')}`,
    );
  }
  return withoutLocal;
}

export function buildTwin() {
  const parts = [HEADER];
  for (const fileName of SOURCE_FILES) {
    const source = readFileSync(join(SCREENING_DIR, fileName), 'utf8');
    parts.push(`// ==================== screening/${fileName} ====================\n\n`);
    parts.push(stripLocalImports(source, fileName).trimStart());
    parts.push('\n');
  }
  return parts.join('');
}

function main() {
  const generated = buildTwin();
  const check = process.argv.includes('--check');
  if (check) {
    let current = '';
    try {
      current = readFileSync(TWIN_PATH, 'utf8');
    } catch {
      current = '';
    }
    if (current !== generated) {
      console.error(
        'mynews screening edge twin is stale. Run: node scripts/gen-mynews-screening-twin.mjs',
      );
      process.exit(1);
    }
    console.log('mynews screening edge twin is current.');
    return;
  }
  writeFileSync(TWIN_PATH, generated);
  console.log(`wrote ${TWIN_PATH}`);
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  main();
}
