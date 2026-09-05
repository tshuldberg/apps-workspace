// Plan 38 Phase 5 (WEB): pure view-model tests for the library browse layer --
// sort / filter / search, On Deck + Recently added (real local rows only), the
// dedup notice text, the smart-collection unknown-rule fail-safe, and the
// windowed-grid geometry. No database: the browse core is pure.

import { describe, expect, it } from 'vitest';
import type { LibraryItemEvent, ResolvedLibraryItem } from '../library-data-core';
import type { KnownMediaType } from '../library-metadata-core';
import {
  LIBRARY_STRINGS,
  browseLibraryItems,
  buildOnDeck,
  buildRecentlyAdded,
  cardShapeForMediaType,
  computeGridWindow,
  dedupNoticeText,
  evaluateSmartCollection,
  filterLibraryItems,
  searchLibraryItems,
  sortLibraryItems,
  type ItemProgress,
  type LibraryBrowseContext,
} from '../library-browse-core';

function makeItem(
  mediaType: KnownMediaType,
  partial: Partial<LibraryItemEvent> & { id: string; title: string },
  metadata: Record<string, unknown> = {},
): ResolvedLibraryItem {
  const event: LibraryItemEvent = {
    version: 1,
    id: partial.id,
    communityId: 'ws',
    channelId: 'lib1',
    contentCid: 'a'.repeat(32),
    coverCid: null,
    thumbCid: null,
    keyEpoch: 1,
    wrappedKey: 'b'.repeat(96),
    coverWrappedKey: null,
    manifestJson: '{}',
    title: partial.title,
    sortTitle: partial.sortTitle ?? null,
    year: partial.year ?? null,
    durationMs: partial.durationMs ?? null,
    sizeBytes: partial.sizeBytes ?? null,
    mimeType: partial.mimeType ?? null,
    metadataJson: JSON.stringify(metadata),
    metadataSource: 'local',
    authorDeviceId: 'dev',
    updatedAt: partial.updatedAt ?? '2026-07-01T00:00:00.000Z',
    tombstone: false,
    signature: 'sig',
  };
  return { event, mediaType, metadataUnknownType: false };
}

function ctxWith(progress: Record<string, ItemProgress>, tags: Record<string, string[]> = {}): LibraryBrowseContext {
  return {
    progressByItem: new Map(Object.entries(progress)),
    tagsByItem: new Map(Object.entries(tags)),
  };
}

describe('sort', () => {
  it('sorts by title using sort_title when present, id as the final tiebreak', () => {
    const items = [
      makeItem('movie', { id: 'b', title: 'Zebra', sortTitle: 'Alpha' }),
      makeItem('movie', { id: 'a', title: 'Apple' }),
    ];
    expect(sortLibraryItems(items, 'title').map((i) => i.event.id)).toEqual(['b', 'a']);
  });

  it('sorts by year ascending with nulls last', () => {
    const items = [
      makeItem('movie', { id: '1', title: 'A', year: 2010 }),
      makeItem('movie', { id: '2', title: 'B', year: null }),
      makeItem('movie', { id: '3', title: 'C', year: 1999 }),
    ];
    expect(sortLibraryItems(items, 'year').map((i) => i.event.id)).toEqual(['3', '1', '2']);
  });

  it('added sorts newest first', () => {
    const items = [
      makeItem('movie', { id: 'old', title: 'Old', updatedAt: '2026-01-01T00:00:00.000Z' }),
      makeItem('movie', { id: 'new', title: 'New', updatedAt: '2026-06-01T00:00:00.000Z' }),
    ];
    expect(sortLibraryItems(items, 'added').map((i) => i.event.id)).toEqual(['new', 'old']);
  });

  it('sorts music by artist from metadata', () => {
    const items = [
      makeItem('music', { id: '1', title: 'Song1' }, { artist: 'Zed' }),
      makeItem('music', { id: '2', title: 'Song2' }, { artist: 'Abe' }),
    ];
    expect(sortLibraryItems(items, 'artist').map((i) => i.event.id)).toEqual(['2', '1']);
  });
});

describe('filter + search', () => {
  const items = [
    makeItem('movie', { id: '1', title: 'Arrival', year: 2016 }, { genres: ['sci-fi'] }),
    makeItem('movie', { id: '2', title: 'Amelie', year: 2001 }),
    makeItem('movie', { id: '3', title: 'Dune', year: 2021 }),
  ];

  it('filters by exact year', () => {
    expect(filterLibraryItems(items, { year: 2016, tags: [], unwatchedOnly: false }).map((i) => i.event.id)).toEqual(['1']);
  });

  it('filters unwatched-only using local progress (completed excluded)', () => {
    const ctx = ctxWith({ '3': { positionMs: 10, completed: true, updatedAt: '2026-06-01T00:00:00.000Z' } });
    const out = filterLibraryItems(items, { year: null, tags: [], unwatchedOnly: true }, ctx);
    expect(out.map((i) => i.event.id)).toEqual(['1', '2']);
  });

  it('filters by tag (AND) from the tag map', () => {
    const ctx = ctxWith({}, { '1': ['favorite'], '2': ['favorite', 'french'] });
    const out = filterLibraryItems(items, { year: null, tags: ['french'], unwatchedOnly: false }, ctx);
    expect(out.map((i) => i.event.id)).toEqual(['2']);
  });

  it('searches title and string metadata case-insensitively', () => {
    expect(searchLibraryItems(items, 'du').map((i) => i.event.id)).toEqual(['3']);
    expect(searchLibraryItems(items, 'sci-fi').map((i) => i.event.id)).toEqual(['1']);
  });

  it('browse pipeline composes filter -> search -> sort', () => {
    const out = browseLibraryItems(items, { filters: { year: null, tags: [], unwatchedOnly: false }, query: 'a', sortKey: 'title' });
    // 'Amelie' and 'Arrival' both contain 'a'; sorted by title.
    expect(out.map((i) => i.event.id)).toEqual(['2', '1']);
  });
});

