import { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import {
  calculateDueReviews,
  getExpiringReturns,
  listPurchases,
  type Purchase,
} from '@mylife/shop';
import { colors, surfaceTiers } from '@mylife/ui';
import { useDatabase } from '../../components/DatabaseProvider';
import { SHOP_ACCENT } from './_ui';

type Filter = 'all' | 'impulse' | 'pending_return';

function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(cents % 100 === 0 ? 0 : 2)}`;
}

function daysUntil(iso: string, now: Date = new Date()): number {
  const d = new Date(iso);
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const target = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  return Math.round((target - today) / 86_400_000);
}

function SatisfactionStars({ rating }: { rating: number | null }) {
  if (rating == null) return null;
  return (
    <Text style={styles.stars}>
      {'★'.repeat(rating)}
      <Text style={styles.starsDim}>{'★'.repeat(5 - rating)}</Text>
    </Text>
  );
}

export default function PurchasesScreen() {
  const db = useDatabase();
  const router = useRouter();
  const [tick, setTick] = useState(0);
  const [filter, setFilter] = useState<Filter>('all');

  useFocusEffect(useCallback(() => { setTick((t) => t + 1); }, []));

  const purchases = useMemo<Purchase[]>(() => {
    try {
      return listPurchases(db);
    } catch {
      return [];
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [db, tick]);

  const expiringById = useMemo(() => {
    const set = new Set<string>();
    getExpiringReturns(purchases, 14).forEach((p) => set.add(p.id));
    return set;
  }, [purchases]);

  const dueReviewsByPurchase = useMemo(() => {
    const map = new Map<string, number>();
    calculateDueReviews(purchases).forEach((d) => {
      map.set(d.purchaseId, (map.get(d.purchaseId) ?? 0) + 1);
    });
    return map;
  }, [purchases]);

  const filtered = useMemo(() => {
    if (filter === 'impulse') return purchases.filter((p) => p.isImpulse);
    if (filter === 'pending_return') {
      return purchases.filter((p) => !p.returned && p.returnDeadline);
    }
    return purchases;
  }, [purchases, filter]);

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <Text style={styles.eyebrow}>Purchases</Text>
        <Text style={styles.title}>
          {purchases.length === 0 ? 'Log your first purchase' : 'Purchase journal'}
        </Text>
        <Text style={styles.subtitle}>
          Track what you bought, how you feel about it, and which returns are about to lapse.
        </Text>
      </View>

      <View style={styles.filterRow}>
        {(['all', 'impulse', 'pending_return'] as Filter[]).map((f) => (
          <Pressable
            key={f}
            style={[styles.pill, filter === f && styles.pillActive]}
            onPress={() => setFilter(f)}
          >
            <Text style={[styles.pillText, filter === f && styles.pillTextActive]}>
              {f === 'pending_return' ? 'Pending return' : f === 'all' ? 'All' : 'Impulse'}
            </Text>
          </Pressable>
        ))}
      </View>

      {filtered.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>Nothing here yet</Text>
          <Text style={styles.emptyBody}>
            Log a purchase to start building your private shopping memory.
          </Text>
        </View>
      ) : (
        filtered.map((p) => {
          const daysLeft = p.returnDeadline ? daysUntil(p.returnDeadline) : null;
          const expiring = expiringById.has(p.id);
          const dueCount = dueReviewsByPurchase.get(p.id) ?? 0;
          return (
            <Pressable
              key={p.id}
              style={styles.card}
              onPress={() => router.push(`/(shop)/purchase/${p.id}`)}
            >
              <View style={styles.cardTopRow}>
                <Text style={styles.cardName} numberOfLines={1}>{p.name}</Text>
                <Text style={styles.cardPrice}>{formatCents(p.priceCents)}</Text>
              </View>
              <View style={styles.cardMetaRow}>
                <Text style={styles.meta}>{p.category}</Text>
                {p.store ? (
                  <>
                    <Text style={styles.metaDot}>·</Text>
                    <Text style={styles.meta}>{p.store}</Text>
                  </>
                ) : null}
                <Text style={styles.metaDot}>·</Text>
                <Text style={styles.meta}>{p.purchaseDate.slice(0, 10)}</Text>
              </View>
              <View style={styles.cardBadgeRow}>
                <SatisfactionStars rating={p.satisfactionInitial} />
                {p.isImpulse ? <Text style={styles.impulseBadge}>impulse</Text> : null}
                {p.returned ? <Text style={styles.returnedBadge}>returned</Text> : null}
                {daysLeft != null && !p.returned ? (
                  <Text style={[styles.returnBadge, expiring && styles.returnBadgeWarn]}>
                    {daysLeft >= 0 ? `return in ${daysLeft}d` : 'return lapsed'}
                  </Text>
                ) : null}
                {dueCount > 0 ? (
                  <Text style={styles.reviewBadge}>review due</Text>
                ) : null}
              </View>
            </Pressable>
          );
        })
      )}

      <Pressable
        style={styles.primaryButton}
        onPress={() => router.push('/(shop)/purchase/log')}
      >
        <Text style={styles.primaryButtonText}>Log a purchase</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: surfaceTiers.lowest },
  content: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 160, gap: 12 },
  header: {
    gap: 8,
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
  subtitle: { color: colors.textSecondary, fontSize: 14, lineHeight: 20 },
  filterRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  pill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: surfaceTiers.low,
    borderWidth: 1,
    borderColor: colors.border,
  },
  pillActive: { backgroundColor: SHOP_ACCENT, borderColor: SHOP_ACCENT },
  pillText: { color: colors.textSecondary, fontSize: 12, fontWeight: '700' },
  pillTextActive: { color: '#0E0E13' },
  card: {
    gap: 8,
    padding: 16,
    borderRadius: 18,
    backgroundColor: surfaceTiers.low,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardName: { color: colors.text, fontSize: 16, fontWeight: '700', flex: 1, marginRight: 10 },
  cardPrice: { color: SHOP_ACCENT, fontSize: 16, fontWeight: '800' },
  cardMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  meta: { color: colors.textSecondary, fontSize: 12, textTransform: 'capitalize' },
  metaDot: { color: colors.textSecondary, fontSize: 12 },
  cardBadgeRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginTop: 2 },
  stars: { color: SHOP_ACCENT, fontSize: 13, fontWeight: '700' },
  starsDim: { color: 'rgba(255,255,255,0.2)' },
  impulseBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: 'rgba(239,68,68,0.14)',
    color: '#FF6B6B',
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  returnedBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.06)',
    color: colors.textSecondary,
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  returnBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: 'rgba(139,207,240,0.12)',
    color: '#8BCFF0',
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  returnBadgeWarn: {
    backgroundColor: 'rgba(255,184,119,0.18)',
    color: '#FFB877',
  },
  reviewBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: 'rgba(16,185,129,0.15)',
    color: SHOP_ACCENT,
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  emptyCard: {
    gap: 6,
    padding: 20,
    borderRadius: 18,
    backgroundColor: surfaceTiers.low,
    borderWidth: 1,
    borderColor: colors.border,
  },
  emptyTitle: { color: colors.text, fontSize: 15, fontWeight: '700' },
  emptyBody: { color: colors.textSecondary, fontSize: 13, lineHeight: 19 },
  primaryButton: {
    marginTop: 6,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
    borderRadius: 16,
    backgroundColor: SHOP_ACCENT,
  },
  primaryButtonText: { color: '#0E0E13', fontSize: 15, fontWeight: '800' },
});
