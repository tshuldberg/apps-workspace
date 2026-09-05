import { useMemo } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import {
  getProperties,
  getCostEntriesForProperty,
  getAppliancesForProperty,
  getCostSummary,
  getMonthlyCostTrend,
  getLifetimeCosts,
  getAppliancesNeedingAttention,
} from '@mylife/homes';
import { Card, Text, colors, spacing } from '@mylife/ui';
import { useDatabase } from '../../components/DatabaseProvider';

const ACCENT = colors.modules.homes;
const fmt = (c: number) => `$${Math.round(c / 100).toLocaleString()}`;

export default function CostPredictorScreen() {
  const db = useDatabase();
  const properties = useMemo(() => getProperties(db), [db]);
  const propId = properties[0]?.id;
  const entries = useMemo(() => propId ? getCostEntriesForProperty(db, propId) : [], [db, propId]);
  const appliances = useMemo(() => propId ? getAppliancesForProperty(db, propId) : [], [db, propId]);
  const summary = useMemo(() => getCostSummary(entries), [entries]);
  const trend = useMemo(() => getMonthlyCostTrend(entries), [entries]);
  const lifetime = useMemo(() => getLifetimeCosts(entries), [entries]);
  const needAttention = useMemo(() => getAppliancesNeedingAttention(appliances), [appliances]);

  // 1% rule placeholder (property schema doesn't store value, so skip if zero)
  const homeValue = 0;
  const onePercentAnnual = 0;

  // Simple 5-year forecast (average monthly * 60)
  const avgMonthly = trend.length > 0
    ? trend.reduce((s, t) => s + t.totalCents, 0) / trend.length
    : 0;
  const fiveYearForecast = Math.round(avgMonthly * 60);

  if (!propId) {
    return (
      <View style={styles.container}>
        <Card style={styles.emptyCard}>
          <Text style={{ fontSize: 40 }}>🏠</Text>
          <Text style={styles.emptyTitle}>No Properties</Text>
          <Text style={styles.emptyText}>Add a property to see cost predictions.</Text>
        </Card>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Cost Predictor</Text>

      {/* Lifetime Costs */}
      <Card style={styles.heroCard}>
        <Text style={styles.heroValue}>{fmt(lifetime)}</Text>
        <Text style={styles.heroLabel}>Lifetime Spending</Text>
      </Card>

      {/* Category Breakdown */}
      <Card style={styles.section}>
        <Text style={styles.sectionTitle}>By Category</Text>
        {Object.entries(summary.byCategory).map(([cat, cents]) => (
          <View key={cat} style={styles.catRow}>
            <Text style={styles.catLabel}>{cat}</Text>
            <Text style={styles.catValue}>{fmt(cents)}</Text>
          </View>
        ))}
        <View style={styles.catRow}>
          <Text style={[styles.catLabel, { fontWeight: '600' }]}>Total ({summary.entryCount} entries)</Text>
          <Text style={[styles.catValue, { color: ACCENT }]}>{fmt(summary.totalCents)}</Text>
        </View>
      </Card>

      {/* 1% Rule */}
      {homeValue > 0 && (
        <Card style={styles.section}>
          <Text style={styles.sectionTitle}>1% Rule</Text>
          <Text style={styles.ruleText}>
            Annual maintenance should be ~1% of home value ({fmt(onePercentAnnual)}/year).
          </Text>
          <Text style={styles.ruleText}>
            Your average monthly: {fmt(Math.round(avgMonthly))}/month ({fmt(Math.round(avgMonthly * 12))}/year).
          </Text>
        </Card>
      )}

      {/* Monthly Trend */}
      {trend.length > 0 && (
        <Card style={styles.section}>
          <Text style={styles.sectionTitle}>Monthly Trend</Text>
          {trend.slice(-6).map((t) => (
            <View key={t.month} style={styles.trendRow}>
              <Text style={styles.trendMonth}>{t.month}</Text>
              <View style={styles.trendBarBg}>
                <View style={[styles.trendBarFill, {
                  width: `${Math.min(100, (t.totalCents / Math.max(...trend.map((x) => x.totalCents), 1)) * 100)}%`,
                }]} />
              </View>
              <Text style={styles.trendValue}>{fmt(t.totalCents)}</Text>
            </View>
          ))}
        </Card>
      )}

      {/* 5-Year Forecast */}
      <Card style={styles.section}>
        <Text style={styles.sectionTitle}>5-Year Forecast</Text>
        <Text style={styles.forecastValue}>{fmt(fiveYearForecast)}</Text>
        <Text style={styles.forecastNote}>Based on your average monthly spending</Text>
      </Card>

      {/* Appliances Needing Attention */}
      {needAttention.length > 0 && (
        <Card style={styles.section}>
          <Text style={styles.sectionTitle}>Appliances to Watch</Text>
          {needAttention.map((a) => (
            <View key={a.id} style={styles.appRow}>
              <Text style={styles.appName}>{a.name}</Text>
              <Text style={styles.appMeta}>{a.category}</Text>
            </View>
          ))}
        </Card>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, gap: spacing.md, paddingBottom: 100 },
  emptyCard: { padding: spacing.xl, alignItems: 'center', gap: spacing.sm },
  emptyTitle: { fontSize: 20, fontWeight: '700', color: colors.text },
  emptyText: { fontSize: 14, color: colors.textSecondary, textAlign: 'center' },
  title: { fontSize: 24, fontWeight: '700', color: colors.text },
  heroCard: { padding: spacing.lg, alignItems: 'center', gap: spacing.xs },
  heroValue: { fontSize: 36, lineHeight: 44, fontWeight: '800', color: ACCENT },
  heroLabel: { fontSize: 12, color: colors.textSecondary, textTransform: 'uppercase', fontWeight: '600' },
  section: { padding: spacing.md, gap: spacing.sm },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
  catRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 2 },
  catLabel: { fontSize: 14, color: colors.textSecondary, textTransform: 'capitalize' },
  catValue: { fontSize: 14, fontWeight: '600', color: colors.text },
  ruleText: { fontSize: 13, color: colors.textSecondary, lineHeight: 20 },
  trendRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: 2 },
  trendMonth: { fontSize: 12, color: colors.textSecondary, width: 56 },
  trendBarBg: { flex: 1, height: 6, backgroundColor: colors.surface, borderRadius: 3 },
  trendBarFill: { height: 6, backgroundColor: ACCENT, borderRadius: 3 },
  trendValue: { fontSize: 12, fontWeight: '600', color: colors.text, width: 60, textAlign: 'right' },
  forecastValue: { fontSize: 28, fontWeight: '700', color: ACCENT },
  forecastNote: { fontSize: 12, color: colors.textTertiary },
  appRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: spacing.xs, borderBottomWidth: 1, borderBottomColor: colors.border },
  appName: { fontSize: 14, color: colors.text },
  appMeta: { fontSize: 12, color: colors.textSecondary, textTransform: 'capitalize' },
});
