import { useState, useCallback, useMemo } from 'react';
import {
  View,
  FlatList,
  Pressable,
  StyleSheet,
  TextInput,
  Alert,
} from 'react-native';
import { Text } from '@mylife/ui';
import { useFocusEffect, useRouter } from 'expo-router';
import { useDatabase } from '../../components/DatabaseProvider';
import {
  listRestaurants,
  updateRestaurant,
  listTags,
} from '@mylife/dining';
import type { Restaurant, RestaurantFilter } from '@mylife/dining';

const ACCENT = '#DC2626';
const BG = '#0E0E13';
const SURFACE = '#1B1B20';
const TEXT_PRIMARY = '#E4E1E9';
const TEXT_SECONDARY = '#D6C3B5';
const TEXT_TERTIARY = 'rgba(228,225,233,0.35)';
const GLASS = 'rgba(255,255,255,0.03)';
const GLASS_BORDER = 'rgba(255,255,255,0.06)';

const PRICE_LABELS = ['', '$', '$$', '$$$', '$$$$'];

type StatusFilter = 'all' | 'visited' | 'wishlist';
type SortOption = 'created_at' | 'visit_count' | 'average_rating' | 'name';

const SORT_OPTIONS: { key: SortOption; label: string }[] = [
  { key: 'created_at', label: 'Recently Added' },
  { key: 'visit_count', label: 'Most Visited' },
  { key: 'average_rating', label: 'Highest Rated' },
  { key: 'name', label: 'Alphabetical' },
];

function parseCuisines(cuisines: string | null): string[] {
  if (!cuisines) return [];
  try {
    return JSON.parse(cuisines);
  } catch {
    return [cuisines];
  }
}

