// Plan 38 Phase 5 (WEB): one library's browse surface. Card shape per media type
// (poster / album / masonry / list), sort from the media-type registry, filters
// (year / tags / unwatched), local search, a collections row (pinned first) with
// a smart-collection fail-safe (unknown rule => honest empty + notice), an
// all-local stats card, and a windowed grid for the 10k-item budget. Ingest is a
// multi-file picker driving IngestModal.

import { useEffect, useMemo, useRef, useState } from 'react';
import { useMeerkat } from '../../lib/MeerkatProvider';
import {
  MULTI_COMMUNITY_STORAGE_COPY,
  LAST_COPY_DELETE_CONFIRM,
  STORAGE_BUDGET_EXCEEDED_ERROR,
  type LibraryPinPolicy,
} from '../../lib/library-storage-core';
import { useView } from '../navigation/useView';
import { Button } from '../shell/Button';
import { EmptyState } from '../shell/EmptyState';
import { HonestNotice } from '../shell/HonestNotice';
import { formatBytes } from '../format';
import {
  NO_FILTERS,
  availableYears,
  availableTags,
  browseLibraryItems,
  cardShapeForMediaType,
  defaultSortForMediaType,
  evaluateSmartCollection,
  sortFieldLabel,
  sortFieldsForMediaType,
  type ItemProgress,
  type LibraryBrowseContext,
  type LibraryFilters,
} from '../../lib/library-browse-core';
import type { ResolvedLibraryItem } from '../../lib/library-data-core';
import type { KnownMediaType } from '../../lib/library-metadata-core';
import { useLibrary } from './useLibrary';
import { MEDIA_TYPE_META } from './media-meta';
import { LibraryGrid } from './LibraryGrid';
import { LibraryPosterCard } from './LibraryPosterCard';
import { LibraryListRow } from './LibraryListRow';
import { IngestModal } from './IngestModal';
import { PhotoTimeline } from './PhotoTimeline';

type PhotoSegment = 'grid' | 'timeline';

