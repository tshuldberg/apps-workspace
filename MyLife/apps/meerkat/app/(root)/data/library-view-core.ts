// Plan 38 Phase 5 (amendment D.10): the pure browse view logic for a library
// (MOBILE). Sort / filter / search composition, On Deck (resume), and Recently
// added derivation, all over the ALREADY-VERIFIED ResolvedLibraryItem read model
// (library-store-core owns verification; this never re-reads the db). Node-only,
// no React, so the browse hot paths are unit-tested without a render harness.
//
// This is the mobile source of truth for library view logic; apps/meerkat-web
// carries a structural twin. Every number a card shows still derives from a real
// verified row (honesty): On Deck reads real cm_library_progress, Recently added
// reads real item updatedAt HLCs, and nothing here fabricates availability.

import type { ResolvedLibraryItem } from './library-data-core';
import { MEDIA_TYPE_REGISTRY, type KnownMediaType, type LibraryCardShape } from './library-metadata-core';

// Canonical strings shared with the web twin (parity-locked). Keep byte-identical.
export const LIBRARY_STRINGS = {
  myLibrary: 'My Library',
  onDeck: 'On Deck',
  recentlyAdded: 'Recently added',
  heldOnThisDevice: 'Held on this device',
  // Plan 38 Phase 7 (amendment E): the ONLY honest state line for a COMMUNITY
  // library item this device does not hold. Never 'available', never a spinner.
  availableFromMembers: 'Available from members who have it, when a sync connects.',
  alreadyInThisLibrary: 'Already in this library',
  keepPhotoLocations: 'Keep photo locations',
  saveToLibrary: 'Save to library',
  addToLibrary: 'Add to library',
  newLibrary: 'New library',
} as const;

export type LibrarySortDir = 'asc' | 'desc';

export interface LibrarySortState {
  /** A sort key from the media type's registry sortFields. */
  field: string;
  dir: LibrarySortDir;
}

export interface LibraryFilterState {
  /** Exact release year, or null for any. */
  year: number | null;
  /** Item must carry EVERY selected tag (AND). Empty = no tag filter. */
  tags: readonly string[];
  /** Only items with no completed progress (honest "unwatched"). */
  unwatchedOnly: boolean;
}

export const EMPTY_FILTER: LibraryFilterState = { year: null, tags: [], unwatchedOnly: false };

export interface LibraryProgressLite {
  positionMs: number;
  completed: boolean;
  updatedAt: string;
}

export interface LibraryViewInput {
  items: readonly ResolvedLibraryItem[];
  sort: LibrarySortState;
  filter: LibraryFilterState;
  /** Free text; matched (case-insensitive, trimmed) against title + sortTitle. */
  query: string;
  /** Verified tags per item id (add-only set); missing = no tags. */
  tagsByItemId: ReadonlyMap<string, readonly string[]>;
  /** Real progress per item id; missing = never opened. */
  progressByItemId: ReadonlyMap<string, LibraryProgressLite>;
}

/** The card layout a media type renders in (poster / list / album / masonry). */
export function cardShapeForMediaType(mediaType: string): LibraryCardShape {
  const entry = MEDIA_TYPE_REGISTRY[mediaType as KnownMediaType];
  return entry ? entry.cardShape : 'list';
}

/** The sort keys a media type offers (registry-driven; unknown type falls back to added/title). */
export function sortFieldsForMediaType(mediaType: string): readonly string[] {
  const entry = MEDIA_TYPE_REGISTRY[mediaType as KnownMediaType];
  return entry ? entry.sortFields : ['title', 'added'];
}

/** The default sort key for a media type. */
export function defaultSortForMediaType(mediaType: string): string {
  const entry = MEDIA_TYPE_REGISTRY[mediaType as KnownMediaType];
  return entry ? entry.defaultSort : 'added';
}

