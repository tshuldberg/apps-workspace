// Plan 38 Phase 5: the pure browse view-model. Sort/filter/search composition,
// On Deck (real progress only), Recently added (real HLCs), facets, and the
// FlatList windowing seam. No render harness: these are pure functions over the
// already-verified ResolvedLibraryItem read model.

import { describe, expect, it } from 'vitest';
import type { LibraryItemEvent, ResolvedLibraryItem } from '../(root)/data/library-data-core';
import type { KnownMediaType } from '../(root)/data/library-metadata-core';
import {
  buildOnDeck,
  buildRecentlyAdded,
  composeLibraryView,
  defaultSortForMediaType,
  cardShapeForMediaType,
  libraryFacets,
  nextLibraryWindow,
  sortFieldsForMediaType,
  type LibraryFilterState,
  type LibraryProgressLite,
  type LibrarySortState,
} from '../(root)/data/library-view-core';

function mkItem(
  id: string,
  fields: Partial<LibraryItemEvent>,
  mediaType: KnownMediaType = 'movie',
): ResolvedLibraryItem {
  const event: LibraryItemEvent = {
    version: 1,
    id,
    communityId: 'ws',
    channelId: 'lib',
    contentCid: `cid-${id}`,
    coverCid: null,
    thumbCid: null,
    keyEpoch: 1,
    wrappedKey: 'k',
    coverWrappedKey: null,
    manifestJson: '{}',
    title: id,
    sortTitle: null,
    year: null,
    durationMs: null,
    sizeBytes: null,
    mimeType: null,
    metadataJson: '{}',
    metadataSource: 'local',
    authorDeviceId: 'me',
    updatedAt: '2026-01-01T00:00:00.000Z',
    tombstone: false,
    signature: 'sig',
    ...fields,
  };
  return { event, mediaType, metadataUnknownType: false };
}

const ASC_TITLE: LibrarySortState = { field: 'title', dir: 'asc' };
const emptyFilter: LibraryFilterState = { year: null, tags: [], unwatchedOnly: false };

function baseInput(items: ResolvedLibraryItem[]) {
  return {
    items,
    sort: ASC_TITLE,
    filter: emptyFilter,
    query: '',
    tagsByItemId: new Map<string, readonly string[]>(),
    progressByItemId: new Map<string, LibraryProgressLite>(),
  };
}

describe('registry-driven card shape + sort fields', () => {
  it('resolves per media type and falls back safely for unknown types', () => {
    expect(cardShapeForMediaType('movie')).toBe('poster');
    expect(cardShapeForMediaType('music')).toBe('album');
    expect(cardShapeForMediaType('photo')).toBe('masonry');
    expect(cardShapeForMediaType('document')).toBe('list');
    expect(cardShapeForMediaType('nonsense')).toBe('list');
    expect(sortFieldsForMediaType('book')).toContain('author');
    expect(defaultSortForMediaType('music')).toBe('artist');
    expect(defaultSortForMediaType('nonsense')).toBe('added');
  });
});

describe('composeLibraryView sort', () => {
  it('sorts by title case-insensitively with a stable id tiebreak', () => {
    const items = [
      mkItem('b', { title: 'banana' }),
      mkItem('a', { title: 'Apple' }),
      mkItem('c', { title: 'apple' }),
    ];
    const out = composeLibraryView(baseInput(items));
    expect(out.map((i) => i.event.id)).toEqual(['a', 'c', 'b']);
  });

  it('sorts by year descending and pushes missing years to the end', () => {
    const items = [
      mkItem('x', { title: 'x', year: 1999 }),
      mkItem('y', { title: 'y', year: 2020 }),
      mkItem('z', { title: 'z', year: null }),
    ];
    const out = composeLibraryView({ ...baseInput(items), sort: { field: 'year', dir: 'desc' } });
    expect(out.map((i) => i.event.id)).toEqual(['y', 'x', 'z']);
  });

  it('sorts music by artist from metadata', () => {
    const items = [
      mkItem('1', { title: 'song1', metadataJson: JSON.stringify({ artist: 'Zeta' }) }, 'music'),
      mkItem('2', { title: 'song2', metadataJson: JSON.stringify({ artist: 'alpha' }) }, 'music'),
    ];
    const out = composeLibraryView({ ...baseInput(items), sort: { field: 'artist', dir: 'asc' } });
    expect(out.map((i) => i.event.id)).toEqual(['2', '1']);
  });
});

