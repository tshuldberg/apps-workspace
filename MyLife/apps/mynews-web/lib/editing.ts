/**
 * Pure editing-desk view builders for the public site.
 *
 * Improved-by aggregation over revision changelogs, open-suggestion
 * marginalia counts, del/add diff blocks, thread lines, and the editor
 * credibility breakdown. All credibility math runs through the module engine
 * (`@mylife/mynews/engines`) over the public signed ledger: nothing here is
 * hand-assigned. This mirrors the Expo app's `lib/credibility.ts` builder
 * (reimplemented thin; app code is never imported) and is tested against the
 * module engine the same way the app test is.
 */
import {
  BASE_POINTS,
  diversityMultiplier,
  editorStatsFromAggregates,
  ledgerWeightedScore,
  levelFor,
  openSuggestionCap,
  type ChangelogEntry,
  type EditorLevel,
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

/** Severity display order shared by the improved-by card and the breakdown. */
const TYPE_ORDER: SuggestionType[] = [
  'correction',
  'context',
  'translation',
  'clarity',
  'headline',
  'copyedit',
];

/* ------------------------------ improved by ------------------------------ */

export interface ImprovedBy {
  /** Distinct editor keys across every revision changelog. */
  editorCount: number;
  /** Total accepted credits across all revisions. */
  acceptedTotal: number;
  /** Per-type accepted counts, severity order, no fabricated zero rows. */
  typeCounts: Array<{ type: SuggestionType; count: number }>;
  /** The newest revision that carries credits (the latest acceptance). */
  latest: { rev: number; createdAt: string; entries: ChangelogEntry[] };
}

/** Null when no revision carries external credits (the card is omitted). */
export function buildImprovedBy(revisions: RevisionSummary[]): ImprovedBy | null {
  const credited = revisions.filter((r) => r.changelog.length > 0);
  if (credited.length === 0) return null;
  const editors = new Set<string>();
  const counts = new Map<SuggestionType, number>();
  let acceptedTotal = 0;
  for (const revision of credited) {
    for (const entry of revision.changelog) {
      editors.add(entry.editorKey);
      counts.set(entry.type, (counts.get(entry.type) ?? 0) + 1);
      acceptedTotal++;
    }
  }
  const latest = credited.reduce((top, r) => (r.rev > top.rev ? r : top));
  return {
    editorCount: editors.size,
    acceptedTotal,
    typeCounts: TYPE_ORDER.filter((type) => counts.has(type)).map((type) => ({
      type,
      count: counts.get(type)!,
    })),
    latest: { rev: latest.rev, createdAt: latest.createdAt, entries: latest.changelog },
  };
}

/* ------------------------------- marginalia ------------------------------- */

export interface Marginalia {
  open: number;
  /** Open corrections that carry at least one citation. */
  correctionsWithCitations: number;
}

export function buildMarginalia(suggestions: SuggestionView[]): Marginalia {
  const open = suggestions.filter((s) => s.status === 'open');
  return {
    open: open.length,
    correctionsWithCitations: open.filter(
      (s) => s.type === 'correction' && s.citations.length > 0,
    ).length,
  };
}

/* ------------------------------- diff blocks ------------------------------ */

export interface DiffBlock {
  key: string;
  kind: 'del' | 'add';
  text: string;
}

/** Flattens a structured diff into render-ready del/add blocks, op order. */
export function diffToBlocks(diff: StructuredDiff): DiffBlock[] {
  const blocks: DiffBlock[] = [];
  diff.ops.forEach((op, i) => {
    op.baseBlocks.forEach((text, j) => blocks.push({ key: `op${i}-del${j}`, kind: 'del', text }));
    op.newBlocks.forEach((text, j) => blocks.push({ key: `op${i}-add${j}`, kind: 'add', text }));
  });
  return blocks;
}

/* ------------------------------ thread lines ------------------------------ */

export interface ThreadLine {
  label: string;
  body: string | null;
}

/** One human line per suggestion event (comment or decision row). */
export function describeEvent(event: SuggestionEventView): ThreadLine {
  const text = (key: 'body' | 'note'): string | null => {
    const value = event.payload?.[key];
    return typeof value === 'string' && value.trim() !== '' ? value : null;
  };
  switch (event.action) {
    case 'comment':
      return { label: 'commented', body: text('body') };
    case 'accept':
      return { label: 'accepted this suggestion', body: text('note') };
    case 'partial':
      return { label: 'accepted with a counter-edit', body: text('note') };
    case 'reject':
      return { label: 'rejected this suggestion', body: text('note') };
    case 'rebase':
      return { label: 'rebased onto a newer revision', body: null };
  }
}

/* -------------------------- credibility breakdown ------------------------- */

export const LEVEL_NAMES: Record<EditorLevel, string> = {
  reader: 'Reader',
  contributor: 'Contributor',
  copyeditor: 'Copyeditor',
  trusted_editor: 'Trusted Editor',
  section_editor: 'Section Editor',
};

const TYPE_LABELS: Record<SuggestionType, string> = {
  correction: 'Corrections accepted',
  context: 'Context added',
  translation: 'Translations accepted',
  clarity: 'Clarity edits accepted',
  headline: 'Headline fixes accepted',
  copyedit: 'Copyedits accepted',
};

/** Pair concentration is elevated at or above 70 percent (anti-gaming flag). */
export const PAIR_ELEVATED_THRESHOLD = 0.7;

export interface BreakdownLineItem {
  type: SuggestionType;
  label: string;
  count: number;
  baseTotal: number;
}

export interface EditorBreakdown {
  handle: string;
  displayName: string;
  kind: 'reader' | 'editor' | 'journalist';
  emptyLedger: boolean;
  /** ledgerWeightedScore over the public rows; same math as the app and server twin. */
  total: number;
  lineItems: BreakdownLineItem[];
  distinctAuthors: number;
  diversityMult: number;
  /** Mean stored standing multiplier across awards; 0.5-baseline copy when empty. */
  standingMult: number;
  level: EditorLevel;
  levelName: string;
  nextLevel: { name: string; requirements: string[] } | null;
  /** Null when there are no awards yet (no fabricated concentration stat). */
  pair: { status: 'healthy' | 'elevated'; maxSharePct: number } | null;
  openCap: number;
}

function nextLevelFor(level: EditorLevel): { name: string; requirements: string[] } | null {
  switch (level) {
    case 'reader':
      return { name: 'Contributor', requirements: ['1 accepted suggestion'] };
    case 'contributor':
      return {
        name: 'Copyeditor',
        requirements: ['25 accepted copyedits', '60% acceptance rate', '5 distinct authors'],
      };
    case 'copyeditor':
      return {
        name: 'Trusted Editor',
        requirements: [
          '150 weighted points',
          '10 distinct authors',
          'No sanctions in the last 90 days',
        ],
      };
    case 'trusted_editor':
      return {
        name: 'Section Editor',
        requirements: [
          '500 topic points',
          '3 Trusted Editor endorsements',
          'Verified identity (identity verification is not yet available)',
        ],
      };
    case 'section_editor':
      return null;
  }
}

function pairConcentration(
  ledger: LedgerRowView[],
): { status: 'healthy' | 'elevated'; maxSharePct: number } | null {
  if (ledger.length === 0) return null;
  const counts = new Map<string, number>();
  for (const row of ledger) {
    const key = row.authorId ?? 'unknown';
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const maxShare = Math.max(...counts.values()) / ledger.length;
  return {
    status: maxShare >= PAIR_ELEVATED_THRESHOLD ? 'elevated' : 'healthy',
    maxSharePct: Math.round(maxShare * 100),
  };
}

export function buildEditorBreakdown(view: EditorProfileView, nowMs: number): EditorBreakdown {
  const { profile, ledger, aggregates } = view;
  const total = ledgerWeightedScore(ledger, aggregates.distinctAuthors, nowMs);

  const lineItems: BreakdownLineItem[] = [];
  for (const type of TYPE_ORDER) {
    const rows = ledger.filter((row) => row.type === type);
    if (rows.length === 0) continue;
    lineItems.push({
      type,
      label: TYPE_LABELS[type],
      count: rows.length,
      baseTotal: rows.reduce((sum, row) => sum + row.basePoints, 0),
    });
  }

  const stats = editorStatsFromAggregates(
    {
      acceptedTotal: ledger.length,
      acceptedCopyedits: ledger.filter((row) => row.type === 'copyedit').length,
      distinctAuthors: aggregates.distinctAuthors,
      acceptanceRate: aggregates.acceptanceRate,
      decidedSampleSize: aggregates.decidedSampleSize,
      // No public sanctions signal exists in the ledger today; zero is the
      // real value, not a placeholder.
      sanctionsInLast90d: 0,
    },
    total,
  );
  const level = levelFor(stats);

  return {
    handle: profile.handle,
    displayName: profile.displayName,
    kind: profile.kind,
    emptyLedger: ledger.length === 0,
    total,
    lineItems,
    distinctAuthors: aggregates.distinctAuthors,
    diversityMult: diversityMultiplier(aggregates.distinctAuthors),
    standingMult:
      ledger.length === 0
        ? 0.5
        : ledger.reduce((sum, row) => sum + row.standingMult, 0) / ledger.length,
    level,
    levelName: LEVEL_NAMES[level],
    nextLevel: nextLevelFor(level),
    pair: pairConcentration(ledger),
    openCap: openSuggestionCap(stats),
  };
}

/** Formats BASE_POINTS-derived line items like "Corrections accepted (9) +90 base". */
export function lineItemText(item: BreakdownLineItem): string {
  return `${item.label} (${item.count}) +${item.baseTotal} base`;
}

/** Sanity anchor: a line item's base total from counts alone (used by tests). */
export function baseTotalFor(type: SuggestionType, count: number): number {
  return BASE_POINTS[type] * count;
}