function parseMetadata(item: ResolvedLibraryItem): Record<string, unknown> {
  try {
    const parsed: unknown = JSON.parse(item.event.metadataJson);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

function normalize(text: string): string {
  return text.trim().toLowerCase();
}

/**
 * A comparable sort value for one item on a given sort key. Strings compare
 * case-insensitively; a missing value sorts to the end for asc (and the start
 * for desc) by using extreme sentinels. Registry sort keys are honored; an
 * unknown key falls back to the added timestamp.
 */
function sortValue(item: ResolvedLibraryItem, field: string): string | number {
  const e = item.event;
  switch (field) {
    case 'title':
      return normalize(e.sortTitle ?? e.title);
    case 'added':
      return e.updatedAt;
    case 'year':
      return typeof e.year === 'number' ? e.year : Number.NEGATIVE_INFINITY;
    case 'duration':
      return typeof e.durationMs === 'number' ? e.durationMs : 0;
    case 'artist':
    case 'album': {
      const meta = parseMetadata(item);
      const v = meta[field];
      return typeof v === 'string' ? normalize(v) : '';
    }
    case 'author': {
      const meta = parseMetadata(item);
      const authors = meta.authors;
      const first = Array.isArray(authors) && typeof authors[0] === 'string' ? authors[0] : '';
      return normalize(first);
    }
    case 'capturedAt': {
      const meta = parseMetadata(item);
      const v = meta.capturedAt;
      return typeof v === 'string' ? v : '';
    }
    default:
      return e.updatedAt;
  }
}

function compareItems(a: ResolvedLibraryItem, b: ResolvedLibraryItem, sort: LibrarySortState): number {
  const av = sortValue(a, sort.field);
  const bv = sortValue(b, sort.field);
  let cmp: number;
  if (typeof av === 'number' && typeof bv === 'number') {
    cmp = av - bv;
  } else {
    cmp = String(av) < String(bv) ? -1 : String(av) > String(bv) ? 1 : 0;
  }
  if (cmp === 0) {
    // Stable, deterministic tiebreak on id (never a locale-variant order).
    cmp = a.event.id < b.event.id ? -1 : a.event.id > b.event.id ? 1 : 0;
  }
  return sort.dir === 'desc' ? -cmp : cmp;
}

function matchesFilter(item: ResolvedLibraryItem, input: LibraryViewInput): boolean {
  const { filter } = input;
  if (filter.year !== null && item.event.year !== filter.year) return false;
  if (filter.tags.length > 0) {
    const itemTags = input.tagsByItemId.get(item.event.id) ?? [];
    const have = new Set(itemTags.map(normalize));
    for (const tag of filter.tags) {
      if (!have.has(normalize(tag))) return false;
    }
  }
  if (filter.unwatchedOnly) {
    const progress = input.progressByItemId.get(item.event.id);
    if (progress?.completed) return false;
  }
  return true;
}

function matchesQuery(item: ResolvedLibraryItem, query: string): boolean {
  const q = normalize(query);
  if (!q) return true;
  const title = normalize(item.event.title);
  const sortTitle = item.event.sortTitle ? normalize(item.event.sortTitle) : '';
  return title.includes(q) || sortTitle.includes(q);
}

/**
 * The full browse composition: filter (year/tags/unwatched), then search
 * (title/sortTitle), then sort. Pure and stable; the caller windows the result
 * for the FlatList. Order of operations is filter -> search -> sort so the sort
 * only touches the surviving set.
 */
export function composeLibraryView(input: LibraryViewInput): ResolvedLibraryItem[] {
  const filtered = input.items.filter(
    (item) => matchesFilter(item, input) && matchesQuery(item, input.query),
  );
  return filtered.sort((a, b) => compareItems(a, b, input.sort));
}

export interface LibraryFacets {
  /** Distinct release years present, descending. */
  years: number[];
  /** Distinct tags present across the library, alphabetical. */
  tags: string[];
}

/** The filter facets (years + tags) available for the current item set. */
export function libraryFacets(
  items: readonly ResolvedLibraryItem[],
  tagsByItemId: ReadonlyMap<string, readonly string[]>,
): LibraryFacets {
  const years = new Set<number>();
  const tags = new Set<string>();
  for (const item of items) {
    if (typeof item.event.year === 'number') years.add(item.event.year);
    for (const tag of tagsByItemId.get(item.event.id) ?? []) tags.add(tag);
  }
  return {
    years: [...years].sort((a, b) => b - a),
    tags: [...tags].sort((a, b) => (a.toLowerCase() < b.toLowerCase() ? -1 : 1)),
  };
}

export interface OnDeckEntry {
  item: ResolvedLibraryItem;
  positionMs: number;
  durationMs: number | null;
  progressUpdatedAt: string;
}

/**
 * On Deck = items you started but have not completed, most-recently-touched
 * first. Fed ONLY by real cm_library_progress rows (positionMs > 0, not
 * completed); an item with no progress row never appears. Deterministic order:
 * progress updatedAt desc, id tiebreak.
 */
export function buildOnDeck(
  items: readonly ResolvedLibraryItem[],
  progressByItemId: ReadonlyMap<string, LibraryProgressLite>,
  limit = 12,
): OnDeckEntry[] {
  const entries: OnDeckEntry[] = [];
  for (const item of items) {
    const progress = progressByItemId.get(item.event.id);
    if (!progress || progress.completed || progress.positionMs <= 0) continue;
    entries.push({
      item,
      positionMs: progress.positionMs,
      durationMs: item.event.durationMs,
      progressUpdatedAt: progress.updatedAt,
    });
  }
  entries.sort((a, b) => {
    if (a.progressUpdatedAt !== b.progressUpdatedAt) {
      return a.progressUpdatedAt < b.progressUpdatedAt ? 1 : -1;
    }
    return a.item.event.id < b.item.event.id ? 1 : -1;
  });
  return entries.slice(0, limit);
}

/**
 * Recently added = newest items by their signed updatedAt HLC, id tiebreak.
 * (An item's updatedAt advances on author edits too, which is the honest
 * "recently touched" signal; no separate created column exists on the row.)
 */
export function buildRecentlyAdded(
  items: readonly ResolvedLibraryItem[],
  limit = 12,
): ResolvedLibraryItem[] {
  return [...items]
    .sort((a, b) => {
      if (a.event.updatedAt !== b.event.updatedAt) {
        return a.event.updatedAt < b.event.updatedAt ? 1 : -1;
      }
      return a.event.id < b.event.id ? 1 : -1;
    })
    .slice(0, limit);
}

// ---------------------------------------------------------------------------
// FlatList windowing seam (Plan 32 feed precedent): pure so the scroll hot path
// is unit-tested. A 10k-item library renders a growing window, never all rows.
// ---------------------------------------------------------------------------

/** The initial render-window size for a library grid/list. */
export const LIBRARY_RENDER_WINDOW = 60;

/** How many more cells each onEndReached reveals. */
export const LIBRARY_RENDER_STEP = 60;

/**
 * The next render-window size after onEndReached. Grows by `step` until it covers
 * the whole composed list, then stays put (the slice caller caps at the real
 * length, so overshoot is harmless). Never shrinks.
 */
export function nextLibraryWindow(current: number, total: number, step = LIBRARY_RENDER_STEP): number {
  if (current >= total) return current;
  return current + step;
}
