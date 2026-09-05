/**
 * Product-copy claim gate for the MyNews app surface.
 *
 * The legal-copy parity test only ever covered the shared legal bundle, which is
 * how a staged-delivery string ("arrives with verification (Phase 3)") and a
 * hardcoded fee claim both survived review. This test scans the SOURCE the user
 * actually sees and enforces two mechanical rules:
 *
 *  1. No staged-delivery markers in user-visible copy. A shipped screen must
 *     describe what it does now, not what a roadmap phase will do.
 *  2. Every 2% platform-fee claim lives in a file that derives from the
 *     capability system. A file that states the fee without importing the
 *     capability or fee source can publish it in a build with no payment rail.
 *
 * "User-visible copy" is the source with COMMENTS REMOVED, which covers string
 * literals AND bare JSX text (`<Text>MyNews shows its 2% platform fee</Text>`
 * is not a string literal, and a literal-only scan would miss exactly the copy
 * that matters). Implementation notes in comments stay free to explain why
 * something is missing.
 *
 * Both rules walk the tree rather than an allowlist of known files, so a NEW
 * screen is covered the moment it is added.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { extname, join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

const APP_DIR = join(__dirname, '..');
const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx']);
const SKIPPED_DIRECTORIES = new Set(['node_modules', '__tests__', '.expo']);

/** 'Phase' followed by a digit, and the classic unshipped-feature hedge. */
const STAGED_DELIVERY_PATTERNS = [/Phase\s*\d/i, /coming soon/i];

/** Any statement of the platform fee percentage. */
const FEE_CLAIM_PATTERN = /\b2\s*%|\b2 percent\b/i;

/**
 * Imports that prove a file derives its fee/payment claims from the capability
 * system rather than asserting them.
 */
const CAPABILITY_IMPORT_MARKERS = [
  'runtime-capabilities',
  'detectMyNewsCapabilities',
  'getMyNewsRuntimeCapabilities',
  'getMyNewsPaymentsRuntimeConfig',
  'createLegalContent',
  'splitReaderSupport',
  'MYNEWS_PLATFORM_FEE_BPS',
  'MYNEWS_PLATFORM_FEE_PERCENT',
];

function sourceFiles(directory: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(directory)) {
    const path = join(directory, entry);
    if (statSync(path).isDirectory()) {
      if (SKIPPED_DIRECTORIES.has(entry)) continue;
      found.push(...sourceFiles(path));
      continue;
    }
    if (!SOURCE_EXTENSIONS.has(extname(entry))) continue;
    if (/\.test\.tsx?$/.test(entry)) continue;
    found.push(path);
  }
  return found;
}

/**
 * The source with line and block comments removed. Uses a character scanner so
 * `//` inside a URL literal is not mistaken for a comment start and an
 * apostrophe inside a comment is not mistaken for a string start.
 */
export function stripComments(source: string): string {
  let output = '';
  let index = 0;
  while (index < source.length) {
    const char = source[index]!;
    if (char === '/' && source[index + 1] === '/') {
      while (index < source.length && source[index] !== '\n') index += 1;
      continue;
    }
    if (char === '/' && source[index + 1] === '*') {
      index += 2;
      while (index < source.length && !(source[index] === '*' && source[index + 1] === '/')) {
        index += 1;
      }
      index += 2;
      continue;
    }
    if (char === "'" || char === '"' || char === '`') {
      const quote = char;
      output += char;
      index += 1;
      while (index < source.length) {
        const current = source[index]!;
        output += current;
        index += 1;
        if (current === '\\') {
          output += source[index] ?? '';
          index += 1;
          continue;
        }
        if (current === quote) break;
        if (quote !== '`' && current === '\n') break;
      }
      continue;
    }
    output += char;
    index += 1;
  }
  return output;
}

function matchingLines(source: string, pattern: RegExp): string[] {
  return stripComments(source)
    .split('\n')
    .filter((line) => pattern.test(line))
    .map((line) => line.trim().slice(0, 140));
}

const FILES = sourceFiles(APP_DIR);

describe('MyNews app product copy', () => {
  it('scans a real, non-trivial slice of the app surface', () => {
    expect(FILES.length).toBeGreaterThan(30);
  });

  it('ships no staged-delivery markers in user-visible copy', () => {
    const offenders: string[] = [];
    for (const file of FILES) {
      const source = readFileSync(file, 'utf8');
      for (const pattern of STAGED_DELIVERY_PATTERNS) {
        for (const line of matchingLines(source, pattern)) {
          offenders.push(`${relative(APP_DIR, file)}: ${line}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it('states the platform fee only in files that derive it from the capability system', () => {
    const offenders: string[] = [];
    let claimingFiles = 0;
    for (const file of FILES) {
      const source = readFileSync(file, 'utf8');
      const claims = matchingLines(source, FEE_CLAIM_PATTERN);
      if (claims.length === 0) continue;
      claimingFiles += 1;
      if (CAPABILITY_IMPORT_MARKERS.some((marker) => source.includes(marker))) continue;
      offenders.push(`${relative(APP_DIR, file)}: ${claims[0]}`);
    }
    expect(offenders).toEqual([]);
    // Guards the rule itself: if nothing states the fee any more, the check
    // above passes vacuously and the reader should be told to re-derive it.
    expect(claimingFiles).toBeGreaterThan(0);
  });

  it('reaches bare JSX text, not only string literals', () => {
    const support = FILES.find((file) => file.endsWith(join('(tabs)', 'support.tsx')));
    expect(support).toBeDefined();
    const source = readFileSync(support!, 'utf8');
    // This copy lives in JSX children with no surrounding quotes.
    expect(source).toContain('MyNews shows its 2% platform fee before checkout');
    expect(matchingLines(source, FEE_CLAIM_PATTERN).length).toBeGreaterThan(0);
  });
});

describe('stripComments', () => {
  it('removes comments while keeping code and URLs intact', () => {
    expect(stripComments("// Phase 3 note\nconst a = 'https://example.com';").trim()).toBe(
      "const a = 'https://example.com';",
    );
    expect(stripComments('/* coming soon */ const a = 1;').trim()).toBe('const a = 1;');
    expect(stripComments("// the author's note about Phase 2\nconst a = 1;").trim()).toBe(
      'const a = 1;',
    );
  });

  it('keeps comment-looking text that is inside a literal', () => {
    expect(stripComments("const a = '// not a comment';")).toContain('// not a comment');
    expect(stripComments('const a = `/* also not */`;')).toContain('/* also not */');
  });

  it('keeps template literals and escaped quotes whole', () => {
    expect(stripComments('const a = `one\ntwo`;')).toContain('one\ntwo');
    expect(stripComments("const a = 'it\\'s fine';")).toContain("it\\'s fine");
  });
});
