import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { computeDiff, type StructuredDiff } from './diff';
import {
  NEAR_DUPE_THRESHOLD,
  isNearDupe,
  normalizedAddedText,
  suggestionContentHash,
  suggestionSimilarity,
} from './dupes';

const FIXTURE_PATH = join(__dirname, '__fixtures__', 'dupe-vectors.json');

const BLOCKS = [
  'The Owens Valley faces its driest season in a decade.',
  'County filings from March 2025 show a 40% drop in allocations.',
  'Growers south of Big Pine are hit hardest by the cuts.',
  'Officials expect a decision on emergency releases by August.',
];
const BASE = BLOCKS.join('\n\n');
const withBlock = (index: number, text: string) =>
  BLOCKS.map((b, i) => (i === index ? text : b)).join('\n\n');
const withoutBlock = (index: number) => BLOCKS.filter((_, i) => i !== index).join('\n\n');

const CORRECTION_A =
  'County filings from March 2026 show a 34% drop in water allocations across the southern valley.';
const CORRECTION_B =
  'County filings from March 2026 show a 34% drop in water allocations across the entire southern valley.';
const CORRECTION_LOOSE =
  'County filings from March 2026 point to steep cuts in irrigation deliveries for valley growers.';
const UNRELATED_EDIT =
  'The council approved new zoning rules for downtown storefronts after months of debate.';

interface DupeVector {
  label: string;
  a: StructuredDiff;
  b: StructuredDiff;
  isDupe: boolean;
  similarity: number;
}

const round4 = (x: number) => Math.round(x * 10000) / 10000;

function buildVectors(): DupeVector[] {
  const pair = (label: string, aText: string, bText: string): DupeVector => {
    const a = computeDiff(BASE, aText);
    const b = computeDiff(BASE, bText);
    return {
      label,
      a,
      b,
      isDupe: isNearDupe(a, b),
      similarity: round4(suggestionSimilarity(a, b)),
    };
  };
  return [
    pair('identical-diff', withBlock(1, CORRECTION_A), withBlock(1, CORRECTION_A)),
    pair('paraphrase-above-threshold', withBlock(1, CORRECTION_A), withBlock(1, CORRECTION_B)),
    pair('paraphrase-below-threshold', withBlock(1, CORRECTION_A), withBlock(1, CORRECTION_LOOSE)),
    pair('disjoint-blocks-similar-words', withBlock(1, CORRECTION_A), withBlock(3, CORRECTION_A)),
    pair('pure-delete-same-block', withoutBlock(2), withoutBlock(2)),
    pair('different-edit-same-block', withBlock(1, CORRECTION_A), withBlock(1, UNRELATED_EDIT)),
  ];
}

function loadOrRegenVectors(): DupeVector[] {
  if (process.env.REGEN_DUPE_VECTORS === '1' || !existsSync(FIXTURE_PATH)) {
    const vectors = buildVectors();
    mkdirSync(dirname(FIXTURE_PATH), { recursive: true });
    writeFileSync(FIXTURE_PATH, `${JSON.stringify(vectors, null, 2)}\n`);
    return vectors;
  }
  return JSON.parse(readFileSync(FIXTURE_PATH, 'utf8')) as DupeVector[];
}

const vectors = loadOrRegenVectors();

describe('normalizedAddedText', () => {
  it('lowercases and collapses whitespace across added blocks', () => {
    const diff = computeDiff(BASE, withBlock(1, 'County  Filings\tWere   REVISED.'));
    expect(normalizedAddedText(diff)).toBe('county filings were revised.');
  });

  it('is empty for pure deletes', () => {
    expect(normalizedAddedText(computeDiff(BASE, withoutBlock(2)))).toBe('');
  });
});

describe('suggestionContentHash', () => {
  it('is an FNV-1a style 8-hex digest, equal for identical diffs', () => {
    const a = computeDiff(BASE, withBlock(1, CORRECTION_A));
    const b = computeDiff(BASE, withBlock(1, CORRECTION_A));
    expect(suggestionContentHash(a)).toMatch(/^[0-9a-f]{8}$/);
    expect(suggestionContentHash(a)).toBe(suggestionContentHash(b));
  });

  it('differs when the same added text lands on a different op footprint', () => {
    const a = computeDiff(BASE, withBlock(1, CORRECTION_A));
    const b = computeDiff(BASE, withBlock(3, CORRECTION_A));
    expect(suggestionContentHash(a)).not.toBe(suggestionContentHash(b));
  });
});

