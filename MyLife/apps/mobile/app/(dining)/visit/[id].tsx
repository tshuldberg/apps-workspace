import { useState, useMemo, useCallback } from 'react';
import {
  View,
  ScrollView,
  Pressable,
  StyleSheet,
  Alert,
} from 'react-native';
import { Text } from '@mylife/ui';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useFocusEffect } from 'expo-router';
import { useDatabase } from '../../../components/DatabaseProvider';
import {
  getVisit,
  deleteVisit,
  getRestaurant,
  listDishesByVisit,
  listWinesByVisit,
} from '@mylife/dining';
import type { Dish, Wine } from '@mylife/dining';

const ACCENT = '#DC2626';
const BG = '#0E0E13';
const SURFACE = '#1B1B20';
const SURFACE_ELEVATED = '#2A292F';
const TEXT_PRIMARY = '#E4E1E9';
const TEXT_SECONDARY = '#D6C3B5';
const TEXT_TERTIARY = 'rgba(228,225,233,0.35)';
const GLASS = 'rgba(255,255,255,0.03)';
const GLASS_BORDER = 'rgba(255,255,255,0.06)';

function Stars({ rating, size = 18 }: { rating: number; size?: number }) {
  return (
    <Text style={{ color: '#FFB877', fontSize: size }}>
      {'\u2605'.repeat(rating)}
      {'\u2606'.repeat(5 - rating)}
    </Text>
  );
}

function RatingRow({ label, rating }: { label: string; rating: number | null }) {
  if (rating == null) return null;
  return (
    <View style={ratingStyles.row}>
      <Text style={ratingStyles.label}>{label}</Text>
      <Stars rating={rating} size={16} />
    </View>
  );
}

const ratingStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: TEXT_SECONDARY,
  },
});

