import { useCallback, useMemo, useState } from 'react';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type {
  Dream,
  NapRecord,
  SleepEntryRecord,
  YearReview,
  YearReviewLongestStreak,
  YearReviewMonthStats,
} from '@mylife/sleep';
import {
  generateYearReview,
  getStreakHistory,
  listDreams,
  listEntries,
  listNaps,
  SLEEP_STREAK_TYPES,
} from '@mylife/sleep';
import { colors, surfaceTiers } from '@mylife/ui';
import { useDatabase } from '../../../components/DatabaseProvider';
import { SLEEP_ACCENT, readSleepTargetHours } from '../_ui';

type ReviewData = {
  entries: SleepEntryRecord[];
  dreams: Dream[];
  naps: NapRecord[];
  review: YearReview;
};

const CURRENT_YEAR = new Date().getFullYear();
const LAVENDER = '#C4B5FD';

function parseYearParam(value: string | string[] | undefined): number {
  const rawValue = Array.isArray(value) ? value[0] : value;
  const parsed = Number(rawValue);

  return Number.isInteger(parsed) && parsed >= 1 && parsed <= CURRENT_YEAR
    ? parsed
    : CURRENT_YEAR;
}

function yearStart(year: number): string {
  return `${String(year).padStart(4, '0')}-01-01`;
}

function yearEnd(year: number): string {
  return `${String(year).padStart(4, '0')}-12-31`;
}

function queryEndDate(year: number): string {
  const endDate = yearEnd(year);
  const today = new Date().toISOString().slice(0, 10);

  return endDate > today ? today : endDate;
}

function formatHours(value: number | null | undefined): string {
  if (typeof value !== 'number') {
    return '--';
  }

  return `${value.toFixed(value % 1 === 0 ? 0 : 1)}h`;
}

function formatQuality(value: number | null | undefined): string {
  return typeof value === 'number' ? `${value.toFixed(1)}/5` : '--';
}

function formatStreak(streak: YearReviewLongestStreak): string {
  if (streak.count === 0) {
    return 'No streak yet';
  }

  return `${streak.count} nights`;
}

function formatTrend(value: YearReview['improvementMetric']['trend']): string {
  if (value === 'improved') return 'Improved';
  if (value === 'declined') return 'Declined';
  return 'Stable';
}

function formatStreakType(value: YearReviewLongestStreak['type']): string {
  return value === 'none'
    ? 'Streak'
    : value
        .split('_')
        .map((part) => part[0].toUpperCase() + part.slice(1))
        .join(' ');
}

function qualityFill(month: YearReviewMonthStats): string {
  if (month.avgQuality === null) {
    return 'rgba(255,255,255,0.05)';
  }

  const alpha = 0.12 + ((month.avgQuality - 1) / 4) * 0.36;
  return `rgba(167,139,250,${alpha.toFixed(2)})`;
}