export function LibraryView({ workspaceId, channelId }: { workspaceId: string; channelId: string }): React.ReactElement {
  const m = useMeerkat();
  const { dispatch } = useView();
  const lib = useLibrary();
  const revision = m.revision;

  const config = useMemo(() => {
    void revision;
    return lib.getLibrary(channelId);
  }, [lib, channelId, revision]);
  const mediaType: KnownMediaType = config?.mediaType ?? 'custom';
  const shape = cardShapeForMediaType(mediaType);
  const canCurate = lib.canCurate(workspaceId, channelId);
  const workspaceKind = lib.workspaceKind(workspaceId) ?? 'personal';

  const items = useMemo(() => {
    void revision;
    return lib.listItems(channelId);
  }, [lib, channelId, revision]);
  const collections = useMemo(() => {
    void revision;
    return lib.listCollections(channelId);
  }, [lib, channelId, revision]);

  const [sortKey, setSortKey] = useState<string>('');
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState<LibraryFilters>(NO_FILTERS);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [collectionId, setCollectionId] = useState<string | null>(null);
  const [pendingFiles, setPendingFiles] = useState<File[] | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  // Photo libraries add a Timeline (EXIF capture-date grouping) alongside the
  // grid. The web app ships no map (that is mobile-only, C.6). Default = grid.
  const isPhotoLibrary = mediaType === 'photo';
  const [segment, setSegment] = useState<PhotoSegment>('grid');

  const activeSort = sortKey || defaultSortForMediaType(mediaType);

  // Build the tag/progress maps only when a feature needs them (filter panel or a
  // tag/unwatched filter), so default browse of a big library stays cheap.
  const needsMaps = filtersOpen || filters.unwatchedOnly || filters.tags.length > 0;
  const ctx: LibraryBrowseContext = useMemo(() => {
    if (!needsMaps) return { tagsByItem: new Map(), progressByItem: new Map() };
    const tagsByItem = new Map<string, readonly string[]>();
    const progressByItem = new Map<string, ItemProgress>();
    for (const item of items) {
      const tags = lib.listTags(channelId, item.event.id);
      if (tags.length > 0) tagsByItem.set(item.event.id, tags);
      const p = lib.getProgress(item.event.id);
      if (p) progressByItem.set(item.event.id, p);
    }
    return { tagsByItem, progressByItem };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [needsMaps, items, channelId, revision]);

  // The base set: all items, or one selected collection's membership (manual or
  // smart). A smart rule the client cannot parse renders empty + an honest notice.
  const selectedCollection = collections.find((c) => c.id === collectionId) ?? null;
  const { base, smartUnknown } = useMemo(() => {
    if (!selectedCollection) return { base: items, smartUnknown: false };
    const rules = lib.listSmartRules(channelId, selectedCollection.id);
    if (rules.length > 0) {
      const ids = new Set<string>();
      let unknown = false;
      for (const rule of rules) {
        const evaln = evaluateSmartCollection(rule.ruleType, rule.ruleJson, items, ctx);
        if (evaln.unknownRule) unknown = true;
        for (const id of evaln.itemIds) ids.add(id);
      }
      return { base: items.filter((it) => ids.has(it.event.id)), smartUnknown: unknown && ids.size === 0 };
    }
    const memberIds = new Set(lib.listCollectionItemIds(channelId, selectedCollection.id));
    return { base: items.filter((it) => memberIds.has(it.event.id)), smartUnknown: false };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCollection, items, channelId, ctx, revision]);

  const displayed = useMemo(
    () => browseLibraryItems(base, { filters, query, sortKey: activeSort }, ctx),
    [base, filters, query, activeSort, ctx],
  );

  const logicalBytes = useMemo(
    () => items.reduce((sum, it) => sum + (it.event.sizeBytes ?? 0), 0),
    [items],
  );

  // Plan 38 C.7/C.2: this-device stored bytes + per-library pin policy. Reconcile
  // held pin classes to intent + policy, then read real store stats.
  const [storedBytes, setStoredBytes] = useState(0);
  const [pinPolicy, setPinPolicy] = useState<LibraryPinPolicy>('pin_all');
  useEffect(() => {
    let live = true;
    setPinPolicy(lib.pinPolicy(channelId));
    void lib.reconcilePins(channelId)
      .then(() => lib.storageStats(channelId))
      .then((s) => { if (live) setStoredBytes(s.storedBytes); });
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channelId, revision]);

  const onTogglePinPolicy = (): void => {
    const next: LibraryPinPolicy = pinPolicy === 'pin_all' ? 'fetch_on_demand' : 'pin_all';
    if (next === 'fetch_on_demand' && !window.confirm(LAST_COPY_DELETE_CONFIRM)) return;
    void lib.setPinPolicy(channelId, next).then(
      () => setPinPolicy(next),
      (err: unknown) => window.alert(err instanceof Error && err.message === STORAGE_BUDGET_EXCEEDED_ERROR
        ? STORAGE_BUDGET_EXCEEDED_ERROR
        : err instanceof Error ? err.message : String(err)),
    );
  };

  if (!config) {
    return (
      <div className="mk-main-scroll">
        <div className="mk-lib-view-header">
          <Button variant="ghost" small onClick={() => dispatch({ type: 'OPEN_LIBRARY_HOME', workspaceId })}>← Back</Button>
          <h1 className="mk-h1" style={{ margin: 0 }}>Library unavailable</h1>
        </div>
        <HonestNotice>This device has no verified config for that library. Nothing is loaded from a server.</HonestNotice>
      </div>
    );
  }

  const name = libraryDisplayName(channelId, mediaType, m);
  const sortFields = sortFieldsForMediaType(mediaType);
  const years = availableYears(items);
  const tags = needsMaps ? availableTags(ctx) : [];

  const pickFiles = (list: FileList | null): void => {
    if (!list || list.length === 0) return;
    setPendingFiles(Array.from(list));
  };

  return (
    <div className="mk-main-scroll mk-lib-view">
      <div className="mk-lib-view-header">
        <Button variant="ghost" small onClick={() => dispatch({ type: 'OPEN_LIBRARY_HOME', workspaceId })}>← Back</Button>
        <div className="mk-lib-view-title">
          <span className="mk-lib-view-icon" aria-hidden>{MEDIA_TYPE_META[mediaType].icon}</span>
          <h1 className="mk-h1" style={{ margin: 0 }}>{name}</h1>
        </div>
        {canCurate ? (
          <>
            <input
              ref={fileRef}
              type="file"
              multiple
              style={{ display: 'none' }}
              aria-hidden
              onChange={(e) => {
                pickFiles(e.target.files);
                e.target.value = '';
              }}
            />
            <Button small onClick={() => fileRef.current?.click()}>Add files</Button>
          </>
        ) : null}
      </div>

      <div className="mk-lib-stats mk-box">
        <span><strong>{items.length}</strong> {items.length === 1 ? 'item' : 'items'}</span>
        <span className="mk-muted">·</span>
        <span>{formatBytes(logicalBytes)} logical</span>
        <span className="mk-muted">·</span>
        <span>{formatBytes(storedBytes)} on this device</span>
      </div>
      <p className="mk-muted" style={{ margin: '4px 0 0', fontSize: 12 }}>{MULTI_COMMUNITY_STORAGE_COPY}</p>
      <div className="mk-lib-stats mk-box" style={{ justifyContent: 'space-between' }}>
        <span className="mk-muted">
          {pinPolicy === 'pin_all' ? 'Keeping every item on this device' : 'Keeping only what you open or keep'}
        </span>
        <Button variant="ghost" small onClick={onTogglePinPolicy}>
          {pinPolicy === 'pin_all' ? 'Fetch on demand' : 'Keep all'}
        </Button>
      </div>

      {isPhotoLibrary ? (
        <div className="mk-lib-segments" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={segment === 'grid'}
            className={`mk-lib-segment ${segment === 'grid' ? 'is-active' : ''}`}
            onClick={() => setSegment('grid')}
          >
            Grid
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={segment === 'timeline'}
            className={`mk-lib-segment ${segment === 'timeline' ? 'is-active' : ''}`}
            onClick={() => setSegment('timeline')}
          >
            Timeline
          </button>
        </div>
      ) : null}

      <div className="mk-lib-controls">
        <input
          className="mk-input mk-lib-search"
          type="search"
          placeholder={`Search ${name}`}
          value={query}
          onChange={(e) => setQuery(e.currentTarget.value)}
        />
        <label className="mk-lib-sort">
          <span className="mk-label">Sort</span>
          <select className="mk-input" value={activeSort} onChange={(e) => setSortKey(e.currentTarget.value)}>
            {sortFields.map((f) => (
              <option key={f} value={f}>{sortFieldLabel(f)}</option>
            ))}
          </select>
        </label>
        <Button variant="ghost" small onClick={() => setFiltersOpen((v) => !v)}>
          {filtersOpen ? 'Hide filters' : 'Filters'}
        </Button>
      </div>

      {filtersOpen ? (
        <div className="mk-lib-filters mk-box">
          <label className="mk-field">
            <span className="mk-label">Year</span>
            <select
              className="mk-input"
              value={filters.year ?? ''}
              onChange={(e) => setFilters((f) => ({ ...f, year: e.currentTarget.value ? Number(e.currentTarget.value) : null }))}
            >
              <option value="">Any year</option>
              {years.map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
          </label>
          {tags.length > 0 ? (
            <label className="mk-field">
              <span className="mk-label">Tag</span>
              <select
                className="mk-input"
                value={filters.tags[0] ?? ''}
                onChange={(e) => setFilters((f) => ({ ...f, tags: e.currentTarget.value ? [e.currentTarget.value] : [] }))}
              >
                <option value="">Any tag</option>
                {tags.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </label>
          ) : null}
          <label className="mk-lib-filter-check">
            <input
              type="checkbox"
              checked={filters.unwatchedOnly}
              onChange={(e) => setFilters((f) => ({ ...f, unwatchedOnly: e.currentTarget.checked }))}
            />
            <span>Unwatched only</span>
          </label>
          {(filters.year !== null || filters.tags.length > 0 || filters.unwatchedOnly) ? (
            <Button variant="ghost" small onClick={() => setFilters(NO_FILTERS)}>Clear</Button>
          ) : null}
        </div>
      ) : null}

      {collections.length > 0 ? (
        <div className="mk-lib-collections">
          <button
            type="button"
            className={`mk-lib-collection-chip ${collectionId === null ? 'is-active' : ''}`}
            onClick={() => setCollectionId(null)}
          >
            All
          </button>
          {[...collections]
            .sort((a, b) => Number(b.pinned) - Number(a.pinned) || a.name.localeCompare(b.name))
            .map((c) => (
              <button
                key={c.id}
                type="button"
                className={`mk-lib-collection-chip ${collectionId === c.id ? 'is-active' : ''}`}
                onClick={() => setCollectionId(c.id)}
              >
                {c.pinned ? '📌 ' : ''}{c.name}
              </button>
            ))}
        </div>
      ) : null}

      {smartUnknown ? (
        <HonestNotice>
          This smart collection uses a rule this version does not understand yet, so it is shown empty
          rather than guessing its contents.
        </HonestNotice>
      ) : null}

      {items.length === 0 ? (
        <EmptyState icon={MEDIA_TYPE_META[mediaType].icon} title="This library is empty">
          <p className="mk-muted">
            {canCurate ? 'Add files to seal them into this library on this device.' : 'Nothing has been added here yet.'}
          </p>
          {canCurate ? <Button onClick={() => fileRef.current?.click()}>Add files</Button> : null}
        </EmptyState>
      ) : isPhotoLibrary && segment === 'timeline' ? (
        displayed.length === 0 ? (
          <EmptyState icon="🔍" title="Nothing matches">
            <p className="mk-muted">No photos match the current search, filters, or collection.</p>
          </EmptyState>
        ) : (
          <PhotoTimeline
            items={displayed}
            onOpen={(itemId) => dispatch({ type: 'OPEN_LIBRARY_ITEM', workspaceId, channelId, itemId })}
          />
        )
      ) : displayed.length === 0 ? (
        <EmptyState icon="🔍" title="Nothing matches">
          <p className="mk-muted">No items match the current search, filters, or collection.</p>
        </EmptyState>
      ) : shape === 'list' ? (
        <LibraryGrid
          items={displayed}
          shape="list"
          renderItem={(item) => (
            <LibraryListRow
              item={item}
              onOpen={() => dispatch({ type: 'OPEN_LIBRARY_ITEM', workspaceId, channelId, itemId: item.event.id })}
            />
          )}
        />
      ) : (
        <LibraryGrid
          items={displayed}
          shape={shape}
          renderItem={(item) => (
            <LibraryPosterCard
              item={item}
              onOpen={() => dispatch({ type: 'OPEN_LIBRARY_ITEM', workspaceId, channelId, itemId: item.event.id })}
            />
          )}
        />
      )}

      {pendingFiles ? (
        <IngestModal
          channelId={channelId}
          workspaceId={workspaceId}
          workspaceKind={workspaceKind}
          mediaType={mediaType}
          files={pendingFiles}
          onClose={() => setPendingFiles(null)}
          onDone={() => { /* store writes bumped revision already */ }}
        />
      ) : null}
    </div>
  );
}

function libraryDisplayName(channelId: string, mediaType: KnownMediaType, m: ReturnType<typeof useMeerkat>): string {
  for (const community of m.listCommunities()) {
    const channel = community.descriptor.channels.find((c) => c.id === channelId);
    if (channel) return channel.name;
  }
  return MEDIA_TYPE_META[mediaType].label;
}

export type { ResolvedLibraryItem };
