import { useCallback, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import {
  generateReview,
  listGifts,
  listItemsByWishlist,
  listPurchases,
  listWarranties,
  listWishlists,
  type WishlistItem,
  type YearReview,
} from '@mylife/shop';
import { colors, surfaceTiers } from '@mylife/ui';
import { useDatabase } from '../../../components/DatabaseProvider';
import { SHOP_ACCENT } from '../_ui';

const MONTH_LABELS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

function formatCents(cents: number | null | undefined): string {
  if (cents == null) return '';
  return `$${(cents / 100).toFixed(cents % 100 === 0 ? 0 : 2)}`;
}

export default function YearReviewScreen() {
  const db = useDatabase();
  const { year } = useLocalSearchParams<{ year: string }>();
  const yearNum = Number(year);
  const [tick, setTick] = useState(0);

  useFocusEffect(
    useCallback(() => {
      setTick((t) => t + 1);
    }, []),
  );

  const review: YearReview | null = useMemo(() => {
    if (!Number.isFinite(yearNum)) return null;
    try {
      const purchases = listPurchases(db);
      const gifts = listGifts(db);
      const warranties = listWarranties(db);
      const wishlists = listWishlists(db);
      const wishlistItems: WishlistItem[] = wishlists.flatMap((w) =>
        listItemsByWishlist(db, w.id),
      );
      return generateReview({
        year: yearNum,
        purchases,
        gifts,
        warranties,
        wishlistItems,
      });
    } catch {
      return null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [db, yearNum, tick]);

  if (!review) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>Could not load review.</Text>
      </View>
    );
  }

  const maxMonth = Math.max(...review.monthlyTrend.map((m) => m.totalCents), 1);

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <Text style={styles.eyebrow}>{review.year}</Text>
        <Text style={styles.title}>Year in review</Text>
      </View>

      <View style={styles.heroRow}>
        <View style={styles.heroCard}>
          <Text style={styles.heroLabel}>Total spent</Text>
          <Text style={styles.heroValue}>{formatCents(review.totalCents)}</Text>
        </View>
        <View style={styles.heroCard}>
          <Text style={styles.heroLabel}>Items</Text>
          <Text style={styles.heroValue}>{review.itemCount}</Text>
        </View>
        <View style={styles.heroCard}>
          <Text style={styles.heroLabel}>Avg / item</Text>
          <Text style={styles.heroValue}>{formatCents(review.avgCents)}</Text>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Monthly trend</Text>
        <View style={styles.barRow}>
          {review.monthlyTrend.map((m) => {
            const h = Math.max(2, Math.round((m.totalCents / maxMonth) * 80));
            return (
              <View key={m.month} style={styles.barCol}>
                <View style={[styles.bar, { height: h }]} />
                <Text style={styles.barLabel}>
                  {MONTH_LABELS[m.month - 1] ?? m.month}
                </Text>
              </View>
            );
          })}
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Categories</Text>
        {review.categoryBreakdown.length === 0 ? (
          <Text style={styles.body}>Nothing logged this year.</Text>
        ) : (
          review.categoryBreakdown.map((c) => (
            <View key={c.category} style={styles.catRow}>
              <Text style={styles.catName}>{c.category}</Text>
              <Text style={styles.catMeta}>
                {formatCents(c.totalCents)} · {c.percentage.toFixed(0)}%
              </Text>
            </View>
          ))
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Best purchases</Text>
        {review.bestPurchases.length === 0 ? (
          <Text style={styles.body}>No standout favorites yet.</Text>
        ) : (
          review.bestPurchases.map((p) => (
            <View key={p.id} style={styles.purchaseRow}>
              <Text style={styles.purchaseName}>{p.name}</Text>
              <Text style={styles.purchaseMeta}>{formatCents(p.priceCents)}</Text>
            </View>
          ))
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Worst purchases</Text>
        {review.worstPurchases.length === 0 ? (
          <Text style={styles.body}>Nothing flagged as a regret.</Text>
        ) : (
          review.worstPurchases.map((p) => (
            <View key={p.id} style={styles.purchaseRow}>
              <Text style={styles.purchaseName}>{p.name}</Text>
              <Text style={styles.purchaseMeta}>{formatCents(p.priceCents)}</Text>
            </View>
          ))
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Gifts</Text>
        <Text style={styles.body}>
          {review.giftSummary.peopleCount} people ·{' '}
          {formatCents(review.giftSummary.totalSpentCents)} spent
        </Text>
        {review.giftSummary.mostGenerousOccasion ? (
          <Text style={styles.body}>
            Most generous occasion: {review.giftSummary.mostGenerousOccasion}
          </Text>
        ) : null}
        {review.giftSummary.occasionBreakdown.map((o) => (
          <View key={o.occasion} style={styles.catRow}>
            <Text style={styles.catName}>{o.occasion}</Text>
            <Text style={styles.catMeta}>
              {o.count} · {formatCents(o.totalCents)}
            </Text>
          </View>
        ))}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Warranty wins</Text>
        <Text style={styles.body}>
          {review.warrantyUtilization.claimsFiledCount} claim
          {review.warrantyUtilization.claimsFiledCount === 1 ? '' : 's'} filed,
          {' '}
          {formatCents(review.warrantyUtilization.savedCents)} saved
        </Text>
        <Text style={styles.body}>
          {review.warrantyUtilization.expiredUnusedCount} expired without use
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Wishlist conversion</Text>
        <Text style={styles.body}>
          {review.wishlistConversion.purchasedCount} of{' '}
          {review.wishlistConversion.wishlistedCount} wishlisted items bought (
          {review.wishlistConversion.conversionPercentage.toFixed(0)}%)
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Impulse audit</Text>
        <Text style={styles.body}>
          {review.impulseAudit.impulseCount} impulse buys ·{' '}
          {(review.impulseAudit.impulseRegretRate * 100).toFixed(0)}% regretted
        </Text>
        <Text style={styles.body}>
          {formatCents(review.impulseAudit.regrettedSpendCents)} regretted spend
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: surfaceTiers.lowest },
  content: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 160, gap: 14 },
  empty: {
    flex: 1,
    backgroundColor: surfaceTiers.lowest,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  emptyText: { color: colors.textSecondary, fontSize: 14 },
  header: {
    gap: 4,
    padding: 18,
    borderRadius: 20,
    backgroundColor: surfaceTiers.container,
    borderWidth: 1,
    borderColor: colors.border,
  },
  eyebrow: {
    color: SHOP_ACCENT,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  title: { color: colors.text, fontSize: 24, fontWeight: '800' },
  heroRow: { flexDirection: 'row', gap: 10 },
  heroCard: {
    flex: 1,
    gap: 6,
    padding: 14,
    borderRadius: 16,
    backgroundColor: surfaceTiers.low,
    borderWidth: 1,
    borderColor: colors.border,
  },
  heroLabel: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  heroValue: { color: colors.text, fontSize: 18, fontWeight: '800' },
  card: {
    gap: 10,
    padding: 16,
    borderRadius: 18,
    backgroundColor: surfaceTiers.low,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardTitle: { color: colors.text, fontSize: 14, fontWeight: '700' },
  body: { color: colors.textSecondary, fontSize: 13, lineHeight: 19 },
  barRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    height: 110,
    gap: 4,
  },
  barCol: { alignItems: 'center', flex: 1, gap: 4 },
  bar: {
    width: '85%',
    backgroundColor: SHOP_ACCENT,
    borderRadius: 3,
    minHeight: 2,
  },
  barLabel: { color: colors.textSecondary, fontSize: 9, fontWeight: '700' },
  catRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  catName: { color: colors.text, fontSize: 13, fontWeight: '700' },
  catMeta: { color: colors.textSecondary, fontSize: 12 },
  purchaseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  purchaseName: { color: colors.text, fontSize: 13, fontWeight: '600', flex: 1 },
  purchaseMeta: { color: colors.textSecondary, fontSize: 12 },
});
