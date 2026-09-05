import { useCallback, useMemo, useState } from 'react';
import { View, FlatList, TextInput, Pressable, ScrollView, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { Text, Card, Button, EmptyState, SearchBar, TagPill } from '@mylife/ui';
import {
  getEvents,
  getFacets,
  createEvent,
  refreshDiscoveryCache,
  getCachedDiscoveryEvents,
  buildSourceRegistry,
  type CachedDiscoveryEvent,
  type EventRow,
  type FetchImpl,
} from '@mylife/manhattan';
import { useManhattanDatabase } from '../providers/DatabaseProvider';

const BACKGROUND = '#131318';
const ACCENT = '#E4572E';

const FILTER_AXES = ['category', 'time', 'price'] as const;
type FilterAxis = (typeof FILTER_AXES)[number];

const AXIS_LABELS: Record<FilterAxis, string> = {
  category: 'Category',
  time: 'When',
  price: 'Price',
};

// Wrap the global fetch so it satisfies the module's FetchImpl shape. The
// init cast is safe: fetchWithTimeout only ever passes a real AbortSignal.
const fetchImpl: FetchImpl = (url, init) => fetch(url, init as RequestInit);

type FacetMap = Record<string, { axis: string; value: string }[]>;
type DiscoveryListItem = {
  id: string;
  title: string;
  venue_name: string | null;
  start_at: string | null;
  category: string | null;
  source_id: string;
  saved: number;
};

function isEngagedEvent(event: EventRow): boolean {
  return (
    event.saved === 1 ||
    event.source_id === 'manual' ||
    event.source_id === 'share_intent' ||
    event.source_id === 'device_calendar' ||
    event.source_id === 'ics_import'
  );
}

function rowToListItem(event: EventRow): DiscoveryListItem {
  return {
    id: event.id,
    title: event.title,
    venue_name: event.venue_name,
    start_at: event.start_at,
    category: event.category,
    source_id: event.source_id,
    saved: event.saved,
  };
}

function cachedToListItem(event: CachedDiscoveryEvent): DiscoveryListItem {
  return {
    id: `cache:${event.cacheId}`,
    title: event.title,
    venue_name: event.venueName ?? null,
    start_at: event.startAt ?? null,
    category: event.category ?? null,
    source_id: event.sourceId,
    saved: 0,
  };
}

function formatStartAt(startAt: string | null): string | null {
  if (!startAt) return null;
  const d = new Date(startAt);
  if (Number.isNaN(d.getTime())) return startAt;
  return d.toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function facetValue(facets: { axis: string; value: string }[], axis: string): string | null {
  return facets.find((f) => f.axis === axis)?.value ?? null;
}

export default function DiscoverScreen() {
  const db = useManhattanDatabase();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [events, setEvents] = useState<DiscoveryListItem[]>([]);
  const [facetsByEvent, setFacetsByEvent] = useState<FacetMap>({});
  const [query, setQuery] = useState('');
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState('');
  const [venue, setVenue] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Record<FilterAxis, Set<string>>>({
    category: new Set(),
    time: new Set(),
    price: new Set(),
  });

  const gapSources = useMemo(
    () => buildSourceRegistry().filter((a) => a.tier === 'gap'),
    [],
  );

  const refresh = useCallback(() => {
    const rows = getEvents(db).filter(isEngagedEvent).map(rowToListItem);
    const cachedEvents = getCachedDiscoveryEvents(db);
    const cached = cachedEvents.map(cachedToListItem);
    const allEvents = [...rows, ...cached];
    const map: FacetMap = {};
    for (const e of rows) {
      map[e.id] = getFacets(db, e.id).map((f) => ({ axis: f.axis, value: f.value }));
    }
    for (const cachedEvent of cachedEvents) {
      map[`cache:${cachedEvent.cacheId}`] = cachedEvent.facets;
    }
    setEvents(allEvents);
    setFacetsByEvent(map);
  }, [db]);

  useFocusEffect(useCallback(() => {
    refresh();
  }, [refresh]));

  const handleRefreshEvents = async () => {
    setRefreshing(true);
    setRefreshError(null);
    try {
      await refreshDiscoveryCache(
        db,
        buildSourceRegistry(),
        { city: 'New York', limit: 50 },
        fetchImpl,
      );
    } catch (err) {
      setRefreshError(
        err instanceof Error ? err.message : 'Could not refresh events. Try again later.',
      );
    } finally {
      setRefreshing(false);
      refresh();
    }
  };

  // Distinct facet values per axis, built from the loaded events' facets.
  const axisValues = useMemo<Record<FilterAxis, string[]>>(() => {
    const acc: Record<FilterAxis, Set<string>> = {
      category: new Set(),
      time: new Set(),
      price: new Set(),
    };
    for (const facets of Object.values(facetsByEvent)) {
      for (const f of facets) {
        if ((FILTER_AXES as readonly string[]).includes(f.axis)) {
          acc[f.axis as FilterAxis].add(f.value);
        }
      }
    }
    return {
      category: [...acc.category].sort(),
      time: [...acc.time].sort(),
      price: [...acc.price].sort(),
    };
  }, [facetsByEvent]);

  const toggleFacet = (axis: FilterAxis, value: string) => {
    setSelected((prev) => {
      const next = new Set(prev[axis]);
      if (next.has(value)) next.delete(value);
      else next.add(value);
      return { ...prev, [axis]: next };
    });
  };

  // AND across axes, OR within an axis. An event passes an axis if it carries
  // at least one of that axis' selected values; it must pass every active axis.
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return events.filter((e) => {
      if (q && !e.title.toLowerCase().includes(q)) return false;
      const facets = facetsByEvent[e.id] ?? [];
      for (const axis of FILTER_AXES) {
        const wanted = selected[axis];
        if (wanted.size === 0) continue;
        const hasMatch = facets.some((f) => f.axis === axis && wanted.has(f.value));
        if (!hasMatch) return false;
      }
      return true;
    });
  }, [events, facetsByEvent, query, selected]);

  const activeFilterCount =
    selected.category.size + selected.time.size + selected.price.size;

  const handleAdd = () => {
    if (!title.trim()) return;
    createEvent(db, {
      title: title.trim(),
      venueName: venue.trim() || null,
      saved: true,
    });
    setTitle('');
    setVenue('');
    setAdding(false);
    refresh();
  };

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <Text variant="heading">Discover</Text>
        <Button
          title={refreshing ? 'Refreshing...' : 'Refresh events'}
          variant="primary"
          onPress={() => { void handleRefreshEvents(); }}
          disabled={refreshing}
        />
      </View>
      <View style={styles.actionsRow}>
        <View style={styles.actionItem}>
          <Button
            title="Import link"
            variant="secondary"
            onPress={() => router.push('/(root)/share/confirm')}
          />
        </View>
        <View style={styles.actionItem}>
          <Button
            title={adding ? 'Close' : 'Add event'}
            variant="secondary"
            onPress={() => setAdding((v) => !v)}
          />
        </View>
      </View>

      {refreshError ? (
        <View style={styles.noticeWrap}>
          <Text variant="caption" color="#FFB4AB">{refreshError}</Text>
        </View>
      ) : null}

      {adding ? (
        <View style={styles.form}>
          <TextInput
            style={styles.input}
            value={title}
            onChangeText={setTitle}
            placeholder="Event title"
            placeholderTextColor="#52443A"
            autoFocus
          />
          <TextInput
            style={styles.input}
            value={venue}
            onChangeText={setVenue}
            placeholder="Venue (optional)"
            placeholderTextColor="#52443A"
          />
          <Button title="Save event" onPress={handleAdd} disabled={!title.trim()} />
        </View>
      ) : (
        <View style={styles.searchWrap}>
          <SearchBar value={query} onChangeText={setQuery} placeholder="Search events" />
        </View>
      )}

      {FILTER_AXES.map((axis) =>
        axisValues[axis].length > 0 ? (
          <View key={axis} style={styles.filterRow}>
            <Text variant="label" color="#9F8E81" style={styles.filterLabel}>
              {AXIS_LABELS[axis]}
            </Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.chipScroll}
            >
              {axisValues[axis].map((value) => {
                const active = selected[axis].has(value);
                return (
                  <Pressable
                    key={value}
                    accessibilityRole="button"
                    accessibilityLabel={`${AXIS_LABELS[axis]} filter: ${value}`}
                    accessibilityState={{ selected: active }}
                    onPress={() => toggleFacet(axis, value)}
                    style={[styles.chip, active && styles.chipActive]}
                  >
                    <Text
                      variant="caption"
                      color={active ? BACKGROUND : '#D6C3B5'}
                    >
                      {value}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        ) : null,
      )}

      <View style={styles.countRow}>
        <Text variant="caption" color="#9F8E81">
          {filtered.length} {filtered.length === 1 ? 'event' : 'events'}
          {activeFilterCount > 0 ? ` · ${activeFilterCount} filters` : ''}
        </Text>
      </View>

      {filtered.length === 0 ? (
        <View style={styles.emptyWrap}>
          <EmptyState
            icon="🔎"
            title={
              activeFilterCount > 0 || query.trim()
                ? 'No matching events'
                : 'No events yet'
            }
            message="Tap Refresh events to pull NYC events from open sources, or add one manually."
            actionLabel="Refresh events"
            onAction={() => { void handleRefreshEvents(); }}
          />
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(e) => e.id}
          contentContainerStyle={styles.list}
          ListFooterComponent={
            gapSources.length > 0 ? (
              <View style={styles.gapSection}>
                <Text variant="label" color="#9F8E81" style={styles.gapTitle}>
                  Coming with MyLife Tickets
                </Text>
                <View style={styles.gapChips}>
                  {gapSources.map((a) => (
                    <View key={a.id} style={styles.gapChip}>
                      <TagPill name={a.displayName} />
                    </View>
                  ))}
                </View>
              </View>
            ) : null
          }
          renderItem={({ item }) => {
            const facets = facetsByEvent[item.id] ?? [];
            const category = item.category ?? facetValue(facets, 'category');
            const price = facetValue(facets, 'price');
            const when = formatStartAt(item.start_at);
            return (
              <Card>
                <Text variant="subheading">{item.title}</Text>
                {item.venue_name ? (
                  <Text variant="caption" color="#D6C3B5">{item.venue_name}</Text>
                ) : null}
                {when ? (
                  <Text variant="caption" color="#9F8E81">{when}</Text>
                ) : null}
                {(category || price) ? (
                  <View style={styles.cardTags}>
                    {category ? <TagPill name={category} color={ACCENT} /> : null}
                    {price ? <TagPill name={price} /> : null}
                  </View>
                ) : null}
              </Card>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BACKGROUND },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  actionsRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingBottom: 8 },
  actionItem: { flex: 1 },
  noticeWrap: { paddingHorizontal: 20, paddingBottom: 4 },
  searchWrap: { paddingHorizontal: 16, paddingBottom: 8 },
  form: { paddingHorizontal: 16, paddingBottom: 8, gap: 8 },
  input: {
    backgroundColor: '#1F1F25',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: '#E4E1E9',
    fontSize: 16,
  },
  filterRow: { paddingLeft: 16, paddingBottom: 6 },
  filterLabel: { marginBottom: 4 },
  chipScroll: { gap: 8, paddingRight: 16 },
  chip: {
    backgroundColor: '#2A292F',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  chipActive: {
    backgroundColor: ACCENT,
    borderColor: ACCENT,
  },
  countRow: { paddingHorizontal: 20, paddingVertical: 6 },
  cardTags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  gapSection: { marginTop: 20, paddingHorizontal: 4 },
  gapTitle: { marginBottom: 8 },
  gapChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, opacity: 0.5 },
  gapChip: {},
  emptyWrap: { flex: 1, justifyContent: 'center' },
  list: { padding: 16, gap: 12 },
});
