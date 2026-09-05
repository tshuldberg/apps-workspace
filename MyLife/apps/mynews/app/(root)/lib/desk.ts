// C8.2/C8.3/C8.4 editing-desk logic: role persistence, queue grouping and
// sorting, editor and journalist view models, accept previews with rebase,
// the unchanged-counter-edit downgrade, and the batch copyedit model. All
// pure or port-injected so everything unit-tests against the module's
// InMemoryCloudAdapter; the screens stay thin.

import type { DatabaseAdapter } from '@mylife/db';
import {
  applyDiff,
  buildBlockSet,
  combineDiffs,
  filterBlockedSuggestions,
  hashText,
  headlineDoc,
  rebaseDiff,
  splitHeadlineDoc,
  type ArticleView,
  type BlockView,
  type EditorProfileView,
  type LedgerRowView,
  type MyNewsCloudPort,
  type ProfileView,
  type PublishErrorCode,
  type StructuredDiff,
  type SuggestionEventView,
  type SuggestionType,
  type SuggestionView,
} from '@mylife/mynews';
import { buildCredibilityViewModel, type CredibilityViewModel } from './credibility';
import { publishErrorMessage } from './publish-errors';

// --- Desk role (nw_settings key 'desk.role'; persisted value wins, default editor) ---

export type DeskRole = 'editor' | 'journalist';

export const DESK_ROLE_KEY = 'desk.role';

export function getDeskRole(db: DatabaseAdapter): DeskRole {
  const rows = db.query<{ value: string }>('SELECT value FROM nw_settings WHERE key = ?', [
    DESK_ROLE_KEY,
  ]);
  return rows[0]?.value === 'journalist' ? 'journalist' : 'editor';
}

export function setDeskRole(db: DatabaseAdapter, role: DeskRole): void {
  db.execute(
    'INSERT INTO nw_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
    [DESK_ROLE_KEY, role],
  );
}

// --- Severity + queue grouping ---

const SEVERITY_ORDER: readonly SuggestionType[] = [
  'correction',
  'context',
  'translation',
  'clarity',
  'headline',
  'copyedit',
];

/** Lower rank reviews first: correction > context > translation > clarity > headline > copyedit. */
export function severityRank(type: SuggestionType): number {
  return SEVERITY_ORDER.indexOf(type);
}

export const TYPE_LABEL: Record<SuggestionType, string> = {
  correction: 'Correction',
  context: 'Context',
  translation: 'Translation',
  clarity: 'Clarity',
  headline: 'Headline',
  copyedit: 'Copyedit',
};

export interface QueueBatch {
  articleId: string;
  articleSlug: string;
  articleHeadline: string;
  suggestions: SuggestionView[];
}

export interface JournalistQueue {
  /** Non-copyedit suggestions, severity rank then oldest-first. */
  singles: SuggestionView[];
  /** Copyedits grouped per article, oldest group first. */
  batches: QueueBatch[];
  openCount: number;
  articleCount: number;
  subtitle: string;
}

export function buildJournalistQueue(open: SuggestionView[]): JournalistQueue {
  const singles = open
    .filter((s) => s.type !== 'copyedit')
    .sort(
      (a, b) =>
        severityRank(a.type) - severityRank(b.type) || a.createdAt.localeCompare(b.createdAt),
    );
  const byArticle = new Map<string, QueueBatch>();
  for (const s of open.filter((x) => x.type === 'copyedit')) {
    const existing = byArticle.get(s.articleId);
    if (existing) {
      existing.suggestions.push(s);
    } else {
      byArticle.set(s.articleId, {
        articleId: s.articleId,
        articleSlug: s.articleSlug,
        articleHeadline: s.articleHeadline,
        suggestions: [s],
      });
    }
  }
  const batches = [...byArticle.values()]
    .map((batch) => ({
      ...batch,
      suggestions: [...batch.suggestions].sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
    }))
    .sort((a, b) => a.suggestions[0]!.createdAt.localeCompare(b.suggestions[0]!.createdAt));
  const articleCount = new Set(open.map((s) => s.articleId)).size;
  return {
    singles,
    batches,
    openCount: open.length,
    articleCount,
    subtitle: `${open.length} suggestions on ${articleCount} articles`,
  };
}

/** First line of the suggested change for queue rows: added text, else rationale. */
export function suggestionPreviewLine(s: SuggestionView): string {
  for (const op of s.diff.ops) {
    const added = op.newBlocks.find((block) => block.trim().length > 0);
    if (added) return added.split('\n')[0]!;
  }
  if (s.rationale.trim()) return s.rationale.split('\n')[0]!;
  return 'Removes text';
}

