import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import {
  GlassCard,
  MaterialSymbol,
  SectionHeader,
  TR_ACCENT,
  TR_ACCENT_LIGHT,
  TR_SURFACES,
  TR_TEXT,
  TR_TEXT_SECONDARY,
  TR_TEXT_TERTIARY,
  TR_TYPOGRAPHY,
  TrailCard,
  withAlpha,
  type TrailDifficulty,
} from '@mylife/trails';
import { useDatabase } from '../../../components/DatabaseProvider';
import {
  buildTrailModels,
  filterTrailModels,
  getRecentlyCompletedTrailModels,
  getSavedTrailModels,
  type TrailSortMode,
  type TrailTypeFilter,
  type TrailCardModel,
} from '../phase1-data';

const DIFFICULTY_FILTERS: Array<TrailDifficulty | 'all'> = [
  'all',
  'easy',
  'moderate',
  'hard',
  'expert',
];
const TYPE_FILTERS: TrailTypeFilter[] = ['all', 'loop', 'out_and_back', 'point_to_point'];
const SORT_OPTIONS: TrailSortMode[] = ['recommended', 'distance', 'elevation', 'rating'];
const DISTANCE_OPTIONS = [10, 25, 50] as const;

export default function TrailsExplorerScreen() {
  const db = useDatabase();
  const router = useRouter();
  const [tick, setTick] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [difficulty, setDifficulty] = useState<TrailDifficulty | 'all'>('all');
  const [trailType, setTrailType] = useState<TrailTypeFilter>('all');
  const [sortMode, setSortMode] = useState<TrailSortMode>('recommended');
  const [maxDistanceMiles, setMaxDistanceMiles] = useState<(typeof DISTANCE_OPTIONS)[number]>(50);
  const [visibleCount, setVisibleCount] = useState(8);

  useFocusEffect(
    useCallback(() => {
      setTick((value) => value + 1);
    }, []),
  );

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchInput);
    }, 200);

    return () => clearTimeout(timer);
  }, [searchInput]);

  const trailModels = useMemo(() => {
    try {
      return buildTrailModels(db);
    } catch (error) {
      console.error('[MyTrails] failed to build trails tab', error);
      return [];
    }
  }, [db, tick]);

  const filteredTrails = useMemo(
    () =>
      filterTrailModels(trailModels, {
        search: debouncedSearch,
        difficulty,
        trailType,
        maxDistanceMiles,
        sort: sortMode,
      }),
    [trailModels, debouncedSearch, difficulty, trailType, maxDistanceMiles, sortMode],
  );

  const featuredTrails = useMemo(() => trailModels.slice(0, 5), [trailModels]);
  const savedTrails = useMemo(() => getSavedTrailModels(trailModels, 6), [trailModels]);
  const completedTrails = useMemo(
    () => getRecentlyCompletedTrailModels(trailModels, 6),
    [trailModels],
  );

  useEffect(() => {
    setVisibleCount(8);
  }, [debouncedSearch, difficulty, trailType, sortMode, maxDistanceMiles]);

  const visibleTrails = filteredTrails.slice(0, visibleCount);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    setTick((value) => value + 1);
    setTimeout(() => setRefreshing(false), 250);
  }, []);

  const handleLoadMore = useCallback(() => {
    if (visibleCount < filteredTrails.length) {
      setVisibleCount((count) => count + 6);
    }
  }, [filteredTrails.length, visibleCount]);

  return (
    <FlatList
      data={visibleTrails}
      keyExtractor={(item) => item.id}
      numColumns={2}
      style={styles.screen}
      contentContainerStyle={styles.content}
      columnWrapperStyle={styles.columnWrapper}
      renderItem={({ item }) => (
        <View style={styles.gridCell}>
          <TrailGridCell
            trail={item}
            onPress={() => router.push(`/(trails)/trail/${item.id}` as `/${string}`)}
          />
        </View>
      )}
      ListHeaderComponent={
        <View style={styles.headerStack}>
          <View style={styles.heroCopy}>
            <Text style={styles.eyebrow}>Discover</Text>
            <Text style={styles.title}>Explore Trails</Text>
            <Text style={styles.subtitle}>
              Featured routes, fast filters, and saved favorites tuned for the MyTrails field map.
            </Text>
          </View>

          <View style={styles.searchShell}>
            <MaterialSymbol name="search" size={18} color={TR_TEXT_TERTIARY} />
            <TextInput
              value={searchInput}
              onChangeText={setSearchInput}
              placeholder="Search trails..."
              placeholderTextColor={TR_TEXT_TERTIARY}
              style={styles.searchInput}
            />
            <Pressable onPress={() => router.push('/(trails)/discover')} style={styles.searchAction}>
              <MaterialSymbol name="map" size={18} color={TR_ACCENT_LIGHT} />
            </Pressable>
          </View>

          {featuredTrails.length > 0 ? (
            <View style={styles.sectionBlock}>
              <SectionHeader
                title="Featured Trails"
                action={{
                  label: 'Discover',
                  onPress: () => router.push('/(trails)/discover'),
                }}
              />
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.featuredRail}
              >
                {featuredTrails.map((trail) => (
                  <View key={trail.id} style={styles.featuredCard}>
                    <TrailCard
                      trail={{
                        ...trail,
                        lastExploredLabel: trail.region ?? 'Featured',
                        liveGps: false,
                      }}
                      variant="hero"
                      onPress={() => router.push(`/(trails)/trail/${trail.id}` as `/${string}`)}
                    />
                  </View>
                ))}
              </ScrollView>
            </View>
          ) : null}

          <View style={styles.filtersBlock}>
            <FilterRail
              label="Difficulty"
              values={DIFFICULTY_FILTERS}
              activeValue={difficulty}
              renderLabel={(value) =>
                value === 'all' ? 'All' : value.charAt(0).toUpperCase() + value.slice(1)
              }
              onPress={(value) => setDifficulty(value as TrailDifficulty | 'all')}
            />
            <FilterRail
              label="Type"
              values={TYPE_FILTERS}
              activeValue={trailType}
              renderLabel={(value) =>
                value === 'all'
                  ? 'All'
                  : value === 'out_and_back'
                    ? 'Out & Back'
                    : value === 'point_to_point'
                      ? 'Point to Point'
                      : 'Loop'
              }
              onPress={(value) => setTrailType(value as TrailTypeFilter)}
            />
            <FilterRail
              label="Sort"
              values={SORT_OPTIONS}
              activeValue={sortMode}
              renderLabel={(value) =>
                value.charAt(0).toUpperCase() + value.slice(1)
              }
              onPress={(value) => setSortMode(value as TrailSortMode)}
            />

            <View style={styles.distanceRow}>
              <Text style={styles.filterLabel}>Distance</Text>
              <View style={styles.distanceChips}>
                {DISTANCE_OPTIONS.map((value) => (
                  <FilterChip
                    key={value}
                    label={value === 50 ? 'Any' : `≤ ${value} mi`}
                    active={maxDistanceMiles === value}
                    onPress={() => setMaxDistanceMiles(value)}
                  />
                ))}
              </View>
            </View>
          </View>

          <View style={styles.sectionBlock}>
            <SectionHeader title="Trail Grid" />
            <Text style={styles.gridMeta}>
              {filteredTrails.length} trail{filteredTrails.length === 1 ? '' : 's'} matched
            </Text>
          </View>
        </View>
      }
      ListEmptyComponent={
        <GlassCard style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>No trails match those filters</Text>
          <Text style={styles.emptyBody}>
            Broaden the distance radius, reset difficulty, or jump into the full discover map.
          </Text>
          <Pressable onPress={() => router.push('/(trails)/discover')} style={styles.inlineButton}>
            <Text style={styles.inlineButtonCopy}>Open Discover</Text>
          </Pressable>
        </GlassCard>
      }
      ListFooterComponent={
        <View style={styles.footerStack}>
          {savedTrails.length > 0 ? (
            <View style={styles.sectionBlock}>
              <SectionHeader
                title="Saved"
                action={{
                  label: 'View All',
                  onPress: () => router.push('/(trails)/discover'),
                }}
              />
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.savedRail}
              >
                {savedTrails.map((trail) => (
                  <View key={trail.id} style={styles.savedCard}>
                    <TrailCard
                      trail={trail}
                      variant="row"
                      onPress={() => router.push(`/(trails)/trail/${trail.id}` as `/${string}`)}
                    />
                  </View>
                ))}
              </ScrollView>
            </View>
          ) : null}

          {completedTrails.length > 0 ? (
            <View style={styles.sectionBlock}>
              <SectionHeader title="Recently Completed" />
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.savedRail}
              >
                {completedTrails.map((trail) => (
                  <View key={trail.id} style={styles.savedCard}>
                    <TrailCard
                      trail={trail}
                      variant="row"
                      onPress={() => router.push(`/(trails)/trail/${trail.id}` as `/${string}`)}
                    />
                  </View>
                ))}
              </ScrollView>
            </View>
          ) : null}
        </View>
      }
      onEndReached={handleLoadMore}
      onEndReachedThreshold={0.35}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={handleRefresh}
          tintColor={TR_ACCENT}
        />
      }
    />
  );
}

