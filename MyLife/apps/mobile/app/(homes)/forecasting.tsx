import { useMemo } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import {
  getProperties,
  getCostEntriesForProperty,
  getMonthlyCostTrend,
} from '@mylife/homes';
import type { CostCategory } from '@mylife/homes';
import { Card, Text, colors, spacing } from '@mylife/ui';
import { useDatabase } from '../../components/DatabaseProvider';

const ACCENT = colors.modules.homes;
const fmt = (c: number) => `$${Math.round(c / 100).toLocaleString()}`;

const CATEGORY_COLORS: Record<CostCategory, string> = {
  maintenance: colors.modules.homes,
  repair: colors.danger,
  improvement: colors.success,
  utility: colors.modules.surf,
  other: colors.textTertiary,
};

export default function ForecastingScreen() {
  const db = useDatabase();
  const properties = useMemo(() => getProperties(db), [db]);
  const propId = properties[0]?.id;
  const entries = useMemo(() => propId ? getCostEntriesForProperty(db, propId) : [], [db, propId]);
  const trend = useMemo(() => getMonthlyCostTrend(entries), [entries]);

  const avgMonthly = trend.length > 0
    ? Math.round(trend.reduce((s, t) => s + t.totalCents, 0) / trend.length)
    : 0;
  const avgAnnual = avgMonthly * 12;

  // Category forecasts
  const catEntries = (cat: CostCategory) => entries.filter((e) => e.category === cat);
  const catMonthlyAvg = (cat: CostCategory) => {
    const catTrend = getMonthlyCostTrend(catEntries(cat));
    return catTrend.length > 0
      ? Math.round(catTrend.reduce((s, t) => s + t.totalCents, 0) / catTrend.length)
      : 0;
  };

  // Surprise expense reserve: 10% of average annual
  const reserveRecommendation = Math.round(avgAnnual * 0.1);

  if (!propId) {
    return (
      <View style={styles.container}>
        <Card style={styles.emptyCard}>
          <Text style={{ fontSize: 40 }}>📈</Text>
          <Text style={styles.emptyTitle}>No Properties</Text>
          <Text style={styles.emptyText}>Add a property and log costs to see forecasts.</Text>
        </Card>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Cost Forecasting</Text>

      {/* Summary */}
      <View style={styles.metricsRow}>
        <Card style={styles.metricCard}>
          <Text style={styles.metricValue}>{fmt(avgMonthly)}</Text>
          <Text style={styles.metricLabel}>Monthly Avg</Text>
        </Card>
        <Card style={styles.metricCard}>
          <Text style={styles.metricValue}>{fmt(avgAnnual)}</Text>
          <Text style={styles.metricLabel}>Annual Proj.</Text>
        </Card>
      </View>

      {/* Budget vs Actual */}
      <Card style={styles.section}>
        <Text style={styles.sectionTitle}>Category Forecasts (Monthly)</Text>
        {(['maintenance', 'repair', 'improvement', 'utility'] as CostCategory[]).map((cat) => {
          const monthly = catMonthlyAvg(cat);
          return (
            <View key={cat} style={styles.catRow}>
              <View style={[styles.catDot, { backgroundColor: CATEGORY_COLORS[cat] }]} />
              <Text style={styles.catLabel}>{cat}</Text>
              <Text style={styles.catValue}>{fmt(monthly)}/mo</Text>
              <Text style={styles.catAnnual}>{fmt(monthly * 12)}/yr</Text>
            </View>
          );
        })}
      </Card>

      {/* Surprise Expense Reserve */}
      <Card style={styles.section}>
        <Text style={styles.sectionTitle}>Emergency Reserve</Text>
        <Text style={styles.reserveValue}>{fmt(reserveRecommendation)}</Text>
        <Text style={styles.reserveNote}>
          Recommended annual reserve (10% of projected costs) for unexpected repairs.
        </Text>
      </Card>

      {/* Monthly Trend Chart */}
      {trend.length > 0 && (
        <Card style={styles.section}>
          <Text style={styles.sectionTitle}>Spending Trend</Text>
          {trend.slice(-12).map((t) => {
            const maxCents = Math.max(...trend.map((x) => x.totalCents), 1);
            return (
              <View key={t.month} style={styles.trendRow}>
                <Text style={styles.trendMonth}>{t.month.slice(5)}</Text>
                <View style={styles.trendBarBg}>
                  <View style={[styles.trendBarFill, { width: `${(t.totalCents / maxCents) * 100}%` }]} />
                </View>
                <Text style={styles.trendValue}>{fmt(t.totalCents)}</Text>
              </View>
            );
          })}
        </Card>
      )}

      {/* Savings Goal Calculator */}
      <Card style={styles.section}>
        <Text style={styles.sectionTitle}>Savings Goals</Text>
        {[
          { name: 'Kitchen Remodel', target: 2000000 },
          { name: 'Roof Replacement', target: 1000000 },
          { name: 'Bathroom Update', target: 800000 },
        ].map((goal) => {
          const monthsToSave = avgMonthly > 0 ? Math.ceil(goal.target / avgMonthly) : 0;
          return (
            <View key={goal.name} style={styles.goalRow}>
              <Text style={styles.goalName}>{goal.name}</Text>
              <Text style={styles.goalTarget}>{fmt(goal.target)}</Text>
              <Text style={styles.goalMonths}>
                ~{monthsToSave} months at current rate
              </Text>
            </View>
          );
        })}
      </Card>
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
  metricsRow: { flexDirection: 'row', gap: spacing.sm },
  metricCard: { flex: 1, padding: spacing.md, alignItems: 'center', gap: 2 },
  metricValue: { fontSize: 22, fontWeight: '800', color: ACCENT },
  metricLabel: { fontSize: 11, color: colors.textSecondary, textTransform: 'uppercase', fontWeight: '600' },
  section: { padding: spacing.md, gap: spacing.sm },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
  catRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: 2 },
  catDot: { width: 8, height: 8, borderRadius: 4 },
  catLabel: { fontSize: 13, color: colors.textSecondary, textTransform: 'capitalize', flex: 1 },
  catValue: { fontSize: 13, fontWeight: '600', color: colors.text, width: 70, textAlign: 'right' },
  catAnnual: { fontSize: 11, color: colors.textTertiary, width: 65, textAlign: 'right' },
  reserveValue: { fontSize: 28, fontWeight: '700', color: colors.warning },
  reserveNote: { fontSize: 13, color: colors.textSecondary, lineHeight: 20 },
  trendRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: 2 },
  trendMonth: { fontSize: 12, color: colors.textSecondary, width: 30 },
  trendBarBg: { flex: 1, height: 6, backgroundColor: colors.surface, borderRadius: 3 },
  trendBarFill: { height: 6, backgroundColor: ACCENT, borderRadius: 3 },
  trendValue: { fontSize: 12, fontWeight: '600', color: colors.text, width: 60, textAlign: 'right' },
  goalRow: { paddingVertical: spacing.xs, borderBottomWidth: 1, borderBottomColor: colors.border },
  goalName: { fontSize: 14, fontWeight: '600', color: colors.text },
  goalTarget: { fontSize: 13, color: ACCENT },
  goalMonths: { fontSize: 12, color: colors.textSecondary },
});
