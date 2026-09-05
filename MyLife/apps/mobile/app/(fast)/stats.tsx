import React, { useMemo, useRef, useState, type RefObject } from 'react';
import { Pressable, ScrollView, Share, StyleSheet, View } from 'react-native';
import { captureRef } from 'react-native-view-shot';
import {
  adherenceRate,
  averageDuration,
  durationTrend,
  getStreaks,
  weeklyRollup,
  getMonthlySummary,
  getAnnualSummary,
  formatSummaryShareText,
  computeWeekInReview,
  listFasts,
  getBeverageLogs,
  getCaffeineLogsForDate,
  getSetting,
  getWeightEntries,
} from '@mylife/fast';
import type { SummaryStats, WeekInReview } from '@mylife/fast';
import { Card, EmptyState, Text, colors, spacing } from '@mylife/ui';
import { useDatabase } from '../../components/DatabaseProvider';

function formatSummaryValue(value: number): string {
  if (Number.isInteger(value)) return String(value);
  return value.toFixed(1);
}

function SummaryCard({
  title,
  label,
  summary,
  onShare,
}: {
  title: string;
  label: string;
  summary: SummaryStats;
  onShare: () => void;
}) {
  return (
    <Card>
      <View style={styles.rowBetween}>
        <View>
          <Text variant="subheading">{title}</Text>
          <Text variant="caption" color={colors.textSecondary}>{label}</Text>
        </View>
        <Pressable style={styles.copyButton} onPress={onShare}>
          <Text variant="label" color={colors.background}>Share</Text>
        </Pressable>
      </View>

      <SummaryRow label="Total fasts" value={formatSummaryValue(summary.totalFasts)} />
      <SummaryRow label="Total hours" value={`${formatSummaryValue(summary.totalHours)}h`} />
      <SummaryRow label="Average duration" value={`${formatSummaryValue(summary.averageDurationHours)}h`} />
      <SummaryRow label="Longest fast" value={`${formatSummaryValue(summary.longestFastHours)}h`} />
      <SummaryRow label="Current streak" value={`${formatSummaryValue(summary.currentStreak)}d`} />
      <SummaryRow label="Adherence" value={`${formatSummaryValue(summary.adherenceRate)}%`} />
    </Card>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={[styles.rowBetween, { marginTop: spacing.xs }]}> 
      <Text variant="caption" color={colors.textSecondary}>{label}</Text>
      <Text variant="body">{value}</Text>
    </View>
  );
}

