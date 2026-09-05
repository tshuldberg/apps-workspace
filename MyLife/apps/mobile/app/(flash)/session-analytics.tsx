import { useMemo } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import {
  getFlashDashboard,
  getAccuracyTrend,
  getDifficultyDistribution,
  getMaturityDistribution,
  browseFlashcards,
  type FlashDashboard,
  type AccuracyTrendPoint,
  type DifficultyBucket,
  type MaturityBucket,
} from '@mylife/flash';
import { Card, Text, colors, spacing } from '@mylife/ui';
import { useDatabase } from '../../components/DatabaseProvider';

const ACCENT = '#9B7DDB';

const DIFFICULTY_COLORS: Record<string, string> = {
  hard: colors.danger,
  medium: '#FF9F0A',
  normal: '#F1C40F',
  easy: colors.success,
};

const MATURITY_COLORS: Record<string, string> = {
  new: '#3498DB',
  young: '#F1C40F',
  mature: colors.success,
};

export default function SessionAnalyticsScreen() {
  const db = useDatabase();

  const dashboard: FlashDashboard | null = useMemo(() => {
    try { return getFlashDashboard(db); } catch { return null; }
  }, [db]);

  const allCards = useMemo(() => {
    try { return browseFlashcards(db, {}); } catch { return []; }
  }, [db]);

  const accuracyTrend: AccuracyTrendPoint[] = useMemo(() => {
    try { return getAccuracyTrend([]); } catch { return []; }
  }, []);

  const difficultyDist: DifficultyBucket[] = useMemo(() => {
    try { return getDifficultyDistribution(allCards); } catch { return []; }
  }, [allCards]);

  const maturityDist: MaturityBucket[] = useMemo(() => {
    try { return getMaturityDistribution(allCards); } catch { return []; }
  }, [allCards]);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text variant="heading" style={{ color: ACCENT }}>Session Analytics</Text>

      {/* Key metrics */}
      {dashboard && (
        <View style={styles.metricsGrid}>
          <Card style={styles.metricCard}>
            <Text variant="caption" color={colors.textSecondary}>Streak</Text>
            <Text style={styles.metricValue}>{dashboard.currentStreak}d</Text>
          </Card>
          <Card style={styles.metricCard}>
            <Text variant="caption" color={colors.textSecondary}>Best Streak</Text>
            <Text style={styles.metricValue}>{dashboard.longestStreak}d</Text>
          </Card>
          <Card style={styles.metricCard}>
            <Text variant="caption" color={colors.textSecondary}>Reviewed</Text>
            <Text style={styles.metricValue}>{dashboard.reviewedToday}</Text>
          </Card>
        </View>
      )}

      {/* Difficulty distribution */}
      {difficultyDist.length > 0 && (
        <Card>
          <Text variant="label" color={colors.textTertiary}>DIFFICULTY DISTRIBUTION</Text>
          {difficultyDist.map((bucket) => {
            const total = difficultyDist.reduce((s, b) => s + b.count, 0);
            const pct = total > 0 ? (bucket.count / total) * 100 : 0;
            return (
              <View key={bucket.label} style={styles.distRow}>
                <View style={styles.distInfo}>
                  <View style={[styles.distDot, { backgroundColor: DIFFICULTY_COLORS[bucket.label] ?? ACCENT }]} />
                  <Text variant="body">{bucket.label}</Text>
                </View>
                <View style={styles.distBarContainer}>
                  <View style={[styles.distBar, {
                    width: `${pct}%`,
                    backgroundColor: DIFFICULTY_COLORS[bucket.label] ?? ACCENT,
                  }]} />
                </View>
                <Text variant="caption" color={colors.textSecondary} style={styles.distCount}>
                  {bucket.count}
                </Text>
              </View>
            );
          })}
        </Card>
      )}

      {/* Maturity distribution */}
      {maturityDist.length > 0 && (
        <Card>
          <Text variant="label" color={colors.textTertiary}>CARD MATURITY</Text>
          {maturityDist.map((bucket) => {
            const total = maturityDist.reduce((s, b) => s + b.count, 0);
            const pct = total > 0 ? (bucket.count / total) * 100 : 0;
            return (
              <View key={bucket.level} style={styles.distRow}>
                <View style={styles.distInfo}>
                  <View style={[styles.distDot, { backgroundColor: MATURITY_COLORS[bucket.level] ?? ACCENT }]} />
                  <Text variant="body">{bucket.level}</Text>
                </View>
                <View style={styles.distBarContainer}>
                  <View style={[styles.distBar, {
                    width: `${pct}%`,
                    backgroundColor: MATURITY_COLORS[bucket.level] ?? ACCENT,
                  }]} />
                </View>
                <Text variant="caption" color={colors.textSecondary} style={styles.distCount}>
                  {bucket.count}
                </Text>
              </View>
            );
          })}
        </Card>
      )}

      {/* Accuracy trend */}
      {accuracyTrend.length > 0 && (
        <Card>
          <Text variant="label" color={colors.textTertiary}>ACCURACY TREND</Text>
          {accuracyTrend.slice(-7).map((pt) => (
            <View key={pt.date} style={styles.trendRow}>
              <Text variant="caption" color={colors.textSecondary} style={styles.trendDate}>
                {pt.date.slice(5)}
              </Text>
              <View style={styles.trendBarContainer}>
                <View style={[styles.trendBar, {
                  width: `${pt.accuracy * 100}%`,
                  backgroundColor: pt.accuracy >= 0.8 ? colors.success : pt.accuracy >= 0.5 ? '#FF9F0A' : colors.danger,
                }]} />
              </View>
              <Text variant="iconCaption" color={colors.textTertiary}>
                {(pt.accuracy * 100).toFixed(0)}%
              </Text>
            </View>
          ))}
        </Card>
      )}

      {!dashboard && (
        <Card>
          <View style={styles.emptyState}>
            <Text style={{ fontSize: 48 }}>📊</Text>
            <Text variant="body" color={colors.textSecondary}>No session data yet.</Text>
          </View>
        </Card>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, paddingBottom: spacing.xxl, gap: spacing.md },
  metricsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  metricCard: { width: '31.5%', minWidth: 95, gap: spacing.xs },
  metricValue: { color: ACCENT, fontSize: 20, fontWeight: '700' },
  distRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: 6,
  },
  distInfo: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, width: 80 },
  distDot: { width: 10, height: 10, borderRadius: 5 },
  distBarContainer: {
    flex: 1, height: 8, borderRadius: 4,
    backgroundColor: colors.surfaceElevated, overflow: 'hidden',
  },
  distBar: { height: 8, borderRadius: 4 },
  distCount: { width: 30, textAlign: 'right' },
  trendRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: 4,
  },
  trendDate: { width: 50 },
  trendBarContainer: {
    flex: 1, height: 8, borderRadius: 4,
    backgroundColor: colors.surfaceElevated, overflow: 'hidden',
  },
  trendBar: { height: 8, borderRadius: 4 },
  emptyState: { paddingVertical: spacing.xl, alignItems: 'center', gap: spacing.sm },
});
