import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import {
  getCostSummary,
  getCategoryBreakdown,
  getUpcomingRenewals,
} from '@mylife/subs';
import { Card, Text, colors, spacing } from '@mylife/ui';
import { useDatabase } from '../../components/DatabaseProvider';

const ACCENT = colors.modules.subs;

export default function SubsDashboardScreen() {
  const db = useDatabase();
  const router = useRouter();

  const summary = useMemo(() => getCostSummary(db), [db]);
  const categories = useMemo(() => getCategoryBreakdown(db), [db]);
  const upcoming = useMemo(() => getUpcomingRenewals(db, 7), [db]);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      {/* Hero monthly total */}
      <Card style={styles.heroCard}>
        <Text variant="caption" color={colors.textSecondary}>Monthly Total</Text>
        <Text style={[styles.heroValue, { color: ACCENT }]}>
          ${(summary.totalMonthlyCents / 100).toFixed(2)}
        </Text>
        <Text variant="caption" color={colors.textSecondary}>
          ${(summary.totalAnnualCents / 100).toFixed(0)}/year
          {summary.mostExpensive
            ? ` -- Most expensive: ${summary.mostExpensive.name}`
            : ''}
        </Text>
      </Card>

      {/* Calendar link */}
      <Pressable style={styles.calendarLink} onPress={() => router.push('/(subs)/calendar')}>
        <Text variant="label" color={ACCENT}>Renewal Calendar</Text>
      </Pressable>

      {/* Stats */}
      <View style={styles.statsGrid}>
        <View style={styles.statCard}>
          <Text style={[styles.statValue, { color: ACCENT }]}>{summary.activeCount}</Text>
          <Text variant="caption" color={colors.textSecondary}>Active</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={[styles.statValue, { color: '#F59E0B' }]}>{summary.pausedCount}</Text>
          <Text variant="caption" color={colors.textSecondary}>Paused</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={[styles.statValue, { color: colors.textTertiary }]}>{summary.cancelledCount}</Text>
          <Text variant="caption" color={colors.textSecondary}>Cancelled</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={[styles.statValue, { color: '#3B82F6' }]}>{summary.trialCount}</Text>
          <Text variant="caption" color={colors.textSecondary}>Trials</Text>
        </View>
      </View>

      {/* Upcoming renewals */}
      {upcoming.length > 0 && (
        <Card>
          <Text variant="subheading">Upcoming Renewals</Text>
          <View style={styles.list}>
            {upcoming.slice(0, 5).map((renewal) => (
              <View key={renewal.id} style={styles.renewalRow}>
                <View style={styles.mainCopy}>
                  <Text variant="body">{renewal.name}</Text>
                  <Text variant="caption" color={colors.textSecondary}>
                    {renewal.renewalDate}
                  </Text>
                </View>
                <Text variant="body" color={ACCENT}>
                  ${(renewal.renewalAmountCents / 100).toFixed(2)}
                </Text>
              </View>
            ))}
          </View>
        </Card>
      )}

      {/* Category breakdown */}
      {categories.length > 0 && (
        <Card>
          <Text variant="subheading">By Category</Text>
          <View style={styles.list}>
            {categories.map((cat) => (
              <View key={cat.categoryId ?? 'uncategorized'} style={styles.categoryRow}>
                <View style={[styles.dot, { backgroundColor: cat.categoryColor }]} />
                <Text variant="body" style={styles.catLabel}>{cat.categoryName}</Text>
                <Text variant="caption" color={colors.textSecondary}>{cat.subscriptionCount}</Text>
                <Text variant="body" color={colors.textSecondary}>
                  ${(cat.monthlyCents / 100).toFixed(0)}/mo
                </Text>
              </View>
            ))}
          </View>
        </Card>
      )}

      {/* Quick actions */}
      <View style={styles.buttonRow}>
        <Pressable style={styles.actionButton} onPress={() => router.push('/(subs)/add-sub')}>
          <Text variant="label" color={colors.background}>+ Add Sub</Text>
        </Pressable>
        <Pressable style={styles.actionButton} onPress={() => router.push('/(subs)/cost-report')}>
          <Text variant="label" color={colors.background}>Cost Report</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, paddingBottom: spacing.xxl, gap: spacing.md },
  heroCard: { alignItems: 'center', gap: spacing.xs },
  heroValue: { fontSize: 42, fontWeight: '700' },
  statsGrid: { flexDirection: 'row', gap: spacing.sm },
  statCard: {
    flex: 1, padding: spacing.sm, borderRadius: 12, alignItems: 'center',
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, gap: 2,
  },
  statValue: { fontSize: 20, fontWeight: '700' },
  list: { gap: spacing.sm, marginTop: spacing.sm },
  renewalRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    padding: spacing.sm, borderRadius: 10,
    backgroundColor: colors.surfaceElevated, borderWidth: 1, borderColor: colors.border,
  },
  mainCopy: { flex: 1, gap: 2 },
  categoryRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    padding: spacing.sm, borderRadius: 10,
    backgroundColor: colors.surfaceElevated, borderWidth: 1, borderColor: colors.border,
  },
  dot: { width: 10, height: 10, borderRadius: 5 },
  catLabel: { flex: 1 },
  buttonRow: { flexDirection: 'row', gap: spacing.sm },
  actionButton: {
    flex: 1, backgroundColor: ACCENT, borderRadius: 12,
    paddingVertical: spacing.sm, alignItems: 'center',
  },
  calendarLink: {
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
});
