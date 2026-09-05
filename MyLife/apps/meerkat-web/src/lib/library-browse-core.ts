// Plan 38 Phase 5 (browse UX, WEB): the PURE view-model layer for the library
// browse surface. It owns sort / filter / search, the "On Deck" (resume) and
// "Recently added" rows, the within-workspace dedup notice text, the media-type
// card shape lookup, the local smart-collection evaluation with an unknown-rule
// fail-safe, and the windowed-grid slice math for the 10k-item perf budget.
//
// It is DELIBERATELY pure and db/store-free: the screen builds the tag/progress
// maps from the shipped store queries and passes them in, so this module can be
// unit-tested without a database (channel-view-core precedent). It IMPORTS the
// data + metadata cores (owned by the data agent) read-only.

import {
  MEDIA_TYPE_REGISTRY,
  isKnownMediaType,
  validateLibraryItemMetadata,
  evaluateSmartRuleSafe,
  type KnownMediaType,
  type LibraryCardShape,
  type SmartRule,
} from './library-metadata-core';
import type { ResolvedLibraryItem } from './library-data-core';

// ---------------------------------------------------------------------------
// Canonical UI strings (the mobile browse surface carries the same set). Kept in
// one place so the tests and every screen read the exact wording.
// ---------------------------------------------------------------------------

export const LIBRARY_STRINGS = {
  myLibrary: 'My Library',
  onDeck: 'On Deck',
  recentlyAdded: 'Recently added',
  heldOnThisDevice: 'Held on this device',
  availableFromMembers: 'Available from members who have it, when a sync connects.',
  alreadyInThisLibrary: 'Already in this library',
  alreadyInThisCommunity: 'Already in this community',
  keepPhotoLocations: 'Keep photo locations',
  saveToLibrary: 'Save to library',
  addToLibrary: 'Add to library',
  newLibrary: 'New library',
} as const;

/**
 * The dedup notice a successful ingest shows when the store reported the sealed
 * blob was already held. Personal libraries phrase it per-library; a community
 * library dedups across its libraries, so it phrases it per-community (C.2).
 */
export function dedupNoticeText(workspaceKind: 'personal' | 'community'): string {
  return workspaceKind === 'community'
    ? LIBRARY_STRINGS.alreadyInThisCommunity
    : LIBRARY_STRINGS.alreadyInThisLibrary;
}

// ---------------------------------------------------------------------------
// Media-type presentation.
// ---------------------------------------------------------------------------

/** The card layout for a media type; an unknown type falls back to a generic list. */
export function cardShapeForMediaType(mediaType: string): LibraryCardShape {
  return isKnownMediaType(mediaType) ? MEDIA_TYPE_REGISTRY[mediaType].cardShape : 'list';
}

/** The sort keys a media type offers; unknown types get the generic document set. */
export function sortFieldsForMediaType(mediaType: string): readonly string[] {
  return isKnownMediaType(mediaType) ? MEDIA_TYPE_REGISTRY[mediaType].sortFields : ['title', 'added'];
}

export function defaultSortForMediaType(mediaType: string): string {
  return isKnownMediaType(mediaType) ? MEDIA_TYPE_REGISTRY[mediaType].defaultSort : 'added';
}

/** Human label for a sort key. */
export function sortFieldLabel(sortKey: string): string {
  switch (sortKey) {
    case 'title': return 'Title';
    case 'year': return 'Year';
    case 'added': return 'Recently added';
    case 'duration': return 'Duration';
    case 'artist': return 'Artist';
    case 'album': return 'Album';
    case 'capturedAt': return 'Date taken';
    case 'author': return 'Author';
    default: return sortKey;
  }
}

// ---------------------------------------------------------------------------
// Per-item derived view (parsed metadata + local tags + local progress).
// ---------------------------------------------------------------------------

export interface ItemProgress {
  positionMs: number;
  completed: boolean;
  updatedAt: string;
}

export interface LibraryBrowseContext {
  /** itemId -> verified local tags (lower-cased, sorted). */
  tagsByItem: Map<string, readonly string[]>;
  /** itemId -> personal resume state (never community-visible). */
  progressByItem: Map<string, ItemProgress>;
}