function TrailGridCell({
  trail,
  onPress,
}: {
  trail: TrailCardModel;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={styles.gridCardShell}>
      <TrailCard trail={trail} />
      <View style={styles.gridCardFooter}>
        <View style={styles.gridMetaRow}>
          <MaterialSymbol name="star" size={14} color={TR_ACCENT_LIGHT} filled />
          <Text style={styles.gridMetaText}>
            {trail.rating ? trail.rating.toFixed(1) : 'New'} {trail.reviewCount ? `(${trail.reviewCount})` : ''}
          </Text>
        </View>
        <Text style={styles.gridMetaText}>
          {trail.trailType === 'out_and_back'
            ? 'Out & Back'
            : trail.trailType === 'point_to_point'
              ? 'Point to Point'
              : 'Loop'}
        </Text>
      </View>
    </Pressable>
  );
}

function FilterRail<T extends string>({
  label,
  values,
  activeValue,
  renderLabel,
  onPress,
}: {
  label: string;
  values: readonly T[];
  activeValue: T;
  renderLabel: (value: T) => string;
  onPress: (value: T) => void;
}) {
  return (
    <View style={styles.filterRail}>
      <Text style={styles.filterLabel}>{label}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={styles.filterRailContent}>
          {values.map((value) => (
            <FilterChip
              key={value}
              label={renderLabel(value)}
              active={activeValue === value}
              onPress={() => onPress(value)}
            />
          ))}
        </View>
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
    <Pressable
      onPress={onPress}
      style={[
        styles.filterChip,
        active ? styles.filterChipActive : null,
      ]}
    >
      <Text
        style={[
          styles.filterChipCopy,
          {
            color: active ? '#102108' : TR_TEXT_SECONDARY,
          },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: TR_SURFACES.base,
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 140,
    gap: 18,
  },
  headerStack: {
    gap: 18,
  },
  heroCopy: {
    gap: 6,
  },
  eyebrow: {
    ...TR_TYPOGRAPHY.labelUpper,
    color: TR_ACCENT_LIGHT,
  },
  title: {
    ...TR_TYPOGRAPHY.displayLg,
    color: TR_TEXT,
    fontSize: 34,
  },
  subtitle: {
    ...TR_TYPOGRAPHY.bodyMd,
    color: TR_TEXT_SECONDARY,
    maxWidth: 320,
  },
  searchShell: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 999,
    backgroundColor: TR_SURFACES.high,
  },
  searchInput: {
    flex: 1,
    color: TR_TEXT,
    fontFamily: TR_TYPOGRAPHY.bodyMd.fontFamily,
    fontSize: 15,
    paddingVertical: 0,
  },
  searchAction: {
    width: 30,
    height: 30,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: withAlpha(TR_ACCENT_LIGHT, 0.14),
  },
  featuredRail: {
    gap: 12,
    paddingRight: 16,
  },
  featuredCard: {
    width: 298,
  },
  filtersBlock: {
    gap: 12,
  },
  filterRail: {
    gap: 8,
  },
  filterRailContent: {
    flexDirection: 'row',
    gap: 8,
    paddingRight: 16,
  },
  filterLabel: {
    ...TR_TYPOGRAPHY.labelUpper,
    color: TR_TEXT_TERTIARY,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 999,
    backgroundColor: TR_SURFACES.high,
  },
  filterChipActive: {
    backgroundColor: TR_ACCENT_LIGHT,
  },
  filterChipCopy: {
    ...TR_TYPOGRAPHY.labelUpper,
  },
  distanceRow: {
    gap: 8,
  },
  distanceChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  sectionBlock: {
    gap: 10,
  },
  gridMeta: {
    ...TR_TYPOGRAPHY.bodyMd,
    color: TR_TEXT_TERTIARY,
  },
  columnWrapper: {
    gap: 12,
  },
  gridCell: {
    flex: 1,
    marginBottom: 16,
  },
  gridCardShell: {
    gap: 8,
  },
  gridCardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    paddingHorizontal: 4,
  },
  gridMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  gridMetaText: {
    ...TR_TYPOGRAPHY.caption,
    color: TR_TEXT_SECONDARY,
  },
  emptyCard: {
    gap: 10,
    marginTop: 6,
  },
  emptyTitle: {
    ...TR_TYPOGRAPHY.titleMd,
    color: TR_TEXT,
  },
  emptyBody: {
    ...TR_TYPOGRAPHY.bodyMd,
    color: TR_TEXT_TERTIARY,
  },
  inlineButton: {
    alignSelf: 'flex-start',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: withAlpha(TR_ACCENT_LIGHT, 0.16),
  },
  inlineButtonCopy: {
    ...TR_TYPOGRAPHY.labelUpper,
    color: TR_ACCENT_LIGHT,
  },
  footerStack: {
    gap: 18,
  },
  savedRail: {
    gap: 12,
    paddingRight: 16,
  },
  savedCard: {
    width: 280,
  },
});
