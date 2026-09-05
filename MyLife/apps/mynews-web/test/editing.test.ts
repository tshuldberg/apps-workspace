import { describe, expect, it } from 'vitest';
import {
  BASE_POINTS,
  computeScore,
  ledgerWeightedScore,
  standingMultiplier,
  type CredibilityEntry,
  type StructuredDiff,
  type SuggestionType,
} from '@mylife/mynews/engines';
import type {
  EditorProfileView,
  LedgerRowView,
  RevisionSummary,
  SuggestionEventView,
  SuggestionView,
} from '@mylife/mynews/cloud-fetch';
import {
  buildEditorBreakdown,
  buildImprovedBy,
  buildMarginalia,
  describeEvent,
  diffToBlocks,
  lineItemText,
} from '../lib/editing';

const NOW = Date.parse('2026-07-04T00:00:00.000Z');

/* ------------------------------ improved by ------------------------------ */

function rev(revNo: number, changelog: RevisionSummary['changelog'], createdAt = ''): RevisionSummary {
  return { rev: revNo, createdAt, changelog };
}

describe('buildImprovedBy', () => {
  it('returns null when no revision carries external credits', () => {
    expect(buildImprovedBy([])).toBeNull();
    expect(buildImprovedBy([rev(1, []), rev(2, [])])).toBeNull();
  });

  it('counts distinct editors and per-type acceptances across all changelogs', () => {
    const improved = buildImprovedBy([
      rev(1, []),
      rev(2, [
        { suggestionId: 's1', editorKey: 'ed-a', type: 'correction' },
        { suggestionId: 's2', editorKey: 'ed-b', type: 'copyedit' },
      ]),
      rev(3, [{ suggestionId: 's3', editorKey: 'ed-a', type: 'correction' }], '2026-07-01T00:00:00.000Z'),
    ]);
    expect(improved).not.toBeNull();
    expect(improved!.editorCount).toBe(2);
    expect(improved!.acceptedTotal).toBe(3);
    expect(improved!.typeCounts).toEqual([
      { type: 'correction', count: 2 },
      { type: 'copyedit', count: 1 },
    ]);
  });

  it('reports the latest acceptance from the highest credited rev, input order independent', () => {
    const improved = buildImprovedBy([
      rev(3, [{ suggestionId: 's3', editorKey: 'ed-c', type: 'clarity' }], '2026-07-02T00:00:00.000Z'),
      rev(2, [{ suggestionId: 's1', editorKey: 'ed-a', type: 'correction' }]),
      rev(4, []),
    ]);
    expect(improved!.latest.rev).toBe(3);
    expect(improved!.latest.createdAt).toBe('2026-07-02T00:00:00.000Z');
    expect(improved!.latest.entries).toEqual([
      { suggestionId: 's3', editorKey: 'ed-c', type: 'clarity' },
    ]);
  });
});

/* ------------------------------- marginalia ------------------------------- */

function makeSuggestion(over: Partial<SuggestionView> = {}): SuggestionView {
  return {
    id: 'sg-1',
    articleId: 'a-1',
    articleSlug: 'story',
    articleHeadline: 'Story',
    baseRev: 1,
    editorId: 'ed-1',
    editorHandle: 'sam',
    editorDisplayName: 'Sam Editor',
    editorPubkey: 'pub-sam',
    type: 'copyedit',
    diff: { baseHash: 'hash', ops: [] },
    citations: [],
    rationale: 'Fix a typo.',
    status: 'open',
    createdAt: '2026-07-01T00:00:00.000Z',
    endorsements: 0,
    ...over,
  };
}

describe('buildMarginalia', () => {
  it('counts open suggestions and cited open corrections only', () => {
    const marginalia = buildMarginalia([
      makeSuggestion({ id: 's1', type: 'correction', citations: ['https://example.com/a'] }),
      makeSuggestion({ id: 's2', type: 'correction', citations: [] }),
      makeSuggestion({ id: 's3', type: 'clarity' }),
      makeSuggestion({
        id: 's4',
        type: 'correction',
        status: 'accepted',
        citations: ['https://example.com/b'],
      }),
    ]);
    expect(marginalia).toEqual({ open: 3, correctionsWithCitations: 1 });
  });

  it('is honest about the empty state', () => {
    expect(buildMarginalia([])).toEqual({ open: 0, correctionsWithCitations: 0 });
  });
});