const EMPTY_CONTEXT: LibraryBrowseContext = {
  tagsByItem: new Map(),
  progressByItem: new Map(),
};

/** Parse an item's metadata_json for the given media type; {} on anything invalid. */
export function itemMetadata(item: ResolvedLibraryItem): Record<string, unknown> {
  const parse = validateLibraryItemMetadata(item.mediaType, item.event.metadataJson);
  return parse.status === 'ok' ? parse.value : {};
}

function metaString(meta: Record<string, unknown>, key: string): string {
  const v = meta[key];
  return typeof v === 'string' ? v : '';
}

/** The title used for display + title sort (sort_title wins when present). */
export function itemSortTitle(item: ResolvedLibraryItem): string {
  return (item.event.sortTitle ?? item.event.title ?? '').toLocaleLowerCase();
}

// ---------------------------------------------------------------------------
// Sort.
// ---------------------------------------------------------------------------

/**
 * Sort the resolved items by a sort key. Stable + total: every comparator falls
 * back to (sort title, id) so the order is deterministic for a 10k list. An
 * unknown sort key sorts by title.
 */
export function sortLibraryItems(
  items: readonly ResolvedLibraryItem[],
  sortKey: string,
): ResolvedLibraryItem[] {
  const withKeys = items.map((item) => ({ item, meta: itemMetadata(item) }));
  const cmp = (a: { item: ResolvedLibraryItem; meta: Record<string, unknown> }, b: typeof a): number => {
    const primary = compareByKey(a, b, sortKey);
    if (primary !== 0) return primary;
    const t = itemSortTitle(a.item).localeCompare(itemSortTitle(b.item));
    if (t !== 0) return t;
    return a.item.event.id < b.item.event.id ? -1 : a.item.event.id > b.item.event.id ? 1 : 0;
  };
  return withKeys.slice().sort(cmp).map((w) => w.item);
}

function compareByKey(
  a: { item: ResolvedLibraryItem; meta: Record<string, unknown> },
  b: { item: ResolvedLibraryItem; meta: Record<string, unknown> },
  sortKey: string,
): number {
  switch (sortKey) {
    case 'year':
      return numAsc(a.item.event.year, b.item.event.year);
    case 'duration':
      return numAsc(a.item.event.durationMs, b.item.event.durationMs);
    case 'added':
      // Newest first (the row is "Recently added").
      return -a.item.event.updatedAt.localeCompare(b.item.event.updatedAt);
    case 'artist':
      return metaString(a.meta, 'artist').localeCompare(metaString(b.meta, 'artist'));
    case 'album':
      return metaString(a.meta, 'album').localeCompare(metaString(b.meta, 'album'));
    case 'capturedAt':
      // Newest capture first.
      return -metaString(a.meta, 'capturedAt').localeCompare(metaString(b.meta, 'capturedAt'));
    case 'author': {
      const aa = firstAuthor(a.meta);
      const bb = firstAuthor(b.meta);
      return aa.localeCompare(bb);
    }
    case 'title':
    default:
      return itemSortTitle(a.item).localeCompare(itemSortTitle(b.item));
  }
}

function firstAuthor(meta: Record<string, unknown>): string {
  const authors = meta['authors'];
  if (Array.isArray(authors) && typeof authors[0] === 'string') return authors[0];
  return '';
}

/** Ascending numeric compare with nulls sorted last. */
function numAsc(a: number | null, b: number | null): number {
  if (a === null && b === null) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return a - b;
}

// ---------------------------------------------------------------------------
// Filter + search.
// ---------------------------------------------------------------------------

export interface LibraryFilters {
  /** Exact release/capture year, or null for any. */
  year: number | null;
  /** Every tag here must be present on the item (AND). Lower-cased. */
  tags: readonly string[];
  /** Only items with no completed progress (the "unwatched" filter). */
  unwatchedOnly: boolean;
}

export const NO_FILTERS: LibraryFilters = { year: null, tags: [], unwatchedOnly: false };

export function filtersAreEmpty(filters: LibraryFilters): boolean {
  return filters.year === null && filters.tags.length === 0 && !filters.unwatchedOnly;
}

