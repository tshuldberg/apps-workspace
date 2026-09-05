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
import { uuid } from '../../../lib/uuid';
import {
  getDish,
  deleteDish,
  createDish,
  getRestaurant,
} from '@mylife/dining';
import type { CreateDishInput } from '@mylife/dining';

const ACCENT = '#DC2626';
const BG = '#0E0E13';
const SURFACE = '#1B1B20';
const SURFACE_ELEVATED = '#2A292F';
const TEXT_PRIMARY = '#E4E1E9';
const TEXT_SECONDARY = '#D6C3B5';
const TEXT_TERTIARY = 'rgba(228,225,233,0.35)';
const GLASS = 'rgba(255,255,255,0.03)';
const GLASS_BORDER = 'rgba(255,255,255,0.06)';
const WARNING_ORANGE = '#FFB877';

function Stars({ rating, size = 18 }: { rating: number; size?: number }) {
  return (
    <Text style={{ color: '#FFB877', fontSize: size }}>
      {'\u2605'.repeat(rating)}
      {'\u2606'.repeat(5 - rating)}
    </Text>
  );
}

function parseAllergens(raw: string | null): string[] {
  if (!raw) return [];
  try {
    return JSON.parse(raw) as string[];
  } catch {
    return [];
  }
}

function courseLabel(course: string | null): string {
  if (!course) return '';
  return course.charAt(0).toUpperCase() + course.slice(1);
}

