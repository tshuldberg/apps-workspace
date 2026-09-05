import { describe, expect, it } from 'vitest';
import {
  BASE_POINTS,
  computeScore,
  ledgerWeightedScore,
  standingMultiplier,
  type CredibilityEntry,
  type EditorProfileView,
  type LedgerRowView,
  type SuggestionType,
} from '@mylife/mynews';
import { buildCredibilityViewModel, lineItemText } from '../(root)/lib/credibility';

const NOW = Date.parse('2026-07-03T00:00:00.000Z');

interface SeedAward {
  type: SuggestionType;
  authorId: string;
  authorStanding: number;
  awardedAt: string;
}

/**
 * Builds the SAME award history in both shapes: public ledger rows (what the
 * port returns) and CredibilityEntry values (what the module engine's
 * computeScore consumes), so the two totals must agree.
 */
function seed(awards: SeedAward[]): { ledger: LedgerRowView[]; entries: CredibilityEntry[] } {
  const distinct = new Set(awards.map((a) => a.authorId)).size;
  const ledger = awards.map((a, i) => ({
    id: `award-${i}`,
    editorId: 'editor-1',
    suggestionId: `sg-${i}`,
    basePoints: BASE_POINTS[a.type],
    diversityMult: 0.3 + 0.12 * (distinct - 1),
    standingMult: standingMultiplier(a.authorStanding),
    awardedAt: a.awardedAt,
    type: a.type,
    authorId: a.authorId,
  }));
  const entries = awards.map((a) => ({
    type: a.type,
    acceptedAtMs: Date.parse(a.awardedAt),
    authorKey: a.authorId,
    authorStanding: a.authorStanding,
  }));
  return { ledger, entries };
}

function profileWith(
  ledger: LedgerRowView[],
  aggregates?: Partial<EditorProfileView['aggregates']>,
): EditorProfileView {
  const distinct = new Set(ledger.map((row) => row.authorId)).size;
  return {
    profile: { id: 'editor-1', handle: 'sam_editor', displayName: 'Sam Editor', kind: 'editor' },
    ledger,
    aggregates: {
      openCount: 1,
      acceptanceRate: 0.75,
      decidedSampleSize: 8,
      distinctAuthors: distinct,
      ...aggregates,
    },
  };
}

