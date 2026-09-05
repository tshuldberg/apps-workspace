import type { CSSProperties } from 'react';
import Link from 'next/link';
import type {
  Factor,
  HealthBridgeSummary,
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
  getSleepWeekStart,
  getSleepMoodCorrelation,
  getStressLevelMeta,
  getTopCorrelations,
  getTrendData,
  getWeekendVsWeekday,
  getWeeklyAverage,
  getWorstNights,
  listEntries,
  listFactors,
  type HealthSyncPreview,
} from '@mylife/sleep';
import { ensureModuleMigrations, getAdapter } from '@/lib/db';
import { readSleepTargetHours } from '../presentation';
import { SleepInsightsLineChart, type SleepInsightsChartPoint } from './SleepInsightsCharts';

type InsightsRangeKey = '7d' | '30d' | '90d' | 'all';

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

const DEBT_GOAL_HOURS = 14;
const SHORT_DATE_FORMATTER = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  timeZone: 'UTC',
});

function parseRange(value: string | string[] | undefined): InsightsRangeKey {
  const raw = Array.isArray(value) ? value[0] : value;
  return RANGE_OPTIONS.some((option) => option.key === raw)
    ? (raw as InsightsRangeKey)
    : '30d';
}

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
): SleepInsightsChartPoint[] {
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
): SleepInsightsChartPoint[] {
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
  return top.length > 0 ? top : getAllCorrelations(entries, factors, dateRange);
}

