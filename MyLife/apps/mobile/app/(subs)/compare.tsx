import { useMemo } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import {
  getComparison,
  getComparisonSummary,
} from '@mylife/subs';
import { Card, Text, colors, spacing } from '@mylife/ui';
import { useDatabase } from '../../components/DatabaseProvider';

const ACCENT = colors.modules.subs;

export default function CompareScreen() {
  const db = useDatabase();
  const { id } = useLocalSearchParams<{ id: string }>();

  const comparison = useMemo(() => (id ? getComparison(db, id) : null), [db, id]);
  const overallSummary = useMemo(() => getComparisonSummary(db), [db]);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      {/* Overall savings summary */}
      <Card>
        <Text variant="subheading">Savings Overview</Text>
        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <Text style={[styles.statValue, { color: colors.success }]}>
              ${(overallSummary.totalMonthlySavingsCents / 100).toFixed(0)}
            </Text>
            <Text variant="caption" color={colors.textSecondary}>Potential Savings/mo</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={[styles.statValue, { color: ACCENT }]}>
              {overallSummary.subscriptionsWithSavings}
            </Text>
            <Text variant="caption" color={colors.textSecondary}>With Savings</Text>
          </View>
        </View>
        {overallSummary.topOpportunity && (
          <Text variant="caption" color={colors.textSecondary}>
            Top opportunity: {overallSummary.topOpportunity}
          </Text>
        )}
      </Card>

      {/* Specific comparison */}
      {comparison ? (
        <>
          <Card>
            <Text variant="subheading">{comparison.subscriptionName}</Text>
            <Text variant="body" color={ACCENT}>
              Current: ${(comparison.currentMonthlyCents / 100).toFixed(2)}/mo
            </Text>
          </Card>

          {/* Cheaper tiers */}
          {comparison.cheaperTiers.length > 0 && (
            <Card>
              <Text variant="subheading">Cheaper Tiers</Text>
              <View style={styles.list}>
                {comparison.cheaperTiers.map((tier, i) => (
                  <View key={i} style={styles.altRow}>
                    <View style={styles.mainCopy}>
                      <Text variant="body">{tier.tierName}</Text>
                      <Text variant="caption" color={colors.textSecondary}>
                        ${(tier.monthlyCents / 100).toFixed(2)}/mo
                      </Text>
                    </View>
                    <Text variant="body" color={colors.success}>
                      -${(tier.savingsCents / 100).toFixed(2)}/mo
                    </Text>
                  </View>
                ))}
              </View>
            </Card>
          )}

          {/* Annual discount */}
          {comparison.annualSavings && (
            <Card>
              <Text variant="subheading">Annual Discount Available</Text>
              <Text variant="body">
                ${(comparison.annualSavings.annualCostCents / 100).toFixed(2)}/year
              </Text>
              <Text variant="body" color={colors.success}>
                Save ${(comparison.annualSavings.annualSavingsCents / 100).toFixed(2)}/year by switching to annual
              </Text>
            </Card>
          )}

          {/* Alternative services */}
          {comparison.alternatives.length > 0 && (
            <Card>
              <Text variant="subheading">Alternative Services</Text>
              <View style={styles.list}>
                {comparison.alternatives.map((alt, i) => (
                  <View key={i} style={styles.altRow}>
                    <View style={styles.mainCopy}>
                      <Text variant="body">{alt.name}{alt.freeOptionAvailable ? ' (Free)' : ''}</Text>
                      <Text variant="caption" color={colors.textSecondary}>
                        ${(alt.monthlyCents / 100).toFixed(2)}/mo
                      </Text>
                    </View>
                    {alt.savingsCents > 0 && (
                      <Text variant="body" color={colors.success}>
                        -${(alt.savingsCents / 100).toFixed(2)}/mo
                      </Text>
                    )}
                  </View>
                ))}
              </View>
            </Card>
          )}
        </>
      ) : (
        <Card>
          <Text variant="body" color={colors.textSecondary}>
            {id
              ? 'No comparison data available for this subscription.'
              : 'Select a subscription to compare prices.'}
          </Text>
        </Card>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, paddingBottom: spacing.xxl, gap: spacing.md },
  statsGrid: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  statCard: {
    flex: 1, padding: spacing.sm, borderRadius: 12, alignItems: 'center',
    backgroundColor: colors.surfaceElevated, borderWidth: 1, borderColor: colors.border, gap: 2,
  },
  statValue: { fontSize: 20, fontWeight: '700' },
  list: { gap: spacing.sm, marginTop: spacing.sm },
  altRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    padding: spacing.sm, borderRadius: 10,
    backgroundColor: colors.surfaceElevated, borderWidth: 1, borderColor: colors.border,
  },
  mainCopy: { flex: 1, gap: 2 },
});
