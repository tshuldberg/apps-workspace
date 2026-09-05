/**
 * Product-copy claim gate for the public MyNews website.
 *
 * The shared legal-copy parity test only covered the legal bundle, which is how
 * `lib/editing.ts` shipped "Verified identity, arrives with verification
 * (Phase 3)" and `app/legal/page.tsx` shipped a hardcoded "2% platform fee"
 * claim while pinning the frozen unconfigured legal documents. This test scans
 * the SOURCE under app/ and lib/ and enforces two mechanical rules:
 *
 *  1. No staged-delivery markers in user-visible copy.
 *  2. Every 2% platform-fee claim lives in a file that derives from the
 *     capability system (lib/capabilities.ts or the module's capability and fee
 *     exports), so the claim cannot appear in a deployment with no payment rail.
 *
 * "User-visible copy" is the source with COMMENTS REMOVED, which covers string
 * literals AND bare JSX text; a literal-only scan would miss the copy that
 * matters most. Implementation notes in comments stay free to explain history.
 *
 * Both rules walk the tree rather than an allowlist, so a NEW page is covered
 * the moment it is added.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { extname, join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

const WEB_DIR = join(__dirname, '..');
const SCANNED_ROOTS = ['app', 'lib'];
const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx']);
const SKIPPED_DIRECTORIES = new Set(['node_modules', '.next']);

const STAGED_DELIVERY_PATTERNS = [/Phase\s*\d/i, /coming soon/i];
const FEE_CLAIM_PATTERN = /\b2\s*%|\b2 percent\b/i;

const CAPABILITY_IMPORT_MARKERS = [
  'lib/capabilities',
  './capabilities',
  'readWebLegalContext',
  'buildWebLegalContext',
  'detectWebCapabilities',
  'detectMyNewsCapabilities',
  'createLegalContent',
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
 * The source with line and block comments removed. Character scanner, so `//`
 * inside a URL literal is not read as a comment start and an apostrophe inside a
 * comment is not read as a string start.
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

const FILES = SCANNED_ROOTS.flatMap((root) => sourceFiles(join(WEB_DIR, root)));

describe('MyNews web product copy', () => {
  it('scans every page and lib module', () => {
    expect(FILES.length).toBeGreaterThan(15);
    expect(FILES.some((file) => file.endsWith(join('legal', 'page.tsx')))).toBe(true);
    expect(FILES.some((file) => file.endsWith(join('lib', 'editing.ts')))).toBe(true);
  });

  it('ships no staged-delivery markers in user-visible copy', () => {
    const offenders: string[] = [];
    for (const file of FILES) {
      const source = readFileSync(file, 'utf8');
      for (const pattern of STAGED_DELIVERY_PATTERNS) {
        for (const line of matchingLines(source, pattern)) {
          offenders.push(`${relative(WEB_DIR, file)}: ${line}`);
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
      offenders.push(`${relative(WEB_DIR, file)}: ${claims[0]}`);
    }
    expect(offenders).toEqual([]);
    expect(claimingFiles).toBeGreaterThan(0);
  });

  it('keeps the legal document pages off the frozen unconfigured export set', () => {
    for (const page of ['legal/page.tsx', 'legal/terms/page.tsx', 'legal/privacy/page.tsx', 'legal/guidelines/page.tsx']) {
      const source = readFileSync(join(WEB_DIR, 'app', page), 'utf8');
      expect(source, page).toContain('readWebLegalContext');
      // The frozen constants are exactly what made the copy capability-blind.
      expect(source, page).not.toMatch(/\b(TERMS_OF_SERVICE|PRIVACY_POLICY|COMMUNITY_GUIDELINES)\b/);
    }
  });

  it('gates the fee claim on the payments capability in the legal hub', () => {
    const source = stripComments(readFileSync(join(WEB_DIR, 'app/legal/page.tsx'), 'utf8'));
    const claimLine = source
      .split('\n')
      .find((line) => FEE_CLAIM_PATTERN.test(line));
    expect(claimLine).toBeDefined();
    expect(claimLine).toContain('capabilities.payments');
  });
});

describe('stripComments', () => {
  it('removes comments while keeping code and URLs intact', () => {
    expect(stripComments("// Phase 3 note\nconst a = 'https://example.com';").trim()).toBe(
      "const a = 'https://example.com';",
    );
    expect(stripComments('/* coming soon */ const a = 1;').trim()).toBe('const a = 1;');
  });

  it('keeps comment-looking text that is inside a literal', () => {
    expect(stripComments("const a = '// not a comment';")).toContain('// not a comment');
  });
});