export default function SleepYearReviewScreen() {
  const db = useDatabase();
  const router = useRouter();
  const params = useLocalSearchParams<{ year?: string }>();
  const year = parseYearParam(params.year);
  const [data, setData] = useState<ReviewData | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const loadReview = useCallback(() => {
    const entries = listEntries(db, {
      startDate: yearStart(year - 1),
      endDate: queryEndDate(year),
      limit: 500,
    });
    const dreams = listDreams(db, {
      startDate: yearStart(year - 1),
      endDate: queryEndDate(year),
      limit: 500,
    });
    const naps = listNaps(db, {
      startDate: yearStart(year - 1),
      endDate: queryEndDate(year),
    });
    const streakHistory = SLEEP_STREAK_TYPES.flatMap((type) =>
      getStreakHistory(db, type),
    );
    const review = generateYearReview(year, {
      entries,
      dreams,
      naps,
      streakHistory,
      targetHours: readSleepTargetHours(db),
    });

    setData({ entries, dreams, naps, review });
  }, [db, year]);

  useFocusEffect(
    useCallback(() => {
      loadReview();
    }, [loadReview]),
  );

  const handleRefresh = useCallback(() => {
    setIsRefreshing(true);
    try {
      loadReview();
    } finally {
      setIsRefreshing(false);
    }
  }, [loadReview]);

  const review = data?.review ?? generateYearReview(year);
  const populatedMonths = useMemo(
    () => review.monthlyStats.filter((month) => month.totalNights > 0),
    [review.monthlyStats],
  );

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={(
        <RefreshControl
          refreshing={isRefreshing}
          onRefresh={handleRefresh}
          tintColor={SLEEP_ACCENT}
        />
      )}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.hero}>
        <Text style={styles.eyebrow}>Year in Review</Text>
        <Text style={styles.heroTitle}>{year} MySleep review</Text>
        <Text style={styles.heroCopy}>
          {review.totalNights > 0
            ? `${review.totalNights} logged nights, ${formatHours(review.totalHoursSlept)} asleep, and a ${formatQuality(review.averageQuality)} average quality.`
            : 'Your annual review will build from the sleep you have logged so far.'}
        </Text>
        <Pressable
          onPress={() =>
            router.push(`/(sleep)/review/share?year=${year}` as never)
          }
          style={styles.primaryButton}
        >
          <Text style={styles.primaryButtonText}>Share Card</Text>
        </Pressable>
      </View>

      <View style={styles.metricGrid}>
        <Metric label="Total hours" value={formatHours(review.totalHoursSlept)} />
        <Metric label="Total nights" value={String(review.totalNights)} />
        <Metric label="Avg duration" value={formatHours(review.averageDuration)} />
        <Metric label="Avg quality" value={formatQuality(review.averageQuality)} />
      </View>

      <View style={styles.card}>
        <Text style={styles.cardEyebrow}>Month highlights</Text>
        <Text style={styles.cardTitle}>Best and hardest months</Text>
        <View style={styles.monthPair}>
          <MonthHighlight
            label="Best"
            month={review.bestMonth.label ?? '--'}
            quality={formatQuality(review.bestMonth.avgQuality)}
            duration={formatHours(review.bestMonth.avgDuration)}
          />
          <MonthHighlight
            label="Hardest"
            month={review.worstMonth.label ?? '--'}
            quality={formatQuality(review.worstMonth.avgQuality)}
            duration={formatHours(review.worstMonth.avgDuration)}
          />
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardEyebrow}>Consistency</Text>
        <Text style={styles.cardTitle}>
          {Math.round(review.consistencyScore)} consistency score
        </Text>
        <View style={styles.statRows}>
          <StatRow label="Sleep debt" value={formatHours(review.sleepDebtTotal)} />
          <StatRow
            label={formatStreakType(review.longestStreak.type)}
            value={formatStreak(review.longestStreak)}
          />
          <StatRow
            label="Trend"
            value={`${formatTrend(review.improvementMetric.trend)} quality`}
          />
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardEyebrow}>Dreams and naps</Text>
        <Text style={styles.cardTitle}>
          {review.dreamStats.total} dreams and {review.totalNaps} naps
        </Text>
        <View style={styles.statRows}>
          <StatRow label="Lucid dreams" value={String(review.dreamStats.lucidCount)} />
          <StatRow label="Nightmares" value={String(review.dreamStats.nightmareCount)} />
          <StatRow
            label="Common emotion"
            value={review.dreamStats.mostCommonEmotion ?? '--'}
          />
        </View>
        <View style={styles.tagRow}>
          {review.dreamStats.topThemes.length > 0
            ? review.dreamStats.topThemes.map((theme) => (
                <View key={theme.theme} style={styles.tag}>
                  <Text style={styles.tagText}>
                    {theme.theme} x{theme.count}
                  </Text>
                </View>
              ))
            : (
                <Text style={styles.emptyText}>No dream themes logged.</Text>
              )}
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardEyebrow}>Monthly quality</Text>
        <Text style={styles.cardTitle}>
          {populatedMonths.length} active months
        </Text>
        <View style={styles.heatmapGrid}>
          {review.monthlyStats.map((month) => (
            <View
              key={month.month}
              style={[
                styles.monthTile,
                { backgroundColor: qualityFill(month) },
              ]}
            >
              <Text style={styles.monthLabel}>{month.label.slice(0, 3)}</Text>
              <Text style={styles.monthValue}>
                {month.avgQuality === null ? '--' : month.avgQuality.toFixed(1)}
              </Text>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardEyebrow}>Quality arc</Text>
        <Text style={styles.cardTitle}>
          {formatTrend(review.improvementMetric.trend)}
        </Text>
        <View style={styles.statRows}>
          <StatRow
            label="Start"
            value={formatQuality(review.improvementMetric.startQuality)}
          />
          <StatRow
            label="End"
            value={formatQuality(review.improvementMetric.endQuality)}
          />
          <StatRow
            label="Last year"
            value={
              review.comparison
                ? `${review.comparison.averageQualityDelta?.toFixed(1) ?? '0.0'} quality`
                : 'Not enough data'
            }
          />
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardEyebrow}>Fun facts</Text>
        <View style={styles.factList}>
          {review.funFacts.map((fact) => (
            <Text key={fact} style={styles.factText}>
              {fact}
            </Text>
          ))}
        </View>
      </View>
    </ScrollView>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metricCard}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue}>{value}</Text>
    </View>
  );
}

