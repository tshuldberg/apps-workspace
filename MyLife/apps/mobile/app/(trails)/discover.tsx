import type { ReactNode } from 'react';
import { startTransition, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import {
  DifficultyChip,
  GlassCard,
  MaterialSymbol,
  SectionHeader,
  TR_ACCENT,
  TR_ACCENT_GLOW,
  TR_ACCENT_LIGHT,
  TR_CARD_RADIUS,
  TR_LIME_GLOW_STYLE,
  TR_ON_ACCENT,
  TR_SURFACES,
  TR_TEXT,
  TR_TEXT_SECONDARY,
  TR_TEXT_TERTIARY,
  TR_TYPOGRAPHY,
  formatTrailDistance,
  formatTrailElevation,
  getCollections,
  getDatabaseEntries,
  getFeaturedRegions,
  getRecommendedTrails,
  getTrails,
  getTrendingTrails,
  saveDatabaseTrailToMyTrails,
  searchTrailDatabase,
  withAlpha,
  type TrailDatabaseEntry,
  type TrailDifficulty,
  type TrailDiscoveryCollection,
  type TrailFeaturedRegion,
  type TrailType,
} from '@mylife/trails';
import { spacing } from '@mylife/ui';
import { useDatabase } from '../../components/DatabaseProvider';
import { uuid } from '../../lib/uuid';

type DistanceFilter = 'all' | 'short' | 'medium' | 'long';

const DISTANCE_FILTERS: Array<{ key: DistanceFilter; label: string }> = [
  { key: 'all', label: 'Any distance' },
  { key: 'short', label: '< 5 km' },
  { key: 'medium', label: '5-12 km' },
  { key: 'long', label: '12+ km' },
];

const ACTIVITY_FILTERS: Array<{ key: TrailType | 'all'; label: string }> = [
  { key: 'all', label: 'Any activity' },
  { key: 'hiking', label: 'Hike' },
  { key: 'running', label: 'Run' },
  { key: 'cycling', label: 'Ride' },
  { key: 'multi_use', label: 'Mixed' },
];

const DIFFICULTY_FILTERS: Array<{ key: TrailDifficulty | 'all'; label: string }> = [
  { key: 'all', label: 'Any difficulty' },
  { key: 'easy', label: 'Easy' },
  { key: 'moderate', label: 'Moderate' },
  { key: 'hard', label: 'Hard' },
  { key: 'expert', label: 'Expert' },
];

export default function DiscoverScreen() {
  const db = useDatabase();
  const router = useRouter();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [difficulty, setDifficulty] = useState<TrailDifficulty | 'all'>('all');
  const [distance, setDistance] = useState<DistanceFilter>('all');
  const [activity, setActivity] = useState<TrailType | 'all'>('all');
  const [region, setRegion] = useState<string>('all');
  const [activeCollectionId, setActiveCollectionId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(() => {
      startTransition(() => setDebouncedSearch(search.trim()));
    }, 220);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [search]);

  const myTrails = useMemo(() => getTrails(db, { limit: 200 }), [db, tick]);
  const allEntries = useMemo(() => getDatabaseEntries(db, { limit: 300 }), [db, tick]);
  const featuredRegions = useMemo(() => getFeaturedRegions(db, { limit: 6 }), [db, tick]);
  const trendingTrails = useMemo(() => getTrendingTrails(db, { limit: 6 }), [db, tick]);
  const collections = useMemo(
    () => getCollections(db, { limit: 4, entriesPerCollection: 4 }),
    [db, tick],
  );
  const recommendedTrails = useMemo(
    () =>
      getRecommendedTrails(db, {
        difficulty: difficulty === 'all' ? undefined : difficulty,
        limit: 4,
      }),
    [db, difficulty, tick],
  );

  const sourceEntries = useMemo(
    () => (debouncedSearch ? searchTrailDatabase(db, debouncedSearch, 80) : allEntries),
    [allEntries, db, debouncedSearch],
  );

  const activeCollection = useMemo(
    () => collections.find((collection) => collection.id === activeCollectionId) ?? null,
    [activeCollectionId, collections],
  );

  const visibleEntries = useMemo(() => {
    const collectionKeys = activeCollection
      ? new Set(activeCollection.entries.map((entry) => toEntryKey(entry.name, entry.region)))
      : null;

    return sourceEntries.filter((entry) => {
      if (collectionKeys && !collectionKeys.has(toEntryKey(entry.name, entry.region))) {
        return false;
      }
      if (difficulty !== 'all' && entry.difficulty !== difficulty) {
        return false;
      }
      if (activity !== 'all' && entry.trailType !== activity) {
        return false;
      }
      if (region !== 'all' && entry.region !== region) {
        return false;
      }
      return matchesDistanceFilter(entry, distance);
    });
  }, [activity, activeCollection, difficulty, distance, region, sourceEntries]);

  const savedTrailIndex = useMemo(
    () =>
      new Map(myTrails.map((trail) => [toEntryKey(trail.name, trail.region), trail.id])),
    [myTrails],
  );

  const hasActiveFilters =
    difficulty !== 'all' ||
    distance !== 'all' ||
    activity !== 'all' ||
    region !== 'all' ||
    activeCollectionId !== null;

  const highlightedEntries =
    visibleEntries.length > 0 ? visibleEntries : trendingTrails.length > 0 ? trendingTrails : allEntries;

  const searchSummary = debouncedSearch
    ? `${visibleEntries.length} trail${visibleEntries.length === 1 ? '' : 's'} matched your search`
    : `${allEntries.length} trail${allEntries.length === 1 ? '' : 's'} in the discovery index`;

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    setTick((value) => value + 1);
    setTimeout(() => setRefreshing(false), 240);
  }, []);

  const handleSave = useCallback(
    (entry: TrailDatabaseEntry) => {
      try {
        const trail = saveDatabaseTrailToMyTrails(db, entry, uuid());
        setTick((value) => value + 1);
        Alert.alert('Saved to MyTrails', `"${trail.name}" is ready in your trail library.`, [
          {
            text: 'View Trail',
            onPress: () => {
              router.push(`/(trails)/trail/${trail.id}` as `/${string}`);
            },
          },
          { text: 'Stay Here' },
        ]);
      } catch {
        Alert.alert('Save failed', 'This trail could not be saved right now.');
      }
    },
    [db, router],
  );

  const handleTrailAction = useCallback(
    (entry: TrailDatabaseEntry) => {
      const existingTrailId = savedTrailIndex.get(toEntryKey(entry.name, entry.region));
      if (existingTrailId) {
        router.push(`/(trails)/trail/${existingTrailId}` as `/${string}`);
        return;
      }

      handleSave(entry);
    },
    [handleSave, router, savedTrailIndex],
  );

  const resetFilters = useCallback(() => {
    setDifficulty('all');
    setDistance('all');
    setActivity('all');
    setRegion('all');
    setActiveCollectionId(null);
  }, []);

  const heroRegions = useMemo(
    () => featuredRegions.slice(0, 3).map((item) => item.name),
    [featuredRegions],
  );

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.scrollContent}
      stickyHeaderIndices={[1]}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={handleRefresh}
          tintColor={TR_ACCENT_LIGHT}
        />
      }
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.contentBlock}>
        <View style={styles.headerCard}>
          <View style={styles.headerEyebrow}>
            <MaterialSymbol name="map" size={14} color={TR_ACCENT_LIGHT} />
            <Text style={styles.headerEyebrowText}>Global Trail Discovery</Text>
          </View>
          <Text style={styles.headerTitle}>Discover</Text>
          <Text style={styles.headerBody}>
            Search trails worldwide, pivot into featured regions, and save routes into your
            offline-first MyTrails library.
          </Text>
          <View style={styles.metricRow}>
            <MetricPill label="Featured Regions" value={String(featuredRegions.length)} />
            <MetricPill label="Collections" value={String(collections.length)} />
            <MetricPill label="For You" value={String(recommendedTrails.length)} />
          </View>
        </View>
      </View>

      <View style={styles.searchStickyShell}>
        <View style={styles.contentBlock}>
          <GlassCard padding={14} style={styles.searchCard}>
            <View style={styles.searchRow}>
              <MaterialSymbol name="search" size={18} color={TR_ACCENT_LIGHT} />
              <TextInput
                value={search}
                onChangeText={setSearch}
                placeholder="Search trails worldwide..."
                placeholderTextColor="rgba(228,225,233,0.45)"
                style={styles.searchInput}
              />
              {search.length > 0 ? (
                <Pressable onPress={() => setSearch('')} hitSlop={8}>
                  <MaterialSymbol name="more_vert" size={18} color={TR_TEXT_TERTIARY} />
                </Pressable>
              ) : null}
            </View>
            <View style={styles.searchMetaRow}>
              <Text style={styles.searchMetaText}>{searchSummary}</Text>
              {hasActiveFilters ? (
                <Pressable onPress={resetFilters} hitSlop={8}>
                  <Text style={styles.searchResetText}>Reset filters</Text>
                </Pressable>
              ) : null}
            </View>
          </GlassCard>
        </View>
      </View>

      <View style={styles.contentBlock}>
        <DiscoveryMapHero
          entries={highlightedEntries.slice(0, 10)}
          subtitle={heroRegions.join(' • ')}
          onPressCta={() => {
            if (featuredRegions[0]) {
              setRegion((current) => (current === featuredRegions[0].name ? 'all' : featuredRegions[0].name));
            }
          }}
        />

        <View style={styles.section}>
          <SectionHeader title="Quick Filters" />
          <Text style={styles.sectionBody}>
            Tune difficulty, distance, activity, region, and collection focus without leaving the
            discovery map.
          </Text>

          <FilterGroup label="Difficulty">
            {DIFFICULTY_FILTERS.map((item) => (
              <FilterChip
                key={item.key}
                label={item.label}
                active={difficulty === item.key}
                onPress={() => setDifficulty(item.key)}
              />
            ))}
          </FilterGroup>

          <FilterGroup label="Distance">
            {DISTANCE_FILTERS.map((item) => (
              <FilterChip
                key={item.key}
                label={item.label}
                active={distance === item.key}
                onPress={() => setDistance(item.key)}
              />
            ))}
          </FilterGroup>

          <FilterGroup label="Activity">
            {ACTIVITY_FILTERS.map((item) => (
              <FilterChip
                key={item.key}
                label={item.label}
                active={activity === item.key}
                onPress={() => setActivity(item.key)}
              />
            ))}
          </FilterGroup>

          <FilterGroup label="Region">
            <FilterChip
              label="All regions"
              active={region === 'all'}
              onPress={() => setRegion('all')}
            />
            {featuredRegions.map((item) => (
              <FilterChip
                key={item.id}
                label={item.name}
                active={region === item.name}
                onPress={() => setRegion(item.name)}
              />
            ))}
          </FilterGroup>
        </View>

        {(debouncedSearch || hasActiveFilters) && (
          <View style={styles.section}>
            <SectionHeader
              title={debouncedSearch ? 'Search Results' : 'Filtered Trails'}
              action={{
                label: 'Clear',
                onPress: () => {
                  resetFilters();
                  setSearch('');
                },
              }}
            />
            {visibleEntries.length === 0 ? (
              <GlassCard style={styles.emptyCard}>
                <Text style={styles.emptyIcon}>🧭</Text>
                <Text style={styles.emptyTitle}>No trails match this view</Text>
                <Text style={styles.emptyBody}>
                  Widen the filters or clear the search to bring back the broader discovery index.
                </Text>
              </GlassCard>
            ) : (
              <View style={styles.cardStack}>
                {visibleEntries.slice(0, 6).map((entry) => (
                  <DiscoveryTrailCard
                    key={entry.id}
                    entry={entry}
                    actionLabel={savedTrailIndex.has(toEntryKey(entry.name, entry.region)) ? 'View' : 'Save'}
                    onAction={() => handleTrailAction(entry)}
                  />
                ))}
              </View>
            )}
          </View>
        )}

        <View style={styles.section}>
          <SectionHeader title="Featured Regions" />
          <Text style={styles.sectionBody}>
            Tap a region to pivot the entire discovery surface around that area.
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalRail}>
            {featuredRegions.map((item) => (
              <FeaturedRegionCard
                key={item.id}
                region={item}
                active={region === item.name}
                onPress={() => setRegion(item.name)}
              />
            ))}
          </ScrollView>
        </View>

        <View style={styles.section}>
          <SectionHeader title="Trending This Week" />
          <Text style={styles.sectionBody}>
            Higher-signal routes bubble up here based on recency, metadata quality, and standout
            trail details.
          </Text>
          <View style={styles.cardStack}>
            {trendingTrails.map((entry) => (
              <DiscoveryTrailCard
                key={entry.id}
                entry={entry}
                badgeLabel="Trending"
                reason="Hot trail details this week."
                actionLabel={savedTrailIndex.has(toEntryKey(entry.name, entry.region)) ? 'View' : 'Save'}
                onAction={() => handleTrailAction(entry)}
              />
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <SectionHeader
            title="Curated Collections"
            action={
              activeCollection
                ? {
                    label: 'Clear',
                    onPress: () => setActiveCollectionId(null),
                  }
                : undefined
            }
          />
          <Text style={styles.sectionBody}>
            Collections drive instant filtered trail lists for wildflowers, waterfalls, alpine
            routes, and family-friendly days.
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalRail}>
            {collections.map((collection) => (
              <CollectionCard
                key={collection.id}
                collection={collection}
                active={activeCollectionId === collection.id}
                onPress={() =>
                  setActiveCollectionId((current) =>
                    current === collection.id ? null : collection.id,
                  )
                }
              />
            ))}
          </ScrollView>

          {activeCollection ? (
            <View style={styles.collectionSpotlight}>
              <SectionHeader title={activeCollection.title} />
              <View style={styles.cardStack}>
                {activeCollection.entries.map((entry) => (
                  <DiscoveryTrailCard
                    key={entry.id}
                    entry={entry}
                    badgeLabel="Collection pick"
                    actionLabel={savedTrailIndex.has(toEntryKey(entry.name, entry.region)) ? 'View' : 'Save'}
                    onAction={() => handleTrailAction(entry)}
                  />
                ))}
              </View>
            </View>
          ) : null}
        </View>

        <View style={styles.section}>
          <SectionHeader title="For You" />
          <Text style={styles.sectionBody}>
            Recommendations react to your current difficulty preference and the trail history
            already saved inside MyTrails.
          </Text>
          <View style={styles.cardStack}>
            {recommendedTrails.map((item) => (
              <DiscoveryTrailCard
                key={item.trail.id}
                entry={item.trail}
                badgeLabel="For You"
                reason={item.reason}
                actionLabel={savedTrailIndex.has(toEntryKey(item.trail.name, item.trail.region)) ? 'View' : 'Save'}
                onAction={() => handleTrailAction(item.trail)}
              />
            ))}
          </View>
        </View>
      </View>
    </ScrollView>
  );
}