/* ------------------------------- diff blocks ------------------------------ */

describe('diffToBlocks', () => {
  it('renders del blocks before add blocks per op, in op order', () => {
    const diff: StructuredDiff = {
      baseHash: 'h',
      ops: [
        {
          kind: 'replace',
          baseIndex: 0,
          anchorBefore: null,
          anchorAfter: null,
          baseBlocks: ['Old paragraph.'],
          newBlocks: ['New paragraph.'],
        },
        {
          kind: 'insert',
          baseIndex: 2,
          anchorBefore: 'Anchor.',
          anchorAfter: null,
          baseBlocks: [],
          newBlocks: ['Inserted context.'],
        },
      ],
    };
    expect(diffToBlocks(diff)).toEqual([
      { key: 'op0-del0', kind: 'del', text: 'Old paragraph.' },
      { key: 'op0-add0', kind: 'add', text: 'New paragraph.' },
      { key: 'op1-add0', kind: 'add', text: 'Inserted context.' },
    ]);
  });

  it('returns no blocks for an empty diff', () => {
    expect(diffToBlocks({ baseHash: 'h', ops: [] })).toEqual([]);
  });
});

/* ------------------------------ thread lines ------------------------------ */

function makeEvent(over: Partial<SuggestionEventView> = {}): SuggestionEventView {
  return {
    id: 'ev-1',
    suggestionId: 'sg-1',
    actorId: 'p-1',
    actorHandle: 'jane',
    action: 'comment',
    payload: {},
    createdAt: '2026-07-01T00:00:00.000Z',
    ...over,
  };
}

describe('describeEvent', () => {
  it('maps comments to their body text', () => {
    expect(describeEvent(makeEvent({ payload: { body: 'Nice catch.' } }))).toEqual({
      label: 'commented',
      body: 'Nice catch.',
    });
  });

  it('maps decision rows with optional notes', () => {
    expect(describeEvent(makeEvent({ action: 'accept' }))).toEqual({
      label: 'accepted this suggestion',
      body: null,
    });
    expect(
      describeEvent(makeEvent({ action: 'reject', payload: { note: 'Source disagrees.' } })),
    ).toEqual({ label: 'rejected this suggestion', body: 'Source disagrees.' });
    expect(describeEvent(makeEvent({ action: 'partial' })).label).toBe(
      'accepted with a counter-edit',
    );
    expect(describeEvent(makeEvent({ action: 'rebase' })).body).toBeNull();
  });

  it('never fabricates text from non-string payloads', () => {
    expect(describeEvent(makeEvent({ payload: { body: 42 } })).body).toBeNull();
    expect(describeEvent(makeEvent({ payload: { body: '   ' } })).body).toBeNull();
  });
});

/* -------------------------- credibility breakdown ------------------------- */

interface SeedAward {
  type: SuggestionType;
  authorId: string;
  authorStanding: number;
  awardedAt: string;
}