function MonthHighlight({
  label,
  month,
  quality,
  duration,
}: {
  label: string;
  month: string;
  quality: string;
  duration: string;
}) {
  return (
    <View style={styles.monthHighlight}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.monthHighlightTitle}>{month}</Text>
      <Text style={styles.monthHighlightMeta}>
        {quality} quality, {duration} average
      </Text>
    </View>
  );
}

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.statRow}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: surfaceTiers.lowest,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 160,
    gap: 16,
  },
  hero: {
    gap: 14,
    padding: 22,
    borderRadius: 24,
    backgroundColor: 'rgba(167,139,250,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(167,139,250,0.30)',
  },
  eyebrow: {
    color: LAVENDER,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  heroTitle: {
    color: colors.text,
    fontSize: 32,
    lineHeight: 37,
    fontWeight: '800',
  },
  heroCopy: {
    color: colors.textSecondary,
    fontSize: 15,
    lineHeight: 22,
  },
  primaryButton: {
    alignSelf: 'flex-start',
    minHeight: 46,
    justifyContent: 'center',
    borderRadius: 999,
    backgroundColor: SLEEP_ACCENT,
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  primaryButtonText: {
    color: '#0A0A0F',
    fontSize: 14,
    fontWeight: '800',
  },
  metricGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  metricCard: {
    flexGrow: 1,
    minWidth: '47%',
    gap: 8,
    padding: 16,
    borderRadius: 18,
    backgroundColor: surfaceTiers.low,
    borderWidth: 1,
    borderColor: colors.border,
  },
  metricLabel: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
  },
  metricValue: {
    color: colors.text,
    fontSize: 24,
    lineHeight: 29,
    fontWeight: '800',
  },
  card: {
    gap: 14,
    padding: 18,
    borderRadius: 22,
    backgroundColor: surfaceTiers.low,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardEyebrow: {
    color: LAVENDER,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  cardTitle: {
    color: colors.text,
    fontSize: 21,
    lineHeight: 26,
    fontWeight: '800',
  },
  monthPair: {
    gap: 10,
  },
  monthHighlight: {
    gap: 7,
    padding: 14,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: colors.border,
  },
  monthHighlightTitle: {
    color: colors.text,
    fontSize: 19,
    lineHeight: 23,
    fontWeight: '800',
  },
  monthHighlightMeta: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 18,
  },
  statRows: {
    gap: 9,
  },
  statRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  statLabel: {
    flex: 1,
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 18,
  },
  statValue: {
    flexShrink: 1,
    color: colors.text,
    fontSize: 14,
    lineHeight: 19,
    fontWeight: '800',
    textAlign: 'right',
  },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tag: {
    borderRadius: 999,
    backgroundColor: 'rgba(167,139,250,0.16)',
    borderWidth: 1,
    borderColor: 'rgba(167,139,250,0.32)',
    paddingHorizontal: 11,
    paddingVertical: 7,
  },
  tagText: {
    color: '#E9DDFF',
    fontSize: 12,
    fontWeight: '800',
  },
  emptyText: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 19,
  },
  heatmapGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  monthTile: {
    width: '30.8%',
    minHeight: 58,
    justifyContent: 'space-between',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 10,
  },
  monthLabel: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '800',
  },
  monthValue: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
  },
  factList: {
    gap: 10,
  },
  factText: {
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
  },
});
