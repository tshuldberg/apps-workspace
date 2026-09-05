import { describe, expect, it } from 'vitest';
import * as enginesPublic from './engines-public';

describe('engines-public subpath (@mylife/mynews/engines)', () => {
  it('exposes the pure engines the web SSR surfaces depend on', () => {
    expect(typeof enginesPublic.computeDiff).toBe('function');
    expect(typeof enginesPublic.applyDiff).toBe('function');
    expect(typeof enginesPublic.rebaseDiff).toBe('function');
    expect(typeof enginesPublic.combineDiffs).toBe('function');
    expect(typeof enginesPublic.ledgerWeightedScore).toBe('function');
    expect(typeof enginesPublic.editorStatsFromAggregates).toBe('function');
    expect(typeof enginesPublic.levelFor).toBe('function');
    expect(typeof enginesPublic.openSuggestionCap).toBe('function');
    expect(typeof enginesPublic.computeScore).toBe('function');
    expect(typeof enginesPublic.diversityMultiplier).toBe('function');
    expect(typeof enginesPublic.standingMultiplier).toBe('function');
    expect(typeof enginesPublic.isNearDupe).toBe('function');
    expect(typeof enginesPublic.suggestionContentHash).toBe('function');
    expect(enginesPublic.BASE_POINTS).toEqual({
      correction: 10,
      context: 7,
      translation: 7,
      clarity: 4,
      headline: 3,
      copyedit: 1,
    });
    expect(enginesPublic.NEAR_DUPE_THRESHOLD).toBe(0.85);
  });
});
