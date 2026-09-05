// Twin-parity guard: the server credibility twin in _shared/mynews-cred.ts
// must stay behaviorally identical to the module engine. Runs in the monorepo
// where both sides are importable; the deployed function never imports the
// module.

import { describe, expect, it } from 'vitest';
import {
  BASE_POINTS as engineBasePoints,
  authorStandingForTier as engineAuthorStandingForTier,
  computeScore as engineComputeScore,
  decayFactor as engineDecayFactor,
  diversityMultiplier as engineDiversity,
  editorStatsFromAggregates as engineEditorStatsFromAggregates,
  ledgerWeightedScore as engineLedgerWeightedScore,
  levelFor as engineLevelFor,
  openSuggestionCap as engineOpenSuggestionCap,
  standingMultiplier as engineStanding,
  type EditorLevel as EngineEditorLevel,
  type EditorStats as EngineEditorStats,
} from '../../../../modules/mynews/src/engines/credibility';
import type { CredibilityEntry as EngineCredibilityEntry } from '../../../../modules/mynews/src/models';
import {
  BASE_POINTS,
  LEVEL_CAPS,
  MIN_POSSIBLE_CAP,
  authorStandingForTier,
  computeScore,
  decayFactor,
  diversityMultiplier,
  editorStatsFromAggregates,
  effectiveCap,
  ledgerWeightedScore,
  levelFor,
  standingMultiplier,
} from '../../_shared/mynews-cred.ts';
import type { EditorAggregates } from '../../_shared/mynews-store.ts';

const DAY = 86_400_000;

