import { useCallback, useMemo, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Svg, {
  Circle,
  Defs,
  Line,
  LinearGradient,
  Path,
  Polyline,
  Stop,
} from 'react-native-svg';
import type {
  Factor,
  HealthBridgeSummary,
  HealthSyncPreview,
  SleepAnalyticsDateRange,
  SleepCorrelationResult,
  SleepEntryRecord,
  SleepHabitAdherenceSummary,
  SleepMoodCorrelation,
  SleepNightInsight,
  SleepTrendGranularity,
} from '@mylife/sleep';
import {
  calculateSleepDebt,
  correlateAlcohol,
  correlateCaffeine,
  correlateExercise,
  correlateScreenTime,
  correlateStress,
  buildHealthSyncPreview,
  findOptimalBedtime,
  findOptimalDuration,
  formatDurationLabel,
  formatFactorClockTime,
  formatSleepEntryDateLabel,
  getHealthBridgeSummary,
  getBestNights,
  getDebtTrend,
  getEfficiencyTrend,
  getFactorRoomLightMeta,
  getFactorRoomNoiseMeta,
  getFactorRoomTempMeta,
  getPreSleepActivityMeta,
  getSleepConsistencySummary,
  getSleepHabitAdherence,
  getSleepMoodCorrelation,
  getSleepWeekStart,
  getStressLevelMeta,
  getTopCorrelations,
  getTrendData,
  getWeekendVsWeekday,
  getWeeklyAverage,
  getWorstNights,
  listEntries,
  listFactors,
} from '@mylife/sleep';
import { colors, surfaceTiers } from '@mylife/ui';
import { useDatabase } from '../../components/DatabaseProvider';
import {
  SLEEP_ACCENT,
  SleepPlaceholderScreen,
  readSleepTargetHours,
} from './_ui';

type InsightsRangeKey = '7d' | '30d' | '90d' | 'all';

type DashboardState = {
  entries: SleepEntryRecord[];
  factors: Factor[];
  targetHours: number;
};

type ChartPoint = {
  label: string;
  value: number | null;
};

const RANGE_OPTIONS: Array<{
  key: InsightsRangeKey;
  label: string;
  days: number | null;
}> = [
  { key: '7d', label: '7 days', days: 7 },
  { key: '30d', label: '30 days', days: 30 },
  { key: '90d', label: '90 days', days: 90 },
  { key: 'all', label: 'All time', days: null },
];

const FACTOR_LABELS = [
  'Exercise',
  'Caffeine cutoff',
  'Alcohol',
  'Stress',
  'Screen cutoff',
];

const CHART_WIDTH = 320;
const CHART_HEIGHT = 156;
const CHART_PADDING = 18;
const DEBT_GOAL_HOURS = 14;
const SHORT_DATE_FORMATTER = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  timeZone: 'UTC',
});

function parseCalendarDate(date: string): Date {
  return new Date(`${date}T12:00:00.000Z`);
}

function shiftCalendarDate(date: string, days: number): string {
  const parsed = parseCalendarDate(date);
  parsed.setUTCDate(parsed.getUTCDate() + days);
  return parsed.toISOString().slice(0, 10);
}

function getLatestEntryDate(entries: readonly SleepEntryRecord[]): string | null {
  return entries.reduce<string | null>((latest, entry) => {
    if (latest === null || entry.date > latest) {
      return entry.date;
    }
    return latest;
  }, null);
}

function getDateRange(
  entries: readonly SleepEntryRecord[],
  rangeKey: InsightsRangeKey,
): SleepAnalyticsDateRange {
  const option = RANGE_OPTIONS.find((range) => range.key === rangeKey);
  if (!option?.days) {
    return {};
  }

  const endDate = getLatestEntryDate(entries);
  if (!endDate) {
    return {};
  }

  return {
    startDate: shiftCalendarDate(endDate, -(option.days - 1)),
    endDate,
  };
}

function filterEntriesByDateRange(
  entries: readonly SleepEntryRecord[],
  dateRange: SleepAnalyticsDateRange,
): SleepEntryRecord[] {
  return entries.filter((entry) => {
    if (dateRange.startDate && entry.date < dateRange.startDate) {
      return false;
    }
    if (dateRange.endDate && entry.date > dateRange.endDate) {
      return false;
    }
    return true;
  });
}

function formatShortDate(value: string): string {
  return SHORT_DATE_FORMATTER.format(parseCalendarDate(value));
}

function formatHours(value: number | null | undefined): string {
  if (typeof value !== 'number') {
    return 'Not enough data';
  }
  return `${value.toFixed(value % 1 === 0 ? 0 : 1)}h`;
}

function formatQuality(value: number | null | undefined): string {
  return typeof value === 'number' ? `${value.toFixed(1)}/5` : 'Not rated';
}

function formatScore(value: number): string {
  return `${Math.round(value)}`;
}

function formatEfficiency(value: number | null | undefined): string {
  return typeof value === 'number' ? `${value.toFixed(1)}%` : 'Not enough data';
}