export default function FastStatsScreen() {
  const db = useDatabase();

  const streaks = useMemo(() => {
    try { return getStreaks(db); } catch { return { currentStreak: 0, longestStreak: 0, totalFasts: 0 }; }
  }, [db]);
  const avgSeconds = useMemo(() => {
    try { return averageDuration(db); } catch { return 0; }
  }, [db]);
  const adherence = useMemo(() => {
    try { return adherenceRate(db); } catch { return 0; }
  }, [db]);
  const week = useMemo(() => {
    try { return weeklyRollup(db); } catch { return []; }
  }, [db]);
  const trend = useMemo(() => {
    try { return durationTrend(db, 14); } catch { return []; }
  }, [db]);

  const now = new Date();
  const [summaryYear, setSummaryYear] = useState(now.getFullYear());
  const [summaryMonth, setSummaryMonth] = useState(now.getMonth() + 1);
  const monthlySummaryRef = useRef<View>(null);
  const annualSummaryRef = useRef<View>(null);

  const emptySummary: SummaryStats = {
    totalFasts: 0,
    totalHours: 0,
    averageDurationHours: 0,
    longestFastHours: 0,
    currentStreak: 0,
    adherenceRate: 0,
  };
  const monthSummary = useMemo(
    () => {
      try { return getMonthlySummary(db, summaryYear, summaryMonth); } catch { return emptySummary; }
    },
    [db, summaryYear, summaryMonth],
  );
  const annualSummary = useMemo(
    () => {
      try { return getAnnualSummary(db, summaryYear); } catch { return emptySummary; }
    },
    [db, summaryYear],
  );

  const monthLabel = `${new Date(summaryYear, summaryMonth - 1).toLocaleString(undefined, { month: 'long' })} ${summaryYear}`;
  const annualLabel = `${summaryYear}`;

  const weekHours = useMemo(
    () => week.reduce((sum, day) => sum + day.totalHours, 0),
    [week],
  );

  const weekReview = useMemo<WeekInReview | null>(() => {
    try {
      const today = new Date();
      const dayOfWeek = (today.getDay() + 6) % 7; // Monday = 0
      const monday = new Date(today);
      monday.setDate(today.getDate() - dayOfWeek);
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      const start = monday.toISOString().slice(0, 10);
      const end = sunday.toISOString().slice(0, 10);

      const weekFasts = listFasts(db, { limit: 50 }).filter(
        (f) => f.startedAt.slice(0, 10) >= start && f.startedAt.slice(0, 10) <= end,
      );

      const dailyHydration: Array<{ date: string; totalOz: number }> = [];
      const dailyCaffeine: Array<{ date: string; totalMg: number }> = [];
      for (let i = 0; i < 7; i++) {
        const d = new Date(monday);
        d.setDate(monday.getDate() + i);
        const dateStr = d.toISOString().slice(0, 10);
        const logs = getBeverageLogs(db, d);
        dailyHydration.push({ date: dateStr, totalOz: logs.reduce((s, l) => s + l.hydrationOz, 0) });
        const caffeine = getCaffeineLogsForDate(db, d);
        dailyCaffeine.push({ date: dateStr, totalMg: caffeine.reduce((s, c) => s + c.caffeineMg, 0) });
      }

      const weights = getWeightEntries(db, 7).map((w) => ({
        date: w.date,
        value: w.weightValue,
        unit: w.unit,
      }));

      const targetStr = getSetting(db, 'waterDailyTarget');
      const hydrationTarget = targetStr ? Number(targetStr) * 8 : 64; // 8oz per glass
      const cutoff = getSetting(db, 'caffeineCutoffTime') ?? '14:00';

      return computeWeekInReview({
        periodStart: start,
        periodEnd: end,
        fasts: weekFasts,
        dailyHydration,
        dailyCaffeine,
        weights,
        hydrationTargetOz: hydrationTarget,
        caffeineCutoffTime: cutoff,
        currentStreak: streaks.currentStreak,
      });
    } catch {
      return null;
    }
  }, [db, streaks.currentStreak]);

  const handleShareSummary = async (
    summaryRef: RefObject<View | null>,
    summary: SummaryStats,
    label: string,
  ) => {
    const text = formatSummaryShareText(summary, label);

    try {
      const uri = await captureRef(summaryRef, {
        format: 'png',
        quality: 1,
        result: 'tmpfile',
      });

      await Share.share({
        title: `${label} Summary`,
        url: uri,
        message: text,
      });
      return;
    } catch {
      // Fall through to text share.
    }

    await Share.share({
      title: `${label} Summary`,
      message: text,
    });
  };

  const hasData = streaks.currentStreak > 0 || streaks.longestStreak > 0 || avgSeconds > 0;

  if (!hasData) {
    return (
      <View style={styles.screen}>
        <EmptyState
          icon="📊"
          title="No stats yet"
          message="Complete your first fast to start tracking streaks, trends, and summaries."
          accentColor={colors.modules.fast}
        />
      </View>
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.metricsGrid}>
        <Metric title="Current Streak" value={String(streaks.currentStreak)} />
        <Metric title="Longest Streak" value={String(streaks.longestStreak)} />
        <Metric title="Avg Duration" value={`${(avgSeconds / 3600).toFixed(1)}h`} />
        <Metric title="Adherence" value={`${adherence.toFixed(1)}%`} />
      </View>

      {weekReview ? (
        <Card>
          <Text variant="subheading">Week in Review</Text>
          <Text variant="caption" color={colors.textSecondary}>
            {weekReview.periodStart} to {weekReview.periodEnd}
          </Text>
          <View style={styles.list}>
            <View style={styles.rowBetween}>
              <Text variant="caption" color={colors.textSecondary}>Fasting hours</Text>
              <Text variant="body">{weekReview.totalFastingHours.toFixed(1)}h</Text>
            </View>
            <View style={styles.rowBetween}>
              <Text variant="caption" color={colors.textSecondary}>Completed / Started</Text>
              <Text variant="body">{weekReview.completedFasts}/{weekReview.totalFasts}</Text>
            </View>
            <View style={styles.rowBetween}>
              <Text variant="caption" color={colors.textSecondary}>Avg quality score</Text>
              <Text variant="body">{Math.round(weekReview.avgQualityScore)}</Text>
            </View>
            <View style={styles.rowBetween}>
              <Text variant="caption" color={colors.textSecondary}>Avg hydration</Text>
              <Text variant="body">{weekReview.avgDailyHydrationOz.toFixed(0)} oz</Text>
            </View>
            <View style={styles.rowBetween}>
              <Text variant="caption" color={colors.textSecondary}>Avg caffeine</Text>
              <Text variant="body">{weekReview.avgCaffeineMg.toFixed(0)} mg</Text>
            </View>
            {weekReview.weightDelta != null ? (
              <View style={styles.rowBetween}>
                <Text variant="caption" color={colors.textSecondary}>Weight change</Text>
                <Text variant="body" color={weekReview.weightDelta <= 0 ? colors.success : colors.danger}>
                  {weekReview.weightDelta > 0 ? '+' : ''}{weekReview.weightDelta.toFixed(1)} lbs
                </Text>
              </View>
            ) : null}
            <View style={styles.rowBetween}>
              <Text variant="caption" color={colors.textSecondary}>Streak</Text>
              <Text variant="body">{weekReview.streakAtEnd}d</Text>
            </View>
          </View>
        </Card>
      ) : null}

      <Card>
        <Text variant="subheading">Last 7 Days</Text>
        <Text variant="caption" color={colors.textSecondary}>
          {weekHours.toFixed(1)} total fasting hours
        </Text>
        <View style={styles.list}>
          {week.map((day) => (
            <View key={day.date} style={styles.rowBetween}>
              <Text variant="caption" color={colors.textSecondary}>
                {new Date(day.date).toLocaleDateString(undefined, {
                  weekday: 'short',
                  month: 'short',
                  day: 'numeric',
                })}
              </Text>
              <Text variant="body">{day.totalHours.toFixed(1)}h</Text>
            </View>
          ))}
        </View>
      </Card>

      <Card>
        <Text variant="subheading">14-Day Trend</Text>
        <View style={styles.list}>
          {trend.slice(-10).map((point) => (
            <View key={point.date} style={styles.rowBetween}>
              <Text variant="caption" color={colors.textSecondary}>
                {new Date(point.date).toLocaleDateString(undefined, {
                  month: 'short',
                  day: 'numeric',
                })}
              </Text>
              <Text variant="body">
                {point.durationHours.toFixed(1)}h
                {point.movingAverage != null ? ` · avg ${point.movingAverage.toFixed(1)}h` : ''}
              </Text>
            </View>
          ))}
        </View>
      </Card>

      <Card>
        <Text variant="subheading">Summary Period</Text>
        <View style={[styles.rowBetween, { marginTop: spacing.sm }]}>
          <Text variant="caption" color={colors.textSecondary}>Year</Text>
          <View style={styles.adjustControls}>
            <Pressable style={styles.adjustButton} onPress={() => setSummaryYear((y) => Math.max(2000, y - 1))}>
              <Text variant="label">-</Text>
            </Pressable>
            <Text style={styles.periodValue}>{summaryYear}</Text>
            <Pressable style={styles.adjustButton} onPress={() => setSummaryYear((y) => Math.min(2100, y + 1))}>
              <Text variant="label">+</Text>
            </Pressable>
          </View>
        </View>

        <View style={[styles.rowBetween, { marginTop: spacing.sm }]}>
          <Text variant="caption" color={colors.textSecondary}>Month</Text>
          <View style={styles.adjustControls}>
            <Pressable style={styles.adjustButton} onPress={() => setSummaryMonth((m) => (m === 1 ? 12 : m - 1))}>
              <Text variant="label">-</Text>
            </Pressable>
            <Text style={styles.periodValue}>{summaryMonth}</Text>
            <Pressable style={styles.adjustButton} onPress={() => setSummaryMonth((m) => (m === 12 ? 1 : m + 1))}>
              <Text variant="label">+</Text>
            </Pressable>
          </View>
        </View>
      </Card>

      <View ref={monthlySummaryRef} collapsable={false}>
        <SummaryCard
          title="Monthly Summary"
          label={monthLabel}
          summary={monthSummary}
          onShare={() => void handleShareSummary(monthlySummaryRef, monthSummary, monthLabel)}
        />
      </View>

      <View ref={annualSummaryRef} collapsable={false}>
        <SummaryCard
          title="Annual Summary"
          label={annualLabel}
          summary={annualSummary}
          onShare={() => void handleShareSummary(annualSummaryRef, annualSummary, annualLabel)}
        />
      </View>
    </ScrollView>
  );
}

function Metric({ title, value }: { title: string; value: string }) {
  return (
    <Card style={styles.metricCard}>
      <Text variant="caption" color={colors.textSecondary}>{title}</Text>
      <Text style={styles.metricValue}>{value}</Text>
    </Card>
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
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  metricCard: {
    width: '48%',
    gap: spacing.xs,
  },
  metricValue: {
    color: colors.modules.fast,
    fontSize: 22,
    fontWeight: '700',
  },
  list: {
    marginTop: spacing.sm,
    gap: spacing.xs,
  },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.sm,
  },
  adjustControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  adjustButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceElevated,
  },
  periodValue: {
    color: colors.modules.fast,
    fontWeight: '700',
    minWidth: 32,
    textAlign: 'center',
  },
  copyButton: {
    borderRadius: 999,
    backgroundColor: colors.modules.fast,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
});
