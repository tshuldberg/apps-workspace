// Plan 38 Phase 5 (MOBILE): the reusable library browse surface. Rendered by the
// personal "My Library" hub AND (for kind:'library' community channels) by the
// channel screen's Library segment. Props-only for db/store access resolution:
// it reaches the providers itself but is otherwise driven by the library id +
// workspace + verified config passed in.
//
// Honesty: every cell/number comes from a verified row. The poster grid renders a
// cheap placeholder (title + media glyph) for 10k-item perf; the FULL cover loads
// lazily on the item detail screen (D.9). "Held on this device" is a real store
// query, never an availability guess.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { useRouter } from 'expo-router';
import { getCommunity } from '@mylife/sync';
import { decodeBase64 } from 'tweetnacl-util';
import {
  ArrowDownUp,
  Check,
  HardDriveDownload,
  ListFilter,
  Search,
  X,
} from 'lucide-react-native';
import { useMeerkatDatabase } from '../../providers/DatabaseProvider';
import { useNode } from '../../providers/NodeProvider';
import { useIdentity } from '../../providers/IdentityProvider';
import { useSync } from '../../providers/SyncProvider';
import { Button } from '../kit';
import { formatBytes, MK_RADIUS, type MkColors } from '../../theme/tokens';
import { useAppThemeColors, useMkStyles } from '../../providers/AppThemeProvider';
import type { LibraryConfigEvent, ResolvedLibraryItem } from '../../data/library-data-core';
import {
  addLibraryItem,
  applyLibraryPinPolicy,
  getLibraryPinPolicy,
  libraryStorageStats,
  listLibraryItems,
  listLibraryCollections,
  listCollectionItemIds,
  reconcileLibraryPinClasses,
} from '../../data/library-store-core';
import {
  MULTI_COMMUNITY_STORAGE_COPY,
  LAST_COPY_DELETE_CONFIRM,
  STORAGE_BUDGET_EXCEEDED_ERROR,
  type LibraryPinPolicy,
} from '../../data/library-storage-core';
import { extractLocalMetadata } from '../../data/library-extract-core';
import {
  heldContentIds,
  progressByItem,
  verifiedTagsByItem,
} from '../../data/library-hub-core';
import {
  cardShapeForMediaType,
  composeLibraryView,
  defaultSortForMediaType,
  libraryFacets,
  LIBRARY_RENDER_WINDOW,
  LIBRARY_STRINGS,
  nextLibraryWindow,
  sortFieldsForMediaType,
  type LibraryFilterState,
  type LibrarySortState,
} from '../../data/library-view-core';
import { LibraryItemPoster } from './LibraryItemPoster';
import { PhotoTimelineSegment } from './PhotoTimelineSegment';
import { PhotoMapSegment } from './PhotoMapSegment';

type PhotoSegment = 'grid' | 'timeline' | 'map';
const PHOTO_SEGMENTS: { key: PhotoSegment; label: string }[] = [
  { key: 'grid', label: 'Grid' },
  { key: 'timeline', label: 'Timeline' },
  { key: 'map', label: 'Map' },
];

const SORT_LABEL: Record<string, string> = {
  title: 'Title',
  added: 'Recently added',
  year: 'Year',
  duration: 'Duration',
  artist: 'Artist',
  album: 'Album',
  author: 'Author',
  capturedAt: 'Date taken',
};

interface IngestProgress {
  name: string;
  status: 'pending' | 'added' | 'duplicate' | 'failed';
  detail?: string;
}

