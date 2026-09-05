import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  EDGE_BOUNDS_ERROR,
  EDGE_MYNEWS_BOUNDS,
  checkBody,
  checkCitations,
  checkCommentBody,
  checkDek,
  checkHeadline,
  checkRationale,
  checkStructuredDiff,
  checkStructuredDiffJson,
  utf8ByteLength,
} from '../mynews-bounds.ts';

const MODULE_SOURCE = resolve(__dirname, '../../../../modules/mynews/src/data/bounds.ts');

/** Parse the `KEY: 123,` lines out of a bounds file's Object.freeze block. */
function parseBoundsBlock(source: string): Record<string, number> {
  const block = source.slice(
    source.indexOf('Object.freeze({'),
    source.indexOf('});', source.indexOf('Object.freeze({')),
  );
  const out: Record<string, number> = {};
  for (const line of block.split('\n')) {
    const match = /^\s{2}([A-Z0-9_]+):\s*(\d+),$/.exec(line);
    if (match) out[match[1]!] = Number(match[2]);
  }
  return out;
}

describe('EDGE_MYNEWS_BOUNDS', () => {
  it('pins every canonical value as a literal', () => {
    // The edge half of the drift pin. Bump a number here and the module test
    // (modules/mynews/src/data/bounds.test.ts) fails too, by design.
    expect(EDGE_MYNEWS_BOUNDS).toEqual({
      HANDLE_MIN_CHARS: 3,
      HANDLE_MAX_CHARS: 30,
      SLUG_MIN_CHARS: 3,
      SLUG_MAX_CHARS: 120,
      DISPLAY_NAME_MAX_CHARS: 80,
      PROFILE_BIO_MAX_CHARS: 2000,
      HEADLINE_MIN_CHARS: 1,
      HEADLINE_MAX_CHARS: 300,
      DEK_MAX_CHARS: 600,
      BODY_MIN_BYTES: 1,
      BODY_MAX_BYTES: 400000,
      RATIONALE_MIN_CHARS: 1,
      RATIONALE_MAX_CHARS: 4000,
      COMMENT_MIN_CHARS: 1,
      COMMENT_MAX_CHARS: 4000,
      CHANGELOG_NOTE_MAX_CHARS: 2000,
      CHANGELOG_MAX_ENTRIES: 100,
      REPORT_DETAIL_MAX_CHARS: 2000,
      URL_MAX_CHARS: 2000,
      CITATIONS_MAX_ITEMS: 20,
      DIFF_MAX_OPS: 200,
      DIFF_MAX_BLOCKS_PER_OP: 200,
      DIFF_MAX_BLOCK_CHARS: 20000,
      DIFF_BASE_HASH_MAX_CHARS: 64,
      DIFF_MAX_BYTES: 400000,
      JSON_MAX_DEPTH: 8,
    });
  });

  it('stays value-identical to the module source of truth (no drift)', () => {
    const canonical = parseBoundsBlock(readFileSync(MODULE_SOURCE, 'utf8'));
    expect(canonical).toEqual({ ...EDGE_MYNEWS_BOUNDS });
    expect(Object.keys(canonical)).toEqual(Object.keys(EDGE_MYNEWS_BOUNDS));
  });

  it('is frozen and names the typed error', () => {
    expect(Object.isFrozen(EDGE_MYNEWS_BOUNDS)).toBe(true);
    expect(EDGE_BOUNDS_ERROR).toBe('bounds');
  });
});

describe('edge validators behave like the module twins', () => {
  it('measures utf8 bytes the way Postgres octet_length does', () => {
    const sample = 'Owens Valley 水 é 🌊';
    expect(utf8ByteLength(sample)).toBe(Buffer.byteLength(sample, 'utf8'));
  });

  it('bounds headline, dek, body, rationale, and comment body', () => {
    expect(checkHeadline('h'.repeat(EDGE_MYNEWS_BOUNDS.HEADLINE_MAX_CHARS))).toEqual({ ok: true });
    expect(checkHeadline('h'.repeat(EDGE_MYNEWS_BOUNDS.HEADLINE_MAX_CHARS + 1))).toMatchObject({
      ok: false,
      failure: { reason: 'too-long' },
    });
    expect(checkHeadline('   ')).toMatchObject({ ok: false, failure: { reason: 'empty' } });
    expect(checkDek(undefined)).toEqual({ ok: true });
    expect(checkDek('d'.repeat(EDGE_MYNEWS_BOUNDS.DEK_MAX_CHARS + 1))).toMatchObject({ ok: false });
    expect(checkBody('a'.repeat(EDGE_MYNEWS_BOUNDS.BODY_MAX_BYTES + 1))).toMatchObject({
      ok: false,
    });
    expect(checkRationale('')).toMatchObject({ ok: false, failure: { reason: 'empty' } });
    expect(checkCommentBody('c'.repeat(EDGE_MYNEWS_BOUNDS.COMMENT_MAX_CHARS + 1))).toMatchObject({
      ok: false,
      failure: { field: 'body', reason: 'too-long' },
    });
  });

  it('bounds citations by count, scheme, and URL length', () => {
    const many = Array.from(
      { length: EDGE_MYNEWS_BOUNDS.CITATIONS_MAX_ITEMS + 1 },
      (_, i) => `https://example.org/${i}`,
    );
    expect(checkCitations(many)).toMatchObject({ ok: false, failure: { reason: 'too-many-items' } });
    expect(checkCitations(['http://example.org'])).toMatchObject({
      ok: false,
      failure: { reason: 'not-https' },
    });
  });

  it('accepts a real diff and rejects malformed, oversized, and over-nested ones', () => {
    const diff = {
      baseHash: 'deadbeef',
      ops: [
        {
          kind: 'replace',
          baseIndex: 1,
          anchorBefore: 'one',
          anchorAfter: 'three',
          baseBlocks: ['two'],
          newBlocks: ['two point five'],
        },
      ],
    };
    expect(checkStructuredDiff(diff)).toEqual({ ok: true });
    expect(checkStructuredDiffJson(JSON.stringify(diff))).toEqual({ ok: true, diff });
    expect(checkStructuredDiffJson('{')).toMatchObject({
      ok: false,
      failure: { reason: 'malformed' },
    });
    const oversized = `{"baseHash":"abc","ops":[],"pad":"${'x'.repeat(
      EDGE_MYNEWS_BOUNDS.DIFF_MAX_BYTES,
    )}"}`;
    expect(checkStructuredDiffJson(oversized)).toMatchObject({
      ok: false,
      failure: { reason: 'too-long' },
    });
    expect(
      checkStructuredDiff({ baseHash: 'abc', ops: [{ ...diff.ops[0], kind: 'nope' }] }),
    ).toMatchObject({ ok: false, failure: { field: 'diff.ops[0].kind' } });
  });
});