const baseStats: EngineEditorStats = {
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

// Boundary stats for every level rung (exact threshold + just-below variants)
// plus throttle boundaries. Expected levels pin twin correctness, not just
// twin-vs-engine agreement.
const statsGrid: Array<{ label: string; stats: EngineEditorStats; level: EngineEditorLevel }> = [
  { label: 'zero stats', stats: baseStats, level: 'reader' },
  { label: 'first acceptance', stats: { ...baseStats, acceptedTotal: 1 }, level: 'contributor' },
  {
    label: 'copyeditor exact boundary',
    stats: { ...baseStats, acceptedTotal: 25, acceptedCopyedits: 25, acceptanceRate: 0.6, distinctAuthors: 5 },
    level: 'copyeditor',
  },
  {
    label: 'one copyedit short',
    stats: { ...baseStats, acceptedTotal: 25, acceptedCopyedits: 24, acceptanceRate: 0.6, distinctAuthors: 5 },
    level: 'contributor',
  },
  {
    label: 'acceptance rate below copyeditor floor',
    stats: { ...baseStats, acceptedTotal: 25, acceptedCopyedits: 25, acceptanceRate: 0.59, distinctAuthors: 5 },
    level: 'contributor',
  },
  {
    label: 'one author short of copyeditor',
    stats: { ...baseStats, acceptedTotal: 25, acceptedCopyedits: 25, acceptanceRate: 0.6, distinctAuthors: 4 },
    level: 'contributor',
  },
  {
    label: 'trusted exact boundary',
    stats: { ...baseStats, acceptedTotal: 40, weightedScore: 150, distinctAuthors: 10 },
    level: 'trusted_editor',
  },
  {
    label: 'score just below trusted',
    stats: { ...baseStats, acceptedTotal: 40, weightedScore: 149.99, distinctAuthors: 10 },
    level: 'contributor',
  },
  {
    label: 'one author short of trusted',
    stats: { ...baseStats, acceptedTotal: 40, weightedScore: 150, distinctAuthors: 9 },
    level: 'contributor',
  },
  {
    label: 'sanction blocks trusted',
    stats: { ...baseStats, acceptedTotal: 40, weightedScore: 150, distinctAuthors: 10, sanctionsInLast90d: 1 },
    level: 'contributor',
  },
  {
    label: 'pair-concentration at the trust gate still qualifies (0.5)',
    stats: { ...baseStats, acceptedTotal: 40, weightedScore: 150, distinctAuthors: 10, maxPairShare: 0.5 },
    level: 'trusted_editor',
  },
  {
    label: 'pair-concentration just over the trust gate blocks trusted (Sybil ring)',
    stats: { ...baseStats, acceptedTotal: 40, weightedScore: 200, distinctAuthors: 12, maxPairShare: 0.6 },
    level: 'contributor',
  },
  {
    label: 'pair-concentration caps the section ceiling too',
    stats: {
      ...baseStats,
      acceptedTotal: 80,
      weightedScore: 600,
      distinctAuthors: 15,
      topicScore: 500,
      endorsements: 3,
      identityVerified: true,
      maxPairShare: 0.7,
    },
    level: 'contributor',
  },
  {
    label: 'section exact boundary',
    stats: {
      ...baseStats,
      acceptedTotal: 80,
      weightedScore: 600,
      distinctAuthors: 15,
      topicScore: 500,
      endorsements: 3,
      identityVerified: true,
    },
    level: 'section_editor',
  },
  {
    label: 'topic score just below section',
    stats: {
      ...baseStats,
      acceptedTotal: 80,
      weightedScore: 600,
      distinctAuthors: 15,
      topicScore: 499,
      endorsements: 3,
      identityVerified: true,
    },
    level: 'trusted_editor',
  },
  {
    label: 'one endorsement short of section',
    stats: {
      ...baseStats,
      acceptedTotal: 80,
      weightedScore: 600,
      distinctAuthors: 15,
      topicScore: 500,
      endorsements: 2,
      identityVerified: true,
    },
    level: 'trusted_editor',
  },
  {
    label: 'unverified identity blocks section',
    stats: {
      ...baseStats,
      acceptedTotal: 80,
      weightedScore: 600,
      distinctAuthors: 15,
      topicScore: 500,
      endorsements: 3,
      identityVerified: false,
    },
    level: 'trusted_editor',
  },
  {
    label: 'throttle exact boundary (rate 0.1, sample 30)',
    stats: { ...baseStats, acceptedTotal: 3, acceptanceRate: 0.1, decidedSampleSize: 30 },
    level: 'contributor',
  },
  {
    label: 'sample below throttle floor',
    stats: { ...baseStats, acceptedTotal: 5, acceptanceRate: 0.19, decidedSampleSize: 29 },
    level: 'contributor',
  },
  {
    label: 'rate at throttle boundary (no throttle at 0.2)',
    stats: { ...baseStats, acceptedTotal: 8, acceptanceRate: 0.2, decidedSampleSize: 40 },
    level: 'contributor',
  },
];

describe('credibility twin parity', () => {
  it('matches BASE_POINTS exactly', () => {
    expect(BASE_POINTS).toEqual(engineBasePoints);
  });

  it('matches the diversity and standing curves', () => {
    for (const d of [0, 1, 2, 3, 5, 8, 10, 11, 12, 20, 50]) {
      expect(diversityMultiplier(d)).toBe(engineDiversity(d));
    }
    for (const s of [0, 0.1, 0.25, 0.5, 0.75, 0.9, 1, -0.5, 1.5]) {
      expect(standingMultiplier(s)).toBe(engineStanding(s));
    }
  });

  it('matches decayFactor across the age spectrum', () => {
    for (const age of [-DAY, 0, 1, DAY, 30 * DAY, 182.5 * DAY, 365 * DAY, 730 * DAY, 3650 * DAY]) {
      expect(decayFactor(age)).toBe(engineDecayFactor(age));
    }
  });

  it('matches computeScore over mixed ledgers (decay, diversity, self-edits)', () => {
    const nowMs = Date.UTC(2026, 6, 3);
    const grids: EngineCredibilityEntry[][] = [
      [],
      [{ type: 'correction', acceptedAtMs: nowMs, authorKey: 'a1', authorStanding: 1 }],
      [
        { type: 'copyedit', acceptedAtMs: nowMs - 365 * DAY, authorKey: 'a1', authorStanding: 0.5 },
        { type: 'context', acceptedAtMs: nowMs - 30 * DAY, authorKey: 'a2', authorStanding: 0.75 },
        { type: 'headline', acceptedAtMs: nowMs - 10 * DAY, authorKey: 'a3', authorStanding: 0, selfEdit: true },
      ],
      [
        { type: 'translation', acceptedAtMs: nowMs - 700 * DAY, authorKey: 'a1', authorStanding: 0.9 },
        { type: 'clarity', acceptedAtMs: nowMs - DAY, authorKey: 'a2', authorStanding: 0.6 },
        { type: 'correction', acceptedAtMs: nowMs, authorKey: 'a2', authorStanding: 0.75, selfEdit: false },
      ],
      [
        { type: 'copyedit', acceptedAtMs: nowMs, authorKey: 'self', authorStanding: 1, selfEdit: true },
        { type: 'correction', acceptedAtMs: nowMs, authorKey: 'self', authorStanding: 1, selfEdit: true },
      ],
    ];
    for (const entries of grids) {
      expect(computeScore(entries, nowMs)).toBe(engineComputeScore(entries, nowMs));
    }
  });

  it('matches levelFor at every rung boundary and pins the expected level', () => {
    for (const { label, stats, level } of statsGrid) {
      expect(levelFor(stats), label).toBe(engineLevelFor(stats));
      expect(levelFor(stats), label).toBe(level);
    }
  });

  it('pins LEVEL_CAPS and matches the module cap (incl. the throttle) on every grid row', () => {
    expect(LEVEL_CAPS).toEqual({
      reader: 5,
      contributor: 8,
      copyeditor: 12,
      trusted_editor: 20,
      section_editor: 30,
    });
    for (const { label, stats } of statsGrid) {
      const cap = effectiveCap({
        openCount: 0,
        acceptanceRate: stats.acceptanceRate,
        decidedSampleSize: stats.decidedSampleSize,
        levelCap: LEVEL_CAPS[levelFor(stats)],
      });
      expect(cap, label).toBe(engineOpenSuggestionCap(stats));
    }
  });

  it('matches ledgerWeightedScore over mixed ledgers and pins the computeScore equivalence', () => {
    const nowMs = Date.UTC(2026, 6, 3);
    const rowGrids: Array<Array<{ basePoints: number; standingMult: number; awardedAt: string }>> = [
      [],
      [{ basePoints: 10, standingMult: 0.85, awardedAt: new Date(nowMs).toISOString() }],
      [
        { basePoints: 1, standingMult: 0.85, awardedAt: new Date(nowMs - 365 * DAY).toISOString() },
        { basePoints: 7, standingMult: 1.025, awardedAt: new Date(nowMs - 30 * DAY).toISOString() },
        { basePoints: 4, standingMult: 0.92, awardedAt: new Date(nowMs - DAY).toISOString() },
      ],
      // Future award: decay clamps at 1 on both sides.
      [{ basePoints: 3, standingMult: 0.5, awardedAt: new Date(nowMs + DAY).toISOString() }],
    ];
    for (const rows of rowGrids) {
      for (const distinct of [0, 1, 2, 5, 10, 12]) {
        expect(ledgerWeightedScore(rows, distinct, nowMs)).toBe(
          engineLedgerWeightedScore(rows, distinct, nowMs),
        );
      }
    }
    // A ledger whose rows store BASE_POINTS and the standing multiplier
    // reproduces computeScore over the matching entries exactly.
    const entries: EngineCredibilityEntry[] = [
      { type: 'correction', acceptedAtMs: nowMs - 30 * DAY, authorKey: 'a1', authorStanding: 0.5 },
      { type: 'copyedit', acceptedAtMs: nowMs - 400 * DAY, authorKey: 'a2', authorStanding: 0.75 },
    ];
    const rows = entries.map((e) => ({
      basePoints: engineBasePoints[e.type],
      standingMult: standingMultiplier(e.authorStanding),
      awardedAt: new Date(e.acceptedAtMs).toISOString(),
    }));
    expect(ledgerWeightedScore(rows, 2, nowMs)).toBe(engineComputeScore(entries, nowMs));
  });

  it('matches editorStatsFromAggregates and pins the C7 zeros mapping', () => {
    const aggGrid: EditorAggregates[] = [
      {
        openCount: 0,
        decidedSampleSize: 0,
        acceptanceRate: 1,
        acceptedTotal: 0,
        acceptedCopyedits: 0,
        distinctAuthors: 0,
        endorsementsReceived: 0,
        maxPairShare: 0,
        sanctionsInLast90d: 0,
        authorStanding: 0.5,
      },
      {
        openCount: 9,
        decidedSampleSize: 40,
        acceptanceRate: 0.8,
        acceptedTotal: 30,
        acceptedCopyedits: 25,
        distinctAuthors: 5,
        endorsementsReceived: 4,
        maxPairShare: 0.4,
        sanctionsInLast90d: 1,
        authorStanding: 0.75,
      },
      // Sybil ring: high distinctAuthors + weighted score, concentrated merges.
      {
        openCount: 12,
        decidedSampleSize: 40,
        acceptanceRate: 1,
        acceptedTotal: 40,
        acceptedCopyedits: 0,
        distinctAuthors: 12,
        endorsementsReceived: 0,
        maxPairShare: 0.6,
        sanctionsInLast90d: 0,
        authorStanding: 0.5,
      },
    ];
    for (const agg of aggGrid) {
      for (const weightedScore of [0, 42.5, 151, 200]) {
        const stats = editorStatsFromAggregates(agg, weightedScore);
        expect(stats).toEqual(engineEditorStatsFromAggregates(agg, weightedScore));
        expect(stats.weightedScore).toBe(weightedScore);
        expect(stats.topicScore).toBe(0);
        // Plan 48 WP8: endorsements are no longer hard-zeroed; they pass
        // through from the aggregates. identityVerified stays false because
        // none of these rows carry a verification state.
        expect(stats.endorsements).toBe(agg.endorsementsReceived);
        expect(stats.identityVerified).toBe(false);
        expect(stats.maxPairShare).toBe(agg.maxPairShare);
        expect(levelFor(stats)).toBe(engineLevelFor(stats));
      }
    }
    // The ring row must not reach trusted_editor even at a qualifying score.
    const ringStats = editorStatsFromAggregates(aggGrid[2], 200);
    expect(levelFor(ringStats)).toBe('contributor');
  });

  it('pins MIN_POSSIBLE_CAP as the smallest cap effectiveCap can return', () => {
    expect(MIN_POSSIBLE_CAP).toBe(3);
    // The throttle returns exactly the floor; every level cap sits above it.
    expect(
      effectiveCap({ openCount: 0, acceptanceRate: 0.1, decidedSampleSize: 30, levelCap: 12 }),
    ).toBe(MIN_POSSIBLE_CAP);
    expect(Math.min(...Object.values(LEVEL_CAPS))).toBeGreaterThanOrEqual(MIN_POSSIBLE_CAP);
  });

  it('matches authorStandingForTier (C7 interim standing)', () => {
    for (const tier of ['open', 'verified'] as const) {
      expect(authorStandingForTier(tier)).toBe(engineAuthorStandingForTier(tier));
    }
    expect(authorStandingForTier('open')).toBe(0.5);
    expect(authorStandingForTier('verified')).toBe(0.75);
  });
});
