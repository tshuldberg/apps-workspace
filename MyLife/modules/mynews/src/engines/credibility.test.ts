import { describe, expect, it } from 'vitest';
import type { CredibilityEntry } from '../models';
import {
  BASE_POINTS,
  authorStandingForTier,
  computeScore,
  decayFactor,
  diversityMultiplier,
  editorStatsFromAggregates,
  ledgerWeightedScore,
  levelFor,
  openSuggestionCap,
  standingMultiplier,
} from './credibility';

const DAY = 86_400_000;
const entry = (over: Partial<CredibilityEntry>): CredibilityEntry => ({
  type: 'correction',
  acceptedAtMs: 0,
  authorKey: 'a1',
  authorStanding: 1,
  ...over,
});

describe('multipliers', () => {
  it('diversity spans 0.3 to 1.5 and is monotonic', () => {
    expect(diversityMultiplier(0)).toBe(0.3);
    expect(diversityMultiplier(1)).toBeCloseTo(0.3, 5);
    expect(diversityMultiplier(11)).toBe(1.5);
    for (let d = 1; d < 15; d++) {
      expect(diversityMultiplier(d + 1)).toBeGreaterThanOrEqual(diversityMultiplier(d));
    }
  });
  it('standing maps 0..1 to 0.5..1.2', () => {
    expect(standingMultiplier(0)).toBe(0.5);
    expect(standingMultiplier(1)).toBeCloseTo(1.2, 5);
  });
  it('decay halves at 365 days and never goes negative', () => {
    expect(decayFactor(0)).toBe(1);
    expect(decayFactor(365 * DAY)).toBeCloseTo(0.5, 5);
    expect(decayFactor(3650 * DAY)).toBeGreaterThan(0);
  });
});

describe('computeScore', () => {
  it('weights corrections above copyedits', () => {
    const now = 0;
    const c = computeScore([entry({ type: 'correction' })], now);
    const e = computeScore([entry({ type: 'copyedit' })], now);
    expect(BASE_POINTS.correction).toBe(10);
    expect(BASE_POINTS.copyedit).toBe(1);
    expect(c).toBeGreaterThan(e * 5);
  });

  it('ten authors beat one author at equal volume', () => {
    const now = 0;
    const one = Array.from({ length: 10 }, () => entry({ authorKey: 'same' }));
    const ten = Array.from({ length: 10 }, (_, i) => entry({ authorKey: `a${i}` }));
    expect(computeScore(ten, now)).toBeGreaterThan(computeScore(one, now) * 2);
  });

  it('self edits earn zero', () => {
    expect(computeScore([entry({ selfEdit: true })], 0)).toBe(0);
  });
});

