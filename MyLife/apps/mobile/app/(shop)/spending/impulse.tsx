import { useCallback, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import {
  listPurchases,
  getImpulseRegretRate,
  getTopImpulseCategories,
  type Purchase,
} from '@mylife/shop';
import { colors, surfaceTiers } from '@mylife/ui';
import { useDatabase } from '../../../components/DatabaseProvider';
import { SHOP_ACCENT } from '../_ui';

function formatCents(cents: number): string {
  if (!cents) return '$0';
  return `$${(cents / 100).toFixed(cents % 100 === 0 ? 0 : 2)}`;
}

function regretColor(rate: number): string {
  if (rate >= 0.5) return '#EF4444';
  if (rate >= 0.25) return '#F59E0B';
  return SHOP_ACCENT;
}

function latestSatisfaction(p: Purchase): number | null {
  return p.satisfaction90day ?? p.satisfaction30day ?? p.satisfactionInitial ?? null;
}

function satisfactionColor(rating: number | null): string {
  if (rating == null) return 'rgba(255,255,255,0.3)';
  if (rating <= 2) return '#EF4444';
  if (rating === 3) return '#F59E0B';
  return SHOP_ACCENT;
}

export default function ShopImpulseScreen() {
  const db = useDatabase();
  const [tick, setTick] = useState(0);

  useFocusEffect(
    useCallback(() => {
      setTick((t) => t + 1);
    }, []),
  );

  const purchases: Purchase[] = useMemo(() => {
    try {
      return listPurchases(db);
    } catch {
      return [];
    }
  }, [db, tick]);

  const impulseList = useMemo(
    () =>
      purchases
        .filter((p) => p.isImpulse)
        .slice()
        .sort((a, b) => (a.purchaseDate < b.purchaseDate ? 1 : -1)),
    [purchases],
  );

  const regret = useMemo(() => getImpulseRegretRate(purchases), [purchases]);
  const topCategories = useMemo(
    () => getTopImpulseCategories(purchases, 5),
    [purchases],
  );

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.hero}>
        <Text style={styles.eyebrow}>Impulse log</Text>
        <Text style={styles.regretLabel}>Regret rate</Text>
        <Text style={[styles.bigNum, { color: regretColor(regret.regretRate) }]}>
          {Math.round(regret.regretRate * 100)}%
        </Text>
        <Text style={styles.subtitle}>
          {regret.regretted} of {regret.totalImpulse} impulse purchase
          {regret.totalImpulse === 1 ? '' : 's'} rated below 3
        </Text>
      </View>

      {topCategories.length > 0 ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Top impulse categories</Text>
          <View style={styles.catList}>
            {topCategories.map((c) => (
              <View key={c.category} style={styles.catRow}>
                <Text style={styles.catLabel}>{c.category}</Text>
                <Text style={styles.catCount}>{c.count}x</Text>
                <Text style={styles.catValue}>{formatCents(c.totalCents)}</Text>
              </View>
            ))}
          </View>
        </View>
      ) : null}

      <View style={styles.card}>
        <Text style={styles.cardTitle}>All impulse purchases</Text>
        {impulseList.length === 0 ? (
          <Text style={styles.empty}>No impulse purchases logged yet.</Text>
        ) : (
          <View style={styles.purchaseList}>
            {impulseList.map((p) => {
              const sat = latestSatisfaction(p);
              return (
                <View key={p.id} style={styles.purchaseRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.purchaseName}>{p.name}</Text>
                    <Text style={styles.purchaseMeta}>
                      {p.purchaseDate} · {formatCents(p.priceCents)}
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.satBadge,
                      { backgroundColor: satisfactionColor(sat) + '22', borderColor: satisfactionColor(sat) },
                    ]}
                  >
                    <Text style={[styles.satBadgeText, { color: satisfactionColor(sat) }]}>
                      {sat == null ? '—' : `${sat}/5`}
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: surfaceTiers.lowest },
  content: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 160, gap: 16 },
  hero: {
    gap: 6,
    padding: 20,
    borderRadius: 24,
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
  regretLabel: { color: colors.textSecondary, fontSize: 13, fontWeight: '600' },
  bigNum: { fontSize: 48, fontWeight: '800', lineHeight: 54 },
  subtitle: { color: colors.textSecondary, fontSize: 13 },
  card: {
    gap: 12,
    padding: 18,
    borderRadius: 20,
    backgroundColor: surfaceTiers.low,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardTitle: { color: colors.text, fontSize: 14, fontWeight: '700' },
  empty: { color: colors.textSecondary, fontSize: 13 },
  catList: { gap: 8 },
  catRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  catLabel: {
    flex: 1,
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
    textTransform: 'capitalize',
  },
  catCount: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
  },
  catValue: { color: SHOP_ACCENT, fontSize: 13, fontWeight: '700', minWidth: 70, textAlign: 'right' },
  purchaseList: { gap: 10 },
  purchaseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  purchaseName: { color: colors.text, fontSize: 14, fontWeight: '700' },
  purchaseMeta: { color: colors.textSecondary, fontSize: 12, marginTop: 2 },
  satBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
  },
  satBadgeText: { fontSize: 12, fontWeight: '800' },
});
