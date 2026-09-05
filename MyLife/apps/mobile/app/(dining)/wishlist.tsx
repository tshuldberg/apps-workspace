import { useState, useCallback, useMemo } from 'react';
import {
  View,
  FlatList,
  Pressable,
  StyleSheet,
  Modal,
  TextInput,
  ScrollView,
  Alert,
} from 'react-native';
import { Text } from '@mylife/ui';
import { useFocusEffect, useRouter } from 'expo-router';
import { useDatabase } from '../../components/DatabaseProvider';
import {
  listRestaurants,
  updateRestaurant,
  createWatchlistEntry,
  listWatchlistEntries,
  deleteWatchlistEntry,
  fulfillWatchlistEntry,
  expireStaleEntries,
} from '@mylife/dining';
import type { Restaurant, WatchlistEntryWithRestaurant } from '@mylife/dining';

const ACCENT = '#DC2626';
const BG = '#0E0E13';
const SURFACE = '#1B1B20';
const TEXT_PRIMARY = '#E4E1E9';
const TEXT_SECONDARY = '#D6C3B5';
const TEXT_TERTIARY = 'rgba(228,225,233,0.35)';
const GLASS = 'rgba(255,255,255,0.03)';
const GLASS_BORDER = 'rgba(255,255,255,0.06)';

const PRICE_LABELS = ['', '$', '$$', '$$$', '$$$$'];

type ActiveTab = 'wishlist' | 'watchlist';
type WishlistSort = 'created_at' | 'name' | 'neighborhood';

function parseCuisines(cuisines: string | null): string[] {
  if (!cuisines) return [];
  try {
    return JSON.parse(cuisines);
  } catch {
    return [cuisines];
  }
}

function genId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