export function filterLibraryItems(
  items: readonly ResolvedLibraryItem[],
  filters: LibraryFilters,
  ctx: LibraryBrowseContext = EMPTY_CONTEXT,
): ResolvedLibraryItem[] {
  if (filtersAreEmpty(filters)) return items.slice();
  const wantTags = filters.tags.map((t) => t.toLowerCase());
  return items.filter((item) => {
    if (filters.year !== null && item.event.year !== filters.year) return false;
    if (filters.unwatchedOnly && ctx.progressByItem.get(item.event.id)?.completed) return false;
    if (wantTags.length > 0) {
      const have = new Set((ctx.tagsByItem.get(item.event.id) ?? []).map((t) => t.toLowerCase()));
      if (!wantTags.every((t) => have.has(t))) return false;
    }
    return true;
  });
}

/** Case-insensitive local search across title, sort title, and string metadata values. */
export function searchLibraryItems(
  items: readonly ResolvedLibraryItem[],
  query: string,
): ResolvedLibraryItem[] {
  const q = query.trim().toLowerCase();
  if (!q) return items.slice();
  return items.filter((item) => {
    if (item.event.title.toLowerCase().includes(q)) return true;
    if ((item.event.sortTitle ?? '').toLowerCase().includes(q)) return true;
    const meta = itemMetadata(item);
    for (const value of Object.values(meta)) {
      if (typeof value === 'string' && value.toLowerCase().includes(q)) return true;
      if (Array.isArray(value)) {
        for (const el of value) if (typeof el === 'string' && el.toLowerCase().includes(q)) return true;
      }
    }
    return false;
  });
}

/** The distinct years present across items (descending), for the year filter. */
export function availableYears(items: readonly ResolvedLibraryItem[]): number[] {
  const years = new Set<number>();
  for (const item of items) if (item.event.year !== null) years.add(item.event.year);
  return [...years].sort((a, b) => b - a);
}

/** The distinct tags present across items (sorted), for the tag filter. */
export function availableTags(ctx: LibraryBrowseContext): string[] {
  const tags = new Set<string>();
  for (const list of ctx.tagsByItem.values()) for (const t of list) tags.add(t.toLowerCase());
  return [...tags].sort();
}

// ---------------------------------------------------------------------------
// On Deck + Recently added rows (REAL local rows only).
// ---------------------------------------------------------------------------

export interface OnDeckEntry {
  item: ResolvedLibraryItem;
  progress: ItemProgress;
}

/**
 * The "On Deck" resume row: items with real in-progress (position > 0, not
 * completed) local progress, newest-touched first. Nothing is fabricated -- an
 * item with no progress row never appears.
 */
export function buildOnDeck(
  items: readonly ResolvedLibraryItem[],
  ctx: LibraryBrowseContext,
  limit = 20,
): OnDeckEntry[] {
  const out: OnDeckEntry[] = [];
  for (const item of items) {
    const progress = ctx.progressByItem.get(item.event.id);
    if (!progress) continue;
    if (progress.completed) continue;
    if (progress.positionMs <= 0) continue;
    out.push({ item, progress });
  }
  out.sort((a, b) => -a.progress.updatedAt.localeCompare(b.progress.updatedAt));
  return out.slice(0, limit);
}

/** The "Recently added" row: items by authored/updated wall time, newest first. */
export function buildRecentlyAdded(
  items: readonly ResolvedLibraryItem[],
  limit = 20,
): ResolvedLibraryItem[] {
  return sortLibraryItems(items, 'added').slice(0, limit);
}

// ---------------------------------------------------------------------------
// Smart collections (evaluated locally; unknown rule fails safe to empty).
// ---------------------------------------------------------------------------

export interface SmartEvaluation {
  /** The verified item ids the rule selects; empty when the rule is unknown. */
  itemIds: string[];
  /** True when the rule type could not be parsed (render an honest empty + notice). */
  unknownRule: boolean;
}

/**
 * Evaluate a single smart-collection rule LOCALLY over the verified items. An
 * unknown or malformed rule (evaluateSmartRuleSafe -> null) yields an empty set
 * flagged unknownRule so the UI renders an honest empty collection with a notice,
 * never a crash and never a stale membership.
 */