export default function DishDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const db = useDatabase();
  const router = useRouter();
  const [tick, setTick] = useState(0);

  useFocusEffect(
    useCallback(() => {
      setTick((v) => v + 1);
    }, []),
  );

  const dish = useMemo(() => {
    if (!id) return null;
    return getDish(db, id);
  }, [db, id, tick]);

  const restaurant = useMemo(() => {
    if (!dish) return null;
    return getRestaurant(db, dish.restaurant_id);
  }, [db, dish]);

  if (!dish) {
    return (
      <View style={styles.centered}>
        <Text style={styles.emptyTitle}>Dish not found</Text>
        <Pressable onPress={() => router.back()} style={styles.backLink}>
          <Text style={styles.backLinkText}>Go back</Text>
        </Pressable>
      </View>
    );
  }

  const allergens = parseAllergens(dish.allergens);

  const handleDelete = () => {
    Alert.alert(
      'Delete Dish',
      `Are you sure you want to delete "${dish.name}"? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            deleteDish(db, dish.id);
            router.back();
          },
        },
      ],
    );
  };

  const handleOrderAgain = () => {
    const newId = uuid();
    const input: CreateDishInput = {
      restaurant_id: dish.restaurant_id,
      name: dish.name,
      course: dish.course as CreateDishInput['course'],
      price_cents: dish.price_cents,
      rating: null,
      would_order_again: 0,
      allergens: dish.allergens,
      notes: null,
    };
    createDish(db, newId, input);
    Alert.alert('Ordered Again', `"${dish.name}" has been logged as a new order.`);
    setTick((v) => v + 1);
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {/* Title */}
      <View style={styles.heroSection}>
        <Text style={styles.dishName}>{dish.name}</Text>
        {dish.course && (
          <View style={styles.courseBadge}>
            <Text style={styles.courseBadgeText}>{courseLabel(dish.course)}</Text>
          </View>
        )}
        {dish.rating != null && (
          <Stars rating={dish.rating} size={22} />
        )}
      </View>

      {/* Restaurant link */}
      {restaurant && (
        <Pressable
          style={styles.restaurantCard}
          onPress={() =>
            router.push(`/(dining)/restaurant/${restaurant.id}` as `/${string}`)
          }
        >
          <View style={styles.restaurantIcon}>
            <Text style={styles.restaurantEmoji}>{'\uD83C\uDF7D\uFE0F'}</Text>
          </View>
          <View style={styles.restaurantInfo}>
            <Text style={styles.restaurantName}>{restaurant.name}</Text>
            {(restaurant.neighborhood || restaurant.city) && (
              <Text style={styles.restaurantLocation}>
                {[restaurant.neighborhood, restaurant.city]
                  .filter(Boolean)
                  .join(', ')}
              </Text>
            )}
          </View>
          <Text style={styles.chevron}>{'\u203A'}</Text>
        </Pressable>
      )}

      {/* Details */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>DETAILS</Text>
        <View style={styles.detailsCard}>
          {dish.price_cents != null && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Price</Text>
              <Text style={styles.detailValue}>
                ${(dish.price_cents / 100).toFixed(2)}
              </Text>
            </View>
          )}
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Would order again</Text>
            <View
              style={[
                styles.orderAgainBadge,
                dish.would_order_again === 1
                  ? styles.orderAgainYes
                  : styles.orderAgainNo,
              ]}
            >
              <Text
                style={[
                  styles.orderAgainText,
                  dish.would_order_again === 1
                    ? styles.orderAgainYesText
                    : styles.orderAgainNoText,
                ]}
              >
                {dish.would_order_again === 1 ? 'Yes' : 'No'}
              </Text>
            </View>
          </View>
        </View>
      </View>

      {/* Allergens */}
      {allergens.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>ALLERGENS</Text>
          <View style={styles.allergenRow}>
            {allergens.map((a) => (
              <View key={a} style={styles.allergenChip}>
                <Text style={styles.allergenChipText}>{a}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Notes */}
      {dish.notes && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>NOTES</Text>
          <Text style={styles.notesText}>{dish.notes}</Text>
        </View>
      )}

      {/* Actions */}
      <View style={styles.actionRow}>
        <Pressable style={styles.actionButton} onPress={handleOrderAgain}>
          <Text style={styles.actionIcon}>{'\uD83D\uDD01'}</Text>
          <Text style={styles.actionLabel}>Order Again</Text>
        </Pressable>
        <Pressable
          style={styles.actionButton}
          onPress={() => {
            try {
              const restName = restaurant?.name ?? 'Unknown';
              const prefillName = `${dish.name} (inspired by ${restName})`;
              const prefillNotes = [
                dish.notes,
                dish.course ? `Course: ${dish.course}` : null,
                `Inspired by a dish at ${restName}`,
              ].filter(Boolean).join('\n');
              router.push(
                `/(recipes)/add?name=${encodeURIComponent(prefillName)}&notes=${encodeURIComponent(prefillNotes)}&source=dining` as `/${string}`,
              );
            } catch {
              // Recipes module may not be available
            }
          }}
        >
          <Text style={styles.actionIcon}>{'\uD83C\uDF73'}</Text>
          <Text style={styles.actionLabel}>Recreate as Recipe</Text>
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
          Logged {new Date(dish.created_at).toLocaleDateString()}
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

  // Hero
  heroSection: {
    alignItems: 'center',
    paddingTop: 20,
    paddingBottom: 16,
    paddingHorizontal: 20,
    gap: 8,
  },
  dishName: {
    fontSize: 26,
    fontWeight: '800',
    color: TEXT_PRIMARY,
    textAlign: 'center',
  },
  courseBadge: {
    backgroundColor: 'rgba(220,38,38,0.12)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 999,
  },
  courseBadgeText: {
    fontSize: 13,
    fontWeight: '600',
    color: ACCENT,
  },

  // Restaurant card
  restaurantCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginHorizontal: 16,
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
  orderAgainBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 999,
  },
  orderAgainYes: {
    backgroundColor: 'rgba(48,209,88,0.15)',
  },
  orderAgainNo: {
    backgroundColor: 'rgba(255,180,171,0.15)',
  },
  orderAgainText: {
    fontSize: 13,
    fontWeight: '600',
  },
  orderAgainYesText: {
    color: '#30D158',
  },
  orderAgainNoText: {
    color: '#FFB4AB',
  },

  // Allergens
  allergenRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  allergenChip: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: 'rgba(255,184,119,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255,184,119,0.3)',
  },
  allergenChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: WARNING_ORANGE,
  },

  // Notes
  notesText: {
    fontSize: 15,
    color: TEXT_PRIMARY,
    lineHeight: 22,
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