describe('On Deck + Recently added (real rows only)', () => {
  const items = [
    makeItem('movie', { id: '1', title: 'One', durationMs: 1000, updatedAt: '2026-01-01T00:00:00.000Z' }),
    makeItem('movie', { id: '2', title: 'Two', durationMs: 1000, updatedAt: '2026-03-01T00:00:00.000Z' }),
    makeItem('movie', { id: '3', title: 'Three', durationMs: 1000, updatedAt: '2026-02-01T00:00:00.000Z' }),
  ];

  it('On Deck shows only in-progress items, newest-touched first, and never a fabricated entry', () => {
    const ctx = ctxWith({
      '1': { positionMs: 500, completed: false, updatedAt: '2026-06-01T00:00:00.000Z' },
      '2': { positionMs: 0, completed: false, updatedAt: '2026-06-02T00:00:00.000Z' }, // position 0 => not on deck
      '3': { positionMs: 500, completed: false, updatedAt: '2026-06-03T00:00:00.000Z' },
    });
    const deck = buildOnDeck(items, ctx);
    expect(deck.map((e) => e.item.event.id)).toEqual(['3', '1']);
  });

  it('On Deck excludes completed items', () => {
    const ctx = ctxWith({ '1': { positionMs: 900, completed: true, updatedAt: '2026-06-01T00:00:00.000Z' } });
    expect(buildOnDeck(items, ctx)).toHaveLength(0);
  });

  it('Recently added is newest first', () => {
    expect(buildRecentlyAdded(items).map((i) => i.event.id)).toEqual(['2', '3', '1']);
  });
});

describe('dedup notice text', () => {
  it('phrases per-library for personal, per-community for community', () => {
    expect(dedupNoticeText('personal')).toBe(LIBRARY_STRINGS.alreadyInThisLibrary);
    expect(dedupNoticeText('community')).toBe(LIBRARY_STRINGS.alreadyInThisCommunity);
    expect(LIBRARY_STRINGS.alreadyInThisLibrary).toBe('Already in this library');
    expect(LIBRARY_STRINGS.alreadyInThisCommunity).toBe('Already in this community');
  });

  it('exposes the canonical strings', () => {
    expect(LIBRARY_STRINGS.myLibrary).toBe('My Library');
    expect(LIBRARY_STRINGS.onDeck).toBe('On Deck');
    expect(LIBRARY_STRINGS.recentlyAdded).toBe('Recently added');
    expect(LIBRARY_STRINGS.heldOnThisDevice).toBe('Held on this device');
    expect(LIBRARY_STRINGS.keepPhotoLocations).toBe('Keep photo locations');
    expect(LIBRARY_STRINGS.saveToLibrary).toBe('Save to library');
    expect(LIBRARY_STRINGS.addToLibrary).toBe('Add to library');
    expect(LIBRARY_STRINGS.newLibrary).toBe('New library');
  });
});

describe('smart collection fail-safe', () => {
  const items = [
    makeItem('movie', { id: '1', title: 'A', year: 2016 }, { genres: ['sci-fi'] }),
    makeItem('movie', { id: '2', title: 'B', year: 2016 }, { genres: ['drama'] }),
  ];

  it('evaluates a known rule locally', () => {
    const evaln = evaluateSmartCollection('genre', JSON.stringify({ genre: 'sci-fi' }), items);
    expect(evaln.unknownRule).toBe(false);
    expect(evaln.itemIds).toEqual(['1']);
  });

  it('an unknown rule type yields empty + unknownRule (honest empty, never a guess)', () => {
    const evaln = evaluateSmartCollection('mystery-rule', '{}', items);
    expect(evaln.unknownRule).toBe(true);
    expect(evaln.itemIds).toEqual([]);
  });

  it('a malformed rule json yields empty + unknownRule', () => {
    const evaln = evaluateSmartCollection('year', 'not-json', items);
    expect(evaln.unknownRule).toBe(true);
    expect(evaln.itemIds).toEqual([]);
  });
});

describe('card shape + windowing', () => {
  it('resolves card shape per media type; unknown -> list', () => {
    expect(cardShapeForMediaType('movie')).toBe('poster');
    expect(cardShapeForMediaType('music')).toBe('album');
    expect(cardShapeForMediaType('photo')).toBe('masonry');
    expect(cardShapeForMediaType('document')).toBe('list');
    expect(cardShapeForMediaType('nonsense')).toBe('list');
  });

  it('windows a 10k grid to only the visible rows plus overscan', () => {
    const w = computeGridWindow({
      itemCount: 10000,
      columns: 5,
      rowHeightPx: 260,
      scrollTopPx: 26000, // 100 rows down
      viewportHeightPx: 780, // 3 rows tall
      overscanRows: 2,
    });
    // Only a handful of rows mount, not 2000.
    expect(w.endIndex - w.startIndex).toBeLessThan(60);
    expect(w.totalHeightPx).toBe(Math.ceil(10000 / 5) * 260);
    // Spacers hold the full scroll height.
    expect(w.topSpacerPx + (w.endIndex - w.startIndex) / 5 * 260 + w.bottomSpacerPx).toBeCloseTo(w.totalHeightPx, 0);
  });

  it('an empty grid windows to nothing', () => {
    const w = computeGridWindow({ itemCount: 0, columns: 4, rowHeightPx: 200, scrollTopPx: 0, viewportHeightPx: 600 });
    expect(w).toEqual({ startIndex: 0, endIndex: 0, topSpacerPx: 0, bottomSpacerPx: 0, totalHeightPx: 0 });
  });
});
