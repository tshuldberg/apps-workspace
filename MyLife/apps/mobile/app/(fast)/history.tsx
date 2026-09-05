import React, { useMemo } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import {
  computeFastQualityScore,
  getCaffeineLogsForDate,
  getDailyHydration,
  getStreaks,
  getSetting,
  hasLateCaffeine,
  listFasts,
  type Fast,
  type FastQualityScore,
} from '@mylife/fast';
import { Card, EmptyState, Text, colors, spacing } from '@mylife/ui';
import { useDatabase } from '../../components/DatabaseProvider';

const ACCENT = colors.modules.fast;

const GRADE_COLORS: Record<string, string> = {
  A: colors.success,
  B: '#3B82F6',
  C: colors.warning,
  D: '#F97316',
  F: colors.danger,
};

function byMonth(fasts: Fast[]): Array<{ key: string; items: Fast[] }> {
  const map = new Map<string, Fast[]>();
  for (const fast of fasts) {
    const d = new Date(fast.startedAt);
    const key = d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
    const bucket = map.get(key) ?? [];
    bucket.push(fast);
    map.set(key, bucket);
  }
  return Array.from(map.entries()).map(([key, items]) => ({ key, items }));
}

function ScoreBadge({ score }: { score: FastQualityScore }) {
  const bg = GRADE_COLORS[score.grade] ?? colors.textTertiary;
  return (
    <View style={[styles.scoreBadge, { borderColor: bg }]}>
      <Text style={[styles.scoreValue, { color: bg }]}>{score.total}</Text>
      <Text variant="caption" style={{ color: bg, fontWeight: '700' }}>{score.grade}</Text>
    </View>
  );
}

export default function FastHistoryScreen() {
  const db = useDatabase();
  const fasts = useMemo(() => {
    try { return listFasts(db, { limit: 250 }); } catch { return [] as Fast[]; }
  }, [db]);
  const streaks = useMemo(() => {
    try { return getStreaks(db); } catch { return { currentStreak: 0, longestStreak: 0, totalFasts: 0 }; }
  }, [db]);

  const waterTarget = useMemo(() => {
    try {
      const val = getSetting(db, 'waterDailyTarget');
      return val ? Number(val) : 8;
    } catch {
      return 8;
    }
  }, [db]);
  const cutoffTime = useMemo(() => {
    try { return getSetting(db, 'caffeineCutoffTime') ?? '14:00'; } catch { return '14:00'; }
  }, [db]);

  const scoreMap = useMemo(() => {
    const map = new Map<string, FastQualityScore>();
    for (const fast of fasts) {
      if (!fast.endedAt) continue;
      try {
        const date = new Date(fast.startedAt);
        const hydration = getDailyHydration(db, waterTarget, date);
        const caffeineLogs = getCaffeineLogsForDate(db, date);
        const score = computeFastQualityScore({
          hitTarget: !!fast.hitTarget,
          hydrationMet: hydration.meetsTarget,
          noLateCaffeine: !hasLateCaffeine(caffeineLogs, cutoffTime, date),
          streakMaintained: streaks.currentStreak > 0,
        });
        map.set(fast.id, score);
      } catch (err) {
        console.warn('Failed to compute fast quality score', err);
      }
    }
    return map;
  }, [fasts, db, waterTarget, cutoffTime, streaks.currentStreak]);

  const groups = useMemo(() => byMonth(fasts), [fasts]);

  return (
    <FlatList
      style={styles.screen}
      contentContainerStyle={styles.content}
      data={groups}
      keyExtractor={(item) => item.key}
      ListHeaderComponent={
        <Card style={styles.summaryCard}>
          <Text variant="subheading">History</Text>
          <Text variant="caption" color={colors.textSecondary}>
            {fasts.length} completed fasts · current streak {streaks.currentStreak}
          </Text>
        </Card>
      }
      renderItem={({ item }) => (
        <View style={styles.group}>
          <Text variant="label" color={colors.textSecondary}>
            {item.key}
          </Text>
          <View style={styles.list}>
            {item.items.map((fast) => {
              const score = scoreMap.get(fast.id);
              return (
                <Card key={fast.id}>
                  <View style={styles.rowBetween}>
                    <View style={styles.flex1}>
                      <View style={styles.rowBetween}>
                        <Text variant="body">{fast.protocol}</Text>
                        <Text
                          variant="label"
                          color={fast.hitTarget ? colors.success : colors.textSecondary}
                        >
                          {fast.hitTarget ? 'Hit Target' : 'Ended Early'}
                        </Text>
                      </View>
                      <Text variant="caption" color={colors.textSecondary}>
                        {new Date(fast.startedAt).toLocaleDateString()} ·{' '}
                        {new Date(fast.startedAt).toLocaleTimeString([], {
                          hour: 'numeric',
                          minute: '2-digit',
                        })}
                      </Text>
                      {fast.durationSeconds != null ? (
                        <Text style={styles.duration}>
                          {Math.round(fast.durationSeconds / 3600)}h
                        </Text>
                      ) : null}
                    </View>
                    {score ? <ScoreBadge score={score} /> : null}
                  </View>
                </Card>
              );
            })}
          </View>
        </View>
      )}
      ListEmptyComponent={
        <EmptyState
          icon="📋"
          title="No fasts recorded yet"
          message="Start your first fast from the Timer tab to see your history."
          accentColor={ACCENT}
        />
      }
    />
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.md,
    paddingBottom: spacing.xxl,
    gap: spacing.md,
  },
  summaryCard: {
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  group: {
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  list: {
    gap: spacing.sm,
  },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.sm,
  },
  flex1: {
    flex: 1,
    gap: 2,
  },
  duration: {
    marginTop: spacing.xs,
    color: ACCENT,
    fontSize: 16,
    fontWeight: '700',
  },
  scoreBadge: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scoreValue: {
    fontSize: 14,
    fontWeight: '700',
  },
});
