import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// @ts-expect-error the generator is a plain .mjs script with no type declarations
import { SOURCE_FILES, TWIN_PATH, buildTwin } from '../../../../../scripts/gen-mynews-screening-twin.mjs';

/**
 * The edge twin is generated, not hand-copied. Regenerating in memory and
 * comparing bytes is a stronger drift pin than any behavioural parity test could
 * be: the twin cannot fall behind the module, and it cannot be edited by hand
 * without this failing.
 */
describe('mynews screening edge twin', () => {
  it('matches the generator output byte for byte', () => {
    const committed = readFileSync(TWIN_PATH as string, 'utf8');
    expect(committed).toBe(buildTwin());
  });

  it('is marked generated so nobody edits it by hand', () => {
    const committed = readFileSync(TWIN_PATH as string, 'utf8');
    expect(committed.startsWith('// GENERATED FILE. Do not edit.')).toBe(true);
    expect(committed).toContain('node scripts/gen-mynews-screening-twin.mjs');
  });

  it('carries every screening source file', () => {
    const committed = readFileSync(TWIN_PATH as string, 'utf8');
    for (const fileName of SOURCE_FILES as string[]) {
      expect(committed).toContain(`screening/${fileName}`);
    }
  });

  it('has no imports at all, so Deno can load it standalone', () => {
    const committed = readFileSync(TWIN_PATH as string, 'utf8');
    expect(committed).not.toMatch(/^import\s/m);
  });

  it('keeps the lexicons and thresholds identical to the module', () => {
    const committed = readFileSync(TWIN_PATH as string, 'utf8');
    // Two anchors that a stale twin would lose: the class policy table and the
    // engine version stamp that lands on every persisted decision row.
    expect(committed).toContain("'child-safety': { quarantineAt: 0.25, humanOnly: true }");
    expect(committed).toContain("export const SCREENING_ENGINE_VERSION = '2026-07-30.1'");
  });
});
