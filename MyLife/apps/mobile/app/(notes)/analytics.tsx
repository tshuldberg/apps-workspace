import { useMemo } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import {
  getNotes,
  getNotesStats,
  computeWritingAnalytics,
} from '@mylife/notes';
import type { WritingAnalyticsInsights } from '@mylife/notes';
import { Text, Card, colors, spacing } from '@mylife/ui';
import { useDatabase } from '../../components/DatabaseProvider';

const ACCENT = colors.modules.notes;

export default function AnalyticsScreen() {
  const db = useDatabase();

  const notes = useMemo(() => {
    try { return getNotes(db); } catch { return []; }
  }, [db]);

  const stats = useMemo(() => {
    try { return getNotesStats(db); } catch { return null; }
  }, [db]);

  const analytics: WritingAnalyticsInsights | null = useMemo(() => {
    if (notes.length === 0) return null;
    try { return computeWritingAnalytics(notes); } catch { return null; }
  }, [notes]);

  if (notes.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={{ fontSize: 48 }}>{'📊'}</Text>
        <Text variant="subheading" style={{ marginTop: spacing.sm }}>Writing Analytics</Text>
        <Text variant="body" color={colors.textSecondary} style={styles.emptyText}>
          Create notes to see your writing patterns and statistics.
        </Text>
      </View>
    );
  }

  const totalWords = stats?.totalWords ?? 0;
  const avgLength = notes.length > 0 ? Math.round(totalWords / notes.length) : 0;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text variant="heading">Writing Analytics</Text>

      {/* Overview stats */}
      <View style={styles.statsGrid}>
        <Card style={styles.statCard}>
          <Text style={styles.statValue}>{stats?.totalNotes ?? 0}</Text>
          <Text style={styles.statLabel}>Notes</Text>
        </Card>
        <Card style={styles.statCard}>
          <Text style={styles.statValue}>{totalWords.toLocaleString()}</Text>
          <Text style={styles.statLabel}>Words</Text>
        </Card>
        <Card style={styles.statCard}>
          <Text style={styles.statValue}>{avgLength}</Text>
          <Text style={styles.statLabel}>Avg Length</Text>
        </Card>
      </View>

      {/* Writing streak */}
      {analytics?.streak && (
        <Card>
          <Text variant="label" color={colors.textTertiary}>WRITING STREAK</Text>
          <View style={styles.streakRow}>
            <Text style={[styles.streakValue, { color: ACCENT }]}>
              {analytics.streak.currentStreak}
            </Text>
            <View>
              <Text variant="body" color={colors.text}>day streak</Text>
              <Text variant="caption" color={colors.textTertiary}>
                Longest: {analytics.streak.longestStreak} days
              </Text>
            </View>
          </View>
        </Card>
      )}

      {/* Writing velocity */}
      {analytics?.velocity && (
        <Card>
          <Text variant="label" color={colors.textTertiary}>WRITING VELOCITY</Text>
          <View style={styles.velocityGrid}>
            <View style={styles.velocityItem}>
              <Text style={styles.velocityValue}>{analytics.velocity.notesPerWeek.toFixed(1)}</Text>
              <Text style={styles.velocityLabel}>notes/week</Text>
            </View>
            <View style={styles.velocityItem}>
              <Text style={styles.velocityValue}>{analytics.velocity.wordsPerWeek.toLocaleString()}</Text>
              <Text style={styles.velocityLabel}>words/week</Text>
            </View>
            {analytics.velocity.mostProductiveDay && (
              <View style={styles.velocityItem}>
                <Text style={styles.velocityValue}>{analytics.velocity.mostProductiveDay}</Text>
                <Text style={styles.velocityLabel}>best day</Text>
              </View>
            )}
          </View>
        </Card>
      )}

      {/* Word count distribution */}
      {analytics?.wordCountDistribution && analytics.wordCountDistribution.length > 0 && (
        <Card>
          <Text variant="label" color={colors.textTertiary}>NOTE LENGTH DISTRIBUTION</Text>
          {analytics.wordCountDistribution.map((bucket) => {
            const maxCount = Math.max(...analytics.wordCountDistribution.map((b) => b.count), 1);
            const pct = (bucket.count / maxCount) * 100;
            return (
              <View key={bucket.label} style={styles.distRow}>
                <Text variant="caption" color={colors.textSecondary} style={styles.distLabel}>
                  {bucket.label}
                </Text>
                <View style={styles.distBarOuter}>
                  <View style={[styles.distBarInner, { width: `${pct}%` }]} />
                </View>
                <Text variant="caption" color={colors.textTertiary} style={styles.distCount}>
                  {bucket.count}
                </Text>
              </View>
            );
          })}
        </Card>
      )}

      {/* Tags overview */}
      {stats && (
        <Card>
          <Text variant="label" color={colors.textTertiary}>OVERVIEW</Text>
          <View style={styles.overviewRow}>
            <Text variant="body" color={colors.textSecondary}>Folders</Text>
            <Text variant="body" color={colors.text}>{stats.totalFolders}</Text>
          </View>
          <View style={styles.overviewRow}>
            <Text variant="body" color={colors.textSecondary}>Tags</Text>
            <Text variant="body" color={colors.text}>{stats.totalTags}</Text>
          </View>
          <View style={styles.overviewRow}>
            <Text variant="body" color={colors.textSecondary}>Pinned</Text>
            <Text variant="body" color={colors.text}>{stats.pinnedCount}</Text>
          </View>
        </Card>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, paddingBottom: spacing.xxl, gap: spacing.md },
  emptyContainer: {
    flex: 1, justifyContent: 'center', alignItems: 'center',
    backgroundColor: colors.background, padding: spacing.lg,
  },
  emptyText: { textAlign: 'center', marginTop: spacing.xs, paddingHorizontal: spacing.xl },
  statsGrid: { flexDirection: 'row', gap: spacing.sm },
  statCard: { flex: 1, padding: spacing.md, alignItems: 'center' },
  statValue: { fontSize: 24, fontWeight: '800', color: ACCENT },
  statLabel: { fontSize: 11, color: colors.textSecondary, marginTop: 2 },
  streakRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: spacing.sm },
  streakValue: { fontSize: 42, fontWeight: '800' },
  velocityGrid: { flexDirection: 'row', justifyContent: 'space-around', marginTop: spacing.sm },
  velocityItem: { alignItems: 'center', gap: 2 },
  velocityValue: { fontSize: 20, fontWeight: '700', color: colors.text },
  velocityLabel: { fontSize: 11, color: colors.textSecondary },
  distRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.xs },
  distLabel: { width: 70 },
  distBarOuter: { flex: 1, height: 8, backgroundColor: colors.border, borderRadius: 4, overflow: 'hidden' },
  distBarInner: { height: '100%', borderRadius: 4, backgroundColor: ACCENT },
  distCount: { width: 30, textAlign: 'right' },
  overviewRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: spacing.xs,
  },
});
