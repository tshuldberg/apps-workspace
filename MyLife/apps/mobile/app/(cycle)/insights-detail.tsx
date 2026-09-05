import { useMemo } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import {
  getCycles,
  getCycleStats,
  generateCycleInsights,
  detectCycleTrend,
  getSymptomFrequencies,
  predictNextPeriod,
  type CycleInsight,
  type CycleTrend,
} from '@mylife/cycle';
import { Card, Text, colors, spacing } from '@mylife/ui';
import { useDatabase } from '../../components/DatabaseProvider';

const ACCENT = colors.modules.cycle;

function trendColor(direction: string): string {
  if (direction === 'stable') return colors.success;
  if (direction === 'insufficient_data') return colors.textTertiary;
  return '#FF9F0A';
}

export default function InsightsDetailScreen() {
  const db = useDatabase();
  const today = new Date().toISOString().slice(0, 10);

  const cycles = useMemo(() => {
    try { return getCycles(db); } catch { return []; }
  }, [db]);

  const stats = useMemo(() => {
    try { return getCycleStats(db); } catch { return null; }
  }, [db]);

  const cycleLengths = useMemo(
    () => cycles.filter((c) => c.lengthDays != null).map((c) => c.lengthDays!),
    [cycles],
  );

  const periodLengths = useMemo(
    () => cycles.filter((c) => c.periodLength != null).map((c) => c.periodLength!),
    [cycles],
  );

  const cycleTrend: CycleTrend | null = useMemo(() => {
    if (cycleLengths.length < 3) return null;
    try { return detectCycleTrend(cycleLengths); } catch { return null; }
  }, [cycleLengths]);

  const prediction = useMemo(() => {
    if (cycles.length === 0) return null;
    try {
      return predictNextPeriod(cycles[0].startDate, cycleLengths, periodLengths, today);
    } catch { return null; }
  }, [cycles, cycleLengths, periodLengths, today]);

  const insights: CycleInsight[] = useMemo(() => {
    if (!stats) return [];
    try {
      // Pass empty symptomPatterns since building them requires raw entries
      return generateCycleInsights(stats, prediction, cycleTrend, [], today);
    } catch { return []; }
  }, [stats, prediction, cycleTrend, today]);

  const symptomFreqs = useMemo(() => {
    try { return getSymptomFrequencies(db); } catch { return []; }
  }, [db]);

  if (cycles.length === 0) {
    return (
      <View style={styles.emptyScreen}>
        <Text style={styles.emptyIcon}>📊</Text>
        <Text variant="subheading" color={colors.textSecondary}>Cycle Insights</Text>
        <Text variant="caption" color={colors.textTertiary}>
          Log at least 3 cycles to see detailed insights.
        </Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text variant="heading" style={{ color: ACCENT }}>Cycle Insights</Text>

      {/* Key stats */}
      {stats && (
        <View style={styles.metricsGrid}>
          <Card style={styles.metricCard}>
            <Text variant="caption" color={colors.textSecondary}>Avg Cycle</Text>
            <Text style={styles.metricValue}>
              {stats.averageCycleLength != null ? `${stats.averageCycleLength}d` : '--'}
            </Text>
          </Card>
          <Card style={styles.metricCard}>
            <Text variant="caption" color={colors.textSecondary}>Avg Period</Text>
            <Text style={styles.metricValue}>
              {stats.averagePeriodLength != null ? `${stats.averagePeriodLength}d` : '--'}
            </Text>
          </Card>
          <Card style={styles.metricCard}>
            <Text variant="caption" color={colors.textSecondary}>Cycles</Text>
            <Text style={styles.metricValue}>{stats.totalCycles}</Text>
          </Card>
        </View>
      )}

      {/* Cycle trend */}
      {cycleTrend && (
        <Card>
          <Text variant="label" color={colors.textTertiary}>CYCLE LENGTH TREND</Text>
          <View style={styles.trendRow}>
            <View style={[styles.trendDot, { backgroundColor: trendColor(cycleTrend.direction) }]} />
            <Text variant="body" color={trendColor(cycleTrend.direction)}>
              {cycleTrend.direction.charAt(0).toUpperCase() + cycleTrend.direction.slice(1)}
            </Text>
          </View>
          <Text variant="caption" color={colors.textSecondary}>
            Regularity: {(cycleTrend.regularity * 100).toFixed(0)}% (trend: {cycleTrend.regularityTrend})
          </Text>
        </Card>
      )}

      {/* Generated insights */}
      {insights.length > 0 && (
        <Card>
          <Text variant="label" color={colors.textTertiary}>INSIGHTS</Text>
          {insights.map((insight) => (
            <View key={insight.key} style={styles.insightCard}>
              <View style={styles.insightRow}>
                <View style={[styles.priorityDot, {
                  backgroundColor: insight.priority === 'high' ? colors.danger
                    : insight.priority === 'medium' ? '#FF9F0A' : colors.textTertiary
                }]} />
                <Text variant="body" color={colors.textSecondary} style={{ flex: 1 }}>
                  {insight.text}
                </Text>
              </View>
            </View>
          ))}
        </Card>
      )}

      {/* Symptom frequencies */}
      {symptomFreqs.length > 0 && (
        <Card>
          <Text variant="label" color={colors.textTertiary}>SYMPTOM PATTERNS</Text>
          {symptomFreqs.slice(0, 10).map((sf) => {
            const maxFreq = symptomFreqs[0]?.count ?? 1;
            const barW = (sf.count / maxFreq) * 100;
            return (
              <View key={sf.symptom} style={styles.freqRow}>
                <Text variant="caption" color={colors.textSecondary} style={styles.freqLabel}>
                  {sf.symptom.replace(/_/g, ' ')}
                </Text>
                <View style={styles.freqBarContainer}>
                  <View style={[styles.freqBar, { width: `${barW}%`, backgroundColor: ACCENT }]} />
                </View>
                <Text variant="iconCaption" color={colors.textTertiary} style={styles.freqCount}>
                  {sf.count}
                </Text>
              </View>
            );
          })}
        </Card>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, paddingBottom: spacing.xxl, gap: spacing.md },
  emptyScreen: {
    flex: 1, backgroundColor: colors.background, justifyContent: 'center',
    alignItems: 'center', padding: spacing.xl,
  },
  emptyIcon: { fontSize: 48, marginBottom: spacing.sm },
  metricsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  metricCard: { width: '31.5%', minWidth: 95, gap: spacing.xs },
  metricValue: { color: ACCENT, fontSize: 20, fontWeight: '700' },
  trendRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  trendDot: { width: 10, height: 10, borderRadius: 5 },
  insightCard: {
    paddingVertical: spacing.sm,
    borderBottomWidth: 1, borderBottomColor: colors.glass,
  },
  insightRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  priorityDot: { width: 8, height: 8, borderRadius: 4, marginTop: 6 },
  freqRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: 4,
  },
  freqLabel: { width: 90 },
  freqBarContainer: {
    flex: 1, height: 8, borderRadius: 4,
    backgroundColor: colors.surfaceElevated, overflow: 'hidden',
  },
  freqBar: { height: 8, borderRadius: 4 },
  freqCount: { width: 30, textAlign: 'right' },
});