function formatConditionHighlights(factor: Factor | null): string[] {
  if (!factor) {
    return ['No factor log saved'];
  }

  const highlights: string[] = [
    factor.exercise_today ? 'exercise' : 'no exercise',
    factor.alcohol_drinks === 0
      ? 'no alcohol'
      : pluralize(factor.alcohol_drinks, 'drink'),
  ];

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

function addMinutesToClock(value: string, minutesToAdd: number): string {
  const [hours, minutes] = value.split(':').map(Number);
  const total = (((hours * 60) + minutes + minutesToAdd) % (24 * 60) + (24 * 60)) % (24 * 60);
  const nextHours = Math.floor(total / 60);
  const nextMinutes = total % 60;
  return `${String(nextHours).padStart(2, '0')}:${String(nextMinutes).padStart(2, '0')}`;
}

function formatClockLabel(value: string | null): string {
  return formatFactorClockTime(value) ?? 'Not enough data';
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
  return `Weekends average ${durationMinutes > 0 ? '+' : '-'}${formatDurationLabel(Math.abs(durationMinutes))} vs weekdays`;
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

export default async function SleepInsightsPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string | string[] }>;
}) {
  const params = await searchParams;
  const rangeKey = parseRange(params.range);
  const adapter = getAdapter();
  ensureModuleMigrations('sleep');
  ensureModuleMigrations('mood');
  ensureModuleMigrations('habits');
  ensureModuleMigrations('health');
  const entries = listEntries(adapter, { limit: 500 });
  const factors = listFactors(adapter, { limit: 500 });
  const targetHours = readSleepTargetHours(adapter);
  const dateRange = getDateRange(entries, rangeKey);
  const selectedEntries = filterEntriesByDateRange(entries, dateRange);
  const latestDate = getLatestEntryDate(entries);
  const weekStart = latestDate ? getSleepWeekStart(latestDate) : null;
  const weekRange = weekStart
    ? { startDate: weekStart, endDate: shiftCalendarDate(weekStart, 6) }
    : {};
  const weekSummary = weekStart
    ? getWeeklyAverage(entries, weekStart, targetHours)
    : null;
  const weekConsistency = getSleepConsistencySummary(entries, weekRange);
  const weekDebt = calculateSleepDebt(entries, weekRange, targetHours);
  const weekEfficiency = getAverageEfficiency(entries, weekRange);
  const selectedConsistency = getSleepConsistencySummary(
    selectedEntries,
    dateRange,
  );
  const selectedDebt = calculateSleepDebt(selectedEntries, dateRange, targetHours);
  const durationTrend = toDurationChartPoints(
    entries,
    dateRange,
    rangeKey,
    targetHours,
  );
  const qualityTrend = toQualityChartPoints(
    entries,
    dateRange,
    rangeKey,
    targetHours,
  );
  const debtTrend = getDebtTrend(selectedEntries, dateRange, targetHours);
  const correlations = getDisplayCorrelations(selectedEntries, factors, dateRange);
  const bestNights = getBestNights(selectedEntries, factors, 3, dateRange);
  const worstNights = getWorstNights(selectedEntries, factors, 3, dateRange);
  const optimalWindow = getOptimalWindowCopy(selectedEntries, dateRange);
  const weekendVsWeekday = getWeekendVsWeekday(
    selectedEntries,
    dateRange,
    targetHours,
  );
  const sleepMoodCorrelation = getSleepMoodCorrelation(adapter, dateRange);
  const sleepHabitAdherence = getSleepHabitAdherence(adapter, dateRange);
  const healthBridgeSummary = getHealthBridgeSummary(adapter, dateRange);
  const healthSyncPreview = buildHealthSyncPreview(adapter, dateRange);
  const neededEntries = Math.max(0, 7 - selectedEntries.length);
  const isInsufficient = selectedEntries.length < 7;
  const isPartial = selectedEntries.length >= 7 && selectedEntries.length < 14;

  if (entries.length === 0) {
    return (
      <div style={styles.page}>
        <section style={styles.hero}>
          <p style={styles.eyebrow}>Insights</p>
          <h1 style={styles.heroTitle}>Log 7 nights to unlock patterns</h1>
          <p style={styles.heroBody}>
            The dashboard uses your own sleep logs, quality ratings, and factor notes. Start with one morning log, then let the patterns build.
          </p>
          <Link href="/sleep/log" style={styles.primaryLink}>
            Log Sleep
          </Link>
        </section>
      </div>
    );
  }

  return (
    <div style={styles.page}>
      <section style={styles.hero}>
        <p style={styles.eyebrow}>Insights</p>
        <h1 style={styles.heroTitle}>Sleep patterns from your own logs.</h1>
        <p style={styles.heroBody}>
          Trends, debt, consistency, and factor cards stay local and only use the sleep data you have saved.
        </p>
        <RangeSelector value={rangeKey} />
      </section>

      {isInsufficient ? (
        <section style={styles.progressCard}>
          <p style={styles.cardEyebrow}>More nights needed</p>
          <h2 style={styles.cardTitle}>
            Log {pluralize(neededEntries, 'more night')} to unlock insights
          </h2>
          <p style={styles.cardBody}>
            {selectedEntries.length} nights are in this range. At 7 nights, MySleep shows basic trends. At 14 nights, factor cards and best/worst condition summaries turn on.
          </p>
          <Link href="/sleep/log" style={styles.secondaryLink}>
            Log Sleep
          </Link>
        </section>
      ) : (
        <>
          <div style={styles.sectionHeader}>
            <h2 style={styles.sectionTitle}>This Week Summary</h2>
            <span style={styles.sectionMeta}>
              {weekSummary ? `${weekSummary.totalNights} nights` : 'No current week'}
            </span>
          </div>

          <section style={styles.metricGrid}>
            <MetricCard
              detail={`${weekSummary?.onTargetNights ?? 0} on target`}
              label="Avg Duration"
              value={formatHours(weekSummary?.avgDurationHours)}
            />
            <MetricCard
              detail={`${weekSummary?.ratedNights ?? 0} rated nights`}
              label="Avg Quality"
              value={formatQuality(weekSummary?.avgQualityRating)}
            />
            <MetricCard
              detail="Bed and wake rhythm"
              label="Consistency"
              value={String(Math.round(weekConsistency.score))}
            />
            <MetricCard
              detail={`Target ${targetHours}h/night`}
              label="Sleep Debt"
              value={`${weekDebt.toFixed(1)}h`}
            />
            <MetricCard
              detail="Sleep time / time in bed"
              label="Efficiency"
              value={formatEfficiency(weekEfficiency)}
            />
          </section>

          <SleepInsightsLineChart
            emptyLabel="Log more nights for a duration trend."
            points={durationTrend}
            targetValue={targetHours}
            title="Duration Trend"
            valueLabel="Duration"
          />

          <SleepInsightsLineChart
            emptyLabel="Rate more nights for a quality trend."
            points={qualityTrend}
            title="Quality Trend"
            valueLabel="Quality"
            yDomain={[1, 5]}
          />

          <section style={styles.visualGrid}>
            <ConsistencyRing score={selectedConsistency.score} />
            <SleepDebtMeter
              currentDebt={selectedDebt}
              latestDebt={debtTrend.at(-1)?.dailyDebtHours ?? null}
            />
          </section>

          <section style={styles.card}>
            <div style={styles.cardHeader}>
              <div>
                <p style={styles.cardEyebrow}>Factor Insights</p>
                <h2 style={styles.cardTitle}>What lines up with better sleep</h2>
              </div>
              <span style={styles.pill}>{selectedEntries.length} nights</span>
            </div>
            <div style={styles.factorGrid}>
              {isPartial
                ? FACTOR_LABELS.map((label) => (
                    <FactorInsightCard
                      key={label}
                      body="Factor comparisons unlock after 14 nights in the selected range."
                      label={label}
                      statusLabel="Need more data"
                    />
                  ))
                : correlations.map((correlation) => (
                    <FactorInsightCard
                      key={correlation.factor}
                      body={getCorrelationBody(correlation)}
                      label={correlation.label}
                      statusLabel={getCorrelationStatusLabel(correlation)}
                    />
                  ))}
            </div>
          </section>

          <ConditionCard
            emptyCopy="No rated nights with factor context in this range yet."
            eyebrow="Best Conditions"
            nights={bestNights}
            title="Your best nights"
          />

          {sleepMoodCorrelation.status === 'reportable' ? (
            <section style={styles.card}>
              <div style={styles.cardHeader}>
                <div>
                  <p style={styles.cardEyebrow}>Mood Bridge</p>
                  <h2 style={styles.cardTitle}>Sleep quality and mood move together</h2>
                </div>
                <span style={styles.pill}>{getMoodBridgeMeta(sleepMoodCorrelation)}</span>
              </div>
              <p style={styles.cardBody}>{sleepMoodCorrelation.insight}</p>
              {sleepMoodCorrelation.highMoodAverageSleepQuality !== null &&
              sleepMoodCorrelation.lowMoodAverageSleepQuality !== null ? (
                <div style={styles.comparisonGrid}>
                  <MetricCard
                    detail="Average sleep quality on high-mood days"
                    label="High mood"
                    value={`${sleepMoodCorrelation.highMoodAverageSleepQuality.toFixed(1)}/5`}
                  />
                  <MetricCard
                    detail="Average sleep quality on lower-mood days"
                    label="Lower mood"
                    value={`${sleepMoodCorrelation.lowMoodAverageSleepQuality.toFixed(1)}/5`}
                  />
                </div>
              ) : null}
            </section>
          ) : null}

          {sleepHabitAdherence.status === 'reportable' ? (
            <section style={styles.card}>
              <div style={styles.cardHeader}>
                <div>
                  <p style={styles.cardEyebrow}>Habits Bridge</p>
                  <h2 style={styles.cardTitle}>Bedtime routine adherence</h2>
                </div>
                <span style={styles.pill}>{getHabitBridgeMeta(sleepHabitAdherence)}</span>
              </div>
              <p style={styles.cardBody}>{sleepHabitAdherence.insight}</p>
              {sleepHabitAdherence.averageQualityAfterRoutine !== null &&
              sleepHabitAdherence.averageQualityWithoutRoutine !== null ? (
                <div style={styles.comparisonGrid}>
                  <MetricCard
                    detail="Average sleep quality after routine completion"
                    label="Routine nights"
                    value={`${sleepHabitAdherence.averageQualityAfterRoutine.toFixed(1)}/5`}
                  />
                  <MetricCard
                    detail="Average sleep quality without routine completion"
                    label="Missed routine"
                    value={`${sleepHabitAdherence.averageQualityWithoutRoutine.toFixed(1)}/5`}
                  />
                </div>
              ) : null}
            </section>
          ) : null}

          {healthBridgeSummary.status === 'reportable' ? (
            <section style={styles.card}>
              <div style={styles.cardHeader}>
                <div>
                  <p style={styles.cardEyebrow}>Health Bridge</p>
                  <h2 style={styles.cardTitle}>Manual journal summary for MyHealth</h2>
                </div>
                <span style={styles.pill}>{getHealthBridgeMeta(healthBridgeSummary)}</span>
              </div>
              <p style={styles.cardBody}>{healthBridgeSummary.insight}</p>
              <div style={styles.comparisonGrid}>
                <MetricCard
                  detail="Aggregate manual journal duration"
                  label="Avg Duration"
                  value={
                    healthBridgeSummary.averageDurationHours !== null
                      ? `${healthBridgeSummary.averageDurationHours.toFixed(1)}h`
                      : 'Not enough data'
                  }
                />
                <MetricCard
                  detail="Aggregate manual journal quality"
                  label="Avg Quality"
                  value={
                    healthBridgeSummary.averageQualityRating !== null
                      ? `${healthBridgeSummary.averageQualityRating.toFixed(1)}/5`
                      : 'Not rated'
                  }
                />
              </div>
            </section>
          ) : healthSyncPreview.status !== 'disabled' ? (
            <section style={styles.card}>
              <div style={styles.cardHeader}>
                <div>
                  <p style={styles.cardEyebrow}>Health Bridge Preview</p>
                  <h2 style={styles.cardTitle}>Review before sharing with MyHealth</h2>
                </div>
                <span style={styles.pill}>{getHealthPreviewMeta(healthSyncPreview)}</span>
              </div>
              <p style={styles.cardBody}>{healthSyncPreview.previewCopy}</p>
              <div style={styles.comparisonGrid}>
                <MetricCard
                  detail={healthSyncPreview.sharedFields.slice(0, 3).join(', ')}
                  label="Would Share"
                  value={`${healthSyncPreview.sharedFields.length} fields`}
                />
                <MetricCard
                  detail={healthSyncPreview.excludedFields.slice(0, 3).join(', ')}
                  label="Excluded"
                  value={`${healthSyncPreview.excludedFields.length} fields`}
                />
              </div>
            </section>
          ) : null}

          <ConditionCard
            emptyCopy="Worst-night context appears after more rated logs."
            eyebrow="Worst Conditions"
            nights={worstNights}
            title="Poor sleep correlated with"
          />

          <section style={styles.card}>
            <p style={styles.cardEyebrow}>Optimal Window</p>
            <h2 style={styles.cardTitle}>{optimalWindow.title}</h2>
            <p style={styles.cardBody}>{optimalWindow.detail}</p>
            <p style={styles.cardMeta}>{optimalWindow.meta}</p>
          </section>

          <section style={styles.card}>
            <p style={styles.cardEyebrow}>Weekend vs Weekday</p>
            <h2 style={styles.cardTitle}>
              {formatWeekendComparison(weekendVsWeekday.difference.durationMinutes)}
            </h2>
            <div style={styles.comparisonGrid}>
              <MetricCard
                detail={formatQuality(weekendVsWeekday.weekdayAvg.avgQualityRating)}
                label="Weekdays"
                value={formatHours(weekendVsWeekday.weekdayAvg.avgDurationHours)}
              />
              <MetricCard
                detail={formatQuality(weekendVsWeekday.weekendAvg.avgQualityRating)}
                label="Weekends"
                value={formatHours(weekendVsWeekday.weekendAvg.avgDurationHours)}
              />
            </div>
            <p style={styles.cardMeta}>
              Quality delta {formatQualityDelta(weekendVsWeekday.difference.qualityRating)}
            </p>
          </section>
        </>
      )}
    </div>
  );
}