function getAverageEfficiency(
  entries: readonly SleepEntryRecord[],
  dateRange: SleepAnalyticsDateRange,
): number | null {
  const values = getEfficiencyTrend(entries, dateRange)
    .map((point) => point.sleepEfficiency)
    .filter((value): value is number => typeof value === 'number');

  if (values.length === 0) {
    return null;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function pluralize(value: number, singular: string, plural = `${singular}s`) {
  return `${value} ${value === 1 ? singular : plural}`;
}

function getTrendGranularity(rangeKey: InsightsRangeKey): SleepTrendGranularity {
  return rangeKey === '90d' || rangeKey === 'all' ? 'week' : 'day';
}

function toDurationChartPoints(
  entries: readonly SleepEntryRecord[],
  dateRange: SleepAnalyticsDateRange,
  rangeKey: InsightsRangeKey,
  targetHours: number,
): ChartPoint[] {
  return getTrendData(
    entries,
    dateRange,
    getTrendGranularity(rangeKey),
    targetHours,
  ).map((point) => ({
    label: point.granularity === 'day'
      ? formatShortDate(point.periodEnd)
      : point.label.replace('Week of ', ''),
    value: point.avgDurationHours,
  }));
}

function toQualityChartPoints(
  entries: readonly SleepEntryRecord[],
  dateRange: SleepAnalyticsDateRange,
  rangeKey: InsightsRangeKey,
  targetHours: number,
): ChartPoint[] {
  return getTrendData(
    entries,
    dateRange,
    getTrendGranularity(rangeKey),
    targetHours,
  ).map((point) => ({
    label: point.granularity === 'day'
      ? formatShortDate(point.periodEnd)
      : point.label.replace('Week of ', ''),
    value: point.avgQualityRating,
  }));
}

function getAllCorrelations(
  entries: readonly SleepEntryRecord[],
  factors: readonly Factor[],
  dateRange: SleepAnalyticsDateRange,
): SleepCorrelationResult[] {
  return [
    correlateExercise(entries, factors, dateRange),
    correlateCaffeine(entries, factors, dateRange),
    correlateAlcohol(entries, factors, dateRange),
    correlateStress(entries, factors, dateRange),
    correlateScreenTime(entries, factors, dateRange),
  ];
}

function getDisplayCorrelations(
  entries: readonly SleepEntryRecord[],
  factors: readonly Factor[],
  dateRange: SleepAnalyticsDateRange,
): SleepCorrelationResult[] {
  const top = getTopCorrelations(entries, factors, dateRange, 5);
  if (top.length > 0) {
    return top;
  }
  return getAllCorrelations(entries, factors, dateRange);
}

function formatConditionHighlights(factor: Factor | null): string[] {
  if (!factor) {
    return ['No factor log saved'];
  }

  const highlights: string[] = [];
  highlights.push(factor.exercise_today ? 'exercise' : 'no exercise');
  highlights.push(
    factor.alcohol_drinks === 0
      ? 'no alcohol'
      : pluralize(factor.alcohol_drinks, 'drink'),
  );

  const caffeine = formatFactorClockTime(factor.last_caffeine_time);
  if (caffeine) {
    highlights.push(`caffeine ${caffeine}`);
  }

  const screens = formatFactorClockTime(factor.screen_cutoff_time);
  if (screens) {
    highlights.push(`screens off ${screens}`);
  }

  if (factor.stress_level !== null) {
    highlights.push(`${getStressLevelMeta(factor.stress_level)?.label ?? 'logged'} stress`);
  }

  if (factor.room_temp) {
    highlights.push(getFactorRoomTempMeta(factor.room_temp).label);
  }
  if (factor.room_light) {
    highlights.push(getFactorRoomLightMeta(factor.room_light).label);
  }
  if (factor.room_noise) {
    highlights.push(getFactorRoomNoiseMeta(factor.room_noise).label);
  }

  for (const activity of factor.pre_sleep_activities.slice(0, 2)) {
    highlights.push(getPreSleepActivityMeta(activity).label);
  }

  return [...new Set(highlights)].slice(0, 6);
}

function formatInsightNight(insight: SleepNightInsight): string {
  const quality =
    typeof insight.entry.quality_rating === 'number'
      ? `${insight.entry.quality_rating}/5`
      : 'unrated';
  return `${formatSleepEntryDateLabel(insight.entry.date)} · ${quality} · ${formatConditionHighlights(insight.factor).join(', ')}`;
}

function formatClockLabel(value: string | null): string {
  return formatFactorClockTime(value) ?? 'Not enough data';
}

function addMinutesToClock(value: string, minutesToAdd: number): string {
  const [hours, minutes] = value.split(':').map(Number);
  const total = (((hours * 60) + minutes + minutesToAdd) % (24 * 60) + (24 * 60)) % (24 * 60);
  const nextHours = Math.floor(total / 60);
  const nextMinutes = total % 60;
  return `${String(nextHours).padStart(2, '0')}:${String(nextMinutes).padStart(2, '0')}`;
}

function getOptimalWindowCopy(
  entries: readonly SleepEntryRecord[],
  dateRange: SleepAnalyticsDateRange,
): {
  title: string;
  detail: string;
  meta: string;
} {
  const bedtime = findOptimalBedtime(entries, dateRange);
  const duration = findOptimalDuration(entries, dateRange);

  if (!bedtime.recommendedTime || !duration.recommendedDurationMinutes) {
    return {
      title: 'Optimal window needs more rated nights',
      detail: 'Keep logging quality ratings so MySleep can compare bedtime and duration buckets.',
      meta: `${bedtime.sampleSize + duration.sampleSize} matching samples`,
    };
  }

  const wakeTime = addMinutesToClock(
    bedtime.recommendedTime,
    duration.recommendedDurationMinutes,
  );
  return {
    title: `${formatClockLabel(bedtime.recommendedTime)} to ${formatClockLabel(wakeTime)}`,
    detail: `Best quality cluster is ${formatDurationLabel(duration.recommendedDurationMinutes)} with bedtime around ${formatClockLabel(bedtime.recommendedTime)}.`,
    meta: `${bedtime.confidence} confidence · ${bedtime.sampleSize} bedtime samples`,
  };
}

function getChartGeometry(
  points: readonly ChartPoint[],
  targetValue?: number,
  yMin?: number,
  yMax?: number,
) {
  const values = points
    .map((point) => point.value)
    .filter((value): value is number => typeof value === 'number');
  const domainValues = targetValue === undefined ? values : [...values, targetValue];
  const min = yMin ?? Math.min(...domainValues);
  const max = yMax ?? Math.max(...domainValues);
  const range = Math.max(max - min, 1);
  const safePoints =
    points.length === 1
      ? [points[0], { ...points[0], label: `${points[0].label} ` }]
      : [...points];

  const chartPoints = safePoints
    .map((point, index) => {
      if (typeof point.value !== 'number') {
        return null;
      }

      const x =
        CHART_PADDING +
        (index / Math.max(safePoints.length - 1, 1)) *
          (CHART_WIDTH - CHART_PADDING * 2);
      const y =
        CHART_HEIGHT -
        CHART_PADDING -
        ((point.value - min) / range) *
          (CHART_HEIGHT - CHART_PADDING * 2);
      return { x, y };
    })
    .filter((point): point is { x: number; y: number } => point !== null);

  const linePoints = chartPoints.map((point) => `${point.x},${point.y}`).join(' ');
  const targetY =
    targetValue === undefined
      ? null
      : CHART_HEIGHT -
        CHART_PADDING -
        ((targetValue - min) / range) * (CHART_HEIGHT - CHART_PADDING * 2);

  return {
    chartPoints,
    linePoints,
    max,
    min,
    targetY,
  };
}

export default function SleepInsightsScreen() {
  const db = useDatabase();
  const router = useRouter();
  const [rangeKey, setRangeKey] = useState<InsightsRangeKey>('30d');
  const [dashboard, setDashboard] = useState<DashboardState>({
    entries: [],
    factors: [],
    targetHours: 8,
  });
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadDashboard = useCallback(() => {
    setIsLoading(true);
    try {
      setDashboard({
        entries: listEntries(db, { limit: 500 }),
        factors: listFactors(db, { limit: 500 }),
        targetHours: readSleepTargetHours(db),
      });
      setError(null);
    } catch (reason) {
      setDashboard({
        entries: [],
        factors: [],
        targetHours: 8,
      });
      setError(
        reason instanceof Error
          ? reason.message
          : 'Could not load sleep insights.',
      );
    } finally {
      setIsLoading(false);
    }
  }, [db]);

  useFocusEffect(
    useCallback(() => {
      loadDashboard();
    }, [loadDashboard]),
  );

  const handleRefresh = useCallback(() => {
    setIsRefreshing(true);
    try {
      loadDashboard();
    } finally {
      setIsRefreshing(false);
    }
  }, [loadDashboard]);

  const dateRange = useMemo(
    () => getDateRange(dashboard.entries, rangeKey),
    [dashboard.entries, rangeKey],
  );
  const selectedEntries = useMemo(
    () => filterEntriesByDateRange(dashboard.entries, dateRange),
    [dashboard.entries, dateRange],
  );
  const latestDate = getLatestEntryDate(dashboard.entries);
  const weekStart = latestDate ? getSleepWeekStart(latestDate) : null;
  const weekRange = weekStart
    ? { startDate: weekStart, endDate: shiftCalendarDate(weekStart, 6) }
    : {};
  const weekSummary = weekStart
    ? getWeeklyAverage(dashboard.entries, weekStart, dashboard.targetHours)
    : null;
  const weekConsistency = getSleepConsistencySummary(
    dashboard.entries,
    weekRange,
  );
  const weekDebt = calculateSleepDebt(
    dashboard.entries,
    weekRange,
    dashboard.targetHours,
  );
  const weekEfficiency = getAverageEfficiency(dashboard.entries, weekRange);
  const selectedConsistency = getSleepConsistencySummary(
    selectedEntries,
    dateRange,
  );
  const selectedDebt = calculateSleepDebt(
    selectedEntries,
    dateRange,
    dashboard.targetHours,
  );
  const durationTrend = toDurationChartPoints(
    dashboard.entries,
    dateRange,
    rangeKey,
    dashboard.targetHours,
  );
  const qualityTrend = toQualityChartPoints(
    dashboard.entries,
    dateRange,
    rangeKey,
    dashboard.targetHours,
  );
  const debtTrend = getDebtTrend(
    selectedEntries,
    dateRange,
    dashboard.targetHours,
  );
  const correlations = getDisplayCorrelations(
    selectedEntries,
    dashboard.factors,
    dateRange,
  );
  const bestNights = getBestNights(
    selectedEntries,
    dashboard.factors,
    3,
    dateRange,
  );
  const worstNights = getWorstNights(
    selectedEntries,
    dashboard.factors,
    3,
    dateRange,
  );
  const optimalWindow = getOptimalWindowCopy(selectedEntries, dateRange);
  const weekendVsWeekday = getWeekendVsWeekday(
    selectedEntries,
    dateRange,
    dashboard.targetHours,
  );
  const sleepMoodCorrelation = useMemo(
    () => getSleepMoodCorrelation(db, dateRange),
    [db, dateRange],
  );
  const sleepHabitAdherence = useMemo(
    () => getSleepHabitAdherence(db, dateRange),
    [db, dateRange],
  );
  const healthBridgeSummary = useMemo(
    () => getHealthBridgeSummary(db, dateRange),
    [db, dateRange],
  );
  const healthSyncPreview = useMemo(
    () => buildHealthSyncPreview(db, dateRange),
    [db, dateRange],
  );

  const neededEntries = Math.max(0, 7 - selectedEntries.length);
  const isInsufficient = selectedEntries.length < 7;
  const isPartial = selectedEntries.length >= 7 && selectedEntries.length < 14;

  if (!isLoading && !error && dashboard.entries.length === 0) {
    return (
      <SleepPlaceholderScreen
        eyebrow="Insights"
        title="Log 7 nights to unlock patterns"
        subtitle="The insights dashboard uses your own sleep logs, quality ratings, and factor notes. Start with one morning log, then let the patterns build."
        cards={[
          {
            emoji: '📈',
            title: 'Duration and quality trends',
            body: 'Line charts unlock once there are enough nights to compare without overclaiming.',
          },
          {
            emoji: '🧭',
            title: 'Consistency and debt',
            body: 'MySleep compares bedtime rhythm, wake rhythm, and cumulative target gaps.',
          },
          {
            emoji: '🧩',
            title: 'Factor cards',
            body: 'Exercise, caffeine, alcohol, stress, and screen cutoff cards stay quiet until the sample is large enough.',
          },
        ]}
        footer={(
          <Pressable
            onPress={() => router.push('/(sleep)/log' as never)}
            style={styles.primaryButton}
          >
            <Text style={styles.primaryButtonText}>Log Sleep</Text>
          </Pressable>
        )}
      />
    );
  }

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
        <Text style={styles.eyebrow}>Insights</Text>
        <Text style={styles.heroTitle}>Sleep patterns from your own logs.</Text>
        <Text style={styles.heroSubtitle}>
          Trends, debt, consistency, and factor cards stay local and only use the sleep data you have saved.
        </Text>
        <RangeSelector value={rangeKey} onChange={setRangeKey} />
      </View>

      {isLoading ? (
        <View style={styles.loadingCard}>
          <ActivityIndicator color={SLEEP_ACCENT} />
        </View>
      ) : error ? (
        <View style={styles.errorCard}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : isInsufficient ? (
        <View style={styles.progressCard}>
          <Text style={styles.cardEyebrow}>More nights needed</Text>
          <Text style={styles.cardTitle}>
            Log {pluralize(neededEntries, 'more night')} to unlock insights
          </Text>
          <Text style={styles.cardBody}>
            {selectedEntries.length} nights are in this range. At 7 nights, MySleep shows basic trends. At 14 nights, factor cards and best/worst condition summaries turn on.
          </Text>
          <Pressable
            onPress={() => router.push('/(sleep)/log' as never)}
            style={styles.secondaryButton}
          >
            <Text style={styles.secondaryButtonText}>Log Sleep</Text>
          </Pressable>
        </View>
      ) : (
        <>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>This Week Summary</Text>
            <Text style={styles.sectionMeta}>
              {weekSummary ? `${weekSummary.totalNights} nights` : 'No current week'}
            </Text>
          </View>

          <View style={styles.metricGrid}>
            <MetricCard
              label="Avg Duration"
              value={formatHours(weekSummary?.avgDurationHours)}
              detail={`${weekSummary?.onTargetNights ?? 0} on target`}
            />
            <MetricCard
              label="Avg Quality"
              value={formatQuality(weekSummary?.avgQualityRating)}
              detail={`${weekSummary?.ratedNights ?? 0} rated nights`}
            />
            <MetricCard
              label="Consistency"
              value={formatScore(weekConsistency.score)}
              detail="Bed and wake rhythm"
            />
            <MetricCard
              label="Sleep Debt"
              value={`${weekDebt.toFixed(1)}h`}
              detail={`Target ${dashboard.targetHours}h/night`}
            />
            <MetricCard
              label="Efficiency"
              value={formatEfficiency(weekEfficiency)}
              detail="Sleep time / time in bed"
            />
          </View>

          <SleepLineChart
            emptyLabel="Log more nights for a duration trend."
            points={durationTrend}
            targetValue={dashboard.targetHours}
            title="Duration Trend"
            valueFormatter={(value) => `${value.toFixed(1)}h`}
          />

          <SleepLineChart
            emptyLabel="Rate more nights for a quality trend."
            points={qualityTrend}
            title="Quality Trend"
            valueFormatter={(value) => `${value.toFixed(1)}/5`}
            yMax={5}
            yMin={1}
          />

          <View style={styles.twoColumn}>
            <ConsistencyRing score={selectedConsistency.score} />
            <SleepDebtMeter
              currentDebt={selectedDebt}
              latestDebt={debtTrend.at(-1)?.dailyDebtHours ?? null}
            />
          </View>

          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View>
                <Text style={styles.cardEyebrow}>Factor Insights</Text>
                <Text style={styles.cardTitle}>What lines up with better sleep</Text>
              </View>
              <Text style={styles.samplePill}>
                {selectedEntries.length} nights
              </Text>
            </View>
            <View style={styles.factorGrid}>
              {isPartial
                ? FACTOR_LABELS.map((label) => (
                    <FactorInsightCard
                      key={label}
                      label={label}
                      statusLabel="Need more data"
                      body="Factor comparisons unlock after 14 nights in the selected range."
                    />
                  ))
                : correlations.map((correlation) => (
                    <FactorInsightCard
                      key={correlation.factor}
                      label={correlation.label}
                      statusLabel={getCorrelationStatusLabel(correlation)}
                      body={getCorrelationBody(correlation)}
                    />
                  ))}
            </View>
          </View>

          <ConditionCard
            eyebrow="Best Conditions"
            title="Your best nights"
            emptyCopy="No rated nights with factor context in this range yet."
            nights={bestNights}
          />

          {sleepMoodCorrelation.status === 'reportable' ? (
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <View>
                  <Text style={styles.cardEyebrow}>Mood Bridge</Text>
                  <Text style={styles.cardTitle}>Sleep quality and mood move together</Text>
                </View>
                <Text style={styles.samplePill}>
                  {getMoodBridgeMeta(sleepMoodCorrelation)}
                </Text>
              </View>
              <Text style={styles.cardBody}>{sleepMoodCorrelation.insight}</Text>
              {sleepMoodCorrelation.highMoodAverageSleepQuality !== null &&
              sleepMoodCorrelation.lowMoodAverageSleepQuality !== null ? (
                <View style={styles.comparisonGrid}>
                  <MetricCard
                    label="High mood"
                    value={`${sleepMoodCorrelation.highMoodAverageSleepQuality.toFixed(1)}/5`}
                    detail="Avg sleep quality"
                  />
                  <MetricCard
                    label="Lower mood"
                    value={`${sleepMoodCorrelation.lowMoodAverageSleepQuality.toFixed(1)}/5`}
                    detail="Avg sleep quality"
                  />
                </View>
              ) : null}
            </View>
          ) : null}

          {sleepHabitAdherence.status === 'reportable' ? (
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <View>
                  <Text style={styles.cardEyebrow}>Habits Bridge</Text>
                  <Text style={styles.cardTitle}>Bedtime routine adherence</Text>
                </View>
                <Text style={styles.samplePill}>
                  {getHabitBridgeMeta(sleepHabitAdherence)}
                </Text>
              </View>
              <Text style={styles.cardBody}>{sleepHabitAdherence.insight}</Text>
              {sleepHabitAdherence.averageQualityAfterRoutine !== null &&
              sleepHabitAdherence.averageQualityWithoutRoutine !== null ? (
                <View style={styles.comparisonGrid}>
                  <MetricCard
                    label="Routine nights"
                    value={`${sleepHabitAdherence.averageQualityAfterRoutine.toFixed(1)}/5`}
                    detail="Avg sleep quality"
                  />
                  <MetricCard
                    label="Missed routine"
                    value={`${sleepHabitAdherence.averageQualityWithoutRoutine.toFixed(1)}/5`}
                    detail="Avg sleep quality"
                  />
                </View>
              ) : null}
            </View>
          ) : null}

          {healthBridgeSummary.status === 'reportable' ? (
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <View>
                  <Text style={styles.cardEyebrow}>Health Bridge</Text>
                  <Text style={styles.cardTitle}>Manual journal summary for MyHealth</Text>
                </View>
                <Text style={styles.samplePill}>
                  {getHealthBridgeMeta(healthBridgeSummary)}
                </Text>
              </View>
              <Text style={styles.cardBody}>{healthBridgeSummary.insight}</Text>
              <View style={styles.comparisonGrid}>
                <MetricCard
                  label="Avg Duration"
                  value={
                    healthBridgeSummary.averageDurationHours !== null
                      ? `${healthBridgeSummary.averageDurationHours.toFixed(1)}h`
                      : 'Not enough data'
                  }
                  detail="Manual journal"
                />
                <MetricCard
                  label="Avg Quality"
                  value={
                    healthBridgeSummary.averageQualityRating !== null
                      ? `${healthBridgeSummary.averageQualityRating.toFixed(1)}/5`
                      : 'Not rated'
                  }
                  detail="Manual journal"
                />
              </View>
            </View>
          ) : healthSyncPreview.status !== 'disabled' ? (
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <View>
                  <Text style={styles.cardEyebrow}>Health Bridge Preview</Text>
                  <Text style={styles.cardTitle}>Review before sharing with MyHealth</Text>
                </View>
                <Text style={styles.samplePill}>
                  {getHealthPreviewMeta(healthSyncPreview)}
                </Text>
              </View>
              <Text style={styles.cardBody}>{healthSyncPreview.previewCopy}</Text>
              <View style={styles.comparisonGrid}>
                <MetricCard
                  label="Would Share"
                  value={`${healthSyncPreview.sharedFields.length} fields`}
                  detail={healthSyncPreview.sharedFields.slice(0, 3).join(', ')}
                />
                <MetricCard
                  label="Excluded"
                  value={`${healthSyncPreview.excludedFields.length} fields`}
                  detail={healthSyncPreview.excludedFields.slice(0, 3).join(', ')}
                />
              </View>
            </View>
          ) : null}

          <ConditionCard
            eyebrow="Worst Conditions"
            title="Poor sleep correlated with"
            emptyCopy="Worst-night context appears after more rated logs."
            nights={worstNights}
          />

          <View style={styles.card}>
            <Text style={styles.cardEyebrow}>Optimal Window</Text>
            <Text style={styles.cardTitle}>{optimalWindow.title}</Text>
            <Text style={styles.cardBody}>{optimalWindow.detail}</Text>
            <Text style={styles.cardMeta}>{optimalWindow.meta}</Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardEyebrow}>Weekend vs Weekday</Text>
            <Text style={styles.cardTitle}>
              {formatWeekendComparison(weekendVsWeekday.difference.durationMinutes)}
            </Text>
            <View style={styles.comparisonGrid}>
              <MetricCard
                label="Weekdays"
                value={formatHours(weekendVsWeekday.weekdayAvg.avgDurationHours)}
                detail={formatQuality(weekendVsWeekday.weekdayAvg.avgQualityRating)}
              />
              <MetricCard
                label="Weekends"
                value={formatHours(weekendVsWeekday.weekendAvg.avgDurationHours)}
                detail={formatQuality(weekendVsWeekday.weekendAvg.avgQualityRating)}
              />
            </View>
            <Text style={styles.cardMeta}>
              Quality delta {formatQualityDelta(weekendVsWeekday.difference.qualityRating)}
            </Text>
          </View>
        </>
      )}
    </ScrollView>
  );
}

function RangeSelector({
  onChange,
  value,
}: {
  onChange: (value: InsightsRangeKey) => void;
  value: InsightsRangeKey;
}) {
  return (
    <View style={styles.rangeRow}>
      {RANGE_OPTIONS.map((option) => {
        const selected = option.key === value;
        return (
          <Pressable
            key={option.key}
            onPress={() => onChange(option.key)}
            style={[styles.rangeButton, selected ? styles.rangeButtonActive : null]}
          >
            <Text
              style={[
                styles.rangeButtonText,
                selected ? styles.rangeButtonTextActive : null,
              ]}
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function MetricCard({
  detail,
  label,
  value,
}: {
  detail: string;
  label: string;
  value: string;
}) {
  return (
    <View style={styles.metricCard}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricDetail}>{detail}</Text>
    </View>
  );
}

function SleepLineChart({
  emptyLabel,
  points,
  targetValue,
  title,
  valueFormatter,
  yMax,
  yMin,
}: {
  emptyLabel: string;
  points: ChartPoint[];
  targetValue?: number;
  title: string;
  valueFormatter: (value: number) => string;
  yMax?: number;
  yMin?: number;
}) {
  const drawable = points.filter((point) => typeof point.value === 'number');
  const geometry = getChartGeometry(points, targetValue, yMin, yMax);
  const firstLabel = points[0]?.label ?? '';
  const middleLabel = points[Math.floor(points.length / 2)]?.label ?? '';
  const lastLabel = points.at(-1)?.label ?? '';

  return (
    <View style={styles.chartCard}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle}>{title}</Text>
        {targetValue !== undefined ? (
          <Text style={styles.samplePill}>Target {targetValue}h</Text>
        ) : null}
      </View>
      {drawable.length === 0 ? (
        <View style={styles.emptyChart}>
          <Text style={styles.cardBody}>{emptyLabel}</Text>
        </View>
      ) : (
        <>
          <View style={styles.chartShell}>
            <Svg
              height={CHART_HEIGHT}
              width="100%"
              viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
            >
              <Defs>
                <LinearGradient id={`sleep-chart-fill-${title}`} x1="0" x2="0" y1="0" y2="1">
                  <Stop offset="0" stopColor="rgba(167,139,250,0.32)" />
                  <Stop offset="1" stopColor="rgba(167,139,250,0.02)" />
                </LinearGradient>
              </Defs>
              {geometry.targetY !== null ? (
                <Line
                  stroke="rgba(255,255,255,0.58)"
                  strokeDasharray="6 6"
                  strokeWidth={2}
                  x1={CHART_PADDING}
                  x2={CHART_WIDTH - CHART_PADDING}
                  y1={geometry.targetY}
                  y2={geometry.targetY}
                />
              ) : null}
              {geometry.linePoints ? (
                <>
                  <Path
                    d={`M ${geometry.linePoints} L ${CHART_WIDTH - CHART_PADDING} ${CHART_HEIGHT - CHART_PADDING} L ${CHART_PADDING} ${CHART_HEIGHT - CHART_PADDING} Z`}
                    fill={`url(#sleep-chart-fill-${title})`}
                  />
                  <Polyline
                    fill="none"
                    points={geometry.linePoints}
                    stroke="#A78BFA"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={4}
                  />
                  {geometry.chartPoints.map((point, index) => (
                    <Circle
                      key={`${title}-${index}`}
                      cx={point.x}
                      cy={point.y}
                      fill="#A78BFA"
                      r={4}
                    />
                  ))}
                </>
              ) : null}
            </Svg>
            <View style={styles.chartRangeLabels}>
              <Text style={styles.chartRangeText}>{valueFormatter(geometry.max)}</Text>
              <Text style={styles.chartRangeText}>{valueFormatter(geometry.min)}</Text>
            </View>
          </View>
          <View style={styles.chartLabels}>
            <Text style={styles.chartLabel}>{firstLabel}</Text>
            <Text style={styles.chartLabel}>{middleLabel}</Text>
            <Text style={styles.chartLabel}>{lastLabel}</Text>
          </View>
        </>
      )}
    </View>
  );
}

function ConsistencyRing({ score }: { score: number }) {
  const radius = 52;
  const circumference = 2 * Math.PI * radius;
  const progress = Math.max(0, Math.min(100, score)) / 100;
  const strokeLength = circumference * progress;

  return (
    <View style={styles.card}>
      <Text style={styles.cardEyebrow}>Consistency Ring</Text>
      <View style={styles.ringWrap}>
        <Svg height={132} width={132} viewBox="0 0 132 132">
          <Circle
            cx={66}
            cy={66}
            fill="transparent"
            r={radius}
            stroke="rgba(255,255,255,0.10)"
            strokeWidth={12}
          />
          <Circle
            cx={66}
            cy={66}
            fill="transparent"
            r={radius}
            stroke="#A78BFA"
            strokeDasharray={`${strokeLength} ${circumference}`}
            strokeLinecap="round"
            strokeWidth={12}
            transform="rotate(-90 66 66)"
          />
        </Svg>
        <View style={styles.ringCenter}>
          <Text style={styles.ringValue}>{Math.round(score)}</Text>
          <Text style={styles.ringLabel}>/100</Text>
        </View>
      </View>
      <Text style={styles.cardBody}>
        Higher scores mean bedtime and wake time are landing closer together.
      </Text>
    </View>
  );
}

function SleepDebtMeter({
  currentDebt,
  latestDebt,
}: {
  currentDebt: number;
  latestDebt: number | null;
}) {
  const progress = Math.min(100, (currentDebt / DEBT_GOAL_HOURS) * 100);

  return (
    <View style={styles.card}>
      <Text style={styles.cardEyebrow}>Sleep Debt Meter</Text>
      <Text style={styles.debtValue}>{currentDebt.toFixed(1)}h</Text>
      <View style={styles.debtTrack}>
        <View style={[styles.debtFill, { width: `${Math.max(6, progress)}%` }]} />
      </View>
      <Text style={styles.cardBody}>
        {latestDebt === null
          ? 'No debt entry in the latest selected night.'
          : `Latest night moved the meter by ${latestDebt.toFixed(1)}h.`}
      </Text>
    </View>
  );
}

function FactorInsightCard({
  body,
  label,
  statusLabel,
}: {
  body: string;
  label: string;
  statusLabel: string;
}) {
  return (
    <View style={styles.factorCard}>
      <Text style={styles.factorLabel}>{label}</Text>
      <Text style={styles.factorStatus}>{statusLabel}</Text>
      <Text style={styles.factorBody}>{body}</Text>
    </View>
  );
}

function ConditionCard({
  emptyCopy,
  eyebrow,
  nights,
  title,
}: {
  emptyCopy: string;
  eyebrow: string;
  nights: SleepNightInsight[];
  title: string;
}) {
  return (
    <View style={styles.card}>
      <Text style={styles.cardEyebrow}>{eyebrow}</Text>
      <Text style={styles.cardTitle}>{title}</Text>
      {nights.length === 0 ? (
        <Text style={styles.cardBody}>{emptyCopy}</Text>
      ) : (
        <View style={styles.conditionList}>
          {nights.map((night) => (
            <Text key={night.entry.id} style={styles.conditionItem}>
              {formatInsightNight(night)}
            </Text>
          ))}
        </View>
      )}
    </View>
  );
}

function getCorrelationStatusLabel(correlation: SleepCorrelationResult): string {
  if (correlation.status === 'reportable') {
    return `${correlation.impactPercent ?? 0}% impact`;
  }
  if (correlation.status === 'not_significant') {
    return 'Not significant';
  }
  return 'Need more data';
}

function getCorrelationBody(correlation: SleepCorrelationResult): string {
  if (correlation.insight) {
    return `${correlation.insight} Confidence: ${correlation.confidence}.`;
  }
  return correlation.reason ?? 'No clear pattern in this range yet.';
}

function formatWeekendComparison(durationMinutes: number | null): string {
  if (durationMinutes === null) {
    return 'Weekend and weekday averages need more data';
  }
  if (durationMinutes === 0) {
    return 'Weekend duration matches weekdays';
  }
  const abs = Math.abs(durationMinutes);
  return `Weekends average ${durationMinutes > 0 ? '+' : '-'}${formatDurationLabel(abs)} vs weekdays`;
}

function formatQualityDelta(value: number | null): string {
  if (value === null) {
    return 'not enough rated nights';
  }
  if (value === 0) {
    return '0.0 points';
  }
  return `${value > 0 ? '+' : ''}${value.toFixed(1)} points`;
}

function getMoodBridgeMeta(correlation: SleepMoodCorrelation): string {
  return `r=${correlation.correlation.toFixed(2)} · ${pluralize(correlation.sampleSize, 'paired day')}`;
}

function getHabitBridgeMeta(summary: SleepHabitAdherenceSummary): string {
  const adherence = summary.adherenceRate ?? 0;
  return `${Math.round(adherence)}% · ${pluralize(summary.sampleSize, 'night')}`;
}

function getHealthBridgeMeta(summary: HealthBridgeSummary): string {
  if (summary.averageDurationHours === null) {
    return pluralize(summary.sampleSize, 'night');
  }
  return `${summary.averageDurationHours.toFixed(1)}h · ${pluralize(summary.sampleSize, 'night')}`;
}

function getHealthPreviewMeta(preview: HealthSyncPreview): string {
  return preview.status === 'ready' ? 'Consent required' : 'Needs MySleep data';
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
    padding: 20,
    borderRadius: 24,
    backgroundColor: surfaceTiers.container,
    borderWidth: 1,
    borderColor: colors.border,
  },
  eyebrow: {
    color: SLEEP_ACCENT,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  heroTitle: {
    color: colors.text,
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '800',
  },
  heroSubtitle: {
    color: colors.textSecondary,
    fontSize: 15,
    lineHeight: 22,
  },
  rangeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  rangeButton: {
    minHeight: 38,
    justifyContent: 'center',
    borderRadius: 999,
    paddingHorizontal: 13,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: colors.border,
  },
  rangeButtonActive: {
    backgroundColor: '#A78BFA',
    borderColor: '#C4B5FD',
  },
  rangeButtonText: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '700',
  },
  rangeButtonTextActive: {
    color: '#0E0E13',
  },
  loadingCard: {
    minHeight: 180,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
    backgroundColor: surfaceTiers.low,
    borderWidth: 1,
    borderColor: colors.border,
  },
  errorCard: {
    padding: 18,
    borderRadius: 20,
    backgroundColor: 'rgba(255,69,58,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,69,58,0.28)',
  },
  errorText: {
    color: '#FECACA',
    fontSize: 14,
    lineHeight: 20,
  },
  progressCard: {
    gap: 12,
    padding: 20,
    borderRadius: 22,
    backgroundColor: 'rgba(167,139,250,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(167,139,250,0.28)',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '800',
  },
  sectionMeta: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '700',
  },
  metricGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  metricCard: {
    flexBasis: '47%',
    flexGrow: 1,
    minWidth: 150,
    gap: 7,
    padding: 16,
    borderRadius: 18,
    backgroundColor: surfaceTiers.low,
    borderWidth: 1,
    borderColor: colors.border,
  },
  metricLabel: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  metricValue: {
    color: colors.text,
    fontSize: 24,
    lineHeight: 29,
    fontWeight: '800',
  },
  metricDetail: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 18,
  },
  chartCard: {
    gap: 14,
    padding: 18,
    borderRadius: 20,
    backgroundColor: surfaceTiers.low,
    borderWidth: 1,
    borderColor: colors.border,
  },
  card: {
    gap: 12,
    padding: 18,
    borderRadius: 20,
    backgroundColor: surfaceTiers.low,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  cardEyebrow: {
    color: SLEEP_ACCENT,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  cardTitle: {
    color: colors.text,
    fontSize: 19,
    lineHeight: 24,
    fontWeight: '800',
  },
  cardBody: {
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
  },
  cardMeta: {
    color: colors.textSecondary,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '700',
  },
  samplePill: {
    overflow: 'hidden',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: 'rgba(167,139,250,0.14)',
    color: '#E9DDFF',
    fontSize: 12,
    fontWeight: '800',
  },
  chartShell: {
    position: 'relative',
    overflow: 'hidden',
    borderRadius: 18,
    backgroundColor: 'rgba(10,10,15,0.42)',
  },
  chartRangeLabels: {
    position: 'absolute',
    top: 12,
    right: 14,
    bottom: 12,
    justifyContent: 'space-between',
  },
  chartRangeText: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '700',
  },
  chartLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  chartLabel: {
    flex: 1,
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'center',
  },
  emptyChart: {
    minHeight: CHART_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
    backgroundColor: 'rgba(10,10,15,0.42)',
    padding: 18,
  },
  twoColumn: {
    gap: 12,
  },
  ringWrap: {
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  ringCenter: {
    position: 'absolute',
    alignItems: 'center',
  },
  ringValue: {
    color: colors.text,
    fontSize: 28,
    lineHeight: 32,
    fontWeight: '900',
  },
  ringLabel: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
  },
  debtValue: {
    color: colors.text,
    fontSize: 34,
    lineHeight: 38,
    fontWeight: '900',
  },
  debtTrack: {
    height: 14,
    overflow: 'hidden',
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  debtFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: '#A78BFA',
  },
  factorGrid: {
    gap: 10,
  },
  factorCard: {
    gap: 7,
    padding: 14,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: colors.border,
  },
  factorLabel: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '800',
  },
  factorStatus: {
    color: '#C4B5FD',
    fontSize: 13,
    fontWeight: '800',
  },
  factorBody: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 19,
  },
  conditionList: {
    gap: 9,
  },
  conditionItem: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 19,
  },
  comparisonGrid: {
    gap: 10,
  },
  primaryButton: {
    minHeight: 56,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: SLEEP_ACCENT,
  },
  primaryButtonText: {
    color: '#0E0E13',
    fontSize: 16,
    fontWeight: '800',
  },
  secondaryButton: {
    minHeight: 48,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: colors.border,
  },
  secondaryButtonText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
});