describe('levels', () => {
  const base = {
    weightedScore: 0,
    acceptedTotal: 0,
    acceptedCopyedits: 0,
    distinctAuthors: 0,
    acceptanceRate: 1,
    decidedSampleSize: 0,
    sanctionsInLast90d: 0,
    topicScore: 0,
    endorsements: 0,
    identityVerified: false,
    maxPairShare: 0,
  };
  it('walks the ladder', () => {
    expect(levelFor(base)).toBe('reader');
    expect(levelFor({ ...base, acceptedTotal: 1 })).toBe('contributor');
    expect(
      levelFor({
        ...base,
        acceptedTotal: 25,
        acceptedCopyedits: 25,
        acceptanceRate: 0.6,
        distinctAuthors: 5,
      }),
    ).toBe('copyeditor');
    expect(
      levelFor({ ...base, acceptedTotal: 40, weightedScore: 150, distinctAuthors: 10 }),
    ).toBe('trusted_editor');
    expect(
      levelFor({
        ...base,
        acceptedTotal: 80,
        weightedScore: 600,
        distinctAuthors: 15,
        topicScore: 500,
        endorsements: 3,
        identityVerified: true,
      }),
    ).toBe('section_editor');
  });
  it('sanctions block trusted_editor', () => {
    expect(
      levelFor({
        ...base,
        weightedScore: 200,
        distinctAuthors: 12,
        acceptedTotal: 30,
        sanctionsInLast90d: 1,
      }),
    ).toBe('contributor');
  });
  it('unverified identity blocks section_editor', () => {
    expect(
      levelFor({
        ...base,
        acceptedTotal: 80,
        weightedScore: 600,
        distinctAuthors: 15,
        topicScore: 500,
        endorsements: 3,
        identityVerified: false,
      }),
    ).toBe('trusted_editor');
  });

  it('pair-concentration above the trust gate blocks trusted_editor (Sybil ring)', () => {
    // A collusion ring inflates distinctAuthors and weighted score, but its
    // merges concentrate on a single target author, so maxPairShare stays high.
    const ring = {
      ...base,
      acceptedTotal: 40,
      weightedScore: 200,
      distinctAuthors: 12,
      sanctionsInLast90d: 0,
      maxPairShare: 0.6,
    };
    expect(levelFor(ring)).toBe('contributor');
    // Exactly at the threshold still qualifies; just above it does not.
    expect(levelFor({ ...ring, maxPairShare: 0.5 })).toBe('trusted_editor');
    expect(levelFor({ ...ring, maxPairShare: 0.5001 })).toBe('contributor');
    // A legitimately diverse editor (low concentration) still reaches trusted.
    expect(levelFor({ ...ring, maxPairShare: 0.15 })).toBe('trusted_editor');
  });

  it('pair-concentration also caps the section_editor ceiling', () => {
    const concentrated = {
      ...base,
      acceptedTotal: 80,
      weightedScore: 600,
      distinctAuthors: 15,
      topicScore: 500,
      endorsements: 3,
      identityVerified: true,
      maxPairShare: 0.7,
    };
    expect(levelFor(concentrated)).toBe('contributor');
  });
});

describe('authorStandingForTier', () => {
  it('maps the C7 interim tiers to 0.5 baseline and 0.75 verified', () => {
    expect(authorStandingForTier('open')).toBe(0.5);
    expect(authorStandingForTier('verified')).toBe(0.75);
    expect(standingMultiplier(authorStandingForTier('open'))).toBeCloseTo(0.85, 10);
    expect(standingMultiplier(authorStandingForTier('verified'))).toBeCloseTo(1.025, 10);
  });
});

describe('ledgerWeightedScore', () => {
  const nowMs = Date.UTC(2026, 6, 3);

  it('is the decayed award sum times the diversity multiplier', () => {
    const rows = [
      { basePoints: 10, standingMult: 0.85, awardedAt: new Date(nowMs).toISOString() },
      { basePoints: 4, standingMult: 1.025, awardedAt: new Date(nowMs - 365 * DAY).toISOString() },
    ];
    const expected = diversityMultiplier(3) * (10 * 0.85 + 4 * 1.025 * 0.5);
    expect(ledgerWeightedScore(rows, 3, nowMs)).toBeCloseTo(expected, 10);
    expect(ledgerWeightedScore([], 12, nowMs)).toBe(0);
  });

  it('clamps future awards to full weight (no negative-age boost)', () => {
    const rows = [{ basePoints: 3, standingMult: 0.5, awardedAt: new Date(nowMs + DAY).toISOString() }];
    expect(ledgerWeightedScore(rows, 2, nowMs)).toBeCloseTo(diversityMultiplier(2) * 1.5, 10);
  });

  it('matches computeScore over an equivalent ledger', () => {
    const entries: CredibilityEntry[] = [
      { type: 'correction', acceptedAtMs: nowMs - 30 * DAY, authorKey: 'a1', authorStanding: 0.5 },
      { type: 'clarity', acceptedAtMs: nowMs - 200 * DAY, authorKey: 'a2', authorStanding: 0.75 },
    ];
    const rows = entries.map((e) => ({
      basePoints: BASE_POINTS[e.type],
      standingMult: standingMultiplier(e.authorStanding),
      awardedAt: new Date(e.acceptedAtMs).toISOString(),
    }));
    expect(ledgerWeightedScore(rows, 2, nowMs)).toBe(computeScore(entries, nowMs));
  });
});