function RangeSelector({ value }: { value: InsightsRangeKey }) {
  return (
    <nav aria-label="Sleep insight date range" style={styles.rangeRow}>
      {RANGE_OPTIONS.map((option) => {
        const selected = option.key === value;
        return (
          <Link
            key={option.key}
            href={option.key === '30d' ? '/sleep/insights' : `/sleep/insights?range=${option.key}`}
            style={{
              ...styles.rangeLink,
              ...(selected ? styles.rangeLinkActive : null),
            }}
          >
            {option.label}
          </Link>
        );
      })}
    </nav>
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
    <article style={styles.metricCard}>
      <span style={styles.metricLabel}>{label}</span>
      <strong style={styles.metricValue}>{value}</strong>
      <span style={styles.metricDetail}>{detail}</span>
    </article>
  );
}

function ConsistencyRing({ score }: { score: number }) {
  const radius = 52;
  const circumference = 2 * Math.PI * radius;
  const progress = Math.max(0, Math.min(100, score)) / 100;
  const strokeLength = circumference * progress;

  return (
    <section style={styles.card}>
      <p style={styles.cardEyebrow}>Consistency Ring</p>
      <div style={styles.ringWrap}>
        <svg height="132" viewBox="0 0 132 132" width="132">
          <circle
            cx="66"
            cy="66"
            fill="transparent"
            r={radius}
            stroke="rgba(255,255,255,0.10)"
            strokeWidth="12"
          />
          <circle
            cx="66"
            cy="66"
            fill="transparent"
            r={radius}
            stroke="#A78BFA"
            strokeDasharray={`${strokeLength} ${circumference}`}
            strokeLinecap="round"
            strokeWidth="12"
            transform="rotate(-90 66 66)"
          />
        </svg>
        <div style={styles.ringCenter}>
          <strong style={styles.ringValue}>{Math.round(score)}</strong>
          <span style={styles.ringLabel}>/100</span>
        </div>
      </div>
      <p style={styles.cardBody}>
        Higher scores mean bedtime and wake time are landing closer together.
      </p>
    </section>
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
    <section style={styles.card}>
      <p style={styles.cardEyebrow}>Sleep Debt Meter</p>
      <strong style={styles.debtValue}>{currentDebt.toFixed(1)}h</strong>
      <div style={styles.debtTrack}>
        <span style={{ ...styles.debtFill, width: `${Math.max(6, progress)}%` }} />
      </div>
      <p style={styles.cardBody}>
        {latestDebt === null
          ? 'No debt entry in the latest selected night.'
          : `Latest night moved the meter by ${latestDebt.toFixed(1)}h.`}
      </p>
    </section>
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
    <article style={styles.factorCard}>
      <strong style={styles.factorLabel}>{label}</strong>
      <span style={styles.factorStatus}>{statusLabel}</span>
      <p style={styles.factorBody}>{body}</p>
    </article>
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
    <section style={styles.card}>
      <p style={styles.cardEyebrow}>{eyebrow}</p>
      <h2 style={styles.cardTitle}>{title}</h2>
      {nights.length === 0 ? (
        <p style={styles.cardBody}>{emptyCopy}</p>
      ) : (
        <div style={styles.conditionList}>
          {nights.map((night) => (
            <p key={night.entry.id} style={styles.conditionItem}>
              {formatInsightNight(night)}
            </p>
          ))}
        </div>
      )}
    </section>
  );
}

