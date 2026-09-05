import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  BOUNDS_ERROR,
  MYNEWS_BOUNDS,
  checkBoundedText,
  checkChangelogEntryCount,
  checkChangelogNote,
  checkCitations,
  checkCommentBody,
  checkDek,
  checkBody,
  checkDisplayName,
  checkHeadline,
  checkHttpsUrl,
  checkJsonDepth,
  checkProfileBio,
  checkRationale,
  checkReportDetail,
  checkStructuredDiff,
  checkStructuredDiffJson,
  jsonDepth,
  utf8ByteLength,
} from './bounds';
import { computeDiff } from '../engines/diff';

const EDGE_MIRROR = resolve(__dirname, '../../../../supabase/functions/_shared/mynews-bounds.ts');

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

describe('MYNEWS_BOUNDS constants', () => {
  it('pins every canonical value as a literal', () => {
    // A change here is a product decision: update the edge mirror, the SQL
    // CHECK constraints in 20260730000003_mynews_comment_boundary.sql, and the
    // provenance comment in bounds.ts in the same change.
    expect(MYNEWS_BOUNDS).toEqual({
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

  it('reproduces the limits that already existed elsewhere', () => {
    // These four are not free choices: they must equal the effective limit the
    // codebase already enforced before WP4 introduced this file.
    // nw_profiles.handle CHECK '^[a-z0-9_]{3,30}$' (bootstrap migration).
    expect([MYNEWS_BOUNDS.HANDLE_MIN_CHARS, MYNEWS_BOUNDS.HANDLE_MAX_CHARS]).toEqual([3, 30]);
    // nw_articles.slug CHECK '^[a-z0-9-]{3,120}$' + SLUG_RE in mynews-publish.
    expect([MYNEWS_BOUNDS.SLUG_MIN_CHARS, MYNEWS_BOUNDS.SLUG_MAX_CHARS]).toEqual([3, 120]);
    // ReportSubmissionSchema detail.max(2000) + mynews-report parseBody.
    expect(MYNEWS_BOUNDS.REPORT_DETAIL_MAX_CHARS).toBe(2000);
    // MAX_NOTE_CHARS in mynews-review + DMCA URL max in models.ts and SQL.
    expect(MYNEWS_BOUNDS.CHANGELOG_NOTE_MAX_CHARS).toBe(2000);
    expect(MYNEWS_BOUNDS.URL_MAX_CHARS).toBe(2000);
  });

  it('stays value-identical to the edge mirror (no drift)', () => {
    const mirrored = parseBoundsBlock(readFileSync(EDGE_MIRROR, 'utf8'));
    expect(mirrored).toEqual({ ...MYNEWS_BOUNDS });
  });

  it('keeps the edge mirror in the same key order', () => {
    const mirrored = parseBoundsBlock(readFileSync(EDGE_MIRROR, 'utf8'));
    expect(Object.keys(mirrored)).toEqual(Object.keys(MYNEWS_BOUNDS));
  });

  it('is frozen', () => {
    expect(Object.isFrozen(MYNEWS_BOUNDS)).toBe(true);
  });

  it('names the typed error the write paths return', () => {
    expect(BOUNDS_ERROR).toBe('bounds');
  });
});

describe('utf8ByteLength', () => {
  it('counts ascii, two-byte, three-byte, and surrogate-pair code points', () => {
    expect(utf8ByteLength('abc')).toBe(3);
    expect(utf8ByteLength('é')).toBe(2);
    expect(utf8ByteLength('水')).toBe(3);
    expect(utf8ByteLength('🌊')).toBe(4);
    expect(utf8ByteLength('')).toBe(0);
  });

  it('agrees with Buffer.byteLength on mixed text', () => {
    const sample = 'Owens Valley 水 é 🌊 ends here';
    expect(utf8ByteLength(sample)).toBe(Buffer.byteLength(sample, 'utf8'));
  });

  it('counts a lone surrogate as three bytes rather than throwing', () => {
    expect(utf8ByteLength('\ud800')).toBe(3);
  });
});

describe('text bounds', () => {
  it('rejects a non-string', () => {
    const result = checkBoundedText(42, 'headline', { maxChars: 10 });
    expect(result).toEqual({
      ok: false,
      failure: { field: 'headline', reason: 'not-a-string', detail: 'headline must be a string' },
    });
  });

  it('treats whitespace-only as empty when a minimum applies', () => {
    expect(checkHeadline('   ')).toMatchObject({ ok: false, failure: { reason: 'empty' } });
    expect(checkRationale('\n\t ')).toMatchObject({ ok: false, failure: { reason: 'empty' } });
  });

  it('accepts a headline at the limit and rejects one character more', () => {
    expect(checkHeadline('h'.repeat(MYNEWS_BOUNDS.HEADLINE_MAX_CHARS))).toEqual({ ok: true });
    expect(checkHeadline('h'.repeat(MYNEWS_BOUNDS.HEADLINE_MAX_CHARS + 1))).toMatchObject({
      ok: false,
      failure: { field: 'headline', reason: 'too-long' },
    });
  });

  it('treats a missing dek as valid and bounds a present one', () => {
    expect(checkDek(undefined)).toEqual({ ok: true });
    expect(checkDek(null)).toEqual({ ok: true });
    expect(checkDek('d'.repeat(MYNEWS_BOUNDS.DEK_MAX_CHARS))).toEqual({ ok: true });
    expect(checkDek('d'.repeat(MYNEWS_BOUNDS.DEK_MAX_CHARS + 1))).toMatchObject({ ok: false });
  });

  it('bounds the body in bytes, not characters', () => {
    // 130k CJK characters are under the char count of a 400k-char cap but over
    // the real storage bound, which is exactly what BODY_MAX_BYTES measures.
    const cjk = '水'.repeat(140000);
    expect(utf8ByteLength(cjk)).toBeGreaterThan(MYNEWS_BOUNDS.BODY_MAX_BYTES);
    expect(checkBody(cjk)).toMatchObject({ ok: false, failure: { reason: 'too-long' } });
    expect(checkBody('a'.repeat(MYNEWS_BOUNDS.BODY_MAX_BYTES))).toEqual({ ok: true });
    expect(checkBody('a'.repeat(MYNEWS_BOUNDS.BODY_MAX_BYTES + 1))).toMatchObject({ ok: false });
    expect(checkBody('  ')).toMatchObject({ ok: false, failure: { reason: 'empty' } });
  });

  it('bounds rationale, comment body, note, detail, display name, and bio', () => {
    expect(checkRationale('r'.repeat(MYNEWS_BOUNDS.RATIONALE_MAX_CHARS + 1))).toMatchObject({
      ok: false,
    });
    expect(checkCommentBody('c'.repeat(MYNEWS_BOUNDS.COMMENT_MAX_CHARS))).toEqual({ ok: true });
    expect(checkCommentBody('c'.repeat(MYNEWS_BOUNDS.COMMENT_MAX_CHARS + 1))).toMatchObject({
      ok: false,
      failure: { field: 'body', reason: 'too-long' },
    });
    expect(checkCommentBody('')).toMatchObject({ ok: false, failure: { reason: 'empty' } });
    expect(checkChangelogNote(undefined)).toEqual({ ok: true });
    expect(
      checkChangelogNote('n'.repeat(MYNEWS_BOUNDS.CHANGELOG_NOTE_MAX_CHARS + 1)),
    ).toMatchObject({ ok: false });
    expect(checkReportDetail('')).toEqual({ ok: true });
    expect(checkReportDetail('d'.repeat(MYNEWS_BOUNDS.REPORT_DETAIL_MAX_CHARS + 1))).toMatchObject({
      ok: false,
    });
    expect(checkDisplayName('n'.repeat(MYNEWS_BOUNDS.DISPLAY_NAME_MAX_CHARS + 1))).toMatchObject({
      ok: false,
    });
    expect(checkProfileBio('b'.repeat(MYNEWS_BOUNDS.PROFILE_BIO_MAX_CHARS + 1))).toMatchObject({
      ok: false,
    });
  });
});

describe('citations and URLs', () => {
  const url = (n: number) => `https://example.org/${n}`;

  it('accepts a bounded https list', () => {
    expect(checkCitations([url(1), url(2)])).toEqual({ ok: true });
    expect(checkCitations([])).toEqual({ ok: true });
  });

  it('rejects a non-array, an over-long list, http, and an over-long URL', () => {
    expect(checkCitations('https://example.org')).toMatchObject({
      ok: false,
      failure: { reason: 'malformed' },
    });
    const tooMany = Array.from({ length: MYNEWS_BOUNDS.CITATIONS_MAX_ITEMS + 1 }, (_, i) => url(i));
    expect(checkCitations(tooMany)).toMatchObject({
      ok: false,
      failure: { field: 'citations', reason: 'too-many-items' },
    });
    expect(checkCitations([url(1), 'http://example.org'])).toMatchObject({
      ok: false,
      failure: { field: 'citations[1]', reason: 'not-https' },
    });
    const long = `https://example.org/${'x'.repeat(MYNEWS_BOUNDS.URL_MAX_CHARS)}`;
    expect(checkCitations([long])).toMatchObject({
      ok: false,
      failure: { field: 'citations[0]', reason: 'too-long' },
    });
  });

  it('accepts exactly the item ceiling', () => {
    const atCap = Array.from({ length: MYNEWS_BOUNDS.CITATIONS_MAX_ITEMS }, (_, i) => url(i));
    expect(checkCitations(atCap)).toEqual({ ok: true });
  });

  it('rejects an empty or non-string URL', () => {
    expect(checkHttpsUrl('')).toMatchObject({ ok: false, failure: { reason: 'empty' } });
    expect(checkHttpsUrl(null)).toMatchObject({ ok: false, failure: { reason: 'not-a-string' } });
  });
});

describe('changelog entry count', () => {
  it('bounds the credited set and rejects a non-array', () => {
    expect(checkChangelogEntryCount([])).toEqual({ ok: true });
    expect(
      checkChangelogEntryCount(new Array(MYNEWS_BOUNDS.CHANGELOG_MAX_ENTRIES).fill({})),
    ).toEqual({ ok: true });
    expect(
      checkChangelogEntryCount(new Array(MYNEWS_BOUNDS.CHANGELOG_MAX_ENTRIES + 1).fill({})),
    ).toMatchObject({ ok: false, failure: { reason: 'too-many-items' } });
    expect(checkChangelogEntryCount({})).toMatchObject({
      ok: false,
      failure: { reason: 'malformed' },
    });
  });
});

describe('json depth', () => {
  it('measures scalars, arrays, and objects', () => {
    expect(jsonDepth(1)).toBe(1);
    expect(jsonDepth({ a: 1 })).toBe(2);
    expect(jsonDepth({ a: [1] })).toBe(3);
  });

  it('rejects a payload nested past the ceiling without recursing', () => {
    let deep: unknown = 'leaf';
    for (let i = 0; i < 50; i++) deep = { next: deep };
    expect(checkJsonDepth(deep)).toMatchObject({ ok: false, failure: { reason: 'too-deep' } });
    expect(checkJsonDepth({ a: { b: { c: 1 } } })).toEqual({ ok: true });
  });
});

describe('structured diff bounds', () => {
  const realDiff = computeDiff('one\n\ntwo\n\nthree', 'one\n\ntwo point five\n\nthree');

  it('accepts a diff produced by the real engine', () => {
    expect(checkStructuredDiff(realDiff)).toEqual({ ok: true });
    expect(checkStructuredDiffJson(JSON.stringify(realDiff))).toEqual({
      ok: true,
      diff: JSON.parse(JSON.stringify(realDiff)),
    });
  });

  it('rejects a non-object, a missing baseHash, and a non-array ops', () => {
    expect(checkStructuredDiff([])).toMatchObject({ ok: false, failure: { reason: 'malformed' } });
    expect(checkStructuredDiff({ ops: [] })).toMatchObject({
      ok: false,
      failure: { field: 'diff.baseHash' },
    });
    expect(checkStructuredDiff({ baseHash: 'abc', ops: {} })).toMatchObject({
      ok: false,
      failure: { field: 'diff.ops', reason: 'malformed' },
    });
  });

  it('rejects an unknown op kind and a negative baseIndex', () => {
    const op = { ...realDiff.ops[0]!, kind: 'obliterate' };
    expect(checkStructuredDiff({ baseHash: realDiff.baseHash, ops: [op] })).toMatchObject({
      ok: false,
      failure: { field: 'diff.ops[0].kind', reason: 'malformed' },
    });
    const negative = { ...realDiff.ops[0]!, baseIndex: -1 };
    expect(checkStructuredDiff({ baseHash: realDiff.baseHash, ops: [negative] })).toMatchObject({
      ok: false,
      failure: { field: 'diff.ops[0].baseIndex', reason: 'malformed' },
    });
  });

  it('bounds the op count, the blocks per op, and each block string', () => {
    const op = realDiff.ops[0]!;
    const tooManyOps = new Array(MYNEWS_BOUNDS.DIFF_MAX_OPS + 1).fill(op);
    expect(checkStructuredDiff({ baseHash: realDiff.baseHash, ops: tooManyOps })).toMatchObject({
      ok: false,
      failure: { field: 'diff.ops', reason: 'too-many-items' },
    });
    const tooManyBlocks = {
      ...op,
      newBlocks: new Array(MYNEWS_BOUNDS.DIFF_MAX_BLOCKS_PER_OP + 1).fill('x'),
    };
    expect(
      checkStructuredDiff({ baseHash: realDiff.baseHash, ops: [tooManyBlocks] }),
    ).toMatchObject({
      ok: false,
      failure: { field: 'diff.ops[0].newBlocks', reason: 'too-many-items' },
    });
    const hugeBlock = { ...op, newBlocks: ['x'.repeat(MYNEWS_BOUNDS.DIFF_MAX_BLOCK_CHARS + 1)] };
    expect(checkStructuredDiff({ baseHash: realDiff.baseHash, ops: [hugeBlock] })).toMatchObject({
      ok: false,
      failure: { field: 'diff.ops[0].newBlocks[0]', reason: 'too-long' },
    });
  });

  it('rejects a non-string block and a non-string anchor', () => {
    const op = realDiff.ops[0]!;
    expect(
      checkStructuredDiff({ baseHash: realDiff.baseHash, ops: [{ ...op, baseBlocks: [7] }] }),
    ).toMatchObject({ ok: false, failure: { reason: 'not-a-string' } });
    expect(
      checkStructuredDiff({ baseHash: realDiff.baseHash, ops: [{ ...op, anchorBefore: 7 }] }),
    ).toMatchObject({ ok: false, failure: { field: 'diff.ops[0].anchorBefore' } });
  });

  it('rejects an over-long baseHash', () => {
    expect(
      checkStructuredDiff({
        baseHash: 'a'.repeat(MYNEWS_BOUNDS.DIFF_BASE_HASH_MAX_CHARS + 1),
        ops: [],
      }),
    ).toMatchObject({ ok: false, failure: { field: 'diff.baseHash', reason: 'too-long' } });
  });

  it('rejects a serialized diff over the byte ceiling before parsing it', () => {
    const oversized = `{"baseHash":"abc","ops":[],"pad":"${'x'.repeat(
      MYNEWS_BOUNDS.DIFF_MAX_BYTES,
    )}"}`;
    expect(checkStructuredDiffJson(oversized)).toMatchObject({
      ok: false,
      failure: { field: 'diffJson', reason: 'too-long' },
    });
  });

  it('rejects a non-JSON and a non-string serialized diff', () => {
    expect(checkStructuredDiffJson('not json')).toMatchObject({
      ok: false,
      failure: { reason: 'malformed', detail: 'diffJson is not JSON' },
    });
    expect(checkStructuredDiffJson({ baseHash: 'a', ops: [] })).toMatchObject({
      ok: false,
      failure: { reason: 'not-a-string' },
    });
  });
});