function DiscoveryMapHero({
  entries,
  subtitle,
  onPressCta,
}: {
  entries: TrailDatabaseEntry[];
  subtitle: string;
  onPressCta: () => void;
}) {
  const pins = useMemo(() => buildMapPins(entries), [entries]);

  return (
    <GlassCard padding={0} style={styles.mapHeroCard}>
      <LinearGradient
        colors={['rgba(132,204,22,0.2)', 'rgba(31,31,37,0.92)', 'rgba(14,14,19,0.98)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFillObject}
      />

      <View style={styles.mapHeroCanvas}>
        {pins.map((pin) => (
          <View
            key={pin.id}
            style={[
              styles.mapHeatSpot,
              {
                left: `${pin.x}%`,
                top: `${pin.y}%`,
              },
            ]}
          />
        ))}
        {pins.map((pin) => (
          <View
            key={`${pin.id}-marker`}
            style={[
              styles.mapPinShell,
              {
                left: `${pin.x}%`,
                top: `${pin.y}%`,
              },
            ]}
          >
            <View style={styles.mapPinCore} />
          </View>
        ))}
      </View>

      <View style={styles.mapHeroTop}>
        <View style={styles.mapHeroBadge}>
          <View style={styles.liveDot} />
          <Text style={styles.mapHeroBadgeText}>Heat map</Text>
        </View>
        <Pressable onPress={onPressCta} style={styles.mapHeroButton}>
          <Text style={styles.mapHeroButtonText}>Search on Map</Text>
        </Pressable>
      </View>

      <View style={styles.mapHeroFooter}>
        <Text style={styles.mapHeroEyebrow}>Global Discovery Hub</Text>
        <Text style={styles.mapHeroTitle}>Find the next trail before you leave signal.</Text>
        <Text style={styles.mapHeroBody}>
          {subtitle || 'Featured discovery zones are ready for route planning, saving, and offline prep.'}
        </Text>
      </View>
    </GlassCard>
  );
}

function FeaturedRegionCard({
  region,
  active,
  onPress,
}: {
  region: TrailFeaturedRegion;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress}>
      <GlassCard
        padding={16}
        style={[
          styles.regionCard,
          active ? styles.regionCardActive : null,
        ]}
      >
        <LinearGradient
          colors={[
            'rgba(132,204,22,0.24)',
            'rgba(101,163,13,0.12)',
            'rgba(14,14,19,0.04)',
          ]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFillObject}
        />
        <Text style={styles.regionTitle}>{region.name}</Text>
        <Text style={styles.regionMeta}>
          {region.trailCount} trail{region.trailCount === 1 ? '' : 's'} ·{' '}
          {region.averageDistanceMeters
            ? formatTrailDistance(region.averageDistanceMeters)
            : 'Varied distance'}
        </Text>
        <View style={styles.regionFooter}>
          {region.dominantDifficulty ? (
            <DifficultyChip level={region.dominantDifficulty} size="sm" />
          ) : null}
          <Text style={styles.regionFooterText}>{region.sampleTrail.name}</Text>
        </View>
      </GlassCard>
    </Pressable>
  );
}

function CollectionCard({
  collection,
  active,
  onPress,
}: {
  collection: TrailDiscoveryCollection;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress}>
      <GlassCard padding={16} style={[styles.collectionCard, active ? styles.collectionCardActive : null]}>
        <LinearGradient
          colors={active ? ['rgba(132,204,22,0.28)', 'rgba(14,14,19,0.12)'] : ['rgba(255,255,255,0.06)', 'rgba(14,14,19,0.04)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFillObject}
        />
        <Text style={styles.collectionTitle}>{collection.title}</Text>
        <Text style={styles.collectionBody}>{collection.description}</Text>
        <Text style={styles.collectionCount}>
          {collection.entries.length} trail{collection.entries.length === 1 ? '' : 's'}
        </Text>
      </GlassCard>
    </Pressable>
  );
}

function DiscoveryTrailCard({
  entry,
  badgeLabel,
  reason,
  actionLabel,
  onAction,
}: {
  entry: TrailDatabaseEntry;
  badgeLabel?: string;
  reason?: string;
  actionLabel: string;
  onAction: () => void;
}) {
  return (
    <GlassCard padding={14} style={styles.trailCard}>
      <View style={styles.trailCardHeader}>
        <View style={styles.trailCardThumb}>
          <LinearGradient
            colors={['rgba(132,204,22,0.36)', 'rgba(101,163,13,0.16)', 'rgba(14,14,19,0.82)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFillObject}
          />
          <MaterialSymbol name="map" size={20} color={TR_ACCENT_LIGHT} />
        </View>

        <View style={styles.trailCardBody}>
          <View style={styles.trailCardTitleRow}>
            <View style={styles.trailCardTitleBlock}>
              {badgeLabel ? (
                <Text style={styles.trailCardEyebrow}>{badgeLabel}</Text>
              ) : null}
              <Text style={styles.trailCardTitle}>{entry.name}</Text>
              <Text style={styles.trailCardRegion}>
                {entry.region ?? 'Global trail database'}
              </Text>
            </View>
            {entry.difficulty ? <DifficultyChip level={entry.difficulty} size="sm" /> : null}
          </View>

          <View style={styles.trailStatRow}>
            <TrailMeta icon="straighten" value={formatTrailDistance(entry.distanceMeters)} />
            <TrailMeta icon="terrain" value={formatTrailElevation(entry.elevationGainMeters)} />
            <TrailMeta icon="schedule" value={formatActivityLabel(entry.trailType)} />
          </View>

          <Text style={styles.trailCardReason} numberOfLines={2}>
            {reason ?? entry.description ?? 'Route details ready for saving and deeper planning.'}
          </Text>

          <View style={styles.trailCardFooter}>
            <Text style={styles.trailCardSource}>
              {entry.source.toUpperCase()} · {new Date(entry.fetchedAt).toLocaleDateString()}
            </Text>
            <Pressable onPress={onAction} style={styles.trailActionButton}>
              <Text style={styles.trailActionButtonText}>{actionLabel}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </GlassCard>
  );
}

function TrailMeta({ icon, value }: { icon: string; value: string }) {
  return (
    <View style={styles.trailMetaPill}>
      <MaterialSymbol name={icon} size={13} color={TR_ACCENT_LIGHT} />
      <Text style={styles.trailMetaText}>{value}</Text>
    </View>
  );
}

function MetricPill({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metricPill}>
      <Text style={styles.metricPillValue}>{value}</Text>
      <Text style={styles.metricPillLabel}>{label}</Text>
    </View>
  );
}

function FilterGroup({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <View style={styles.filterGroup}>
      <Text style={styles.filterGroupLabel}>{label}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRail}>
        {children}
      </ScrollView>
    </View>
  );
}

function FilterChip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={[styles.filterChip, active ? styles.filterChipActive : null]}>
      <Text style={[styles.filterChipText, active ? styles.filterChipTextActive : null]}>{label}</Text>
    </Pressable>
  );
}

