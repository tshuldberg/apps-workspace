// C8.7 credibility breakdown view model. All math runs CLIENT-side through the
// module engine over the public signed ledger, proving the "formula + full
// ledger public" claim: nothing here is hand-assigned or server-invented.

import {
  BASE_POINTS,
  diversityMultiplier,
  editorStatsFromAggregates,
  ledgerWeightedScore,
  levelFor,
  openSuggestionCap,
  type EditorLevel,
  type EditorProfileView,
  type LedgerRowView,
  type SuggestionType,
} from '@mylife/mynews';

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

/** Severity display order for the per-type line items. */
const TYPE_ORDER: SuggestionType[] = [
  'correction',
  'context',
  'translation',
  'clarity',
  'headline',
  'copyedit',
];

/** C8.7 ring-flag: pair concentration is elevated at or above 70 percent. */
export const PAIR_ELEVATED_THRESHOLD = 0.7;

export interface CredibilityLineItem {
  type: SuggestionType;
  label: string;
  count: number;
  baseTotal: number;
}

export interface CredibilityViewModel {
  handle: string;
  displayName: string;
  kind: 'reader' | 'editor' | 'journalist';
  emptyLedger: boolean;
  /** ledgerWeightedScore over the public rows; same math as the server twin. */
  total: number;
  lineItems: CredibilityLineItem[];
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
        requirements: [
          '25 accepted copyedits',
          '60% acceptance rate',
          '5 distinct authors',
        ],
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
          'Verified identity signal from the verification service',
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

export function buildCredibilityViewModel(input: {
  profile: EditorProfileView;
  nowMs: number;
}): CredibilityViewModel {
  const { profile, ledger, aggregates } = input.profile;
  const total = ledgerWeightedScore(ledger, aggregates.distinctAuthors, input.nowMs);

  const lineItems: CredibilityLineItem[] = [];
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
      // This public aggregate does not include moderation sanctions, so this
      // client view cannot infer or manufacture a non-zero value.
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
export function lineItemText(item: CredibilityLineItem): string {
  return `${item.label} (${item.count}) +${item.baseTotal} base`;
}

/** Sanity anchor: a line item's base total from counts alone (used by tests). */
export function baseTotalFor(type: SuggestionType, count: number): number {
  return BASE_POINTS[type] * count;
}