describe('composeLibraryView filter + search', () => {
  const items = [
    mkItem('a', { title: 'Arrival', year: 2016 }),
    mkItem('b', { title: 'Dune', year: 2021 }),
    mkItem('c', { title: 'Sicario', year: 2015 }),
  ];

  it('filters by exact year', () => {
    const out = composeLibraryView({ ...baseInput(items), filter: { ...emptyFilter, year: 2021 } });
    expect(out.map((i) => i.event.id)).toEqual(['b']);
  });

  it('filters by tags (AND across selected tags)', () => {
    const tags = new Map<string, readonly string[]>([
      ['a', ['scifi', 'fav']],
      ['b', ['scifi']],
    ]);
    const out = composeLibraryView({
      ...baseInput(items),
      tagsByItemId: tags,
      filter: { ...emptyFilter, tags: ['scifi', 'fav'] },
    });
    expect(out.map((i) => i.event.id)).toEqual(['a']);
  });

  it('unwatchedOnly hides items with completed progress', () => {
    const progress = new Map<string, LibraryProgressLite>([
      ['b', { positionMs: 100, completed: true, updatedAt: '2026-01-02T00:00:00.000Z' }],
    ]);
    const out = composeLibraryView({
      ...baseInput(items),
      progressByItemId: progress,
      filter: { ...emptyFilter, unwatchedOnly: true },
    });
    expect(out.map((i) => i.event.id)).toEqual(['a', 'c']);
  });

  it('searches title case-insensitively', () => {
    const out = composeLibraryView({ ...baseInput(items), query: 'DUN' });
    expect(out.map((i) => i.event.id)).toEqual(['b']);
  });

  it('composes filter -> search -> sort together', () => {
    const many = [
      mkItem('a', { title: 'Alien', year: 2020 }),
      mkItem('b', { title: 'Aliens', year: 2020 }),
      mkItem('c', { title: 'Predator', year: 2020 }),
      mkItem('d', { title: 'Alien 3', year: 1992 }),
    ];
    const out = composeLibraryView({
      ...baseInput(many),
      query: 'alien',
      filter: { ...emptyFilter, year: 2020 },
      sort: { field: 'title', dir: 'asc' },
    });
    expect(out.map((i) => i.event.id)).toEqual(['a', 'b']);
  });
});

describe('On Deck + Recently added from real rows', () => {
  it('includes only started, uncompleted items, most-recent progress first', () => {
    const items = [
      mkItem('a', { title: 'a', durationMs: 1000 }),
      mkItem('b', { title: 'b' }),
      mkItem('c', { title: 'c' }),
      mkItem('d', { title: 'd' }),
    ];
    const progress = new Map<string, LibraryProgressLite>([
      ['a', { positionMs: 500, completed: false, updatedAt: '2026-01-01T00:00:00.000Z' }],
      ['b', { positionMs: 900, completed: true, updatedAt: '2026-01-03T00:00:00.000Z' }],
      ['c', { positionMs: 200, completed: false, updatedAt: '2026-01-05T00:00:00.000Z' }],
      ['d', { positionMs: 0, completed: false, updatedAt: '2026-01-06T00:00:00.000Z' }],
    ]);
    const deck = buildOnDeck(items, progress);
    expect(deck.map((e) => e.item.event.id)).toEqual(['c', 'a']);
    expect(deck[1]!.durationMs).toBe(1000);
  });

  it('returns an empty deck when nothing was started', () => {
    const items = [mkItem('a', { title: 'a' })];
    expect(buildOnDeck(items, new Map())).toEqual([]);
  });

  it('orders recently added by updatedAt desc with an id tiebreak', () => {
    const items = [
      mkItem('a', { title: 'a', updatedAt: '2026-01-01T00:00:00.000Z' }),
      mkItem('b', { title: 'b', updatedAt: '2026-01-05T00:00:00.000Z' }),
      mkItem('c', { title: 'c', updatedAt: '2026-01-05T00:00:00.000Z' }),
    ];
    const recent = buildRecentlyAdded(items);
    expect(recent.map((i) => i.event.id)).toEqual(['c', 'b', 'a']);
  });
});

describe('facets + windowing', () => {
  it('collects distinct years (desc) and tags (alpha)', () => {
    const items = [
      mkItem('a', { title: 'a', year: 2016 }),
      mkItem('b', { title: 'b', year: 2021 }),
      mkItem('c', { title: 'c', year: 2016 }),
    ];
    const tags = new Map<string, readonly string[]>([
      ['a', ['Zed', 'alpha']],
      ['b', ['alpha']],
    ]);
    const facets = libraryFacets(items, tags);
    expect(facets.years).toEqual([2021, 2016]);
    expect(facets.tags).toEqual(['alpha', 'Zed']);
  });

  it('grows the render window until it covers the list, then holds', () => {
    expect(nextLibraryWindow(60, 10_000, 60)).toBe(120);
    expect(nextLibraryWindow(9990, 10_000, 60)).toBe(10_050);
    expect(nextLibraryWindow(10_000, 10_000, 60)).toBe(10_000);
  });
});