export default function DiningWishlistScreen() {
  const db = useDatabase();
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<ActiveTab>('wishlist');
  const [sortBy, setSortBy] = useState<WishlistSort>('created_at');
  const [tick, setTick] = useState(0);
  const [showAddModal, setShowAddModal] = useState(false);

  // Watchlist form state
  const [selectedRestaurantId, setSelectedRestaurantId] = useState<string | null>(null);
  const [partySize, setPartySize] = useState(2);
  const [dateStart, setDateStart] = useState('');
  const [dateEnd, setDateEnd] = useState('');
  const [watchNotes, setWatchNotes] = useState('');

  useFocusEffect(
    useCallback(() => {
      expireStaleEntries(db);
      setTick((v) => v + 1);
    }, [db]),
  );

  const wishlistRestaurants = useMemo(() => {
    const items = listRestaurants(db, {
      is_wishlist: 1,
      sort_by: sortBy === 'neighborhood' ? 'name' : sortBy,
      sort_dir: sortBy === 'created_at' ? 'DESC' : 'ASC',
      limit: 500,
    });
    if (sortBy === 'neighborhood') {
      return items.sort((a, b) => (a.neighborhood ?? '').localeCompare(b.neighborhood ?? ''));
    }
    return items;
  }, [db, sortBy, tick]);

  const watchlistEntries = useMemo(() => {
    return listWatchlistEntries(db, { status: 'active' });
  }, [db, tick]);

  const removeFromWishlist = useCallback(
    (restaurant: Restaurant) => {
      Alert.alert(
        'Remove from wishlist?',
        `Remove ${restaurant.name} from your wishlist?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Remove',
            style: 'destructive',
            onPress: () => {
              updateRestaurant(db, restaurant.id, { is_wishlist: 0 });
              setTick((v) => v + 1);
            },
          },
        ],
      );
    },
    [db],
  );

  const handleDeleteWatchlist = useCallback(
    (entry: WatchlistEntryWithRestaurant) => {
      Alert.alert('Cancel watchlist entry?', `Stop watching ${entry.restaurant_name}?`, [
        { text: 'Keep', style: 'cancel' },
        {
          text: 'Cancel Entry',
          style: 'destructive',
          onPress: () => {
            deleteWatchlistEntry(db, entry.id);
            setTick((v) => v + 1);
          },
        },
      ]);
    },
    [db],
  );

  const handleFulfill = useCallback(
    (entry: WatchlistEntryWithRestaurant) => {
      fulfillWatchlistEntry(db, entry.id);
      setTick((v) => v + 1);
    },
    [db],
  );

  const handleSaveWatchlist = useCallback(() => {
    if (!selectedRestaurantId) return;
    createWatchlistEntry(db, genId(), {
      restaurant_id: selectedRestaurantId,
      party_size: partySize,
      date_range_start: dateStart || null,
      date_range_end: dateEnd || null,
      notes: watchNotes || null,
    });
    setShowAddModal(false);
    setSelectedRestaurantId(null);
    setPartySize(2);
    setDateStart('');
    setDateEnd('');
    setWatchNotes('');
    setTick((v) => v + 1);
  }, [db, selectedRestaurantId, partySize, dateStart, dateEnd, watchNotes]);

  const handleSort = useCallback(() => {
    const options: { label: string; key: WishlistSort }[] = [
      { label: 'Recently Added', key: 'created_at' },
      { label: 'Alphabetical', key: 'name' },
      { label: 'Neighborhood', key: 'neighborhood' },
    ];
    Alert.alert('Sort By', undefined, [
      ...options.map((o) => ({
        text: o.label,
        onPress: () => setSortBy(o.key),
      })),
      { text: 'Cancel', style: 'cancel' as const },
    ]);
  }, []);

  const renderWishlistCard = useCallback(
    ({ item }: { item: Restaurant }) => {
      const cuisines = parseCuisines(item.cuisines);
      return (
        <Pressable
          style={styles.card}
          onPress={() => router.push(`/(dining)/restaurant/${item.id}` as `/${string}`)}
        >
          <View style={styles.cardHeader}>
            <View style={[styles.thumbnail, { backgroundColor: '#2A292F' }]}>
              <Text style={styles.thumbnailEmoji}>{'\uD83C\uDF7D\uFE0F'}</Text>
            </View>
            <View style={styles.cardInfo}>
              <Text style={styles.cardName} numberOfLines={1}>{item.name}</Text>
              {(item.neighborhood || item.city) && (
                <Text style={styles.cardLocation} numberOfLines={1}>
                  {[item.neighborhood, item.city].filter(Boolean).join(', ')}
                </Text>
              )}
              <View style={styles.cardMeta}>
                {item.price_tier != null && (
                  <Text style={styles.priceBadge}>{PRICE_LABELS[item.price_tier]}</Text>
                )}
                {cuisines.length > 0 && (
                  <Text style={styles.cuisineText} numberOfLines={1}>
                    {cuisines.slice(0, 2).join(', ')}
                  </Text>
                )}
              </View>
              <View style={styles.cardMeta}>
                {item.visit_count === 0 && (
                  <View style={styles.neverTriedBadge}>
                    <Text style={styles.neverTriedText}>Never tried</Text>
                  </View>
                )}
                <Text style={styles.addedDate}>
                  Added {new Date(item.created_at).toLocaleDateString()}
                </Text>
              </View>
            </View>
            <Pressable onPress={() => removeFromWishlist(item)} hitSlop={12} style={styles.heartButton}>
              <Text style={styles.heartActive}>{'\u2764\uFE0F'}</Text>
            </Pressable>
          </View>
        </Pressable>
      );
    },
    [router, removeFromWishlist],
  );

  const renderWatchlistCard = useCallback(
    ({ item }: { item: WatchlistEntryWithRestaurant }) => {
      return (
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={[styles.thumbnail, { backgroundColor: ACCENT + '20' }]}>
              <Text style={styles.thumbnailEmoji}>{'\uD83D\uDD14'}</Text>
            </View>
            <View style={styles.cardInfo}>
              <Text style={styles.cardName} numberOfLines={1}>{item.restaurant_name}</Text>
              <Text style={styles.cardLocation}>
                Party of {item.party_size}
              </Text>
              {(item.date_range_start || item.date_range_end) && (
                <Text style={styles.dateRange}>
                  {item.date_range_start ?? '...'} to {item.date_range_end ?? '...'}
                </Text>
              )}
              {item.notes && (
                <Text style={styles.notesPreview} numberOfLines={1}>{item.notes}</Text>
              )}
            </View>
            <View style={styles.watchActions}>
              <Pressable onPress={() => handleFulfill(item)} hitSlop={8} style={styles.fulfillButton}>
                <Text style={styles.fulfillText}>{'\u2713'}</Text>
              </Pressable>
              <Pressable onPress={() => handleDeleteWatchlist(item)} hitSlop={8}>
                <Text style={styles.deleteText}>{'\u2715'}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      );
    },
    [handleFulfill, handleDeleteWatchlist],
  );

  return (
    <View style={styles.container}>
      {/* Segmented control */}
      <View style={styles.segmentedControl}>
        {(['wishlist', 'watchlist'] as ActiveTab[]).map((tab) => (
          <Pressable
            key={tab}
            style={[styles.segment, activeTab === tab && styles.segmentActive]}
            onPress={() => setActiveTab(tab)}
          >
            <Text style={[styles.segmentText, activeTab === tab && styles.segmentTextActive]}>
              {tab === 'wishlist' ? `Wishlist (${wishlistRestaurants.length})` : `Watchlist (${watchlistEntries.length})`}
            </Text>
          </Pressable>
        ))}
      </View>

      {activeTab === 'wishlist' ? (
        <>
          {wishlistRestaurants.length > 0 && (
            <View style={styles.sortRow}>
              <Pressable style={styles.sortButton} onPress={handleSort}>
                <Text style={styles.sortButtonText}>
                  {'\u2195'} {sortBy === 'created_at' ? 'Recently Added' : sortBy === 'name' ? 'A-Z' : 'Neighborhood'}
                </Text>
              </Pressable>
            </View>
          )}
          <FlatList
            data={wishlistRestaurants}
            keyExtractor={(item) => item.id}
            renderItem={renderWishlistCard}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <View style={styles.emptyCard}>
                  <Text style={styles.emptyIcon}>{'\u2B50'}</Text>
                  <Text style={styles.emptyTitle}>Your wishlist is empty</Text>
                  <Text style={styles.emptySubtext}>
                    Save restaurants you want to try. Tap the heart icon on any restaurant to add it here.
                  </Text>
                </View>
              </View>
            }
          />
        </>
      ) : (
        <>
          <FlatList
            data={watchlistEntries}
            keyExtractor={(item) => item.id}
            renderItem={renderWatchlistCard}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <View style={styles.emptyCard}>
                  <Text style={styles.emptyIcon}>{'\uD83D\uDD14'}</Text>
                  <Text style={styles.emptyTitle}>No active watches</Text>
                  <Text style={styles.emptySubtext}>
                    Watch for reservations at your wishlist restaurants. Tap + to start tracking.
                  </Text>
                </View>
              </View>
            }
          />
          <Pressable style={styles.fab} onPress={() => setShowAddModal(true)}>
            <Text style={styles.fabText}>+</Text>
          </Pressable>
        </>
      )}

      {/* Add watchlist modal */}
      <Modal visible={showAddModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add to Watchlist</Text>
              <Pressable onPress={() => setShowAddModal(false)} hitSlop={12}>
                <Text style={styles.modalClose}>{'\u2715'}</Text>
              </Pressable>
            </View>

            <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
              {/* Restaurant picker */}
              <Text style={styles.formLabel}>Restaurant</Text>
              {wishlistRestaurants.length === 0 ? (
                <Text style={styles.formHint}>Add restaurants to your wishlist first</Text>
              ) : (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.restaurantPicker}>
                  {wishlistRestaurants.map((r) => (
                    <Pressable
                      key={r.id}
                      style={[styles.restaurantChip, selectedRestaurantId === r.id && styles.restaurantChipActive]}
                      onPress={() => setSelectedRestaurantId(r.id)}
                    >
                      <Text style={[styles.restaurantChipText, selectedRestaurantId === r.id && styles.restaurantChipTextActive]}>
                        {r.name}
                      </Text>
                    </Pressable>
                  ))}
                </ScrollView>
              )}

              {/* Party size */}
              <Text style={styles.formLabel}>Party Size</Text>
              <View style={styles.stepperRow}>
                <Pressable
                  style={styles.stepperButton}
                  onPress={() => setPartySize(Math.max(1, partySize - 1))}
                >
                  <Text style={styles.stepperText}>-</Text>
                </Pressable>
                <Text style={styles.stepperValue}>{partySize}</Text>
                <Pressable
                  style={styles.stepperButton}
                  onPress={() => setPartySize(Math.min(12, partySize + 1))}
                >
                  <Text style={styles.stepperText}>+</Text>
                </Pressable>
              </View>

              {/* Date range */}
              <Text style={styles.formLabel}>Date Range (optional)</Text>
              <View style={styles.dateRow}>
                <TextInput
                  style={styles.dateInput}
                  placeholder="Start (YYYY-MM-DD)"
                  placeholderTextColor={TEXT_TERTIARY}
                  value={dateStart}
                  onChangeText={setDateStart}
                />
                <Text style={styles.dateSeparator}>to</Text>
                <TextInput
                  style={styles.dateInput}
                  placeholder="End (YYYY-MM-DD)"
                  placeholderTextColor={TEXT_TERTIARY}
                  value={dateEnd}
                  onChangeText={setDateEnd}
                />
              </View>

              {/* Notes */}
              <Text style={styles.formLabel}>Notes (optional)</Text>
              <TextInput
                style={styles.notesInput}
                placeholder="Any special requests or notes..."
                placeholderTextColor={TEXT_TERTIARY}
                value={watchNotes}
                onChangeText={setWatchNotes}
                multiline
                numberOfLines={3}
              />
            </ScrollView>

            <Pressable
              style={[styles.saveButton, !selectedRestaurantId && styles.saveButtonDisabled]}
              onPress={handleSaveWatchlist}
              disabled={!selectedRestaurantId}
            >
              <Text style={styles.saveButtonText}>Save</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  segmentedControl: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 8,
    backgroundColor: SURFACE,
    borderRadius: 12,
    padding: 3,
  },
  segment: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  segmentActive: { backgroundColor: ACCENT },
  segmentText: { fontSize: 14, fontWeight: '600', color: TEXT_SECONDARY },
  segmentTextActive: { color: '#FFFFFF' },
  sortRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  sortButton: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: GLASS,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
  },
  sortButtonText: { fontSize: 13, fontWeight: '600', color: TEXT_SECONDARY },
  listContent: { paddingHorizontal: 16, paddingBottom: 100, gap: 12 },
  card: {
    backgroundColor: GLASS,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
    padding: 14,
  },
  cardHeader: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  thumbnail: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbnailEmoji: { fontSize: 22 },
  cardInfo: { flex: 1, gap: 3 },
  cardName: { fontSize: 16, fontWeight: '700', color: TEXT_PRIMARY },
  cardLocation: { fontSize: 13, color: TEXT_SECONDARY },
  cardMeta: { flexDirection: 'row', gap: 8, alignItems: 'center', marginTop: 2 },
  priceBadge: { fontSize: 13, fontWeight: '600', color: ACCENT },
  cuisineText: { fontSize: 12, color: TEXT_TERTIARY },
  neverTriedBadge: {
    backgroundColor: 'rgba(220,38,38,0.12)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
  },
  neverTriedText: { fontSize: 11, fontWeight: '600', color: ACCENT },
  addedDate: { fontSize: 11, color: TEXT_TERTIARY },
  heartButton: { padding: 4 },
  heartActive: { fontSize: 20, color: ACCENT },
  dateRange: { fontSize: 12, color: TEXT_TERTIARY },
  notesPreview: { fontSize: 12, color: TEXT_TERTIARY, fontStyle: 'italic' },
  watchActions: { gap: 12, alignItems: 'center' },
  fulfillButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(48,209,88,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fulfillText: { fontSize: 16, fontWeight: '700', color: '#30D158' },
  deleteText: { fontSize: 16, color: TEXT_TERTIARY },
  emptyState: { alignItems: 'center', paddingTop: 80 },
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
  emptyIcon: { fontSize: 48, marginBottom: 4 },
  emptyTitle: { fontSize: 20, fontWeight: '700', color: TEXT_PRIMARY, textAlign: 'center' },
  emptySubtext: { fontSize: 14, color: TEXT_SECONDARY, textAlign: 'center', lineHeight: 20 },
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
  fabText: { fontSize: 28, fontWeight: '300', color: '#FFFFFF', lineHeight: 30 },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: SURFACE,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '85%',
    paddingBottom: 40,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 12,
  },
  modalTitle: { fontSize: 20, fontWeight: '700', color: TEXT_PRIMARY },
  modalClose: { fontSize: 18, color: TEXT_SECONDARY },
  modalBody: { paddingHorizontal: 20 },
  formLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: TEXT_SECONDARY,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 16,
    marginBottom: 8,
  },
  formHint: { fontSize: 14, color: TEXT_TERTIARY, fontStyle: 'italic' },
  restaurantPicker: { flexDirection: 'row', marginBottom: 4 },
  restaurantChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: GLASS,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
    marginRight: 8,
  },
  restaurantChipActive: { backgroundColor: ACCENT, borderColor: ACCENT },
  restaurantChipText: { fontSize: 14, fontWeight: '600', color: TEXT_SECONDARY },
  restaurantChipTextActive: { color: '#FFFFFF' },
  stepperRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  stepperButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: GLASS,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperText: { fontSize: 20, fontWeight: '600', color: TEXT_PRIMARY },
  stepperValue: { fontSize: 24, fontWeight: '700', color: TEXT_PRIMARY, minWidth: 32, textAlign: 'center' },
  dateRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dateInput: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    backgroundColor: GLASS,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
    paddingHorizontal: 12,
    fontSize: 14,
    color: TEXT_PRIMARY,
  },
  dateSeparator: { fontSize: 14, color: TEXT_SECONDARY },
  notesInput: {
    minHeight: 80,
    borderRadius: 12,
    backgroundColor: GLASS,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
    paddingHorizontal: 12,
    paddingTop: 12,
    fontSize: 14,
    color: TEXT_PRIMARY,
    textAlignVertical: 'top',
  },
  saveButton: {
    marginHorizontal: 20,
    marginTop: 20,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: ACCENT,
    alignItems: 'center',
  },
  saveButtonDisabled: { opacity: 0.4 },
  saveButtonText: { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },
});
