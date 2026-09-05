import { useMemo } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import {
  browseFlashcards,
  calculateRetentionRate,
  getRetentionBuckets,
  type RetentionBucket,
} from '@mylife/flash';
import { Card, Text, colors, spacing } from '@mylife/ui';
import { useDatabase } from '../../components/DatabaseProvider';

const ACCENT = '#9B7DDB';

const LEVEL_COLORS: Record<string, string> = {
  critical: colors.danger,
  low: '#FF9F0A',
  moderate: '#F1C40F',
  strong: colors.success,
};

export default function ForgettingCurveScreen() {
  const db = useDatabase();
  const today = new Date().toISOString().slice(0, 10);

  const allCards = useMemo(() => {
    try { return browseFlashcards(db, {}); } catch { return []; }
  }, [db]);

  const retentionBuckets: RetentionBucket[] = useMemo(() => {
    try { return getRetentionBuckets(allCards, today); } catch { return []; }
  }, [allCards, today]);

  const retentionStats = useMemo(() => {
    try { return calculateRetentionRate([]); } catch { return null; }
  }, []);

  const totalCards = retentionBuckets.reduce((s, b) => s + b.count, 0);

  if (allCards.length === 0) {
    return (
      <View style={styles.emptyScreen}>
        <Text style={styles.emptyIcon}>📉</Text>
        <Text variant="subheading" color={colors.textSecondary}>Forgetting Curve</Text>
        <Text variant="caption" color={colors.textTertiary}>
          Study some cards to see your retention analysis.
        </Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text variant="heading" style={{ color: ACCENT }}>Forgetting Curve</Text>

      {/* Explanation */}
      <Card>
        <Text variant="label" color={colors.textTertiary}>HOW IT WORKS</Text>
        <Text variant="body" color={colors.textSecondary}>
          Without review, memories decay exponentially. Spaced repetition fights this by reviewing cards at optimal intervals, strengthening memory each time.
        </Text>
      </Card>

      {/* Retention buckets */}
      {retentionBuckets.length > 0 && (
        <Card>
          <Text variant="label" color={colors.textTertiary}>MEMORY STRENGTH</Text>
          {retentionBuckets.map((bucket) => {
            const pct = totalCards > 0 ? (bucket.count / totalCards) * 100 : 0;
            return (
              <View key={bucket.level} style={styles.bucketRow}>
                <View style={styles.bucketInfo}>
                  <View style={[styles.bucketDot, { backgroundColor: LEVEL_COLORS[bucket.level] ?? colors.textSecondary }]} />
                  <Text variant="body">
                    {bucket.level.charAt(0).toUpperCase() + bucket.level.slice(1)}
                  </Text>
                </View>
                <View style={styles.bucketBarContainer}>
                  <View style={[styles.bucketBar, {
                    width: `${pct}%`,
                    backgroundColor: LEVEL_COLORS[bucket.level] ?? ACCENT,
                  }]} />
                </View>
                <Text variant="caption" color={colors.textSecondary} style={styles.bucketCount}>
                  {bucket.count}
                </Text>
              </View>
            );
          })}
        </Card>
      )}

      {/* Key metrics */}
      <View style={styles.metricsGrid}>
        <Card style={styles.metricCard}>
          <Text variant="caption" color={colors.textSecondary}>Total Cards</Text>
          <Text style={styles.metricValue}>{allCards.length}</Text>
        </Card>
        <Card style={styles.metricCard}>
          <Text variant="caption" color={colors.textSecondary}>Tracked</Text>
          <Text style={styles.metricValue}>{totalCards}</Text>
        </Card>
      </View>

      {/* Ebbinghaus curve visualization */}
      <Card>
        <Text variant="label" color={colors.textTertiary}>EBBINGHAUS CURVE</Text>
        <View style={styles.curveChart}>
          {[0, 1, 2, 4, 7, 14, 30].map((day, i) => {
            // Theoretical retention: R = e^(-t/S), S=14 days
            const retention = Math.exp(-day / 14) * 100;
            return (
              <View key={day} style={styles.curveCol}>
                <View style={[styles.curveBar, { height: retention * 0.6, backgroundColor: ACCENT }]} />
                <Text variant="iconCaption" color={colors.textTertiary}>
                  {day === 0 ? 'Now' : `${day}d`}
                </Text>
              </View>
            );
          })}
        </View>
        <Text variant="caption" color={colors.textSecondary} style={{ marginTop: spacing.sm }}>
          Theoretical retention without review. Spaced repetition keeps your cards in the green zone.
        </Text>
      </Card>
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
  bucketRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: 6,
  },
  bucketInfo: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, width: 90 },
  bucketDot: { width: 10, height: 10, borderRadius: 5 },
  bucketBarContainer: {
    flex: 1, height: 8, borderRadius: 4,
    backgroundColor: colors.surfaceElevated, overflow: 'hidden',
  },
  bucketBar: { height: 8, borderRadius: 4 },
  bucketCount: { width: 30, textAlign: 'right' },
  metricsGrid: { flexDirection: 'row', gap: spacing.sm },
  metricCard: { flex: 1, gap: spacing.xs },
  metricValue: { color: ACCENT, fontSize: 24, fontWeight: '700' },
  curveChart: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end',
    height: 80, marginTop: spacing.sm,
  },
  curveCol: { alignItems: 'center', gap: 2, flex: 1 },
  curveBar: { width: 16, borderRadius: 4, minHeight: 4 },
});
