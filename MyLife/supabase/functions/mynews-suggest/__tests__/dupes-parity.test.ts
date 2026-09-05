// Twin-parity guard: _shared/mynews-dupes.ts must stay behaviorally identical
// to modules/mynews/src/engines/dupes.ts. Both sides assert the committed
// fixture dupe-vectors.json; the deployed function never imports the module.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  NEAR_DUPE_THRESHOLD as ENGINE_NEAR_DUPE_THRESHOLD,
  isNearDupe as engineIsNearDupe,
  normalizedAddedText as engineNormalizedAddedText,
  suggestionContentHash as engineSuggestionContentHash,
  suggestionSimilarity as engineSuggestionSimilarity,
} from '../../../../modules/mynews/src/engines/dupes';
import { computeDiff } from '../../../../modules/mynews/src/engines/diff';
import {
  NEAR_DUPE_THRESHOLD,
  isNearDupe,
  normalizedAddedText,
  suggestionContentHash,
  suggestionSimilarity,
  type StructuredDiff,
} from '../../_shared/mynews-dupes.ts';

interface DupeVector {
  label: string;
  a: StructuredDiff;
  b: StructuredDiff;
  isDupe: boolean;
  similarity: number;
}

const vectors = JSON.parse(
  readFileSync(
    join(__dirname, '../../../../modules/mynews/src/engines/__fixtures__/dupe-vectors.json'),
    'utf8',
  ),
) as DupeVector[];

describe('dupes twin parity', () => {
  it('shares the near-dupe threshold', () => {
    expect(NEAR_DUPE_THRESHOLD).toBe(ENGINE_NEAR_DUPE_THRESHOLD);
  });

  it('matches the module engine on every committed dupe vector', () => {
    expect(vectors.length).toBeGreaterThanOrEqual(6);
    for (const { label, a, b, isDupe, similarity } of vectors) {
      for (const diff of [a, b]) {
        expect(normalizedAddedText(diff), label).toBe(engineNormalizedAddedText(diff));
        expect(suggestionContentHash(diff), label).toBe(engineSuggestionContentHash(diff));
      }
      expect(suggestionSimilarity(a, b), label).toBe(engineSuggestionSimilarity(a, b));
      expect(suggestionSimilarity(a, b), label).toBeCloseTo(similarity, 4);
      expect(isNearDupe(a, b), label).toBe(engineIsNearDupe(a, b));
      expect(isNearDupe(a, b), label).toBe(isDupe);
      // Symmetry on both sides.
      expect(isNearDupe(b, a), label).toBe(engineIsNearDupe(b, a));
      expect(suggestionSimilarity(b, a), label).toBe(engineSuggestionSimilarity(b, a));
    }
  });

  it('matches the module engine on synthetic computeDiff output', () => {
    const base = ['Alpha block one.', 'Beta block two.', 'Gamma block three.', 'Delta block four.'].join(
      '\n\n',
    );
    const rewordedA = base.replace('Beta block two.', 'Beta block two, now with sourcing.');
    const rewordedB = base.replace('Beta block two.', 'Beta block two, now with better sourcing.');
    const insertion = base.replace(
      'Gamma block three.',
      'Gamma block three.\n\nEntirely new context paragraph with citations.',
    );
    const deletion = base.replace('\n\nDelta block four.', '');

    const diffs = [
      computeDiff(base, rewordedA),
      computeDiff(base, rewordedB),
      computeDiff(base, insertion),
      computeDiff(base, deletion),
      { baseHash: computeDiff(base, base).baseHash, ops: [] },
    ];

    for (const d of diffs) {
      expect(normalizedAddedText(d)).toBe(engineNormalizedAddedText(d));
      expect(suggestionContentHash(d)).toBe(engineSuggestionContentHash(d));
    }
    for (const x of diffs) {
      for (const y of diffs) {
        expect(suggestionSimilarity(x, y)).toBe(engineSuggestionSimilarity(x, y));
        expect(isNearDupe(x, y)).toBe(engineIsNearDupe(x, y));
      }
    }
    // Sanity on the synthetic pairs themselves (same verdicts on both sides
    // could still both be wrong; pin the intent).
    expect(isNearDupe(diffs[0]!, diffs[1]!)).toBe(true); // reworded same block
    expect(isNearDupe(diffs[0]!, diffs[2]!)).toBe(false); // different block
    expect(isNearDupe(diffs[3]!, diffs[3]!)).toBe(true); // pure delete self-dupe
  });
});
