import { useState, useCallback } from 'react';
import { View, ScrollView, StyleSheet, Pressable } from 'react-native';
import { Text } from '@mylife/ui';
import { useFocusEffect, useRouter } from 'expo-router';
import { useDatabase } from '../../components/DatabaseProvider';
import { generateYearInReview } from '@mylife/dining';
import type { YearInReview } from '@mylife/dining';

const ACCENT = '#DC2626';
const ACCENT_DIM = 'rgba(220,38,38,0.15)';
const BG = '#0E0E13';
const SURFACE = '#1B1B20';
const TEXT_PRIMARY = '#E4E1E9';
const TEXT_SECONDARY = '#D6C3B5';
const GLASS = 'rgba(255,255,255,0.03)';
const GLASS_BORDER = 'rgba(255,255,255,0.06)';
const STARS_COLOR = '#FFB877';
const SUCCESS = '#30D158';

function formatCurrency(cents: number): string {
  return `$${(cents / 100).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function formatRating(rating: number | null): string {
  if (rating == null) return '-';
  return rating.toFixed(1);
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatMonth(monthStr: string): string {
  const [year, month] = monthStr.split('-');
  const d = new Date(Number(year), Number(month) - 1);
  return d.toLocaleDateString(undefined, { month: 'short' });
}

export default function YearReviewScreen() {
  const db = useDatabase();
  const router = useRouter();
  const [review, setReview] = useState<YearInReview | null>(null);

  const currentYear = new Date().getFullYear();
  const startDate = `${currentYear}-01-01T00:00:00Z`;
  const endDate = `${currentYear}-12-31T23:59:59Z`;

  useFocusEffect(
    useCallback(() => {
      const data = generateYearInReview(db, startDate, endDate);
      setReview(data);
    }, [db, startDate, endDate]),
  );

  if (!review) {
    return (
      <View style={styles.container}>
        <Text style={styles.loadingText}>Loading your year...</Text>
      </View>
    );
  }

  const maxMonthly = Math.max(...review.monthlyVisits.map((m) => m.count), 1);
  const maxCuisine = Math.max(...review.cuisineBreakdown.map((c) => c.count), 1);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backText}>{'<'} Back</Text>
        </Pressable>
        <Text style={styles.eyebrow}>YEAR IN REVIEW</Text>
        <Text style={styles.title}>Your Year in Dining</Text>
        <Text style={styles.subtitle}>
          {formatDate(review.period.start)} - {formatDate(review.period.end)}
        </Text>
      </View>

      {/* Stats Row */}
      <View style={styles.statsRow}>
        <StatBox label="Visits" value={String(review.totalVisits)} />
        <StatBox label="Restaurants" value={String(review.totalRestaurants)} />
        <StatBox label="Dishes" value={String(review.totalDishes)} />
        <StatBox label="Wines" value={String(review.totalWines)} />
        <StatBox label="Spent" value={review.totalSpentCents > 0 ? formatCurrency(review.totalSpentCents) : '-'} />
      </View>

      {/* Average Rating */}
      {review.averageRating != null && (
        <View style={styles.ratingCard}>
          <Text style={styles.ratingStars}>
            {'★'.repeat(Math.round(review.averageRating))}
            {'☆'.repeat(5 - Math.round(review.averageRating))}
          </Text>
          <Text style={styles.ratingValue}>{formatRating(review.averageRating)} avg</Text>
        </View>
      )}

      {/* Best Meal */}
      {review.bestMeal && (
        <View style={styles.highlightCard}>
          <Text style={styles.highlightLabel}>Best Meal</Text>
          <Text style={styles.highlightTitle}>{review.bestMeal.restaurantName}</Text>
          <View style={styles.highlightRow}>
            <Text style={styles.highlightDate}>{formatDate(review.bestMeal.date)}</Text>
            <Text style={styles.highlightRating}>
              {'★'.repeat(review.bestMeal.rating)} {review.bestMeal.rating}/5
            </Text>
          </View>
        </View>
      )}

      {/* Most Visited Restaurant */}
      {review.mostVisitedRestaurant && (
        <View style={styles.card}>
          <Text style={styles.cardLabel}>Most Visited</Text>
          <Text style={styles.cardTitle}>{review.mostVisitedRestaurant.name}</Text>
          <Text style={styles.cardSub}>
            {review.mostVisitedRestaurant.count} visit{review.mostVisitedRestaurant.count !== 1 ? 's' : ''}
          </Text>
        </View>
      )}

      {/* Dish of the Year */}
      {review.dishOfTheYear && (
        <View style={styles.card}>
          <Text style={styles.cardLabel}>Dish of the Year</Text>
          <Text style={styles.cardTitle}>{review.dishOfTheYear.name}</Text>
          <Text style={styles.cardSub}>
            at {review.dishOfTheYear.restaurantName} - {review.dishOfTheYear.rating}/5
          </Text>
        </View>
      )}

      {/* Top 5 Restaurants */}
      {review.topRestaurants.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Top Restaurants</Text>
          {review.topRestaurants.slice(0, 5).map((r, i) => (
            <View key={r.id} style={styles.listItem}>
              <Text style={styles.listRank}>{i + 1}</Text>
              <View style={styles.listInfo}>
                <Text style={styles.listName}>{r.name}</Text>
                <Text style={styles.listMeta}>
                  {r.visitCount} visit{r.visitCount !== 1 ? 's' : ''} - {r.avgRating.toFixed(1)} avg
                </Text>
              </View>
            </View>
          ))}
        </View>
      )}

      {/* Top 5 Dishes */}
      {review.topDishes.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Top Dishes</Text>
          {review.topDishes.slice(0, 5).map((d, i) => (
            <View key={d.id} style={styles.listItem}>
              <Text style={styles.listRank}>{i + 1}</Text>
              <View style={styles.listInfo}>
                <Text style={styles.listName}>{d.name}</Text>
                <Text style={styles.listMeta}>
                  {d.restaurantName} - {d.rating}/5
                </Text>
              </View>
            </View>
          ))}
        </View>
      )}

      {/* Monthly Visits Bar Chart */}
      {review.monthlyVisits.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Monthly Visits</Text>
          {review.monthlyVisits.map((m) => (
            <View key={m.month} style={styles.barRow}>
              <Text style={styles.barLabel}>{formatMonth(m.month)}</Text>
              <View style={styles.barTrack}>
                <View
                  style={[
                    styles.barFill,
                    { width: `${(m.count / maxMonthly) * 100}%` },
                  ]}
                />
              </View>
              <Text style={styles.barCount}>{m.count}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Cuisine Breakdown */}
      {review.cuisineBreakdown.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Cuisine Breakdown</Text>
          {review.cuisineBreakdown.slice(0, 8).map((c) => (
            <View key={c.cuisine} style={styles.barRow}>
              <Text style={styles.barLabel}>{c.cuisine}</Text>
              <View style={styles.barTrack}>
                <View
                  style={[
                    styles.barFill,
                    styles.barFillCuisine,
                    { width: `${(c.count / maxCuisine) * 100}%` },
                  ]}
                />
              </View>
              <Text style={styles.barCount}>{c.count}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Empty state */}
      {review.totalVisits === 0 && (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyIcon}>{'\uD83C\uDF7D\uFE0F'}</Text>
          <Text style={styles.emptyTitle}>No visits yet this year</Text>
          <Text style={styles.emptySubtext}>
            Start logging your dining experiences to see your year-in-review stats.
          </Text>
        </View>
      )}

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

function StatBox({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.statBox}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BG,
  },
  content: {
    padding: 20,
    gap: 16,
  },
  loadingText: {
    color: TEXT_SECONDARY,
    textAlign: 'center',
    marginTop: 100,
    fontSize: 16,
  },
  header: {
    gap: 4,
    marginBottom: 8,
  },
  backButton: {
    marginBottom: 12,
  },
  backText: {
    color: ACCENT,
    fontSize: 15,
    fontWeight: '600',
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 2,
    color: ACCENT,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: TEXT_PRIMARY,
  },
  subtitle: {
    fontSize: 14,
    color: TEXT_SECONDARY,
    marginTop: 2,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  statBox: {
    flex: 1,
    alignItems: 'center',
    padding: 12,
    borderRadius: 14,
    backgroundColor: GLASS,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
  },
  statValue: {
    fontSize: 20,
    fontWeight: '800',
    color: TEXT_PRIMARY,
  },
  statLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: TEXT_SECONDARY,
    marginTop: 2,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  ratingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 16,
    borderRadius: 14,
    backgroundColor: GLASS,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
  },
  ratingStars: {
    fontSize: 18,
    color: STARS_COLOR,
  },
  ratingValue: {
    fontSize: 16,
    fontWeight: '700',
    color: TEXT_PRIMARY,
  },
  highlightCard: {
    padding: 20,
    borderRadius: 16,
    backgroundColor: ACCENT_DIM,
    borderWidth: 1,
    borderColor: ACCENT,
    gap: 6,
  },
  highlightLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.5,
    color: ACCENT,
    textTransform: 'uppercase',
  },
  highlightTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: TEXT_PRIMARY,
  },
  highlightRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  highlightDate: {
    fontSize: 14,
    color: TEXT_SECONDARY,
  },
  highlightRating: {
    fontSize: 14,
    color: STARS_COLOR,
    fontWeight: '700',
  },
  card: {
    padding: 16,
    borderRadius: 14,
    backgroundColor: GLASS,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
    gap: 4,
  },
  cardLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.5,
    color: ACCENT,
    textTransform: 'uppercase',
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: TEXT_PRIMARY,
  },
  cardSub: {
    fontSize: 13,
    color: TEXT_SECONDARY,
  },
  section: {
    gap: 10,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: TEXT_PRIMARY,
    marginBottom: 4,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 12,
    backgroundColor: GLASS,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
  },
  listRank: {
    fontSize: 16,
    fontWeight: '800',
    color: ACCENT,
    width: 24,
    textAlign: 'center',
  },
  listInfo: {
    flex: 1,
    gap: 2,
  },
  listName: {
    fontSize: 15,
    fontWeight: '600',
    color: TEXT_PRIMARY,
  },
  listMeta: {
    fontSize: 12,
    color: TEXT_SECONDARY,
  },
  barRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  barLabel: {
    width: 60,
    fontSize: 13,
    fontWeight: '600',
    color: TEXT_SECONDARY,
    textAlign: 'right',
  },
  barTrack: {
    flex: 1,
    height: 20,
    borderRadius: 6,
    backgroundColor: SURFACE,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 6,
    backgroundColor: ACCENT,
    minWidth: 4,
  },
  barFillCuisine: {
    backgroundColor: SUCCESS,
  },
  barCount: {
    width: 28,
    fontSize: 13,
    fontWeight: '700',
    color: TEXT_PRIMARY,
    textAlign: 'right',
  },
  emptyCard: {
    alignItems: 'center',
    padding: 32,
    borderRadius: 20,
    backgroundColor: GLASS,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
    gap: 12,
  },
  emptyIcon: {
    fontSize: 48,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: TEXT_PRIMARY,
  },
  emptySubtext: {
    fontSize: 14,
    color: TEXT_SECONDARY,
    textAlign: 'center',
    lineHeight: 20,
  },
});