export function LibraryView({
  channelId,
  workspaceId,
  config,
  name,
  canCurate,
}: {
  channelId: string;
  workspaceId: string;
  config: LibraryConfigEvent;
  name: string;
  canCurate: boolean;
}) {
  const c = useAppThemeColors();
  const styles = useMkStyles(makeStyles);
  const router = useRouter();
  const db = useMeerkatDatabase();
  const { store } = useNode();
  const { identity } = useIdentity();
  const { recordLocalChange } = useSync();

  const cardShape = cardShapeForMediaType(config.mediaType);
  const numColumns = cardShape === 'list' ? 1 : cardShape === 'masonry' ? 3 : 2;
  // A COMMUNITY library (the workspace has a descriptor) shows the honest
  // "available from members" line on items this device does not hold. A PERSONAL
  // library keeps its existing local-only states (held dot only). Amendment E.
  const isCommunityLibrary = useMemo(() => Boolean(getCommunity(db, workspaceId)), [db, workspaceId]);

  const [items, setItems] = useState<ResolvedLibraryItem[]>([]);
  const [tagsByItemId, setTagsByItemId] = useState<Map<string, string[]>>(new Map());
  const [heldSet, setHeldSet] = useState<Set<string>>(new Set());
  const [storedBytes, setStoredBytes] = useState(0);
  const [pinPolicy, setPinPolicy] = useState<LibraryPinPolicy>('pin_all');
  const [collectionFilter, setCollectionFilter] = useState<string | null>(null);
  const [collectionItemIds, setCollectionItemIds] = useState<Set<string> | null>(null);

  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<LibrarySortState>({
    field: config.sortDefault || defaultSortForMediaType(config.mediaType),
    dir: 'asc',
  });
  const [filter, setFilter] = useState<LibraryFilterState>({ year: null, tags: [], unwatchedOnly: false });
  const [window, setWindow] = useState(LIBRARY_RENDER_WINDOW);
  const [sortSheet, setSortSheet] = useState(false);
  const [filterSheet, setFilterSheet] = useState(false);

  const [ingesting, setIngesting] = useState(false);
  const [ingestRows, setIngestRows] = useState<IngestProgress[] | null>(null);
  const [photoConsentOpen, setPhotoConsentOpen] = useState(false);
  const isPhotoLibrary = config.mediaType === 'photo';
  // Photo libraries add a Timeline (EXIF capture-date grouping) and an offline Map
  // (default-off, over a downloaded static tile pack) alongside the grid. C.6.
  const [segment, setSegment] = useState<PhotoSegment>('grid');
  const progressRef = useRef<ReturnType<typeof progressByItem> | null>(null);
  if (progressRef.current === null) progressRef.current = progressByItem(db);

  const reload = useCallback(() => {
    const next = listLibraryItems(db, channelId);
    setItems(next);
    setTagsByItemId(verifiedTagsByItem(db, channelId));
    progressRef.current = progressByItem(db);
    setPinPolicy(getLibraryPinPolicy(db, channelId));
    void heldContentIds(store, workspaceId).then(setHeldSet);
    // Bring held pin classes in line with intent + policy (fetch_cache/policy),
    // then read this-device stored bytes for the C.2 stats card.
    void reconcileLibraryPinClasses(db, store, channelId)
      .then(() => libraryStorageStats(db, store, channelId))
      .then((s) => setStoredBytes(s.storedBytes));
  }, [db, channelId, store, workspaceId]);

  const onTogglePinPolicy = useCallback(() => {
    const next: LibraryPinPolicy = pinPolicy === 'pin_all' ? 'fetch_on_demand' : 'pin_all';
    const apply = () => {
      void (async () => {
        try {
          await applyLibraryPinPolicy(db, store, channelId, next);
          reload();
        } catch (err) {
          Alert.alert(
            'Could not change what stays on this device',
            err instanceof Error && err.message === STORAGE_BUDGET_EXCEEDED_ERROR
              ? STORAGE_BUDGET_EXCEEDED_ERROR
              : err instanceof Error ? err.message : String(err),
          );
        }
      })();
    };
    if (next === 'fetch_on_demand') {
      Alert.alert('Keep only what you open?', LAST_COPY_DELETE_CONFIRM, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Change', style: 'destructive', onPress: apply },
      ]);
    } else {
      apply();
    }
  }, [db, store, channelId, pinPolicy, reload]);

  useEffect(() => {
    reload();
  }, [reload]);

  const collections = useMemo(() => {
    void items;
    return listLibraryCollections(db, channelId);
  }, [db, channelId, items]);

  const selectCollection = useCallback((collectionId: string | null) => {
    setCollectionFilter(collectionId);
    if (collectionId === null) {
      setCollectionItemIds(null);
      return;
    }
    setCollectionItemIds(new Set(listCollectionItemIds(db, channelId, collectionId)));
  }, [db, channelId]);

  const facets = useMemo(() => libraryFacets(items, tagsByItemId), [items, tagsByItemId]);

  const composed = useMemo(() => {
    const scoped = collectionItemIds
      ? items.filter((i) => collectionItemIds.has(i.event.id))
      : items;
    return composeLibraryView({
      items: scoped,
      sort,
      filter,
      query,
      tagsByItemId,
      progressByItemId: progressRef.current ?? new Map(),
    });
  }, [items, collectionItemIds, sort, filter, query, tagsByItemId]);

  const windowed = useMemo(() => composed.slice(0, window), [composed, window]);

  const onEndReached = useCallback(() => {
    setWindow((w) => nextLibraryWindow(w, composed.length));
  }, [composed.length]);

  const totalBytes = useMemo(
    () => items.reduce((sum, i) => sum + (i.event.sizeBytes ?? 0), 0),
    [items],
  );
  const heldCount = useMemo(
    () => items.filter((i) => heldSet.has(i.event.contentCid)).length,
    [items, heldSet],
  );

  const ingestBusyRef = useRef(false);
  const runIngest = useCallback((preserveLocation: boolean) => {
    // Synchronous single-flight: a second tap before the picker resolves must not
    // open a second picker or start a second ingest pass.
    if (ingestBusyRef.current) return;
    ingestBusyRef.current = true;
    void (async () => {
      let result: DocumentPicker.DocumentPickerResult;
      try {
        result = await DocumentPicker.getDocumentAsync({
          type: '*/*',
          copyToCacheDirectory: true,
          multiple: true,
        });
      } catch (err) {
        Alert.alert('Could not open the file picker', err instanceof Error ? err.message : String(err));
        return;
      }
      if (result.canceled) return;
      setIngesting(true);
      const rows: IngestProgress[] = result.assets.map((a) => ({ name: a.name, status: 'pending' }));
      setIngestRows(rows);
      for (let i = 0; i < result.assets.length; i += 1) {
        const asset = result.assets[i]!;
        try {
          const info = await FileSystem.getInfoAsync(asset.uri);
          if (!info.exists || info.isDirectory) {
            rows[i] = { name: asset.name, status: 'failed', detail: 'Not a readable file.' };
            setIngestRows([...rows]);
            continue;
          }
          const base64 = asset.base64 ?? await FileSystem.readAsStringAsync(asset.uri, {
            encoding: FileSystem.EncodingType.Base64,
          });
          const bytes = decodeBase64(base64);
          // Zero-setup local extraction (title/year/EXIF); GPS is stripped by
          // rewriting the bytes unless the contributor kept locations on this ingest.
          const local = extractLocalMetadata({
            fileName: asset.name,
            bytes,
            mediaType: config.mediaType,
            preserveLocation,
          });
          const res = await addLibraryItem(
            db,
            store,
            identity,
            {
              channelId,
              workspaceId,
              bytes: local.rewrittenBytes ?? bytes,
              title: local.title,
              sortTitle: local.sortTitle,
              year: local.year,
              durationMs: local.durationMs,
              mimeType: asset.mimeType ?? null,
              metadata: local.metadata,
              metadataSource: 'local',
            },
            { recordChange: recordLocalChange },
          );
          rows[i] = res.deduped
            ? { name: asset.name, status: 'duplicate', detail: LIBRARY_STRINGS.alreadyInThisLibrary }
            : { name: asset.name, status: 'added', detail: local.gpsStripped ? 'Photo location removed' : undefined };
          setIngestRows([...rows]);
        } catch (err) {
          rows[i] = {
            name: asset.name,
            status: 'failed',
            detail: err instanceof Error ? err.message : 'Could not add this file.',
          };
          setIngestRows([...rows]);
        }
      }
      setIngesting(false);
      reload();
    })().finally(() => { ingestBusyRef.current = false; });
  }, [db, store, identity, channelId, workspaceId, config.mediaType, recordLocalChange, reload]);

  const onAddPress = useCallback(() => {
    if (isPhotoLibrary) setPhotoConsentOpen(true);
    else runIngest(false);
  }, [isPhotoLibrary, runIngest]);

  const sortFields = sortFieldsForMediaType(config.mediaType);

  const renderItem = useCallback(({ item }: { item: ResolvedLibraryItem }) => (
    <LibraryItemPoster
      item={item}
      shape={cardShape}
      columns={numColumns}
      held={heldSet.has(item.event.contentCid)}
      communityContext={isCommunityLibrary}
      onPress={() => router.push(`/library/item/${item.event.id}`)}
    />
  ), [cardShape, numColumns, heldSet, isCommunityLibrary, router]);

  const activeFilterCount =
    (filter.year !== null ? 1 : 0) + filter.tags.length + (filter.unwatchedOnly ? 1 : 0);

  return (
    <View style={styles.container}>
      {isPhotoLibrary ? (
        <View style={styles.segmentRow}>
          {PHOTO_SEGMENTS.map((s) => {
            const active = segment === s.key;
            return (
              <Pressable
                key={s.key}
                onPress={() => setSegment(s.key)}
                style={[styles.segmentBtn, active && styles.segmentBtnActive]}
              >
                <Text style={[styles.segmentText, active && styles.segmentTextActive]}>{s.label}</Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}

      {isPhotoLibrary && segment === 'timeline' ? (
        items.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>Nothing here yet</Text>
            <Text style={styles.emptyBody}>Add photos to see them grouped on a timeline by capture date.</Text>
          </View>
        ) : (
          <PhotoTimelineSegment items={items} heldSet={heldSet} isCommunityLibrary={isCommunityLibrary} />
        )
      ) : isPhotoLibrary && segment === 'map' ? (
        <PhotoMapSegment channelId={channelId} items={items} />
      ) : (
      <>
      <View style={styles.searchRow}>
        <View style={styles.searchBox}>
          <Search size={16} color={c.textSecondary} strokeWidth={2} />
          <TextInput
            style={styles.searchInput}
            placeholder={`Search ${name}`}
            placeholderTextColor={c.textTertiary}
            value={query}
            onChangeText={(t) => { setQuery(t); setWindow(LIBRARY_RENDER_WINDOW); }}
            autoCorrect={false}
          />
          {query.length > 0 ? (
            <Pressable accessibilityLabel="Clear search" onPress={() => setQuery('')} hitSlop={8}>
              <X size={16} color={c.textSecondary} />
            </Pressable>
          ) : null}
        </View>
      </View>

      <View style={styles.controlRow}>
        <ControlChip
          Icon={ArrowDownUp}
          label={SORT_LABEL[sort.field] ?? sort.field}
          onPress={() => setSortSheet(true)}
        />
        <ControlChip
          Icon={ListFilter}
          label={activeFilterCount > 0 ? `Filters (${activeFilterCount})` : 'Filter'}
          active={activeFilterCount > 0}
          onPress={() => setFilterSheet(true)}
        />
        {canCurate ? (
          <ControlChip Icon={HardDriveDownload} label={LIBRARY_STRINGS.addToLibrary} onPress={onAddPress} />
        ) : null}
      </View>

      {collections.length > 0 ? (
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={[{ id: '__all__', name: 'All', pinned: true } as const, ...collections]}
          keyExtractor={(col) => ('id' in col ? col.id : '')}
          contentContainerStyle={styles.collectionsRow}
          renderItem={({ item: col }) => {
            const id = 'id' in col ? col.id : '';
            const isAll = id === '__all__';
            const selected = isAll ? collectionFilter === null : collectionFilter === id;
            return (
              <Pressable
                onPress={() => selectCollection(isAll ? null : id)}
                style={[styles.collectionChip, selected && styles.collectionChipActive]}
              >
                <Text style={[styles.collectionChipText, selected && styles.collectionChipTextActive]}>
                  {col.name}
                </Text>
              </Pressable>
            );
          }}
        />
      ) : null}

      <View style={styles.statsCard}>
        <StatCell label="Items" value={String(items.length)} />
        <StatCell label="Library size" value={formatBytes(totalBytes)} />
        <StatCell label="On this device" value={formatBytes(storedBytes)} />
        <StatCell label={LIBRARY_STRINGS.heldOnThisDevice} value={`${heldCount}/${items.length}`} />
      </View>
      <Text style={styles.storageCopy}>{MULTI_COMMUNITY_STORAGE_COPY}</Text>
      <Pressable style={styles.policyRow} onPress={onTogglePinPolicy} accessibilityLabel="Change what stays on this device">
        <Text style={styles.policyLabel}>
          {pinPolicy === 'pin_all' ? 'Keeping every item on this device' : 'Keeping only what you open or keep'}
        </Text>
        <Text style={styles.policyAction}>{pinPolicy === 'pin_all' ? 'Fetch on demand' : 'Keep all'}</Text>
      </Pressable>

      {items.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>Nothing here yet</Text>
          <Text style={styles.emptyBody}>
            {canCurate
              ? 'Add files from this device to start this library. Everything stays sealed on your device until you sync it.'
              : 'No items have reached this device yet.'}
          </Text>
          {canCurate ? (
            <Button title={LIBRARY_STRINGS.addToLibrary} onPress={onAddPress} />
          ) : null}
        </View>
      ) : composed.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>No matches</Text>
          <Text style={styles.emptyBody}>No items match your search and filters.</Text>
        </View>
      ) : (
        <FlatList
          key={`grid-${numColumns}`}
          data={windowed}
          keyExtractor={(item) => item.event.id}
          renderItem={renderItem}
          numColumns={numColumns > 1 ? numColumns : undefined}
          columnWrapperStyle={numColumns > 1 ? styles.gridRow : undefined}
          contentContainerStyle={styles.gridContent}
          onEndReached={onEndReached}
          onEndReachedThreshold={0.6}
          initialNumToRender={LIBRARY_RENDER_WINDOW}
          windowSize={7}
          removeClippedSubviews
        />
      )}
      </>
      )}

      <SortSheet
        visible={sortSheet}
        fields={sortFields}
        sort={sort}
        onClose={() => setSortSheet(false)}
        onPick={(next) => { setSort(next); setSortSheet(false); setWindow(LIBRARY_RENDER_WINDOW); }}
      />
      <FilterSheet
        visible={filterSheet}
        facets={facets}
        filter={filter}
        onClose={() => setFilterSheet(false)}
        onApply={(next) => { setFilter(next); setFilterSheet(false); setWindow(LIBRARY_RENDER_WINDOW); }}
      />

      <PhotoConsentSheet
        visible={photoConsentOpen}
        onClose={() => setPhotoConsentOpen(false)}
        onChoose={(keep) => { setPhotoConsentOpen(false); runIngest(keep); }}
      />

      <Modal visible={ingestRows !== null} transparent animationType="fade" onRequestClose={() => !ingesting && setIngestRows(null)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{ingesting ? 'Adding files' : 'Added to library'}</Text>
            <FlatList
              data={ingestRows ?? []}
              keyExtractor={(row, i) => `${row.name}-${i}`}
              style={styles.ingestList}
              renderItem={({ item: row }) => (
                <View style={styles.ingestRow}>
                  <IngestStatusDot status={row.status} />
                  <View style={styles.ingestText}>
                    <Text style={styles.ingestName} numberOfLines={1}>{row.name}</Text>
                    {row.detail ? <Text style={styles.ingestDetail}>{row.detail}</Text> : null}
                  </View>
                </View>
              )}
            />
            {ingesting ? (
              <ActivityIndicator color={c.accent} style={{ marginTop: 8 }} />
            ) : (
              <Button title="Done" onPress={() => setIngestRows(null)} />
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

function StatCell({ label, value }: { label: string; value: string }) {
  const styles = useMkStyles(makeStyles);
  return (
    <View style={styles.statCell}>
      <Text style={styles.statValue} numberOfLines={1}>{value}</Text>
      <Text style={styles.statLabel} numberOfLines={1}>{label}</Text>
    </View>
  );
}

function ControlChip({
  Icon,
  label,
  active,
  onPress,
}: {
  Icon: typeof ArrowDownUp;
  label: string;
  active?: boolean;
  onPress: () => void;
}) {
  const c = useAppThemeColors();
  const styles = useMkStyles(makeStyles);
  return (
    <Pressable onPress={onPress} style={[styles.controlChip, active && styles.controlChipActive]}>
      <Icon size={15} color={active ? c.accent : c.textSecondary} strokeWidth={2} />
      <Text style={[styles.controlChipText, active && styles.controlChipTextActive]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

function IngestStatusDot({ status }: { status: IngestProgress['status'] }) {
  const c = useAppThemeColors();
  const color =
    status === 'added' ? c.success
      : status === 'duplicate' ? c.warning
        : status === 'failed' ? c.danger
          : c.textTertiary;
  if (status === 'added') return <Check size={16} color={color} strokeWidth={2.4} />;
  return <Text style={{ color, fontSize: 16, width: 16, textAlign: 'center' }}>●</Text>;
}

function SortSheet({
  visible,
  fields,
  sort,
  onClose,
  onPick,
}: {
  visible: boolean;
  fields: readonly string[];
  sort: LibrarySortState;
  onClose: () => void;
  onPick: (next: LibrarySortState) => void;
}) {
  const styles = useMkStyles(makeStyles);
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.modalBackdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <Text style={styles.sheetTitle}>Sort by</Text>
          {fields.map((field) => {
            const activeField = sort.field === field;
            return (
              <View key={field} style={styles.sortRow}>
                <Pressable
                  style={styles.sortLabelBtn}
                  onPress={() => onPick({ field, dir: activeField ? sort.dir : 'asc' })}
                >
                  <Text style={[styles.sortLabel, activeField && styles.sortLabelActive]}>
                    {SORT_LABEL[field] ?? field}
                  </Text>
                </Pressable>
                {activeField ? (
                  <Pressable
                    style={styles.dirBtn}
                    onPress={() => onPick({ field, dir: sort.dir === 'asc' ? 'desc' : 'asc' })}
                  >
                    <Text style={styles.dirText}>{sort.dir === 'asc' ? 'A→Z' : 'Z→A'}</Text>
                  </Pressable>
                ) : null}
              </View>
            );
          })}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function FilterSheet({
  visible,
  facets,
  filter,
  onClose,
  onApply,
}: {
  visible: boolean;
  facets: { years: number[]; tags: string[] };
  filter: LibraryFilterState;
  onClose: () => void;
  onApply: (next: LibraryFilterState) => void;
}) {
  const styles = useMkStyles(makeStyles);
  const [draft, setDraft] = useState<LibraryFilterState>(filter);
  useEffect(() => { if (visible) setDraft(filter); }, [visible, filter]);

  const toggleTag = (tag: string) => setDraft((d) => ({
    ...d,
    tags: d.tags.includes(tag) ? d.tags.filter((t) => t !== tag) : [...d.tags, tag],
  }));

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.modalBackdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <Text style={styles.sheetTitle}>Filter</Text>

          <Pressable
            style={styles.checkRow}
            onPress={() => setDraft((d) => ({ ...d, unwatchedOnly: !d.unwatchedOnly }))}
          >
            <View style={[styles.checkbox, draft.unwatchedOnly && styles.checkboxOn]}>
              {draft.unwatchedOnly ? <Check size={13} color="#fff" strokeWidth={3} /> : null}
            </View>
            <Text style={styles.checkLabel}>Not finished</Text>
          </Pressable>

          {facets.years.length > 0 ? (
            <>
              <Text style={styles.filterSection}>Year</Text>
              <View style={styles.chipWrap}>
                {facets.years.map((year) => (
                  <Pressable
                    key={year}
                    onPress={() => setDraft((d) => ({ ...d, year: d.year === year ? null : year }))}
                    style={[styles.facetChip, draft.year === year && styles.facetChipOn]}
                  >
                    <Text style={[styles.facetChipText, draft.year === year && styles.facetChipTextOn]}>{year}</Text>
                  </Pressable>
                ))}
              </View>
            </>
          ) : null}

          {facets.tags.length > 0 ? (
            <>
              <Text style={styles.filterSection}>Tags</Text>
              <View style={styles.chipWrap}>
                {facets.tags.map((tag) => (
                  <Pressable
                    key={tag}
                    onPress={() => toggleTag(tag)}
                    style={[styles.facetChip, draft.tags.includes(tag) && styles.facetChipOn]}
                  >
                    <Text style={[styles.facetChipText, draft.tags.includes(tag) && styles.facetChipTextOn]}>{tag}</Text>
                  </Pressable>
                ))}
              </View>
            </>
          ) : null}

          <View style={styles.sheetActions}>
            <Button title="Clear" variant="secondary" onPress={() => onApply({ year: null, tags: [], unwatchedOnly: false })} />
            <Button title="Apply" onPress={() => onApply(draft)} />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function PhotoConsentSheet({
  visible,
  onClose,
  onChoose,
}: {
  visible: boolean;
  onClose: () => void;
  onChoose: (keepLocations: boolean) => void;
}) {
  const styles = useMkStyles(makeStyles);
  const [keep, setKeep] = useState(false);
  useEffect(() => { if (visible) setKeep(false); }, [visible]);
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.modalBackdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <Text style={styles.sheetTitle}>Add photos</Text>
          <Pressable style={styles.checkRow} onPress={() => setKeep((v) => !v)}>
            <View style={[styles.checkbox, keep && styles.checkboxOn]}>
              {keep ? <Check size={13} color="#fff" strokeWidth={3} /> : null}
            </View>
            <Text style={styles.checkLabel}>{LIBRARY_STRINGS.keepPhotoLocations}</Text>
          </Pressable>
          <Text style={styles.consentNote}>
            Off by default. When a photo carries GPS location, Meerkat removes it before sealing
            the photo unless you keep it on for this import.
          </Text>
          <View style={styles.sheetActions}>
            <Button title="Cancel" variant="secondary" onPress={onClose} />
            <Button title="Choose files" onPress={() => onChoose(keep)} />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const makeStyles = (c: MkColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: c.background },
  consentNote: { color: c.textSecondary, fontSize: 13, lineHeight: 19 },
  segmentRow: {
    flexDirection: 'row',
    gap: 6,
    marginHorizontal: 16,
    marginTop: 10,
    backgroundColor: c.surfaceHigh,
    borderRadius: MK_RADIUS.pill,
    padding: 3,
  },
  segmentBtn: { flex: 1, alignItems: 'center', paddingVertical: 7, borderRadius: MK_RADIUS.pill },
  segmentBtnActive: { backgroundColor: c.accent },
  segmentText: { color: c.textSecondary, fontSize: 13, fontWeight: '700' },
  segmentTextActive: { color: c.onAccent },
  searchRow: { paddingHorizontal: 16, paddingTop: 10 },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: c.surfaceHigh,
    borderRadius: MK_RADIUS.md,
    paddingHorizontal: 12,
    height: 42,
  },
  searchInput: { flex: 1, color: c.text, fontSize: 15 },
  controlRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingTop: 10, flexWrap: 'wrap' },
  controlChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: c.surfaceHigh,
    borderRadius: MK_RADIUS.pill,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  controlChipActive: { backgroundColor: c.surfaceElevated, borderWidth: StyleSheet.hairlineWidth, borderColor: c.accent },
  controlChipText: { color: c.textSecondary, fontSize: 13, fontWeight: '700' },
  controlChipTextActive: { color: c.accent },
  collectionsRow: { gap: 8, paddingHorizontal: 16, paddingTop: 10 },
  collectionChip: {
    backgroundColor: c.surfaceHigh,
    borderRadius: MK_RADIUS.pill,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  collectionChipActive: { backgroundColor: c.accent },
  collectionChipText: { color: c.textSecondary, fontSize: 13, fontWeight: '700' },
  collectionChipTextActive: { color: c.onAccent },
  statsCard: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginTop: 10,
    backgroundColor: c.surface,
    borderColor: c.border,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: MK_RADIUS.md,
    paddingVertical: 10,
  },
  statCell: { flex: 1, alignItems: 'center', gap: 2 },
  statValue: { color: c.accent, fontSize: 16, fontWeight: '800' },
  statLabel: { color: c.textTertiary, fontSize: 10, fontWeight: '700', textAlign: 'center' },
  storageCopy: { color: c.textTertiary, fontSize: 11.5, lineHeight: 16, marginHorizontal: 16, marginTop: 6 },
  policyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginHorizontal: 16,
    marginTop: 8,
    backgroundColor: c.surfaceHigh,
    borderRadius: MK_RADIUS.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  policyLabel: { color: c.textSecondary, fontSize: 12.5, flex: 1 },
  policyAction: { color: c.accent, fontSize: 12.5, fontWeight: '800' },
  gridContent: { padding: 12, paddingBottom: 120 },
  gridRow: { gap: 12, paddingHorizontal: 4 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, padding: 32 },
  emptyTitle: { color: c.text, fontSize: 18, fontWeight: '800' },
  emptyBody: { color: c.textSecondary, fontSize: 14, lineHeight: 20, textAlign: 'center' },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalCard: {
    backgroundColor: c.surface,
    borderTopLeftRadius: MK_RADIUS.lg,
    borderTopRightRadius: MK_RADIUS.lg,
    padding: 20,
    gap: 12,
    maxHeight: '70%',
  },
  modalTitle: { color: c.text, fontSize: 18, fontWeight: '800' },
  ingestList: { maxHeight: 280 },
  ingestRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
  ingestText: { flex: 1, minWidth: 0 },
  ingestName: { color: c.text, fontSize: 14, fontWeight: '600' },
  ingestDetail: { color: c.textSecondary, fontSize: 12 },
  sheet: {
    backgroundColor: c.surface,
    borderTopLeftRadius: MK_RADIUS.lg,
    borderTopRightRadius: MK_RADIUS.lg,
    padding: 20,
    gap: 10,
    maxHeight: '80%',
  },
  sheetTitle: { color: c.text, fontSize: 18, fontWeight: '800', marginBottom: 4 },
  sortRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sortLabelBtn: { flex: 1, paddingVertical: 10 },
  sortLabel: { color: c.text, fontSize: 15 },
  sortLabelActive: { color: c.accent, fontWeight: '800' },
  dirBtn: { backgroundColor: c.surfaceHigh, borderRadius: MK_RADIUS.pill, paddingHorizontal: 12, paddingVertical: 6 },
  dirText: { color: c.accent, fontSize: 13, fontWeight: '800' },
  filterSection: { color: c.textSecondary, fontSize: 13, fontWeight: '800', marginTop: 8 },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  facetChip: { backgroundColor: c.surfaceHigh, borderRadius: MK_RADIUS.pill, paddingHorizontal: 12, paddingVertical: 6 },
  facetChipOn: { backgroundColor: c.accent },
  facetChipText: { color: c.textSecondary, fontSize: 13, fontWeight: '700' },
  facetChipTextOn: { color: c.onAccent },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
  checkbox: {
    width: 22, height: 22, borderRadius: 6, borderWidth: 1.5, borderColor: c.border,
    alignItems: 'center', justifyContent: 'center',
  },
  checkboxOn: { backgroundColor: c.accent, borderColor: c.accent },
  checkLabel: { color: c.text, fontSize: 15 },
  sheetActions: { flexDirection: 'row', gap: 10, marginTop: 12, justifyContent: 'flex-end' },
});