/**
 * Builds the SAME award history in both shapes: public ledger rows (what the
 * port returns) and CredibilityEntry values (what the module engine's
 * computeScore consumes), so the two totals must agree. Mirrors the Expo
 * app's credibility parity test.
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

describe('buildEditorBreakdown', () => {
  const awards: SeedAward[] = [
    { type: 'correction', authorId: 'a1', authorStanding: 0.5, awardedAt: '2026-06-01T00:00:00.000Z' },
    { type: 'correction', authorId: 'a2', authorStanding: 0.75, awardedAt: '2026-05-01T00:00:00.000Z' },
    { type: 'context', authorId: 'a1', authorStanding: 0.5, awardedAt: '2026-04-20T00:00:00.000Z' },
    { type: 'copyedit', authorId: 'a3', authorStanding: 0.5, awardedAt: '2026-06-28T00:00:00.000Z' },
  ];

  it('computes the same total as the module engine on the seeded ledger', () => {
    const { ledger, entries } = seed(awards);
    const b = buildEditorBreakdown(profileWith(ledger), NOW);
    expect(b.total).toBe(ledgerWeightedScore(ledger, 3, NOW));
    expect(b.total).toBeCloseTo(computeScore(entries, NOW), 10);
    expect(b.total).toBeGreaterThan(0);
  });

  it('aggregates per-type line items from the ledger with base points', () => {
    const { ledger } = seed(awards);
    const b = buildEditorBreakdown(profileWith(ledger), NOW);
    const corrections = b.lineItems.find((item) => item.type === 'correction');
    expect(corrections).toMatchObject({ count: 2, baseTotal: 20 });
    expect(lineItemText(corrections!)).toBe('Corrections accepted (2) +20 base');
    // No fabricated zero rows for types never awarded.
    expect(b.lineItems.some((item) => item.type === 'headline')).toBe(false);
  });

  it('derives level, next level, and cap from real stats', () => {
    const copyeditRun: SeedAward[] = Array.from({ length: 25 }, (_, i) => ({
      type: 'copyedit' as const,
      authorId: `a${(i % 5) + 1}`,
      authorStanding: 0.5,
      awardedAt: '2026-06-01T00:00:00.000Z',
    }));
    const { ledger } = seed(copyeditRun);
    const b = buildEditorBreakdown(
      profileWith(ledger, { acceptanceRate: 0.7, decidedSampleSize: 36 }),
      NOW,
    );
    expect(b.level).toBe('copyeditor');
    expect(b.levelName).toBe('Copyeditor');
    expect(b.openCap).toBe(12);
    expect(b.nextLevel?.name).toBe('Trusted Editor');
    expect(b.nextLevel?.requirements).toContain('150 weighted points');
  });

  it('applies the low-acceptance throttle to the open cap', () => {
    const { ledger } = seed(awards);
    const b = buildEditorBreakdown(
      profileWith(ledger, { acceptanceRate: 0.1, decidedSampleSize: 30 }),
      NOW,
    );
    expect(b.openCap).toBe(3);
  });

  it('names the identity gate on the Section Editor requirements without staged-delivery framing', () => {
    const trustedRun: SeedAward[] = Array.from({ length: 40 }, (_, i) => ({
      type: 'correction' as const,
      authorId: `a${(i % 12) + 1}`,
      authorStanding: 0.75,
      awardedAt: '2026-06-01T00:00:00.000Z',
    }));
    const { ledger } = seed(trustedRun);
    const b = buildEditorBreakdown(
      profileWith(ledger, { acceptanceRate: 0.8, decidedSampleSize: 50 }),
      NOW,
    );
    expect(b.level).toBe('trusted_editor');
    const requirements = b.nextLevel?.requirements.join(' ') ?? '';
    expect(requirements).toContain('identity verification is not yet available');
    // The old copy promised a roadmap phase; a shipped screen states what is
    // true now (see apps/mynews-web/test/product-copy.test.ts).
    expect(requirements).not.toMatch(/Phase\s*\d/i);
  });

  it('flags pair concentration at or above 70 percent', () => {
    const concentrated: SeedAward[] = [
      ...Array.from({ length: 7 }, (_, i) => ({
        type: 'copyedit' as const,
        authorId: 'a1',
        authorStanding: 0.5,
        awardedAt: `2026-06-0${(i % 9) + 1}T00:00:00.000Z`,
      })),
      ...Array.from({ length: 3 }, (_, i) => ({
        type: 'copyedit' as const,
        authorId: 'a2',
        authorStanding: 0.5,
        awardedAt: `2026-05-0${i + 1}T00:00:00.000Z`,
      })),
    ];
    const { ledger } = seed(concentrated);
    const b = buildEditorBreakdown(profileWith(ledger), NOW);
    expect(b.pair).toEqual({ status: 'elevated', maxSharePct: 70 });
  });

  it('renders an honest empty model for editors with no ledger', () => {
    const b = buildEditorBreakdown(
      profileWith([], { acceptanceRate: 0, decidedSampleSize: 0, distinctAuthors: 0 }),
      NOW,
    );
    expect(b.emptyLedger).toBe(true);
    expect(b.total).toBe(0);
    expect(b.lineItems).toHaveLength(0);
    expect(b.pair).toBeNull();
    expect(b.level).toBe('reader');
    expect(b.standingMult).toBe(0.5);
    expect(b.openCap).toBe(5);
    expect(b.nextLevel?.name).toBe('Contributor');
  });
});