export default function VisitDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const db = useDatabase();
  const router = useRouter();
  const [tick, setTick] = useState(0);

  useFocusEffect(
    useCallback(() => {
      setTick((v) => v + 1);
    }, []),
  );

  const visit = useMemo(() => {
    if (!id) return null;
    return getVisit(db, id);
  }, [db, id, tick]);

  const restaurant = useMemo(() => {
    if (!visit) return null;
    return getRestaurant(db, visit.restaurant_id);
  }, [db, visit]);

  const dishes = useMemo(() => {
    if (!id) return [];
    return listDishesByVisit(db, id);
  }, [db, id, tick]);

  const wines = useMemo(() => {
    if (!id) return [];
    return listWinesByVisit(db, id);
  }, [db, id, tick]);

  if (!visit) {
    return (
      <View style={styles.centered}>
        <Text style={styles.emptyTitle}>Visit not found</Text>
        <Pressable onPress={() => router.back()} style={styles.backLink}>
          <Text style={styles.backLinkText}>Go back</Text>
        </Pressable>
      </View>
    );
  }

  const visitDate = new Date(visit.visited_at);
  const dateLabel = visitDate.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
  const timeLabel = visitDate.toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  });

  const handleDelete = () => {
    Alert.alert(
      'Delete Visit',
      'Are you sure you want to delete this visit? This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            deleteVisit(db, visit.id);
            router.back();
          },
        },
      ],
    );
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {/* Restaurant link */}
      <Pressable
        style={styles.restaurantCard}
        onPress={() => {
          if (restaurant) {
            router.push(`/(dining)/restaurant/${restaurant.id}` as `/${string}`);
          }
        }}
      >
        <View style={styles.restaurantIcon}>
          <Text style={styles.restaurantEmoji}>{'\uD83C\uDF7D\uFE0F'}</Text>
        </View>
        <View style={styles.restaurantInfo}>
          <Text style={styles.restaurantName}>
            {restaurant?.name ?? 'Unknown Restaurant'}
          </Text>
          {restaurant && (restaurant.neighborhood || restaurant.city) && (
            <Text style={styles.restaurantLocation}>
              {[restaurant.neighborhood, restaurant.city]
                .filter(Boolean)
                .join(', ')}
            </Text>
          )}
        </View>
        <Text style={styles.chevron}>{'\u203A'}</Text>
      </Pressable>

      {/* Date & Time */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>DATE</Text>
        <View style={styles.dateCard}>
          <Text style={styles.dateText}>{dateLabel}</Text>
          <Text style={styles.timeText}>{timeLabel}</Text>
        </View>
      </View>

      {/* Ratings */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>RATINGS</Text>
        <View style={styles.ratingsCard}>
          <View style={styles.overallRow}>
            <Text style={styles.overallLabel}>Overall</Text>
            <Stars rating={visit.overall_rating} size={22} />
          </View>
          <RatingRow label="Vibe" rating={visit.vibe_rating} />
          <RatingRow label="Food" rating={visit.food_rating} />
          <RatingRow label="Service" rating={visit.service_rating} />
        </View>
      </View>

      {/* Details */}
      {(visit.party_size || visit.occasion) && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>DETAILS</Text>
          <View style={styles.detailsCard}>
            {visit.party_size && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Party Size</Text>
                <Text style={styles.detailValue}>
                  {visit.party_size} {visit.party_size === 1 ? 'person' : 'people'}
                </Text>
              </View>
            )}
            {visit.occasion && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Occasion</Text>
                <View style={styles.occasionBadge}>
                  <Text style={styles.occasionBadgeText}>{visit.occasion}</Text>
                </View>
              </View>
            )}
          </View>
        </View>
      )}

      {/* Companions */}
      {visit.companions.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>COMPANIONS</Text>
          <View style={styles.companionsRow}>
            {visit.companions.map((c) => (
              <View key={c.id} style={styles.companionChip}>
                <Text style={styles.companionChipText}>{c.display_name}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Notes */}
      {visit.notes_md && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>NOTES</Text>
          <Text style={styles.notesText}>{visit.notes_md}</Text>
        </View>
      )}

      {/* Dishes */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { marginBottom: 0 }]}>DISHES</Text>
          <Pressable
            onPress={() =>
              router.push(
                `/(dining)/dish/add?restaurantId=${visit.restaurant_id}&visitId=${visit.id}` as `/${string}`,
              )
            }
            hitSlop={8}
          >
            <Text style={styles.addLink}>+ Add Dish</Text>
          </Pressable>
        </View>
        {dishes.length === 0 ? (
          <Text style={styles.emptyHint}>No dishes logged</Text>
        ) : (
          <View style={styles.itemList}>
            {dishes.map((d: Dish) => (
              <Pressable
                key={d.id}
                style={styles.itemCard}
                onPress={() =>
                  router.push(`/(dining)/dish/${d.id}` as `/${string}`)
                }
              >
                <View style={styles.itemCardMain}>
                  <Text style={styles.itemName}>{d.name}</Text>
                  {d.rating != null && (
                    <Stars rating={d.rating} size={14} />
                  )}
                </View>
                <View style={styles.itemCardMeta}>
                  {d.course && (
                    <View style={styles.courseBadge}>
                      <Text style={styles.courseBadgeText}>
                        {d.course.charAt(0).toUpperCase() + d.course.slice(1)}
                      </Text>
                    </View>
                  )}
                  {d.price_cents != null && (
                    <Text style={styles.priceText}>
                      ${(d.price_cents / 100).toFixed(2)}
                    </Text>
                  )}
                </View>
              </Pressable>
            ))}
          </View>
        )}
      </View>

      {/* Wines */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { marginBottom: 0 }]}>WINES</Text>
          <Pressable
            onPress={() =>
              router.push(
                `/(dining)/wine/add?restaurantId=${visit.restaurant_id}&visitId=${visit.id}` as `/${string}`,
              )
            }
            hitSlop={8}
          >
            <Text style={styles.addLink}>+ Add Wine</Text>
          </Pressable>
        </View>
        {wines.length === 0 ? (
          <Text style={styles.emptyHint}>No wines logged</Text>
        ) : (
          <View style={styles.itemList}>
            {wines.map((w: Wine) => (
              <Pressable
                key={w.id}
                style={styles.itemCard}
                onPress={() =>
                  router.push(`/(dining)/wine/${w.id}` as `/${string}`)
                }
              >
                <View style={styles.itemCardMain}>
                  <Text style={styles.itemName}>
                    {w.producer} {w.name}
                  </Text>
                  {w.rating != null && (
                    <Stars rating={w.rating} size={14} />
                  )}
                </View>
                <View style={styles.itemCardMeta}>
                  {w.vintage != null && (
                    <View style={styles.vintageBadge}>
                      <Text style={styles.vintageBadgeText}>{w.vintage}</Text>
                    </View>
                  )}
                  {w.color && (
                    <View style={styles.colorChip}>
                      <Text style={styles.colorChipText}>
                        {w.color.charAt(0).toUpperCase() + w.color.slice(1)}
                      </Text>
                    </View>
                  )}
                </View>
              </Pressable>
            ))}
          </View>
        )}
      </View>

      {/* Actions */}
      <View style={styles.actionRow}>
        <Pressable
          style={styles.actionButton}
          onPress={() => {
            try {
              const restName = restaurant?.name ?? 'Unknown';
              router.push(
                `/(nutrition)/add?meal=${encodeURIComponent(restName)}&date=${visit.visited_at}&source=dining` as `/${string}`,
              );
            } catch {
              // Nutrition module may not be available
            }
          }}
        >
          <Text style={styles.actionIcon}>{'\uD83E\uDD57'}</Text>
          <Text style={styles.actionLabel}>Log to Nutrition</Text>
        </Pressable>
        <Pressable
          style={[styles.actionButton, styles.actionDanger]}
          onPress={handleDelete}
        >
          <Text style={styles.actionIcon}>{'\uD83D\uDDD1\uFE0F'}</Text>
          <Text style={[styles.actionLabel, styles.dangerText]}>Delete</Text>
        </Pressable>
      </View>

      {/* Timestamps */}
      <View style={styles.timestampSection}>
        <Text style={styles.timestampText}>
          Logged {new Date(visit.created_at).toLocaleDateString()}
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BG,
  },
  content: {
    paddingBottom: 40,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: BG,
    gap: 12,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: TEXT_PRIMARY,
  },
  backLink: {
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  backLinkText: {
    fontSize: 15,
    color: ACCENT,
    fontWeight: '600',
  },

  // Restaurant card
  restaurantCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 20,
    padding: 16,
    borderRadius: 16,
    backgroundColor: SURFACE,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
  },
  restaurantIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: SURFACE_ELEVATED,
    alignItems: 'center',
    justifyContent: 'center',
  },
  restaurantEmoji: {
    fontSize: 22,
  },
  restaurantInfo: {
    flex: 1,
    gap: 2,
  },
  restaurantName: {
    fontSize: 16,
    fontWeight: '700',
    color: TEXT_PRIMARY,
  },
  restaurantLocation: {
    fontSize: 13,
    color: TEXT_SECONDARY,
  },
  chevron: {
    fontSize: 24,
    color: TEXT_SECONDARY,
    fontWeight: '300',
  },

  // Sections
  section: {
    paddingHorizontal: 16,
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: TEXT_SECONDARY,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginBottom: 12,
  },

  // Date
  dateCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: GLASS,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
    padding: 14,
  },
  dateText: {
    fontSize: 15,
    fontWeight: '600',
    color: TEXT_PRIMARY,
  },
  timeText: {
    fontSize: 15,
    color: TEXT_SECONDARY,
  },

  // Ratings
  ratingsCard: {
    backgroundColor: GLASS,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
    padding: 16,
    gap: 8,
  },
  overallRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: GLASS_BORDER,
    marginBottom: 4,
  },
  overallLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: TEXT_PRIMARY,
  },

  // Details
  detailsCard: {
    backgroundColor: GLASS,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
    padding: 16,
    gap: 12,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  detailLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: TEXT_SECONDARY,
  },
  detailValue: {
    fontSize: 15,
    fontWeight: '600',
    color: TEXT_PRIMARY,
  },
  occasionBadge: {
    backgroundColor: 'rgba(220,38,38,0.12)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 999,
  },
  occasionBadgeText: {
    fontSize: 13,
    fontWeight: '600',
    color: ACCENT,
  },

  // Companions
  companionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  companionChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: 'rgba(220,38,38,0.12)',
  },
  companionChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: TEXT_PRIMARY,
  },

  // Notes
  notesText: {
    fontSize: 15,
    color: TEXT_PRIMARY,
    lineHeight: 22,
  },

  // Section header with inline action
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  addLink: {
    fontSize: 13,
    fontWeight: '600',
    color: ACCENT,
  },
  emptyHint: {
    fontSize: 14,
    color: TEXT_TERTIARY,
    textAlign: 'center',
    paddingVertical: 16,
  },

  // Dish/Wine item list
  itemList: {
    gap: 8,
  },
  itemCard: {
    backgroundColor: GLASS,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
    padding: 14,
    gap: 8,
  },
  itemCardMain: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  itemName: {
    fontSize: 14,
    fontWeight: '600',
    color: TEXT_PRIMARY,
    flex: 1,
    marginRight: 8,
  },
  itemCardMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  courseBadge: {
    backgroundColor: 'rgba(220,38,38,0.12)',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 999,
  },
  courseBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: ACCENT,
  },
  priceText: {
    fontSize: 13,
    fontWeight: '600',
    color: TEXT_SECONDARY,
  },
  vintageBadge: {
    backgroundColor: SURFACE_ELEVATED,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  vintageBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: TEXT_PRIMARY,
  },
  colorChip: {
    backgroundColor: 'rgba(220,38,38,0.12)',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 999,
  },
  colorChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: ACCENT,
  },

  // Actions
  actionRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 8,
    marginBottom: 20,
  },
  actionButton: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: GLASS,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
  },
  actionDanger: {
    borderColor: 'rgba(255,180,171,0.15)',
  },
  actionIcon: {
    fontSize: 18,
  },
  actionLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: TEXT_SECONDARY,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  dangerText: {
    color: '#FFB4AB',
  },

  // Timestamps
  timestampSection: {
    paddingHorizontal: 16,
    gap: 4,
    marginBottom: 20,
  },
  timestampText: {
    fontSize: 12,
    color: TEXT_TERTIARY,
  },
});
