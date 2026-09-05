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
  getWine,
  deleteWine,
  getRestaurant,
} from '@mylife/dining';

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

function colorLabel(color: string | null): string {
  if (!color) return '';
  if (color === 'rose') return 'Ros\u00E9';
  return color.charAt(0).toUpperCase() + color.slice(1);
}

const COLOR_TINTS: Record<string, string> = {
  red: 'rgba(220,38,38,0.15)',
  white: 'rgba(255,223,150,0.15)',
  rose: 'rgba(255,182,193,0.15)',
  sparkling: 'rgba(200,200,255,0.15)',
  orange: 'rgba(255,165,0,0.15)',
  dessert: 'rgba(184,134,11,0.15)',
};

const COLOR_TEXT: Record<string, string> = {
  red: '#FF6B6B',
  white: '#FFE4A0',
  rose: '#FFB6C1',
  sparkling: '#C8C8FF',
  orange: '#FFA500',
  dessert: '#DAA520',
};

export default function WineDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const db = useDatabase();
  const router = useRouter();
  const [tick, setTick] = useState(0);

  useFocusEffect(
    useCallback(() => {
      setTick((v) => v + 1);
    }, []),
  );

  const wine = useMemo(() => {
    if (!id) return null;
    return getWine(db, id);
  }, [db, id, tick]);

  const restaurant = useMemo(() => {
    if (!wine) return null;
    return getRestaurant(db, wine.restaurant_id);
  }, [db, wine]);

  if (!wine) {
    return (
      <View style={styles.centered}>
        <Text style={styles.emptyTitle}>Wine not found</Text>
        <Pressable onPress={() => router.back()} style={styles.backLink}>
          <Text style={styles.backLinkText}>Go back</Text>
        </Pressable>
      </View>
    );
  }

  const handleDelete = () => {
    Alert.alert(
      'Delete Wine',
      `Are you sure you want to delete this wine? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            deleteWine(db, wine.id);
            router.back();
          },
        },
      ],
    );
  };

  const subtitle = [wine.region, wine.varietal].filter(Boolean).join(' \u00B7 ');

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {/* Title */}
      <View style={styles.heroSection}>
        <Text style={styles.producer}>{wine.producer}</Text>
        <Text style={styles.wineName}>{wine.name}</Text>
        <View style={styles.heroMeta}>
          {wine.vintage != null && (
            <View style={styles.vintageBadge}>
              <Text style={styles.vintageBadgeText}>{wine.vintage}</Text>
            </View>
          )}
          {wine.color && (
            <View
              style={[
                styles.colorChip,
                { backgroundColor: COLOR_TINTS[wine.color] ?? COLOR_TINTS.red },
              ]}
            >
              <Text
                style={[
                  styles.colorChipText,
                  { color: COLOR_TEXT[wine.color] ?? COLOR_TEXT.red },
                ]}
              >
                {colorLabel(wine.color)}
              </Text>
            </View>
          )}
        </View>
        {subtitle.length > 0 && (
          <Text style={styles.subtitle}>{subtitle}</Text>
        )}
        {wine.rating != null && <Stars rating={wine.rating} size={22} />}
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
          {wine.price_cents != null && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Price</Text>
              <Text style={styles.detailValue}>
                ${(wine.price_cents / 100).toFixed(2)}
              </Text>
            </View>
          )}
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Served</Text>
            <View style={styles.glassBadge}>
              <Text style={styles.glassBadgeText}>
                {wine.by_glass === 1 ? 'By the Glass' : 'Bottle'}
              </Text>
            </View>
          </View>
        </View>
      </View>

      {/* Pairing Notes */}
      {wine.pairing_notes && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>PAIRING NOTES</Text>
          <Text style={styles.notesText}>{wine.pairing_notes}</Text>
        </View>
      )}

      {/* Actions */}
      <View style={styles.actionRow}>
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
          Logged {new Date(wine.created_at).toLocaleDateString()}
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
    gap: 6,
  },
  producer: {
    fontSize: 14,
    fontWeight: '600',
    color: TEXT_SECONDARY,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  wineName: {
    fontSize: 26,
    fontWeight: '800',
    color: TEXT_PRIMARY,
    textAlign: 'center',
  },
  heroMeta: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    marginTop: 4,
  },
  vintageBadge: {
    backgroundColor: SURFACE_ELEVATED,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  vintageBadgeText: {
    fontSize: 13,
    fontWeight: '700',
    color: TEXT_PRIMARY,
  },
  colorChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  colorChipText: {
    fontSize: 13,
    fontWeight: '600',
  },
  subtitle: {
    fontSize: 14,
    color: TEXT_SECONDARY,
    textAlign: 'center',
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
  glassBadge: {
    backgroundColor: 'rgba(220,38,38,0.12)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 999,
  },
  glassBadgeText: {
    fontSize: 13,
    fontWeight: '600',
    color: ACCENT,
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