export default function DiningRestaurantsScreen() {
  const db = useDatabase();
  const router = useRouter();

  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [priceFilter, setPriceFilter] = useState<number | null>(null);
  const [sortBy, setSortBy] = useState<SortOption>('created_at');
  const [tick, setTick] = useState(0);
  const [searchTimer, setSearchTimer] = useState<ReturnType<typeof setTimeout> | null>(null);

  const handleSearchChange = useCallback((text: string) => {
    setSearch(text);
    if (searchTimer) clearTimeout(searchTimer);
    const timer = setTimeout(() => {
      setDebouncedSearch(text);
    }, 300);
    setSearchTimer(timer);
  }, [searchTimer]);

  useFocusEffect(
    useCallback(() => {
      setTick((v) => v + 1);
    }, []),
  );

  const { restaurants } = useMemo(() => {
    const filters: RestaurantFilter = {
      sort_by: sortBy,
      sort_dir: sortBy === 'name' ? 'ASC' : 'DESC',
      limit: 500,
    };
    if (debouncedSearch) filters.search = debouncedSearch;
    if (statusFilter === 'visited') filters.is_visited = 1;
    if (statusFilter === 'wishlist') filters.is_wishlist = 1;
    if (priceFilter) {
      filters.price_tier_min = priceFilter;
      filters.price_tier_max = priceFilter;
    }

    const items = listRestaurants(db, filters);
    const tags = listTags(db, 'cuisine');
    return { restaurants: items, cuisineTags: tags };
  }, [db, debouncedSearch, statusFilter, priceFilter, sortBy, tick]);

  const toggleWishlist = useCallback(
    (restaurant: Restaurant) => {
      updateRestaurant(db, restaurant.id, {
        is_wishlist: restaurant.is_wishlist ? 0 : 1,
      });
      setTick((v) => v + 1);
    },
    [db],
  );

  const handleSort = useCallback(() => {
    const options = SORT_OPTIONS.map((o) => o.label);
    Alert.alert('Sort By', undefined, [
      ...options.map((label, i) => ({
        text: label,
        onPress: () => setSortBy(SORT_OPTIONS[i].key),
      })),
      { text: 'Cancel', style: 'cancel' as const },
    ]);
  }, []);

  const renderRestaurantCard = useCallback(
    ({ item }: { item: Restaurant }) => {
      const cuisines = parseCuisines(item.cuisines);
      return (
        <Pressable
          style={styles.card}
          onPress={() =>
            router.push(`/(dining)/restaurant/${item.id}` as `/${string}`)
          }
        >
          <View style={styles.cardHeader}>
            {/* Color placeholder for photo */}
            <View
              style={[
                styles.thumbnail,
                { backgroundColor: item.photo_id ? ACCENT : '#2A292F' },
              ]}
            >
              <Text style={styles.thumbnailEmoji}>
                {'\uD83C\uDF7D\uFE0F'}
              </Text>
            </View>
            <View style={styles.cardInfo}>
              <Text style={styles.cardName} numberOfLines={1}>
                {item.name}
              </Text>
              {(item.neighborhood || item.city) && (
                <Text style={styles.cardLocation} numberOfLines={1}>
                  {[item.neighborhood, item.city].filter(Boolean).join(', ')}
                </Text>
              )}
              <View style={styles.cardMeta}>
                {item.price_tier && (
                  <Text style={styles.priceBadge}>
                    {PRICE_LABELS[item.price_tier]}
                  </Text>
                )}
                {item.average_rating != null && (
                  <Text style={styles.ratingBadge}>
                    {'★'} {item.average_rating.toFixed(1)}
                  </Text>
                )}
                {item.visit_count > 0 && (
                  <View style={styles.visitBadge}>
                    <Text style={styles.visitBadgeText}>
                      {item.visit_count} visit
                      {item.visit_count !== 1 ? 's' : ''}
                    </Text>
                  </View>
                )}
              </View>
            </View>
            <Pressable
              onPress={() => toggleWishlist(item)}
              hitSlop={12}
              style={styles.heartButton}
            >
              <Text
                style={[
                  styles.heartIcon,
                  item.is_wishlist ? styles.heartActive : null,
                ]}
              >
                {item.is_wishlist ? '\u2764\uFE0F' : '\u2661'}
              </Text>
            </Pressable>
          </View>
          {cuisines.length > 0 && (
            <View style={styles.cuisineRow}>
              {cuisines.slice(0, 3).map((c) => (
                <View key={c} style={styles.cuisineChip}>
                  <Text style={styles.cuisineChipText}>{c}</Text>
                </View>
              ))}
              {cuisines.length > 3 && (
                <Text style={styles.moreChip}>
                  +{cuisines.length - 3}
                </Text>
              )}
            </View>
          )}
        </Pressable>
      );
    },
    [router, toggleWishlist],
  );

  const clearFilters = useCallback(() => {
    setSearch('');
    setDebouncedSearch('');
    setStatusFilter('all');
    setPriceFilter(null);
    setSortBy('created_at');
  }, []);

  const hasActiveFilters =
    debouncedSearch !== '' ||
    statusFilter !== 'all' ||
    priceFilter !== null;

  return (
    <View style={styles.container}>
      {/* Search bar */}
      <View style={styles.searchRow}>
        <View style={styles.searchInputWrap}>
          <Text style={styles.searchIcon}>{'\uD83D\uDD0D'}</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Search restaurants..."
            placeholderTextColor={TEXT_TERTIARY}
            value={search}
            onChangeText={handleSearchChange}
            autoCorrect={false}
            returnKeyType="search"
          />
          {search.length > 0 && (
            <Pressable
              onPress={() => {
                setSearch('');
                setDebouncedSearch('');
              }}
              hitSlop={8}
            >
              <Text style={styles.clearIcon}>{'\u2715'}</Text>
            </Pressable>
          )}
        </View>
      </View>

      {/* Filter pills */}
      <View style={styles.filterRow}>
        {/* Status pills */}
        {(['all', 'visited', 'wishlist'] as StatusFilter[]).map((s) => (
          <Pressable
            key={s}
            style={[
              styles.filterPill,
              statusFilter === s && styles.filterPillActive,
            ]}
            onPress={() => setStatusFilter(s)}
          >
            <Text
              style={[
                styles.filterPillText,
                statusFilter === s && styles.filterPillTextActive,
              ]}
            >
              {s === 'all' ? 'All' : s === 'visited' ? 'Visited' : 'Wishlist'}
            </Text>
          </Pressable>
        ))}

        {/* Price pills */}
        {[1, 2, 3, 4].map((p) => (
          <Pressable
            key={p}
            style={[
              styles.filterPill,
              priceFilter === p && styles.filterPillActive,
            ]}
            onPress={() => setPriceFilter(priceFilter === p ? null : p)}
          >
            <Text
              style={[
                styles.filterPillText,
                priceFilter === p && styles.filterPillTextActive,
              ]}
            >
              {PRICE_LABELS[p]}
            </Text>
          </Pressable>
        ))}

        {/* Sort button */}
        <Pressable style={styles.sortButton} onPress={handleSort}>
          <Text style={styles.sortButtonText}>
            {'\u2195'}{' '}
            {SORT_OPTIONS.find((o) => o.key === sortBy)?.label ?? 'Sort'}
          </Text>
        </Pressable>
      </View>

      {/* Restaurant list */}
      <FlatList
        data={restaurants}
        keyExtractor={(item) => item.id}
        renderItem={renderRestaurantCard}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <View style={styles.emptyCard}>
              {hasActiveFilters ? (
                <>
                  <Text style={styles.emptyIcon}>{'\uD83D\uDD0D'}</Text>
                  <Text style={styles.emptyTitle}>No restaurants match</Text>
                  <Text style={styles.emptySubtext}>
                    Adjust your search or filters to find what you are looking
                    for.
                  </Text>
                  <Pressable style={styles.resetButton} onPress={clearFilters}>
                    <Text style={styles.resetButtonText}>Reset Filters</Text>
                  </Pressable>
                </>
              ) : (
                <>
                  <Text style={styles.emptyIcon}>
                    {'\uD83C\uDF7D\uFE0F'}
                  </Text>
                  <Text style={styles.emptyTitle}>
                    Your restaurant journal
                  </Text>
                  <Text style={styles.emptySubtext}>
                    Track your favorite spots, log visits, and remember every
                    great meal.
                  </Text>
                  <Pressable
                    style={styles.addButton}
                    onPress={() =>
                      router.push(
                        '/(dining)/restaurant/add' as `/${string}`,
                      )
                    }
                  >
                    <Text style={styles.addButtonText}>
                      Add your first restaurant
                    </Text>
                  </Pressable>
                </>
              )}
            </View>
          </View>
        }
      />

      {/* FAB */}
      {restaurants.length > 0 && (
        <Pressable
          style={styles.fab}
          onPress={() =>
            router.push('/(dining)/restaurant/add' as `/${string}`)
          }
        >
          <Text style={styles.fabText}>+</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BG,
  },
  searchRow: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },
  searchInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: SURFACE,
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 44,
    gap: 8,
  },
  searchIcon: {
    fontSize: 16,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: TEXT_PRIMARY,
    padding: 0,
  },
  clearIcon: {
    fontSize: 14,
    color: TEXT_SECONDARY,
  },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    paddingBottom: 12,
    gap: 8,
  },
  filterPill: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: GLASS,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
  },
  filterPillActive: {
    backgroundColor: ACCENT,
    borderColor: ACCENT,
  },
  filterPillText: {
    fontSize: 13,
    fontWeight: '600',
    color: TEXT_SECONDARY,
  },
  filterPillTextActive: {
    color: '#FFFFFF',
  },
  sortButton: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: GLASS,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
    marginLeft: 'auto',
  },
  sortButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: TEXT_SECONDARY,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 100,
    gap: 12,
  },
  card: {
    backgroundColor: GLASS,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
    padding: 14,
    gap: 10,
  },
  cardHeader: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
  },
  thumbnail: {
    width: 56,
    height: 56,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbnailEmoji: {
    fontSize: 24,
  },
  cardInfo: {
    flex: 1,
    gap: 3,
  },
  cardName: {
    fontSize: 16,
    fontWeight: '700',
    color: TEXT_PRIMARY,
  },
  cardLocation: {
    fontSize: 13,
    color: TEXT_SECONDARY,
  },
  cardMeta: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    marginTop: 4,
  },
  priceBadge: {
    fontSize: 13,
    fontWeight: '600',
    color: ACCENT,
  },
  ratingBadge: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFB877',
  },
  visitBadge: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
  },
  visitBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: TEXT_SECONDARY,
  },
  heartButton: {
    padding: 4,
  },
  heartIcon: {
    fontSize: 20,
    color: TEXT_TERTIARY,
  },
  heartActive: {
    color: ACCENT,
  },
  cuisineRow: {
    flexDirection: 'row',
    gap: 6,
    flexWrap: 'wrap',
  },
  cuisineChip: {
    backgroundColor: 'rgba(220,38,38,0.12)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  cuisineChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: ACCENT,
  },
  moreChip: {
    fontSize: 12,
    fontWeight: '600',
    color: TEXT_TERTIARY,
    alignSelf: 'center',
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 80,
  },
  emptyCard: {
    alignItems: 'center',
    padding: 32,
    borderRadius: 20,
    backgroundColor: GLASS,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
    gap: 12,
    maxWidth: 340,
    width: '100%',
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 4,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: TEXT_PRIMARY,
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: 14,
    color: TEXT_SECONDARY,
    textAlign: 'center',
    lineHeight: 20,
  },
  resetButton: {
    marginTop: 8,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
  },
  resetButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: TEXT_PRIMARY,
  },
  addButton: {
    marginTop: 8,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: ACCENT,
  },
  addButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: ACCENT,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  fabText: {
    fontSize: 28,
    fontWeight: '300',
    color: '#FFFFFF',
    lineHeight: 30,
  },
});