describe('suggestionSimilarity', () => {
  it('is 1 for identical added text and 1 for two empty token sets', () => {
    const a = computeDiff(BASE, withBlock(1, CORRECTION_A));
    expect(suggestionSimilarity(a, a)).toBe(1);
    const delA = computeDiff(BASE, withoutBlock(2));
    const delB = computeDiff(BASE, withoutBlock(1));
    expect(suggestionSimilarity(delA, delB)).toBe(1);
  });

  it('is 0 between empty and non-empty added text', () => {
    const del = computeDiff(BASE, withoutBlock(2));
    const rep = computeDiff(BASE, withBlock(1, CORRECTION_A));
    expect(suggestionSimilarity(del, rep)).toBe(0);
  });
});

describe('isNearDupe', () => {
  it('is true for identical diffs, with equal hashes', () => {
    const a = computeDiff(BASE, withBlock(1, CORRECTION_A));
    const b = computeDiff(BASE, withBlock(1, CORRECTION_A));
    expect(suggestionContentHash(a)).toBe(suggestionContentHash(b));
    expect(isNearDupe(a, b)).toBe(true);
  });

  it('is true for a close paraphrase above the threshold', () => {
    const a = computeDiff(BASE, withBlock(1, CORRECTION_A));
    const b = computeDiff(BASE, withBlock(1, CORRECTION_B));
    expect(suggestionSimilarity(a, b)).toBeGreaterThanOrEqual(NEAR_DUPE_THRESHOLD);
    expect(isNearDupe(a, b)).toBe(true);
  });

  it('is false for a loose paraphrase below the threshold', () => {
    const a = computeDiff(BASE, withBlock(1, CORRECTION_A));
    const b = computeDiff(BASE, withBlock(1, CORRECTION_LOOSE));
    expect(suggestionSimilarity(a, b)).toBeLessThan(NEAR_DUPE_THRESHOLD);
    expect(isNearDupe(a, b)).toBe(false);
  });

  it('is false for disjoint-block diffs even with identical added words (footprint guard)', () => {
    const a = computeDiff(BASE, withBlock(1, CORRECTION_A));
    const b = computeDiff(BASE, withBlock(3, CORRECTION_A));
    expect(suggestionSimilarity(a, b)).toBeGreaterThanOrEqual(NEAR_DUPE_THRESHOLD);
    expect(isNearDupe(a, b)).toBe(false);
  });

  it('is true for a pure-delete diff compared with itself', () => {
    const del = computeDiff(BASE, withoutBlock(2));
    expect(isNearDupe(del, del)).toBe(true);
  });

  it('holds reflexivity and similarity symmetry over 200 seeded trials', () => {
    let seed = 1337;
    const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
    for (let trial = 0; trial < 200; trial++) {
      const n = 2 + Math.floor(rnd() * 6);
      const base = Array.from({ length: n }, (_, i) => `paragraph ${i} ${Math.floor(rnd() * 1000)}`);
      const mutate = () =>
        base
          .filter(() => rnd() > 0.2)
          .map((p) => (rnd() > 0.7 ? `${p} revised ${Math.floor(rnd() * 100)}` : p))
          .join('\n\n');
      const baseText = base.join('\n\n');
      const a = computeDiff(baseText, mutate());
      const b = computeDiff(baseText, mutate());
      expect(isNearDupe(a, a)).toBe(true);
      expect(suggestionSimilarity(a, b)).toBe(suggestionSimilarity(b, a));
    }
  });
});

describe('dupe vectors fixture', () => {
  it('regenerates byte-stable vectors matching the committed fixture', () => {
    expect(buildVectors()).toEqual(vectors);
    expect(`${JSON.stringify(buildVectors(), null, 2)}\n`).toBe(readFileSync(FIXTURE_PATH, 'utf8'));
  });

  it('labels six pairs with the expected verdicts', () => {
    expect(vectors.map((v) => [v.label, v.isDupe])).toEqual([
      ['identical-diff', true],
      ['paraphrase-above-threshold', true],
      ['paraphrase-below-threshold', false],
      ['disjoint-blocks-similar-words', false],
      ['pure-delete-same-block', true],
      ['different-edit-same-block', false],
    ]);
  });

  it('committed verdicts and similarities match the live engine', () => {
    for (const v of vectors) {
      expect(isNearDupe(v.a, v.b)).toBe(v.isDupe);
      expect(round4(suggestionSimilarity(v.a, v.b))).toBe(v.similarity);
    }
  });
});