describe('editorStatsFromAggregates', () => {
  it('passes raw stats through and leaves absent WP8 signals inert', () => {
    const stats = editorStatsFromAggregates(
      {
        acceptedTotal: 30,
        acceptedCopyedits: 25,
        distinctAuthors: 5,
        acceptanceRate: 0.8,
        decidedSampleSize: 40,
        sanctionsInLast90d: 0,
      },
      42,
    );
    expect(stats).toEqual({
      weightedScore: 42,
      acceptedTotal: 30,
      acceptedCopyedits: 25,
      distinctAuthors: 5,
      acceptanceRate: 0.8,
      decidedSampleSize: 40,
      sanctionsInLast90d: 0,
      topicScore: 0,
      endorsements: 0,
      identityVerified: false,
      maxPairShare: 0,
      // Plan 48 WP8: absent age and verification signals stay null so they
      // cannot silently downgrade a caller that has no such input, and ring
      // suspicion defaults to none.
      accountAgeMs: null,
      verification: null,
      ringSuspicion: 0,
    });
    expect(levelFor(stats)).toBe('copyeditor');
    expect(openSuggestionCap(stats)).toBe(12);
  });

  it('threads maxPairShare through and caps the trusted tier via the cap', () => {
    const ringAgg = {
      acceptedTotal: 40,
      acceptedCopyedits: 0,
      distinctAuthors: 12,
      acceptanceRate: 1,
      decidedSampleSize: 40,
      sanctionsInLast90d: 0,
      maxPairShare: 0.6,
    };
    const stats = editorStatsFromAggregates(ringAgg, 200);
    expect(stats.maxPairShare).toBe(0.6);
    // Would be trusted_editor (cap 20) without the gate; concentration drops it.
    expect(levelFor(stats)).toBe('contributor');
    expect(openSuggestionCap(stats)).toBe(8);
    // Same shape with a diverse editor keeps the elevated cap.
    const diverse = editorStatsFromAggregates({ ...ringAgg, maxPairShare: 0.2 }, 200);
    expect(levelFor(diverse)).toBe('trusted_editor');
    expect(openSuggestionCap(diverse)).toBe(20);
  });

  it('defaults maxPairShare to 0 when the caller omits it (app ledger path)', () => {
    const stats = editorStatsFromAggregates(
      {
        acceptedTotal: 40,
        acceptedCopyedits: 0,
        distinctAuthors: 12,
        acceptanceRate: 1,
        decidedSampleSize: 40,
        sanctionsInLast90d: 0,
      },
      200,
    );
    expect(stats.maxPairShare).toBe(0);
    expect(levelFor(stats)).toBe('trusted_editor');
  });
});

describe('openSuggestionCap', () => {
  const base = {
    weightedScore: 0,
    acceptedTotal: 0,
    acceptedCopyedits: 0,
    distinctAuthors: 0,
    acceptanceRate: 1,
    decidedSampleSize: 0,
    sanctionsInLast90d: 0,
    topicScore: 0,
    endorsements: 0,
    identityVerified: false,
    maxPairShare: 0,
  };
  it('throttles low acceptance at sample size 30+', () => {
    expect(openSuggestionCap({ ...base, acceptanceRate: 0.1, decidedSampleSize: 30 })).toBe(3);
    expect(openSuggestionCap({ ...base, acceptanceRate: 0.1, decidedSampleSize: 10 })).toBe(5);
  });
  it('scales with level', () => {
    expect(openSuggestionCap(base)).toBe(5);
    expect(openSuggestionCap({ ...base, acceptedTotal: 1 })).toBe(8);
    expect(
      openSuggestionCap({ ...base, acceptedTotal: 40, weightedScore: 150, distinctAuthors: 10 }),
    ).toBe(20);
  });
});