export function evaluateSmartCollection(
  ruleType: string,
  ruleJson: string,
  items: readonly ResolvedLibraryItem[],
  ctx: LibraryBrowseContext = EMPTY_CONTEXT,
): SmartEvaluation {
  const rule = evaluateSmartRuleSafe(ruleType, ruleJson);
  if (!rule) return { itemIds: [], unknownRule: true };
  const itemIds: string[] = [];
  for (const item of items) if (itemMatchesRule(item, rule, ctx)) itemIds.push(item.event.id);
  return { itemIds, unknownRule: false };
}

function itemMatchesRule(
  item: ResolvedLibraryItem,
  rule: SmartRule,
  ctx: LibraryBrowseContext,
): boolean {
  switch (rule.type) {
    case 'unwatched':
      return !ctx.progressByItem.get(item.event.id)?.completed;
    case 'year':
      return item.event.year === rule.year;
    case 'tag': {
      const have = new Set((ctx.tagsByItem.get(item.event.id) ?? []).map((t) => t.toLowerCase()));
      return have.has(rule.tag.toLowerCase());
    }
    case 'genre': {
      const meta = itemMetadata(item);
      const genres = meta['genres'];
      if (!Array.isArray(genres)) return false;
      return genres.some((g) => typeof g === 'string' && g.toLowerCase() === rule.genre.toLowerCase());
    }
    default:
      return false;
  }
}

// ---------------------------------------------------------------------------
// Windowed grid slice (10k-item perf budget). Pure geometry: given the scroll
// offset + viewport, return which rows to render plus the spacer heights. The
// grid renders only [startIndex, endIndex) of a `columns`-wide layout.
// ---------------------------------------------------------------------------

export interface GridWindow {
  startIndex: number;
  endIndex: number;
  topSpacerPx: number;
  bottomSpacerPx: number;
  totalHeightPx: number;
}

export function computeGridWindow(args: {
  itemCount: number;
  columns: number;
  rowHeightPx: number;
  scrollTopPx: number;
  viewportHeightPx: number;
  overscanRows?: number;
}): GridWindow {
  const columns = Math.max(1, Math.floor(args.columns));
  const rowHeight = Math.max(1, args.rowHeightPx);
  const overscan = Math.max(0, args.overscanRows ?? 2);
  const totalRows = Math.ceil(Math.max(0, args.itemCount) / columns);
  const totalHeightPx = totalRows * rowHeight;
  if (args.itemCount <= 0) {
    return { startIndex: 0, endIndex: 0, topSpacerPx: 0, bottomSpacerPx: 0, totalHeightPx: 0 };
  }
  const firstVisibleRow = Math.max(0, Math.floor(args.scrollTopPx / rowHeight) - overscan);
  const visibleRowCount = Math.ceil(args.viewportHeightPx / rowHeight) + overscan * 2;
  const lastVisibleRow = Math.min(totalRows, firstVisibleRow + visibleRowCount);
  const startIndex = firstVisibleRow * columns;
  const endIndex = Math.min(args.itemCount, lastVisibleRow * columns);
  const topSpacerPx = firstVisibleRow * rowHeight;
  const bottomSpacerPx = Math.max(0, totalHeightPx - lastVisibleRow * rowHeight);
  return { startIndex, endIndex, topSpacerPx, bottomSpacerPx, totalHeightPx };
}

// ---------------------------------------------------------------------------
// A one-call browse pipeline: filter -> search -> sort. The screen owns the raw
// list + maps; this keeps the ordering of the three steps in one tested place.
// ---------------------------------------------------------------------------

export function browseLibraryItems(
  items: readonly ResolvedLibraryItem[],
  args: { filters: LibraryFilters; query: string; sortKey: string },
  ctx: LibraryBrowseContext = EMPTY_CONTEXT,
): ResolvedLibraryItem[] {
  const filtered = filterLibraryItems(items, args.filters, ctx);
  const searched = searchLibraryItems(filtered, args.query);
  return sortLibraryItems(searched, args.sortKey);
}

export type { KnownMediaType, LibraryCardShape };
