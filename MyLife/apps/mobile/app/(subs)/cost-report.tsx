import { useMemo } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import {
  getCostSummary,
  getCategoryBreakdown,
  getCycleBreakdown,
  getPriceChanges,
  getSpendingProjection,
} from '@mylife/subs';
import { Card, Text, colors, spacing } from '@mylife/ui';
import { useDatabase } from '../../components/DatabaseProvider';

const ACCENT = colors.modules.subs;

export default function CostReportScreen() {
  const db = useDatabase();

  const summary = useMemo(() => getCostSummary(db), [db]);
  const categories = useMemo(() => getCategoryBreakdown(db), [db]);
  const cycles = useMemo(() => getCycleBreakdown(db), [db]);
  const priceChanges = useMemo(() => getPriceChanges(db), [db]);
  const projection = useMemo(() => getSpendingProjection(db), [db]);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      {/* Annual spending */}
      <Card style={styles.heroCard}>
        <Text variant="caption" color={colors.textSecondary}>Annual Subscription Spending</Text>
        <Text style={[styles.heroValue, { color: ACCENT }]}>
          ${(summary.totalAnnualCents / 100).toFixed(0)}
        </Text>
        <Text variant="caption" color={colors.textSecondary}>
          ${(summary.totalMonthlyCents / 100).toFixed(2)}/month -- ${(summary.totalWeeklyCents / 100).toFixed(2)}/week
        </Text>
      </Card>

      {/* Highlights */}
      <Card>
        <Text variant="subheading">Highlights</Text>
        <View style={styles.list}>
          {summary.mostExpensive && (
            <View style={styles.highlightRow}>
              <Text variant="body">Most Expensive</Text>
              <Text variant="body" color={ACCENT}>
                {summary.mostExpensive.name} (${(summary.mostExpensive.monthlyCents / 100).toFixed(2)}/mo)
              </Text>
            </View>
          )}
          {summary.cheapest && (
            <View style={styles.highlightRow}>
              <Text variant="body">Cheapest</Text>
              <Text variant="body" color={colors.textSecondary}>
                {summary.cheapest.name} (${(summary.cheapest.monthlyCents / 100).toFixed(2)}/mo)
              </Text>
            </View>
          )}
          <View style={styles.highlightRow}>
            <Text variant="body">Average per Sub</Text>
            <Text variant="body" color={colors.textSecondary}>
              ${(summary.averageMonthlyCents / 100).toFixed(2)}/mo
            </Text>
          </View>
        </View>
      </Card>

      {/* Category breakdown */}
      {categories.length > 0 && (
        <Card>
          <Text variant="subheading">By Category</Text>
          <View style={styles.list}>
            {categories.map((cat) => (
              <View key={cat.categoryId ?? 'uncategorized'} style={styles.categoryRow}>
                <View style={[styles.dot, { backgroundColor: cat.categoryColor }]} />
                <Text variant="body" style={styles.catLabel}>{cat.categoryName}</Text>
                <Text variant="caption" color={colors.textSecondary}>{cat.percentage}%</Text>
                <Text variant="body" color={colors.textSecondary}>
                  ${(cat.monthlyCents / 100).toFixed(0)}/mo
                </Text>
              </View>
            ))}
          </View>
        </Card>
      )}

      {/* Cycle breakdown */}
      {cycles.length > 0 && (
        <Card>
          <Text variant="subheading">By Billing Cycle</Text>
          <View style={styles.list}>
            {cycles.map((c) => (
              <View key={c.cycle} style={styles.categoryRow}>
                <Text variant="body" style={styles.catLabel}>{c.cycle}</Text>
                <Text variant="caption" color={colors.textSecondary}>{c.count} subs</Text>
                <Text variant="body" color={colors.textSecondary}>
                  ${(c.totalMonthlyCents / 100).toFixed(0)}/mo eq.
                </Text>
              </View>
            ))}
          </View>
        </Card>
      )}

      {/* Price changes */}
      {priceChanges.length > 0 && (
        <Card>
          <Text variant="subheading">Price Change History</Text>
          <View style={styles.list}>
            {priceChanges.map((pc) => (
              <View key={pc.subscriptionId} style={styles.changeRow}>
                <Text variant="body">{pc.subscriptionName}</Text>
                <Text variant="caption" color={pc.direction === 'increased' ? colors.danger : colors.success}>
                  {pc.direction === 'increased' ? '+' : ''}${(pc.totalChangeCents / 100).toFixed(2)} total
                  {' '}({pc.totalChangePercent}% -- {pc.changes.length} change{pc.changes.length !== 1 ? 's' : ''})
                </Text>
              </View>
            ))}
          </View>
        </Card>
      )}

      {/* Spending projection */}
      <Card>
        <Text variant="subheading">Spending Projection</Text>
        <View style={styles.list}>
          <View style={styles.projRow}>
            <Text variant="body">Next 30 days</Text>
            <Text variant="body" color={ACCENT}>${(projection.next30DaysCents / 100).toFixed(0)}</Text>
          </View>
          <View style={styles.projRow}>
            <Text variant="body">Next 90 days</Text>
            <Text variant="body" color={ACCENT}>${(projection.next90DaysCents / 100).toFixed(0)}</Text>
          </View>
          <View style={styles.projRow}>
            <Text variant="body">Next 12 months</Text>
            <Text variant="body" color={ACCENT}>${(projection.next12MonthsCents / 100).toFixed(0)}</Text>
          </View>
        </View>
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, paddingBottom: spacing.xxl, gap: spacing.md },
  heroCard: { alignItems: 'center', gap: spacing.xs },
  heroValue: { fontSize: 42, fontWeight: '700' },
  list: { gap: spacing.sm, marginTop: spacing.sm },
  highlightRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: spacing.xs,
  },
  categoryRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    padding: spacing.sm, borderRadius: 10,
    backgroundColor: colors.surfaceElevated, borderWidth: 1, borderColor: colors.border,
  },
  dot: { width: 10, height: 10, borderRadius: 5 },
  catLabel: { flex: 1 },
  changeRow: { gap: 2 },
  projRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    padding: spacing.sm, borderRadius: 10,
    backgroundColor: colors.surfaceElevated, borderWidth: 1, borderColor: colors.border,
  },
});