// --- Editor view ---

/** Carried review note: no percent is shown until a decided sample exists. */
export function editorSubtitle(agg: { acceptanceRate: number; decidedSampleSize: number }): string {
  if (agg.decidedSampleSize === 0) return 'Your suggestions · no decided sample yet';
  return `Your suggestions · ${Math.round(agg.acceptanceRate * 100)}% acceptance`;
}

export interface EditorRow {
  suggestion: SuggestionView;
  chip: string;
  detail: string | null;
}

function decidedRev(events: SuggestionEventView[] | undefined, action: 'accept' | 'partial'): number | null {
  const event = events?.find((e) => e.action === action);
  const rev = event?.payload['rev'];
  return typeof rev === 'number' ? rev : null;
}

function rejectNote(events: SuggestionEventView[] | undefined): string | null {
  const event = events?.find((e) => e.action === 'reject');
  const note = event?.payload['note'];
  return typeof note === 'string' && note.length > 0 ? note : null;
}

function formatPts(row: LedgerRowView): string {
  const value = row.basePoints * row.diversityMult * row.standingMult;
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

export function buildEditorRows(input: {
  suggestions: SuggestionView[];
  ledger: LedgerRowView[];
  eventsBySuggestion: Map<string, SuggestionEventView[]>;
}): EditorRow[] {
  const ledgerBySuggestion = new Map(input.ledger.map((row) => [row.suggestionId, row]));
  return input.suggestions.map((suggestion) => {
    const events = input.eventsBySuggestion.get(suggestion.id);
    const award = ledgerBySuggestion.get(suggestion.id);
    const credit = award
      ? `+${formatPts(award)} pts · credited in changelog`
      : 'credited in changelog';
    switch (suggestion.status) {
      case 'open':
        return { suggestion, chip: '[open]', detail: null };
      case 'accepted': {
        const rev = decidedRev(events, 'accept');
        return {
          suggestion,
          chip: rev !== null ? `[accepted -> rev ${rev}]` : '[accepted]',
          detail: credit,
        };
      }
      case 'partial': {
        const rev = decidedRev(events, 'partial');
        return {
          suggestion,
          chip: rev !== null ? `[accepted with edits -> rev ${rev}]` : '[accepted with edits]',
          detail: credit,
        };
      }
      case 'rejected': {
        const note = rejectNote(events);
        return {
          suggestion,
          chip: note !== null ? '[rejected with note]' : '[rejected]',
          detail: note !== null ? `'${note}' No penalty.` : 'No penalty.',
        };
      }
      case 'stale':
        return { suggestion, chip: '[stale]', detail: null };
    }
  });
}

export interface EditorDeskModel {
  subtitle: string;
  rows: EditorRow[];
  credibility: CredibilityViewModel | null;
}

export async function loadEditorDesk(input: {
  port: MyNewsCloudPort;
  profile: ProfileView;
  nowMs: number;
}): Promise<EditorDeskModel> {
  const [suggestions, editorProfile] = await Promise.all([
    input.port.getMySuggestions(input.profile.id),
    input.port.getEditorProfile(input.profile.handle),
  ]);
  const eventsBySuggestion = new Map<string, SuggestionEventView[]>();
  for (const suggestion of suggestions) {
    if (suggestion.status === 'open') continue;
    eventsBySuggestion.set(suggestion.id, await input.port.getSuggestionEvents(suggestion.id));
  }
  return {
    subtitle: editorSubtitle(
      editorProfile?.aggregates ?? { acceptanceRate: 0, decidedSampleSize: 0 },
    ),
    rows: buildEditorRows({
      suggestions,
      ledger: editorProfile?.ledger ?? [],
      eventsBySuggestion,
    }),
    credibility: editorProfile
      ? buildCredibilityViewModel({ profile: editorProfile, nowMs: input.nowMs })
      : null,
  };
}

/** Progress toward the next level for the C8.2 level card; null at the top. */
export function levelProgress(
  vm: CredibilityViewModel,
): { ratio: number; label: string } | null {
  const acceptedTotal = vm.lineItems.reduce((sum, item) => sum + item.count, 0);
  const copyedits = vm.lineItems.find((item) => item.type === 'copyedit')?.count ?? 0;
  switch (vm.level) {
    case 'reader':
      return { ratio: Math.min(1, acceptedTotal), label: `${acceptedTotal} of 1 accepted suggestion` };
    case 'contributor':
      return { ratio: Math.min(1, copyedits / 25), label: `${copyedits} of 25 accepted copyedits` };
    case 'copyeditor':
      return {
        ratio: Math.min(1, vm.total / 150),
        label: `${Math.round(vm.total)} of 150 weighted points`,
      };
    case 'trusted_editor':
      return {
        ratio: 0,
        label: 'Section Editor requires topic points, endorsements, and verified identity',
      };
    case 'section_editor':
      return null;
  }
}

// --- Journalist queue loading (editor level chips from the public ledger) ---

export interface JournalistQueueModel {
  queue: JournalistQueue;
  /** editorHandle -> level name, one getEditorProfile per distinct editor. */
  editorLevels: Map<string, string>;
}

export async function loadJournalistQueue(input: {
  port: MyNewsCloudPort;
  profileId: string;
  nowMs: number;
  /**
   * The author's block/mute list. A blocked editor's open suggestions are hidden
   * from the review queue client-side after the read (suggestions are keyed by
   * editor profile id, so no single-query server exclusion cleanly applies).
   */
  blocks?: BlockView[];
}): Promise<JournalistQueueModel> {
  const all = await input.port.getReviewQueue(input.profileId);
  const open = filterBlockedSuggestions(buildBlockSet(input.blocks ?? []), all);
  const editorLevels = new Map<string, string>();
  for (const suggestion of open) {
    if (editorLevels.has(suggestion.editorHandle)) continue;
    const editorProfile = await input.port.getEditorProfile(suggestion.editorHandle);
    editorLevels.set(
      suggestion.editorHandle,
      editorProfile
        ? buildCredibilityViewModel({ profile: editorProfile, nowMs: input.nowMs }).levelName
        : 'Reader',
    );
  }
  return { queue: buildJournalistQueue(open), editorLevels };
}

// --- Accept preview (rebase or needs-refresh) ---

export type AcceptPreviewModel =
  | {
      status: 'current' | 'rebased';
      diff: StructuredDiff;
      applied:
        | { kind: 'body'; bodyMd: string }
        | { kind: 'headline'; headline: string; dek: string | null };
    }
  | { status: 'stale' };

/**
 * What accepting would produce against the CURRENT head. Headline suggestions
 * preview against the headline pseudo-document. A diff written against an
 * older revision is rebased; irrecoverable relocation reports stale so the
 * screen blocks accept with honest copy.
 */
export function buildAcceptPreview(input: {
  suggestion: SuggestionView;
  article: ArticleView;
}): AcceptPreviewModel {
  const isHeadline = input.suggestion.type === 'headline';
  const baseDoc = isHeadline
    ? headlineDoc(input.article.headline, input.article.dek)
    : input.article.bodyMd;
  let diff = input.suggestion.diff;
  let status: 'current' | 'rebased' = 'current';
  if (diff.baseHash !== hashText(baseDoc)) {
    const rebased = rebaseDiff(diff, '', baseDoc);
    if (rebased.status !== 'rebased') return { status: 'stale' };
    diff = rebased.diff;
    status = 'rebased';
  }
  const applied = applyDiff(baseDoc, diff);
  if (!applied.ok) return { status: 'stale' };
  if (isHeadline) {
    const split = splitHeadlineDoc(applied.text);
    return { status, diff, applied: { kind: 'headline', headline: split.headline, dek: split.dek } };
  }
  return { status, diff, applied: { kind: 'body', bodyMd: applied.text } };
}

// --- Unchanged counter-edit downgrade ---

export type CounterEditFields =
  | { editedBodyMd: string }
  | { editedHeadline: string; editedDek: string | null }
  | Record<string, never>;

/**
 * The author's "Edit + accept" text is compared against the plain applied
 * output; when nothing changed, a plain accept is sent (no counter-edit
 * fields, decision stays 'accept', the editor gets full credit).
 */
export function resolveCounterEdit(input: {
  preview: Extract<AcceptPreviewModel, { status: 'current' | 'rebased' }>;
  edited: { bodyMd?: string; headline?: string; dek?: string | null };
}): CounterEditFields {
  if (input.preview.applied.kind === 'body') {
    const bodyMd = input.edited.bodyMd ?? input.preview.applied.bodyMd;
    return bodyMd === input.preview.applied.bodyMd ? {} : { editedBodyMd: bodyMd };
  }
  const headline = input.edited.headline ?? input.preview.applied.headline;
  const dek = input.edited.dek === undefined ? input.preview.applied.dek : input.edited.dek;
  return headline === input.preview.applied.headline && dek === input.preview.applied.dek
    ? {}
    : { editedHeadline: headline, editedDek: dek };
}

// --- Suggestion thread rendering ---

/** Decision events render as system rows; comments render as thread messages. */
export function eventRowText(event: SuggestionEventView): string | null {
  switch (event.action) {
    case 'comment':
      return null;
    case 'accept': {
      const rev = event.payload['rev'];
      return typeof rev === 'number' ? `Accepted · published rev ${rev}` : 'Accepted';
    }
    case 'partial': {
      const rev = event.payload['rev'];
      return typeof rev === 'number'
        ? `Accepted with author edits · published rev ${rev}`
        : 'Accepted with author edits';
    }
    case 'reject': {
      const note = event.payload['note'];
      return typeof note === 'string' && note.length > 0 ? `Rejected: '${note}'` : 'Rejected';
    }
    case 'rebase':
      return 'Rebased onto a newer revision';
  }
}

// --- Batch copyedit model ---

/** Open copyedits on the article's CURRENT rev only (baseRev AND base hash must match). */
export function filterBatchEligible(
  article: ArticleView,
  suggestions: SuggestionView[],
): SuggestionView[] {
  const headHash = hashText(article.bodyMd);
  return suggestions.filter(
    (s) =>
      s.type === 'copyedit' &&
      s.status === 'open' &&
      s.baseRev === article.rev &&
      s.diff.baseHash === headHash,
  );
}

export interface BatchConflictModel {
  baseIndex: number;
  suggestionIds: [string, string];
}

export interface BatchModel {
  included: SuggestionView[];
  conflicts: BatchConflictModel[];
  /** Accept stays disabled until every conflict is resolved by exclusion. */
  canAccept: boolean;
  previewBody: string | null;
  creditNames: string[];
  acceptLabel: string;
  creditsLine: string;
}

export function buildBatchModel(input: {
  article: ArticleView;
  eligible: SuggestionView[];
  includedIds: ReadonlySet<string>;
}): BatchModel {
  const included = input.eligible.filter((s) => input.includedIds.has(s.id));
  let conflicts: BatchConflictModel[] = [];
  let previewBody: string | null = null;
  if (included.length > 0) {
    const combined = combineDiffs(included.map((s) => s.diff));
    if (combined.ok) {
      const applied = applyDiff(input.article.bodyMd, combined.diff);
      previewBody = applied.ok ? applied.text : null;
    } else {
      const seen = new Set<string>();
      for (const conflict of combined.conflicts) {
        const pair: [string, string] = [
          included[conflict.diffIndexes[0]!]!.id,
          included[conflict.diffIndexes[1]!]!.id,
        ];
        const key = pair.join('|');
        if (seen.has(key)) continue;
        seen.add(key);
        conflicts.push({ baseIndex: conflict.baseIndex, suggestionIds: pair });
      }
    }
  }
  const creditNames = [...new Set(included.map((s) => s.editorDisplayName))];
  const nextRev = input.article.rev + 1;
  return {
    included,
    conflicts,
    canAccept: included.length > 0 && conflicts.length === 0 && previewBody !== null,
    previewBody,
    creditNames,
    acceptLabel: `Accept ${included.length} · publish rev ${nextRev}`,
    creditsLine: `Accepting creates revision ${nextRev}. Signed by you. ${creditNames.join(', ')} credited in the public changelog.`,
  };
}

// --- Draft banner + draft publish error copy (C8.8, article-page parts) ---

/**
 * Resolve which of my newsrooms holds this draft (the ArticleView carries no
 * newsroom fields; membership reads are small). Null when none matches, so
 * the banner honestly renders plain "Draft".
 */
export async function resolveDraftNewsroomName(input: {
  port: MyNewsCloudPort;
  profileId: string;
  articleId: string;
}): Promise<string | null> {
  const rooms = await input.port.listMyNewsrooms(input.profileId);
  for (const room of rooms) {
    const detail = await input.port.getNewsroom(room.id);
    if (detail?.drafts.some((draft) => draft.articleId === input.articleId)) {
      return detail.newsroom.name;
    }
  }
  return null;
}

export function draftBannerText(newsroomName: string | null): string {
  return newsroomName ? `Draft · ${newsroomName}` : 'Draft';
}

/** publishErrorMessage plus the C4 draft-path code the P1 map predates. */
export function draftPublishErrorMessage(code: string, detail?: string): string {
  if (code === 'not-newsroom-member' || detail === 'not-newsroom-member') {
    return 'Publishing this draft needs an owner or coauthor role in its newsroom.';
  }
  return publishErrorMessage(code as PublishErrorCode, detail);
}