function matchesDistanceFilter(entry: TrailDatabaseEntry, distance: DistanceFilter): boolean {
  if (distance === 'all') {
    return true;
  }

  const value = entry.distanceMeters ?? 0;

  switch (distance) {
    case 'short':
      return value > 0 && value < 5_000;
    case 'medium':
      return value >= 5_000 && value < 12_000;
    case 'long':
      return value >= 12_000;
    default:
      return true;
  }
}

function buildMapPins(entries: TrailDatabaseEntry[]) {
  if (entries.length === 0) {
    return [];
  }

  const latitudes = entries.map((entry) => entry.lat);
  const longitudes = entries.map((entry) => entry.lng);
  const minLat = Math.min(...latitudes);
  const maxLat = Math.max(...latitudes);
  const minLng = Math.min(...longitudes);
  const maxLng = Math.max(...longitudes);

  return entries.slice(0, 10).map((entry) => ({
    id: entry.id,
    x: normalizeCoordinate(entry.lng, minLng, maxLng, 12, 84),
    y: normalizeCoordinate(entry.lat, minLat, maxLat, 16, 78, true),
  }));
}

function normalizeCoordinate(
  value: number,
  min: number,
  max: number,
  start: number,
  end: number,
  invert = false,
) {
  if (min === max) {
    return (start + end) / 2;
  }

  const ratio = (value - min) / (max - min);
  const normalized = invert ? 1 - ratio : ratio;
  return start + normalized * (end - start);
}