const styles: Record<string, CSSProperties> = {
  page: {
    display: 'grid',
    gap: 16,
  },
  hero: {
    display: 'grid',
    gap: 14,
    padding: 22,
    borderRadius: 22,
    border: '1px solid rgba(255,255,255,0.08)',
    background: 'rgba(255,255,255,0.04)',
    backdropFilter: 'blur(18px)',
  },
  eyebrow: {
    margin: 0,
    color: '#C4B5FD',
    fontSize: 12,
    fontWeight: 800,
    letterSpacing: '0.12em',
    textTransform: 'uppercase',
  },
  heroTitle: {
    margin: 0,
    color: 'var(--text)',
    fontSize: 34,
    lineHeight: 1.05,
    letterSpacing: 0,
  },
  heroBody: {
    maxWidth: 760,
    margin: 0,
    color: 'var(--text-secondary)',
    fontSize: 15,
    lineHeight: 1.6,
  },
  rangeRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 8,
  },
  rangeLink: {
    borderRadius: 999,
    border: '1px solid rgba(255,255,255,0.08)',
    background: 'rgba(255,255,255,0.05)',
    color: 'var(--text-secondary)',
    padding: '10px 14px',
    textDecoration: 'none',
    fontSize: 13,
    fontWeight: 800,
  },
  rangeLinkActive: {
    borderColor: '#C4B5FD',
    background: '#A78BFA',
    color: '#0E0E13',
  },
  primaryLink: {
    width: 'fit-content',
    borderRadius: 999,
    background: '#A78BFA',
    color: '#0E0E13',
    padding: '11px 18px',
    textDecoration: 'none',
    fontSize: 14,
    fontWeight: 800,
  },
  secondaryLink: {
    width: 'fit-content',
    borderRadius: 999,
    border: '1px solid rgba(255,255,255,0.08)',
    background: 'rgba(255,255,255,0.05)',
    color: 'var(--text)',
    padding: '10px 16px',
    textDecoration: 'none',
    fontSize: 14,
    fontWeight: 700,
  },
  progressCard: {
    display: 'grid',
    gap: 12,
    padding: 22,
    borderRadius: 20,
    border: '1px solid rgba(167,139,250,0.28)',
    background: 'rgba(167,139,250,0.12)',
  },
  sectionHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  sectionTitle: {
    margin: 0,
    color: 'var(--text)',
    fontSize: 22,
    lineHeight: 1.2,
  },
  sectionMeta: {
    color: 'var(--text-secondary)',
    fontSize: 13,
    fontWeight: 800,
  },
  metricGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
    gap: 12,
  },
  metricCard: {
    display: 'grid',
    gap: 7,
    padding: 16,
    borderRadius: 16,
    border: '1px solid rgba(255,255,255,0.08)',
    background: 'rgba(255,255,255,0.04)',
  },
  metricLabel: {
    color: 'var(--text-secondary)',
    fontSize: 11,
    fontWeight: 800,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
  },
  metricValue: {
    color: 'var(--text)',
    fontSize: 27,
    lineHeight: 1.1,
  },
  metricDetail: {
    color: 'var(--text-secondary)',
    fontSize: 13,
    lineHeight: 1.4,
  },
  visualGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
    gap: 16,
  },
  card: {
    display: 'grid',
    gap: 12,
    padding: 20,
    borderRadius: 20,
    border: '1px solid rgba(255,255,255,0.08)',
    background: 'rgba(255,255,255,0.04)',
  },
  cardHeader: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  cardEyebrow: {
    margin: 0,
    color: '#C4B5FD',
    fontSize: 11,
    fontWeight: 800,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
  },
  cardTitle: {
    margin: 0,
    color: 'var(--text)',
    fontSize: 21,
    lineHeight: 1.25,
    letterSpacing: 0,
  },
  cardBody: {
    margin: 0,
    color: 'var(--text-secondary)',
    fontSize: 14,
    lineHeight: 1.6,
  },
  cardMeta: {
    margin: 0,
    color: 'var(--text-secondary)',
    fontSize: 12,
    lineHeight: 1.5,
    fontWeight: 700,
  },
  pill: {
    borderRadius: 999,
    border: '1px solid rgba(167,139,250,0.28)',
    background: 'rgba(167,139,250,0.14)',
    color: '#E9DDFF',
    padding: '8px 11px',
    fontSize: 12,
    fontWeight: 800,
    whiteSpace: 'nowrap',
  },
  ringWrap: {
    position: 'relative',
    display: 'grid',
    justifySelf: 'center',
    placeItems: 'center',
    width: 132,
    height: 132,
  },
  ringCenter: {
    position: 'absolute',
    display: 'grid',
    justifyItems: 'center',
  },
  ringValue: {
    color: 'var(--text)',
    fontSize: 30,
    lineHeight: 1,
  },
  ringLabel: {
    color: 'var(--text-secondary)',
    fontSize: 12,
    fontWeight: 700,
  },
  debtValue: {
    color: 'var(--text)',
    fontSize: 38,
    lineHeight: 1,
  },
  debtTrack: {
    display: 'block',
    height: 14,
    overflow: 'hidden',
    borderRadius: 999,
    background: 'rgba(255,255,255,0.08)',
  },
  debtFill: {
    display: 'block',
    height: '100%',
    borderRadius: 999,
    background: '#A78BFA',
  },
  factorGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
    gap: 10,
  },
  factorCard: {
    display: 'grid',
    gap: 7,
    padding: 14,
    borderRadius: 16,
    border: '1px solid rgba(255,255,255,0.08)',
    background: 'rgba(255,255,255,0.04)',
  },
  factorLabel: {
    color: 'var(--text)',
    fontSize: 15,
  },
  factorStatus: {
    color: '#C4B5FD',
    fontSize: 13,
    fontWeight: 800,
  },
  factorBody: {
    margin: 0,
    color: 'var(--text-secondary)',
    fontSize: 13,
    lineHeight: 1.5,
  },
  conditionList: {
    display: 'grid',
    gap: 8,
  },
  conditionItem: {
    margin: 0,
    color: 'var(--text-secondary)',
    fontSize: 14,
    lineHeight: 1.5,
  },
  comparisonGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
    gap: 12,
  },
};
