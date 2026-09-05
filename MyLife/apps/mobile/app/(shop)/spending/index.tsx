import { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import {
  listPurchases,
  getMonthlySummary,
  getCategoryBreakdown,
  getSixMonthTrend,
  getImpulseStats,
  getSaleRatio,
  type Purchase,
} from '@mylife/shop';
import { colors, surfaceTiers } from '@mylife/ui';
import { useDatabase } from '../../../components/DatabaseProvider';
import { SHOP_ACCENT } from '../_ui';

const MONTH_NAMES = [
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

function formatCents(cents: number): string {
  if (!cents) return '$0';
  return `$${(cents / 100).toFixed(cents % 100 === 0 ? 0 : 2)}`;
}

function shiftMonth(year: number, month: number, delta: number): { y: number; m: number } {
  const idx = year * 12 + (month - 1) + delta;
  const y = Math.floor(idx / 12);
  const m = (idx % 12) + 1;
  return { y, m };
}

export default function ShopSpendingDashboard() {
  const db = useDatabase();
  const router = useRouter();
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);
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

  const summary = useMemo(
    () => getMonthlySummary(purchases, year, month),
    [purchases, year, month],
  );
  const categories = useMemo(
    () => getCategoryBreakdown(purchases, year, month),
    [purchases, year, month],
  );
  const trend = useMemo(
    () => getSixMonthTrend(purchases, year, month),
    [purchases, year, month],
  );
  const monthMs = useMemo(() => {
    const start = Date.UTC(year, month - 1, 1);
    const next = Date.UTC(year, month, 1);
    return { fromMs: start, toMs: next - 1 };
  }, [year, month]);
  const impulse = useMemo(
    () => getImpulseStats(purchases, monthMs),
    [purchases, monthMs],
  );
  const sale = useMemo(() => getSaleRatio(purchases, monthMs), [purchases, monthMs]);

  const trendMax = Math.max(1, ...trend.map((t) => t.totalCents));
  const categoryMax = Math.max(1, ...categories.map((c) => c.totalCents));

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.hero}>
        <Text style={styles.eyebrow}>Spending</Text>
        <View style={styles.monthRow}>
          <Pressable
            onPress={() => {
              const { y, m } = shiftMonth(year, month, -1);
              setYear(y);
              setMonth(m);
            }}
            style={styles.monthButton}
            accessibilityLabel="Previous month"
          >
            <Text style={styles.monthButtonText}>{'\u2039'}</Text>
          </Pressable>
          <Text style={styles.monthLabel}>
            {MONTH_NAMES[month - 1]} {year}
          </Text>
          <Pressable
            onPress={() => {
              const { y, m } = shiftMonth(year, month, 1);
              setYear(y);
              setMonth(m);
            }}
            style={styles.monthButton}
            accessibilityLabel="Next month"
          >
            <Text style={styles.monthButtonText}>{'\u203A'}</Text>
          </Pressable>
        </View>
        <Text style={styles.bigTotal}>{formatCents(summary.totalCents)}</Text>
        <Text style={styles.subtitle}>
          {summary.itemCount} purchase{summary.itemCount === 1 ? '' : 's'} this month
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Last 6 months</Text>
        {summary.itemCount === 0 && trend.every((t) => t.totalCents === 0) ? (
          <Text style={styles.empty}>No purchases yet in this window.</Text>
        ) : (
          <View style={styles.trendRow}>
            {trend.map((t) => {
              const heightPct = (t.totalCents / trendMax) * 100;
              const isAnchor = t.year === year && t.month === month;
              return (
                <View key={`${t.year}-${t.month}`} style={styles.trendCol}>
                  <View style={styles.trendBarTrack}>
                    <View
                      style={[
                        styles.trendBarFill,
                        {
                          height: `${Math.max(2, heightPct)}%`,
                          backgroundColor: isAnchor ? SHOP_ACCENT : 'rgba(16,185,129,0.4)',
                        },
                      ]}
                    />
                  </View>
                  <Text style={styles.trendLabel}>{MONTH_NAMES[t.month - 1]}</Text>
                </View>
              );
            })}
          </View>
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>By category</Text>
        {categories.length === 0 ? (
          <Text style={styles.empty}>No spending by category this month.</Text>
        ) : (
          <View style={styles.catList}>
            {categories.map((c) => {
              const widthPct = (c.totalCents / categoryMax) * 100;
              return (
                <View key={c.category} style={styles.catRow}>
                  <View style={styles.catLabelRow}>
                    <Text style={styles.catLabel}>{c.category}</Text>
                    <Text style={styles.catValue}>
                      {formatCents(c.totalCents)} · {c.percentage}%
                    </Text>
                  </View>
                  <View style={styles.catBarTrack}>
                    <View
                      style={[
                        styles.catBarFill,
                        { width: `${Math.max(2, widthPct)}%` },
                      ]}
                    />
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </View>

      <View style={styles.ratioRow}>
        <View style={[styles.ratioCard, { borderColor: 'rgba(245,158,11,0.35)' }]}>
          <Text style={styles.ratioLabel}>Impulse</Text>
          <Text style={[styles.ratioValue, { color: '#F59E0B' }]}>
            {impulse.impulsePercentage}%
          </Text>
          <Text style={styles.ratioMeta}>{formatCents(impulse.impulseCents)}</Text>
        </View>
        <View style={[styles.ratioCard, { borderColor: 'rgba(16,185,129,0.35)' }]}>
          <Text style={styles.ratioLabel}>On sale</Text>
          <Text style={[styles.ratioValue, { color: SHOP_ACCENT }]}>
            {sale.salePercentage}%
          </Text>
          <Text style={styles.ratioMeta}>
            {sale.saleCount}/{sale.saleCount + sale.fullPriceCount}
          </Text>
        </View>
      </View>

      <View style={styles.linkRow}>
        <Pressable
          style={styles.linkButton}
          onPress={() => router.push('/(shop)/spending/impulse')}
        >
          <Text style={styles.linkButtonText}>Impulse log</Text>
        </Pressable>
        <Pressable
          style={styles.linkButton}
          onPress={() => router.push('/(shop)/spending/thirty-day-rule')}
        >
          <Text style={styles.linkButtonText}>30-day rule</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: surfaceTiers.lowest },
  content: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 160, gap: 16 },
  hero: {
    gap: 10,
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
  monthRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  monthButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: colors.border,
  },
  monthButtonText: { color: colors.text, fontSize: 18, fontWeight: '700' },
  monthLabel: { flex: 1, color: colors.text, fontSize: 17, fontWeight: '700' },
  bigTotal: { color: colors.text, fontSize: 40, fontWeight: '800', lineHeight: 46 },
  subtitle: { color: colors.textSecondary, fontSize: 14 },
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
  trendRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    height: 140,
  },
  trendCol: { flex: 1, alignItems: 'center', gap: 6 },
  trendBarTrack: {
    width: '100%',
    height: 110,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.04)',
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  trendBarFill: {
    width: '100%',
    borderRadius: 8,
  },
  trendLabel: { color: colors.textSecondary, fontSize: 11, fontWeight: '600' },
  catList: { gap: 12 },
  catRow: { gap: 6 },
  catLabelRow: { flexDirection: 'row', justifyContent: 'space-between' },
  catLabel: { color: colors.text, fontSize: 13, fontWeight: '700', textTransform: 'capitalize' },
  catValue: { color: colors.textSecondary, fontSize: 12, fontWeight: '600' },
  catBarTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.04)',
    overflow: 'hidden',
  },
  catBarFill: {
    height: '100%',
    backgroundColor: SHOP_ACCENT,
    borderRadius: 4,
  },
  ratioRow: { flexDirection: 'row', gap: 12 },
  ratioCard: {
    flex: 1,
    gap: 4,
    padding: 16,
    borderRadius: 16,
    backgroundColor: surfaceTiers.low,
    borderWidth: 1,
  },
  ratioLabel: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  ratioValue: { fontSize: 26, fontWeight: '800' },
  ratioMeta: { color: colors.textSecondary, fontSize: 12 },
  linkRow: { flexDirection: 'row', gap: 12 },
  linkButton: {
    flex: 1,
    alignItems: 'center',
    minHeight: 48,
    justifyContent: 'center',
    paddingHorizontal: 14,
    borderRadius: 14,
    backgroundColor: 'rgba(16,185,129,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(16,185,129,0.3)',
  },
  linkButtonText: { color: SHOP_ACCENT, fontWeight: '800', fontSize: 14 },
});