describe('buildCredibilityViewModel', () => {
  const awards: SeedAward[] = [
    { type: 'correction', authorId: 'a1', authorStanding: 0.5, awardedAt: '2026-06-01T00:00:00.000Z' },
    { type: 'correction', authorId: 'a2', authorStanding: 0.75, awardedAt: '2026-05-01T00:00:00.000Z' },
    { type: 'correction', authorId: 'a3', authorStanding: 0.5, awardedAt: '2026-01-15T00:00:00.000Z' },
    { type: 'context', authorId: 'a1', authorStanding: 0.5, awardedAt: '2026-04-20T00:00:00.000Z' },
    { type: 'copyedit', authorId: 'a2', authorStanding: 0.75, awardedAt: '2025-11-05T00:00:00.000Z' },
    { type: 'copyedit', authorId: 'a3', authorStanding: 0.5, awardedAt: '2026-06-28T00:00:00.000Z' },
  ];

  it('computes the same total as the module engine on the seeded ledger', () => {
    const { ledger, entries } = seed(awards);
    const vm = buildCredibilityViewModel({ profile: profileWith(ledger), nowMs: NOW });
    expect(vm.total).toBe(ledgerWeightedScore(ledger, 3, NOW));
    expect(vm.total).toBeCloseTo(computeScore(entries, NOW), 10);
    expect(vm.total).toBeGreaterThan(0);
  });

  it('aggregates per-type line items from the ledger with base points', () => {
    const { ledger } = seed(awards);
    const vm = buildCredibilityViewModel({ profile: profileWith(ledger), nowMs: NOW });
    const corrections = vm.lineItems.find((item) => item.type === 'correction');
    expect(corrections).toMatchObject({ count: 3, baseTotal: 30 });
    expect(lineItemText(corrections!)).toBe('Corrections accepted (3) +30 base');
    const copyedits = vm.lineItems.find((item) => item.type === 'copyedit');
    expect(copyedits).toMatchObject({ count: 2, baseTotal: 2 });
    // No fabricated zero rows for types never awarded.
    expect(vm.lineItems.some((item) => item.type === 'headline')).toBe(false);
  });

  it('reports diversity and mean standing multipliers honestly', () => {
    const { ledger } = seed(awards);
    const vm = buildCredibilityViewModel({ profile: profileWith(ledger), nowMs: NOW });
    expect(vm.distinctAuthors).toBe(3);
    expect(vm.diversityMult).toBeCloseTo(0.54, 10);
    const meanStanding = ledger.reduce((sum, row) => sum + row.standingMult, 0) / ledger.length;
    expect(vm.standingMult).toBeCloseTo(meanStanding, 10);
  });

  it('flags pair concentration as elevated at or above 70 percent', () => {
    const concentrated: SeedAward[] = [
      ...Array.from({ length: 7 }, (_, i) => ({
        type: 'copyedit' as const,
        authorId: 'a1',
        authorStanding: 0.5,
        awardedAt: `2026-06-${String(i + 1).padStart(2, '0')}T00:00:00.000Z`,
      })),
      ...Array.from({ length: 3 }, (_, i) => ({
        type: 'copyedit' as const,
        authorId: 'a2',
        authorStanding: 0.5,
        awardedAt: `2026-05-${String(i + 1).padStart(2, '0')}T00:00:00.000Z`,
      })),
    ];
    const { ledger } = seed(concentrated);
    const vm = buildCredibilityViewModel({ profile: profileWith(ledger), nowMs: NOW });
    expect(vm.pair).toEqual({ status: 'elevated', maxSharePct: 70 });
  });

  it('keeps balanced ledgers healthy', () => {
    const { ledger } = seed(awards);
    const vm = buildCredibilityViewModel({ profile: profileWith(ledger), nowMs: NOW });
    expect(vm.pair?.status).toBe('healthy');
    expect(vm.pair?.maxSharePct).toBeLessThan(70);
  });

  it('derives level, next level, and cap from real stats', () => {
    // 25 accepted copyedits across 5 authors at a 70 percent acceptance rate
    // is the copyeditor ladder rung; its cap is 12.
    const copyeditRun: SeedAward[] = Array.from({ length: 25 }, (_, i) => ({
      type: 'copyedit' as const,
      authorId: `a${(i % 5) + 1}`,
      authorStanding: 0.5,
      awardedAt: '2026-06-01T00:00:00.000Z',
    }));
    const { ledger } = seed(copyeditRun);
    const vm = buildCredibilityViewModel({
      profile: profileWith(ledger, { acceptanceRate: 0.7, decidedSampleSize: 36 }),
      nowMs: NOW,
    });
    expect(vm.level).toBe('copyeditor');
    expect(vm.levelName).toBe('Copyeditor');
    expect(vm.openCap).toBe(12);
    expect(vm.nextLevel?.name).toBe('Trusted Editor');
    expect(vm.nextLevel?.requirements).toContain('150 weighted points');
  });

  it('applies the low-acceptance throttle to the open cap', () => {
    const { ledger } = seed(awards);
    const vm = buildCredibilityViewModel({
      profile: profileWith(ledger, { acceptanceRate: 0.1, decidedSampleSize: 30 }),
      nowMs: NOW,
    });
    expect(vm.openCap).toBe(3);
  });

  it('names the real verification signal required for Section Editor', () => {
    const trustedRun: SeedAward[] = Array.from({ length: 40 }, (_, i) => ({
      type: 'correction' as const,
      authorId: `a${(i % 12) + 1}`,
      authorStanding: 0.75,
      awardedAt: '2026-06-01T00:00:00.000Z',
    }));
    const { ledger } = seed(trustedRun);
    const vm = buildCredibilityViewModel({
      profile: profileWith(ledger, { acceptanceRate: 0.8, decidedSampleSize: 50 }),
      nowMs: NOW,
    });
    expect(vm.level).toBe('trusted_editor');
    expect(vm.nextLevel?.name).toBe('Section Editor');
    expect(vm.nextLevel?.requirements).toContain(
      'Verified identity signal from the verification service',
    );
  });

  it('renders an honest empty model for editors with no ledger', () => {
    const vm = buildCredibilityViewModel({
      profile: profileWith([], { acceptanceRate: 0, decidedSampleSize: 0, distinctAuthors: 0 }),
      nowMs: NOW,
    });
    expect(vm.emptyLedger).toBe(true);
    expect(vm.total).toBe(0);
    expect(vm.lineItems).toHaveLength(0);
    expect(vm.pair).toBeNull();
    expect(vm.level).toBe('reader');
    expect(vm.openCap).toBe(5);
    expect(vm.nextLevel?.name).toBe('Contributor');
  });
});