function toEntryKey(name: string, region: string | null | undefined) {
  return `${name.trim().toLowerCase()}::${region?.trim().toLowerCase() ?? ''}`;
}

function formatActivityLabel(type: TrailType) {
  switch (type) {
    case 'hiking':
      return 'Hike';
    case 'running':
      return 'Run';
    case 'cycling':
      return 'Ride';
    case 'multi_use':
      return 'Mixed';
    default:
      return 'Trail';
  }
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: TR_SURFACES.lowest,
  },
  scrollContent: {
    paddingBottom: spacing.xxl + 8,
  },
  contentBlock: {
    paddingHorizontal: spacing.md,
  },
  headerCard: {
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
    gap: 14,
  },
  headerEyebrow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(132,204,22,0.12)',
  },
  headerEyebrowText: {
    ...TR_TYPOGRAPHY.labelUpper,
    color: TR_ACCENT_LIGHT,
  },
  headerTitle: {
    ...TR_TYPOGRAPHY.displayLg,
    color: TR_TEXT,
  },
  headerBody: {
    ...TR_TYPOGRAPHY.bodyMd,
    color: TR_TEXT_SECONDARY,
    maxWidth: 340,
  },
  metricRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  metricPill: {
    minWidth: 98,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.05)',
    gap: 4,
  },
  metricPillValue: {
    ...TR_TYPOGRAPHY.headlineMd,
    color: TR_ACCENT_LIGHT,
  },
  metricPillLabel: {
    ...TR_TYPOGRAPHY.caption,
    color: TR_TEXT_TERTIARY,
  },
  searchStickyShell: {
    paddingVertical: 8,
    backgroundColor: 'rgba(14,14,19,0.94)',
  },
  searchCard: {
    backgroundColor: 'rgba(19,19,24,0.82)',
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  searchInput: {
    flex: 1,
    color: TR_TEXT,
    fontFamily: TR_TYPOGRAPHY.bodyMd.fontFamily,
    fontSize: 16,
    paddingVertical: 6,
  },
  searchMetaRow: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  searchMetaText: {
    ...TR_TYPOGRAPHY.caption,
    color: TR_TEXT_TERTIARY,
    flex: 1,
  },
  searchResetText: {
    ...TR_TYPOGRAPHY.labelUpper,
    color: TR_ACCENT_LIGHT,
  },
  section: {
    marginTop: spacing.lg,
    gap: 12,
  },
  sectionBody: {
    ...TR_TYPOGRAPHY.bodyMd,
    color: TR_TEXT_SECONDARY,
  },
  mapHeroCard: {
    marginTop: spacing.sm,
    minHeight: 244,
    overflow: 'hidden',
  },
  mapHeroCanvas: {
    height: 140,
    position: 'relative',
  },
  mapHeatSpot: {
    position: 'absolute',
    width: 56,
    height: 56,
    marginLeft: -28,
    marginTop: -28,
    borderRadius: 999,
    backgroundColor: TR_ACCENT_GLOW,
    opacity: 0.16,
  },
  mapPinShell: {
    position: 'absolute',
    width: 18,
    height: 18,
    marginLeft: -9,
    marginTop: -9,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(19,19,24,0.92)',
  },
  mapPinCore: {
    width: 8,
    height: 8,
    borderRadius: 999,
    backgroundColor: TR_ACCENT_LIGHT,
  },
  mapHeroTop: {
    position: 'absolute',
    top: 14,
    left: 14,
    right: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  mapHeroBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(19,19,24,0.78)',
  },
  mapHeroBadgeText: {
    ...TR_TYPOGRAPHY.labelUpper,
    color: TR_TEXT,
  },
  mapHeroButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: TR_ACCENT,
    ...TR_LIME_GLOW_STYLE,
  },
  mapHeroButtonText: {
    ...TR_TYPOGRAPHY.labelUpper,
    color: TR_ON_ACCENT,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
    backgroundColor: TR_ACCENT_LIGHT,
  },
  mapHeroFooter: {
    paddingHorizontal: 18,
    paddingBottom: 18,
    gap: 8,
  },
  mapHeroEyebrow: {
    ...TR_TYPOGRAPHY.labelUpper,
    color: TR_TEXT_TERTIARY,
  },
  mapHeroTitle: {
    ...TR_TYPOGRAPHY.headlineMd,
    color: TR_TEXT,
  },
  mapHeroBody: {
    ...TR_TYPOGRAPHY.bodyMd,
    color: TR_TEXT_SECONDARY,
  },
  filterGroup: {
    gap: 8,
  },
  filterGroupLabel: {
    ...TR_TYPOGRAPHY.labelUpper,
    color: TR_TEXT_TERTIARY,
  },
  filterRail: {
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  filterChipActive: {
    backgroundColor: TR_ACCENT,
  },
  filterChipText: {
    ...TR_TYPOGRAPHY.caption,
    color: TR_TEXT_SECONDARY,
  },
  filterChipTextActive: {
    color: TR_ON_ACCENT,
    fontFamily: TR_TYPOGRAPHY.titleMd.fontFamily,
  },
  emptyCard: {
    alignItems: 'center',
    paddingVertical: 24,
    gap: 10,
  },
  emptyIcon: {
    fontSize: 32,
  },
  emptyTitle: {
    ...TR_TYPOGRAPHY.headlineMd,
    color: TR_TEXT,
  },
  emptyBody: {
    ...TR_TYPOGRAPHY.bodyMd,
    color: TR_TEXT_SECONDARY,
    textAlign: 'center',
  },
  horizontalRail: {
    gap: 12,
    paddingRight: 8,
  },
  regionCard: {
    width: 232,
    minHeight: 158,
    justifyContent: 'space-between',
    overflow: 'hidden',
  },
  regionCardActive: {
    backgroundColor: 'rgba(132,204,22,0.12)',
  },
  regionTitle: {
    ...TR_TYPOGRAPHY.headlineMd,
    color: TR_TEXT,
  },
  regionMeta: {
    ...TR_TYPOGRAPHY.bodyMd,
    color: TR_TEXT_SECONDARY,
    marginTop: 8,
  },
  regionFooter: {
    marginTop: 18,
    gap: 8,
  },
  regionFooterText: {
    ...TR_TYPOGRAPHY.caption,
    color: TR_TEXT_TERTIARY,
  },
  collectionCard: {
    width: 236,
    minHeight: 156,
    justifyContent: 'space-between',
    overflow: 'hidden',
  },
  collectionCardActive: {
    backgroundColor: 'rgba(132,204,22,0.14)',
  },
  collectionTitle: {
    ...TR_TYPOGRAPHY.headlineMd,
    color: TR_TEXT,
  },
  collectionBody: {
    ...TR_TYPOGRAPHY.bodyMd,
    color: TR_TEXT_SECONDARY,
    marginTop: 10,
  },
  collectionCount: {
    ...TR_TYPOGRAPHY.caption,
    color: TR_ACCENT_LIGHT,
    marginTop: 18,
  },
  collectionSpotlight: {
    marginTop: 10,
    gap: 12,
  },
  cardStack: {
    gap: 12,
  },
  trailCard: {
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  trailCardHeader: {
    flexDirection: 'row',
    gap: 14,
  },
  trailCardThumb: {
    width: 84,
    minHeight: 84,
    borderRadius: TR_CARD_RADIUS - 2,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  trailCardBody: {
    flex: 1,
    gap: 10,
  },
  trailCardTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  trailCardTitleBlock: {
    flex: 1,
    gap: 3,
  },
  trailCardEyebrow: {
    ...TR_TYPOGRAPHY.labelUpper,
    color: TR_ACCENT_LIGHT,
  },
  trailCardTitle: {
    ...TR_TYPOGRAPHY.titleMd,
    color: TR_TEXT,
  },
  trailCardRegion: {
    ...TR_TYPOGRAPHY.caption,
    color: TR_TEXT_SECONDARY,
  },
  trailStatRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  trailMetaPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(19,19,24,0.82)',
  },
  trailMetaText: {
    ...TR_TYPOGRAPHY.caption,
    color: TR_TEXT_SECONDARY,
  },
  trailCardReason: {
    ...TR_TYPOGRAPHY.bodyMd,
    color: TR_TEXT_SECONDARY,
  },
  trailCardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  trailCardSource: {
    ...TR_TYPOGRAPHY.caption,
    color: TR_TEXT_TERTIARY,
    flex: 1,
  },
  trailActionButton: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 999,
    backgroundColor: withAlpha(TR_ACCENT, 0.18),
  },
  trailActionButtonText: {
    ...TR_TYPOGRAPHY.labelUpper,
    color: TR_ACCENT_LIGHT,
  },
});
