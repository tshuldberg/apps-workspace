import { useCallback, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text as RNText, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import Svg, {
  Circle,
  Defs,
  Line,
  LinearGradient as SvgLinearGradient,
  Path,
  Stop,
  Text as SvgText,
} from 'react-native-svg';
import type { DatabaseAdapter } from '@mylife/db';
import {
  GlassPanel,
  MaterialSymbol,
  ProgressRing,
  SectionLabel,
  StatCard,
  WK_ACCENT,
  WK_ACCENT_LIGHT,
  WK_CATEGORY_COLORS,
  WK_FONTS,
  WK_SURFACES,
  buildHistory,
  calculatePersonalRecords,
  calculateStreaks,
  calculateVolume,
  calculateWeightPRs,
  getBodyMeasurements,
  getProgressPhotos,
  getSetWeightsForSession,
  getWeeklySummaries,
  getWorkoutExercises,
  getWorkoutSessions,
  getWorkouts,
  seedWorkoutExerciseLibrary,
  type BodyMeasurementRow,
  type ProgressExercise,
  type ProgressSession,
  type SetWeightRow,
  type WorkoutExerciseLibraryItem,
  type WorkoutSession,
} from '@mylife/workouts';
import { EmptyState, ErrorState } from '@mylife/ui';
import { useDatabase } from '../../../components/DatabaseProvider';
import {
  WorkoutHero,
  WorkoutSectionHeader,
  WorkoutTabScrollView,
  WorkoutTile,
  formatCompactNumber,
  formatDateLabel,
  formatVolume,
} from './_screen-kit';

type ProgressPeriodKey = '7D' | '30D' | '12W' | '1Y';

interface PeriodConfig {
  key: ProgressPeriodKey;
  label: string;
  days: number;
  bucketCount: number;
  bucketSpanDays: number;
}

interface DeltaStat {
  current: number;
  previous: number;
}

interface ChartPoint {
  label: string;
  value: number;
}

interface RecentPRCard {
  id: string;
  exerciseName: string;
  detail: string;
  achievedAt: string;
}

interface ProgressViewModel {
  selectedPeriod: PeriodConfig;
  volumeStat: DeltaStat;
  sessionsStat: DeltaStat;
  prStat: DeltaStat;
  activeDaysStat: DeltaStat;
  streakDays: number;
  volumeSeries: ChartPoint[];
  measurementSeries: ChartPoint[];
  measurementLabel: string;
  recentPRs: RecentPRCard[];
  measurementCount: number;
  photoCount: number;
  insightPreview: string;
  showEmptyState: boolean;
}

const PERIODS: readonly PeriodConfig[] = [
  { key: '7D', label: '7D', days: 7, bucketCount: 7, bucketSpanDays: 1 },
  { key: '30D', label: '30D', days: 30, bucketCount: 10, bucketSpanDays: 3 },
  { key: '12W', label: '12W', days: 84, bucketCount: 12, bucketSpanDays: 7 },
  { key: '1Y', label: '1Y', days: 365, bucketCount: 12, bucketSpanDays: 30 },
] as const;

function toProgressSession(session: WorkoutSession): ProgressSession {
  return {
    id: session.id,
    workout_id: session.workoutId,
    started_at: session.startedAt,
    completed_at: session.completedAt,
    exercises_completed: session.exercisesCompleted.map((exercise) => ({
      exercise_id: exercise.exerciseId,
      sets_completed: exercise.setsCompleted,
      reps_completed: exercise.repsCompleted ?? 0,
      duration_actual: exercise.durationActual ?? null,
      skipped: exercise.skipped,
    })),
  };
}

function toProgressExercise(
  exercise: WorkoutExerciseLibraryItem,
): ProgressExercise {
  return {
    id: exercise.id,
    name: exercise.name,
    muscle_groups: exercise.muscleGroups,
  };
}

function buildSessionVolumeMap(
  db: DatabaseAdapter,
  sessions: WorkoutSession[],
): Map<string, number> {
  const volumeMap = new Map<string, number>();

  for (const session of sessions) {
    const weightedSets = getSetWeightsForSession(db, session.id);
    if (weightedSets.length > 0) {
      volumeMap.set(
        session.id,
        Math.round(
          weightedSets.reduce((sum, set) => sum + set.weight * set.reps, 0),
        ),
      );
      continue;
    }

    const fallbackVolume = session.exercisesCompleted.reduce((sum, exercise) => {
      if (exercise.skipped) return sum;
      return sum + (exercise.repsCompleted ?? 0) * 10;
    }, 0);

    volumeMap.set(session.id, fallbackVolume);
  }

  return volumeMap;
}

function getRangeStart(days: number): number {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date.getTime() - days * 24 * 60 * 60 * 1000;
}

function sessionCompletedAtMs(session: WorkoutSession): number | null {
  if (!session.completedAt) return null;
  const completedMs = new Date(session.completedAt).getTime();
  return Number.isNaN(completedMs) ? null : completedMs;
}

function filterSessionsForWindow(
  sessions: WorkoutSession[],
  startMs: number,
  endMs: number,
): WorkoutSession[] {
  return sessions.filter((session) => {
    const completedMs = sessionCompletedAtMs(session);
    return completedMs != null && completedMs >= startMs && completedMs < endMs;
  });
}

function getActiveDayCount(sessions: WorkoutSession[]): number {
  return new Set(
    sessions
      .filter((session) => session.completedAt)
      .map((session) => (session.completedAt as string).slice(0, 10)),
  ).size;
}

function formatBucketLabel(date: Date, period: PeriodConfig): string {
  if (period.key === '1Y') {
    return date.toLocaleDateString('en-US', { month: 'short' });
  }

  if (period.key === '12W') {
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  }

  return `${date.getMonth() + 1}/${date.getDate()}`;
}

function buildVolumeSeries(
  period: PeriodConfig,
  sessions: WorkoutSession[],
  volumeMap: Map<string, number>,
): ChartPoint[] {
  const dayMs = 24 * 60 * 60 * 1000;
  const bucketMs = period.bucketSpanDays * dayMs;
  const chartStartMs = getRangeStart(period.days);

  const buckets = Array.from({ length: period.bucketCount }, (_, index) => ({
    startMs: chartStartMs + index * bucketMs,
    value: 0,
  }));

  for (const session of sessions) {
    const completedMs = sessionCompletedAtMs(session);
    if (completedMs == null || completedMs < chartStartMs) continue;

    const bucketIndex = Math.floor((completedMs - chartStartMs) / bucketMs);
    if (bucketIndex < 0 || bucketIndex >= buckets.length) continue;
    buckets[bucketIndex].value += volumeMap.get(session.id) ?? 0;
  }

  return buckets.map((bucket) => ({
    label: formatBucketLabel(new Date(bucket.startMs), period),
    value: Math.round(bucket.value),
  }));
}

function buildMeasurementSeries(
  measurements: BodyMeasurementRow[],
  period: PeriodConfig,
): {
  points: ChartPoint[];
  label: string;
} {
  const periodStartMs = getRangeStart(period.days);
  const filtered = measurements
    .filter((measurement) => {
      const measuredMs = new Date(measurement.measuredAt).getTime();
      return !Number.isNaN(measuredMs) && measuredMs >= periodStartMs;
    })
    .slice(0, 10)
    .reverse();

  const points = (filtered.length > 1 ? filtered : measurements.slice(0, 8).reverse()).map(
    (measurement) => ({
      label: formatDateLabel(measurement.measuredAt),
      value: measurement.value,
    }),
  );

  if (points.length === 0) {
    return {
      points: [],
      label: 'No body-weight entries yet',
    };
  }

  const latest = points[points.length - 1]?.value ?? 0;
  const earliest = points[0]?.value ?? latest;
  const delta = latest - earliest;

  return {
    points,
    label:
      delta === 0
        ? `${latest.toFixed(1)} current`
        : `${delta > 0 ? '+' : ''}${delta.toFixed(1)} vs first check-in`,
  };
}

function buildRecentPRs(
  setWeights: SetWeightRow[],
  exerciseMap: Record<string, ProgressExercise>,
  fallbackRecords: ReturnType<typeof calculatePersonalRecords>,
): RecentPRCard[] {
  if (setWeights.length === 0) {
    return fallbackRecords.slice(0, 5).map((record) => ({
      id: record.exerciseId,
      exerciseName: record.exerciseName,
      detail: `${record.maxSets} sets · ${record.maxReps} reps`,
      achievedAt: record.achievedAt,
    }));
  }

  const bestByExercise = new Map<string, { maxWeight: number; max1RM: number }>();
  const events: RecentPRCard[] = [];

  const ordered = [...setWeights].sort((left, right) => {
    return left.createdAt.localeCompare(right.createdAt);
  });

  for (const set of ordered) {
    const existing = bestByExercise.get(set.exerciseId);
    const improved =
      !existing ||
      set.weight > existing.maxWeight ||
      set.estimated1rm > existing.max1RM;

    if (!improved) continue;

    bestByExercise.set(set.exerciseId, {
      maxWeight: Math.max(existing?.maxWeight ?? 0, set.weight),
      max1RM: Math.max(existing?.max1RM ?? 0, set.estimated1rm),
    });

    events.push({
      id: `${set.exerciseId}-${set.createdAt}`,
      exerciseName: exerciseMap[set.exerciseId]?.name ?? 'Exercise PR',
      detail: `${formatCompactNumber(set.weight)} lbs x ${set.reps}`,
      achievedAt: set.createdAt,
    });
  }

  return events.sort((left, right) => right.achievedAt.localeCompare(left.achievedAt)).slice(0, 5);
}

function countPRsInWindow(
  setWeights: SetWeightRow[],
  startMs: number,
  endMs: number,
): number {
  if (setWeights.length === 0) return 0;

  const bestByExercise = new Map<string, { maxWeight: number; max1RM: number }>();
  let count = 0;

  const ordered = [...setWeights].sort((left, right) => {
    return left.createdAt.localeCompare(right.createdAt);
  });

  for (const set of ordered) {
    const existing = bestByExercise.get(set.exerciseId);
    const improved =
      !existing ||
      set.weight > existing.maxWeight ||
      set.estimated1rm > existing.max1RM;

    if (!improved) continue;

    bestByExercise.set(set.exerciseId, {
      maxWeight: Math.max(existing?.maxWeight ?? 0, set.weight),
      max1RM: Math.max(existing?.max1RM ?? 0, set.estimated1rm),
    });

    const achievedMs = new Date(set.createdAt).getTime();
    if (!Number.isNaN(achievedMs) && achievedMs >= startMs && achievedMs < endMs) {
      count += 1;
    }
  }

  return count;
}

function countFallbackPRsInWindow(
  records: ReturnType<typeof calculatePersonalRecords>,
  startMs: number,
  endMs: number,
): number {
  return records.filter((record) => {
    const achievedMs = new Date(record.achievedAt).getTime();
    return !Number.isNaN(achievedMs) && achievedMs >= startMs && achievedMs < endMs;
  }).length;
}

function buildDeltaText(
  current: number,
  previous: number,
  formatter: (value: number) => string = formatCompactNumber,
): string {
  if (previous === 0 && current === 0) return 'Flat vs prior period';
  if (previous === 0) return `${formatter(current)} gained`;

  const delta = current - previous;
  const direction = delta === 0 ? 'Flat' : `${delta > 0 ? '+' : ''}${formatter(delta)}`;
  return `${direction} vs prior`;
}

function deltaTint(current: number, previous: number): string {
  if (current === previous) return 'rgba(214, 195, 181, 0.72)';
  return current > previous ? WK_CATEGORY_COLORS.recovery : '#FFB4AB';
}

function buildProgressView(
  db: DatabaseAdapter,
  selectedPeriodKey: ProgressPeriodKey,
): ProgressViewModel {
  seedWorkoutExerciseLibrary(db);

  const period = PERIODS.find((item) => item.key === selectedPeriodKey) ?? PERIODS[1];
  const sessions = getWorkoutSessions(db, { onlyCompleted: true, limit: 240 });
  const workouts = getWorkouts(db);
  const exercises = getWorkoutExercises(db, { limit: 500 });
  const measurements = getBodyMeasurements(db, { type: 'weight', limit: 48 });
  const progressPhotos = getProgressPhotos(db);

  const progressSessions = sessions.map(toProgressSession);
  const exerciseMap = Object.fromEntries(
    exercises.map((exercise) => [exercise.id, toProgressExercise(exercise)]),
  ) satisfies Record<string, ProgressExercise>;
  const workoutTitleMap = Object.fromEntries(
    workouts.map((workout) => [workout.id, workout.title]),
  );

  const volumeMap = buildSessionVolumeMap(db, sessions);
  const history = buildHistory(progressSessions, workoutTitleMap);
  const allSetWeights = sessions.flatMap((session) => getSetWeightsForSession(db, session.id));
  const currentWeightPRs = calculateWeightPRs(allSetWeights);
  const personalRecords = calculatePersonalRecords(progressSessions, exerciseMap);
  const streaks = calculateStreaks(progressSessions);
  const periodStartMs = getRangeStart(period.days);
  const previousPeriodStartMs = getRangeStart(period.days * 2);
  const nowMs = Date.now();

  const currentSessions = filterSessionsForWindow(sessions, periodStartMs, nowMs);
  const previousSessions = filterSessionsForWindow(sessions, previousPeriodStartMs, periodStartMs);

  const currentVolume = currentSessions.reduce((sum, session) => {
    return sum + (volumeMap.get(session.id) ?? 0);
  }, 0);
  const previousVolume = previousSessions.reduce((sum, session) => {
    return sum + (volumeMap.get(session.id) ?? 0);
  }, 0);

  const currentWeeklySummaries = getWeeklySummaries(
    currentSessions.map(toProgressSession),
    Math.min(period.bucketCount, 12),
  );
  const insightPreview =
    currentWeeklySummaries.find((summary) => summary.sessions > 0)?.label ??
    'Waiting for a new training block';

  const recentPRs = buildRecentPRs(allSetWeights, exerciseMap, personalRecords);
  const measurement = buildMeasurementSeries(measurements, period);
  const currentPRCount = allSetWeights.length > 0
    ? countPRsInWindow(allSetWeights, periodStartMs, nowMs)
    : countFallbackPRsInWindow(personalRecords, periodStartMs, nowMs);
  const previousPRCount = allSetWeights.length > 0
    ? countPRsInWindow(allSetWeights, previousPeriodStartMs, periodStartMs)
    : countFallbackPRsInWindow(personalRecords, previousPeriodStartMs, periodStartMs);
  const volumeStats = calculateVolume(currentSessions.map(toProgressSession), exerciseMap);

  return {
    selectedPeriod: period,
    volumeStat: {
      current: currentVolume,
      previous: previousVolume,
    },
    sessionsStat: {
      current: currentSessions.length,
      previous: previousSessions.length,
    },
    prStat: {
      current: currentPRCount,
      previous: previousPRCount,
    },
    activeDaysStat: {
      current: getActiveDayCount(currentSessions),
      previous: getActiveDayCount(previousSessions),
    },
    streakDays: streaks.current,
    volumeSeries: buildVolumeSeries(period, currentSessions, volumeMap),
    measurementSeries: measurement.points,
    measurementLabel: measurement.label,
    recentPRs,
    measurementCount: measurements.length,
    photoCount: progressPhotos.length,
    insightPreview: currentWeightPRs.size > 0
      ? `${currentWeightPRs.size} lifetime PRs`
      : volumeStats.totalExercises > 0
        ? `${volumeStats.totalExercises} logged exercises`
        : insightPreview,
    showEmptyState: history.length === 0,
  };
}

function LineChart({
  data,
  height = 210,
  stroke = WK_ACCENT,
  fill = 'rgba(201, 137, 77, 0.18)',
  compact = false,
}: {
  data: ChartPoint[];
  height?: number;
  stroke?: string;
  fill?: string;
  compact?: boolean;
}) {
  if (data.length === 0) {
    return (
      <View style={[styles.chartEmpty, { height }]}>
        <RNText style={styles.chartEmptyText}>No chart data yet</RNText>
      </View>
    );
  }

  if (data.length === 1) {
    const point = data[0];
    return (
      <View style={[styles.chartEmpty, { height }]}>
        <RNText style={styles.chartEmptyText}>{`${point.label} · ${formatCompactNumber(point.value)}`}</RNText>
      </View>
    );
  }

  const width = compact ? 280 : 340;
  const paddingLeft = compact ? 6 : 34;
  const paddingRight = 12;
  const paddingTop = 16;
  const paddingBottom = compact ? 20 : 28;
  const chartWidth = width - paddingLeft - paddingRight;
  const chartHeight = height - paddingTop - paddingBottom;
  const maxValue = Math.max(...data.map((point) => point.value), 1);
  const stepX = chartWidth / Math.max(data.length - 1, 1);

  const points = data.map((point, index) => {
    const x = paddingLeft + index * stepX;
    const y = paddingTop + chartHeight - (Math.max(point.value, 0) / maxValue) * chartHeight;
    return { ...point, x, y };
  });

  const linePath = points.reduce((path, point, index) => {
    return `${path}${index === 0 ? 'M' : ' L'}${point.x} ${point.y}`;
  }, '');

  const areaPath = `${linePath} L ${points[points.length - 1]?.x ?? width} ${paddingTop + chartHeight} L ${points[0]?.x ?? 0} ${paddingTop + chartHeight} Z`;
  const yTicks = compact ? [0, 0.5, 1] : [0, 0.33, 0.66, 1];
  const labelStep = compact ? Math.max(1, Math.ceil(data.length / 4)) : Math.max(1, Math.ceil(data.length / 5));

  return (
    <View style={{ width: '100%' }}>
      <Svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`}>
        <Defs>
          <SvgLinearGradient id="progressChartFill" x1="0" x2="0" y1="0" y2="1">
            <Stop offset="0%" stopColor={fill} stopOpacity={1} />
            <Stop offset="100%" stopColor={fill} stopOpacity={0.06} />
          </SvgLinearGradient>
        </Defs>

        {yTicks.map((tick) => {
          const y = paddingTop + tick * chartHeight;
          const value = Math.round(maxValue - tick * maxValue);

          return (
            <>
              <Line
                key={`line-${tick}`}
                x1={paddingLeft}
                x2={width - paddingRight}
                y1={y}
                y2={y}
                stroke="rgba(214, 195, 181, 0.09)"
                strokeWidth={1}
              />
              {!compact ? (
                <SvgText
                  key={`label-${tick}`}
                  x={paddingLeft - 8}
                  y={y + 4}
                  fontFamily={WK_FONTS.medium}
                  fontSize={10}
                  textAnchor="end"
                  fill="rgba(214, 195, 181, 0.54)"
                >
                  {formatCompactNumber(value)}
                </SvgText>
              ) : null}
            </>
          );
        })}

        <Path d={areaPath} fill="url(#progressChartFill)" />
        <Path
          d={linePath}
          fill="none"
          stroke={stroke}
          strokeWidth={compact ? 2.5 : 3}
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {points.map((point) => (
          <Circle
            key={`${point.label}-${point.x}`}
            cx={point.x}
            cy={point.y}
            r={compact ? 3 : 4}
            fill={stroke}
          />
        ))}

        {points.map((point, index) => {
          if (index % labelStep !== 0 && index !== points.length - 1) return null;

          return (
            <SvgText
              key={`${point.label}-label`}
              x={point.x}
              y={height - 6}
              fontFamily={WK_FONTS.medium}
              fontSize={10}
              textAnchor="middle"
              fill="rgba(214, 195, 181, 0.54)"
            >
              {point.label}
            </SvgText>
          );
        })}
      </Svg>
    </View>
  );
}

export default function WorkoutProgressScreen() {
  const db = useDatabase();
  const router = useRouter();
  const [selectedPeriod, setSelectedPeriod] = useState<ProgressPeriodKey>('30D');
  const [refreshKey, setRefreshKey] = useState(0);

  useFocusEffect(
    useCallback(() => {
      setRefreshKey((value) => value + 1);
    }, []),
  );

  const state = useMemo(() => {
    try {
      return {
        data: buildProgressView(db, selectedPeriod),
        error: null,
      };
    } catch (error) {
      return {
        data: null,
        error: error instanceof Error ? error.message : 'Failed to load progress analytics.',
      };
    }
  }, [db, refreshKey, selectedPeriod]);

  const handleRefresh = useCallback(() => {
    setRefreshKey((value) => value + 1);
  }, []);

  return (
    <WorkoutTabScrollView onRefresh={handleRefresh}>
      <View style={styles.body}>
        <WorkoutHero
          eyebrow="Analytics"
          title="Progress Journal"
          subtitle="Track volume shifts, PR momentum, and the body metrics shaping your next training block."
        />

        <View style={styles.periodRail}>
          {PERIODS.map((period) => (
            <Pressable
              key={period.key}
              onPress={() => setSelectedPeriod(period.key)}
              style={[
                styles.periodChip,
                selectedPeriod === period.key && styles.periodChipActive,
              ]}
            >
              <RNText
                style={[
                  styles.periodChipText,
                  selectedPeriod === period.key && styles.periodChipTextActive,
                ]}
              >
                {period.label}
              </RNText>
            </Pressable>
          ))}
        </View>

        {state.error ? (
          <GlassPanel padding={24} style={styles.errorCard}>
            <ErrorState message={state.error} onRetry={handleRefresh} />
          </GlassPanel>
        ) : state.data?.showEmptyState ? (
          <GlassPanel padding={24} style={styles.emptyCard}>
            <EmptyState
              icon="📈"
              title="Start tracking progress"
              message="Finish your first workout and this journal will light up with live volume trends, PRs, and body metrics."
              actionLabel="Open Builder"
              onAction={() => router.push('/(workouts)/builder' as never)}
              accentColor={WK_ACCENT}
            />
          </GlassPanel>
        ) : state.data ? (
          <>
            <View style={styles.statGrid}>
              <View style={styles.statCell}>
                <StatCard
                  label="Total Volume"
                  value={formatVolume(state.data.volumeStat.current)}
                  suffix="lbs"
                  height={148}
                  footer={(
                    <RNText
                      style={[
                        styles.statFooterText,
                        { color: deltaTint(state.data.volumeStat.current, state.data.volumeStat.previous) },
                      ]}
                    >
                      {buildDeltaText(state.data.volumeStat.current, state.data.volumeStat.previous, formatVolume)}
                    </RNText>
                  )}
                />
              </View>
              <View style={styles.statCell}>
                <StatCard
                  label="Sessions"
                  value={state.data.sessionsStat.current}
                  height={148}
                  footer={(
                    <RNText
                      style={[
                        styles.statFooterText,
                        { color: deltaTint(state.data.sessionsStat.current, state.data.sessionsStat.previous) },
                      ]}
                    >
                      {buildDeltaText(state.data.sessionsStat.current, state.data.sessionsStat.previous)}
                    </RNText>
                  )}
                />
              </View>
              <View style={styles.statCell}>
                <StatCard
                  label="PRs Hit"
                  value={state.data.prStat.current}
                  height={148}
                  footer={(
                    <RNText
                      style={[
                        styles.statFooterText,
                        { color: deltaTint(state.data.prStat.current, state.data.prStat.previous) },
                      ]}
                    >
                      {buildDeltaText(state.data.prStat.current, state.data.prStat.previous)}
                    </RNText>
                  )}
                />
              </View>
              <View style={styles.statCell}>
                <StatCard
                  label="Active Days"
                  value={state.data.activeDaysStat.current}
                  height={148}
                  footer={(
                    <View style={styles.activeDaysFooter}>
                      <RNText
                        style={[
                          styles.statFooterText,
                          { color: deltaTint(state.data.activeDaysStat.current, state.data.activeDaysStat.previous) },
                        ]}
                      >
                        {buildDeltaText(state.data.activeDaysStat.current, state.data.activeDaysStat.previous)}
                      </RNText>
                      <ProgressRing
                        progress={Math.min(state.data.streakDays / 14, 1)}
                        size={42}
                        strokeWidth={4}
                        color={WK_CATEGORY_COLORS.recovery}
                        backgroundColor={WK_SURFACES.high}
                        centerValue={String(state.data.streakDays)}
                        centerLabel="streak"
                      />
                    </View>
                  )}
                />
              </View>
            </View>

            <GlassPanel padding={22} style={styles.chartCard}>
              <View style={styles.chartHeader}>
                <View style={styles.chartHeaderCopy}>
                  <SectionLabel accent={WK_ACCENT_LIGHT}>Volume Over Time</SectionLabel>
                  <RNText style={styles.chartTitle}>Training Load Trend</RNText>
                  <RNText style={styles.chartSubtitle}>
                    {`${state.data.selectedPeriod.label} rolling window`}
                  </RNText>
                </View>
                <View style={styles.chartLegend}>
                  <View style={styles.chartLegendDot} />
                  <RNText style={styles.chartLegendText}>Hypertrophy load</RNText>
                </View>
              </View>
              <LineChart data={state.data.volumeSeries} stroke={WK_ACCENT} />
            </GlassPanel>

            <GlassPanel padding={22} style={styles.prCard}>
              <WorkoutSectionHeader
                title="Recent Personal Records"
                actionLabel="View All PRs"
                onAction={() => router.push('/(workouts)/insights' as never)}
              />
              <View style={styles.prList}>
                {state.data.recentPRs.map((record) => (
                  <View key={record.id} style={styles.prRow}>
                    <View style={styles.prIconWrap}>
                      <MaterialSymbol
                        name="local_fire_department"
                        size={18}
                        color={WK_ACCENT_LIGHT}
                      />
                    </View>
                    <View style={styles.prCopy}>
                      <RNText style={styles.prTitle}>{record.exerciseName}</RNText>
                      <RNText style={styles.prDetail}>{record.detail}</RNText>
                    </View>
                    <RNText style={styles.prDate}>{formatDateLabel(record.achievedAt)}</RNText>
                  </View>
                ))}
              </View>
            </GlassPanel>

            <GlassPanel
              padding={22}
              style={styles.measurementCard}
              onPress={() => router.push('/(workouts)/measurements' as never)}
            >
              <View style={styles.measurementHeader}>
                <View style={styles.measurementCopy}>
                  <SectionLabel accent={WK_CATEGORY_COLORS.recovery}>Body Metrics</SectionLabel>
                  <RNText style={styles.measurementTitle}>Body Weight Trend</RNText>
                  <RNText style={styles.measurementSubtitle}>{state.data.measurementLabel}</RNText>
                </View>
                <MaterialSymbol name="chevron_right" size={18} color="rgba(214, 195, 181, 0.54)" />
              </View>
              <LineChart
                data={state.data.measurementSeries}
                height={128}
                stroke={WK_CATEGORY_COLORS.recovery}
                fill="rgba(48, 209, 88, 0.14)"
                compact
              />
            </GlassPanel>

            <View style={styles.tileGrid}>
              <View style={styles.tileCell}>
                <WorkoutTile
                  icon="straighten"
                  title="Body Measurements"
                  subtitle="Track weight, body fat, and circumference check-ins."
                  value={`${state.data.measurementCount} logs`}
                  onPress={() => router.push('/(workouts)/measurements' as never)}
                  accent={WK_CATEGORY_COLORS.recovery}
                />
              </View>
              <View style={styles.tileCell}>
                <WorkoutTile
                  icon="photo_camera"
                  title="Progress Photos"
                  subtitle="Compare visual changes across your current block."
                  value={`${state.data.photoCount} saved`}
                  onPress={() => router.push('/(workouts)/photos' as never)}
                  accent={WK_CATEGORY_COLORS.hypertrophy}
                />
              </View>
              <View style={styles.tileCell}>
                <WorkoutTile
                  icon="favorite"
                  title="Recovery Heatmap"
                  subtitle="See which muscle groups are ready to train again."
                  value={`${state.data.streakDays}d streak`}
                  onPress={() => router.push('/(workouts)/recovery' as never)}
                  accent={WK_CATEGORY_COLORS.recovery}
                />
              </View>
              <View style={styles.tileCell}>
                <WorkoutTile
                  icon="insights"
                  title="Workout Insights"
                  subtitle="Review correlations, highlights, and weekly notes."
                  value={state.data.insightPreview}
                  onPress={() => router.push('/(workouts)/insights' as never)}
                  accent={WK_ACCENT_LIGHT}
                />
              </View>
            </View>
          </>
        ) : null}
      </View>
    </WorkoutTabScrollView>
  );
}

const styles = StyleSheet.create({
  body: {
    paddingHorizontal: 20,
    paddingTop: 22,
    paddingBottom: 152,
    gap: 18,
  },
  periodRail: {
    flexDirection: 'row',
    gap: 10,
  },
  periodChip: {
    flex: 1,
    minHeight: 40,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: WK_SURFACES.high,
  },
  periodChipActive: {
    backgroundColor: WK_ACCENT,
  },
  periodChipText: {
    fontFamily: WK_FONTS.medium,
    fontSize: 12,
    lineHeight: 14,
    color: 'rgba(228, 225, 233, 0.74)',
  },
  periodChipTextActive: {
    color: WK_SURFACES.lowest,
  },
  errorCard: {
    backgroundColor: WK_SURFACES.low,
  },
  emptyCard: {
    backgroundColor: WK_SURFACES.low,
  },
  statGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  statCell: {
    width: '48%',
  },
  statFooterText: {
    fontFamily: WK_FONTS.medium,
    fontSize: 12,
    lineHeight: 16,
  },
  activeDaysFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  chartCard: {
    backgroundColor: WK_SURFACES.low,
    gap: 16,
  },
  chartHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 16,
    alignItems: 'flex-start',
  },
  chartHeaderCopy: {
    flex: 1,
    gap: 6,
  },
  chartTitle: {
    fontFamily: WK_FONTS.bold,
    fontSize: 20,
    lineHeight: 24,
    color: '#F3EFFA',
  },
  chartSubtitle: {
    fontFamily: WK_FONTS.medium,
    fontSize: 12,
    lineHeight: 16,
    color: 'rgba(214, 195, 181, 0.62)',
  },
  chartLegend: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingTop: 4,
  },
  chartLegendDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
    backgroundColor: WK_ACCENT,
  },
  chartLegendText: {
    fontFamily: WK_FONTS.medium,
    fontSize: 11,
    lineHeight: 14,
    color: 'rgba(214, 195, 181, 0.62)',
  },
  chartEmpty: {
    width: '100%',
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: WK_SURFACES.high,
  },
  chartEmptyText: {
    fontFamily: WK_FONTS.medium,
    fontSize: 12,
    lineHeight: 16,
    color: 'rgba(214, 195, 181, 0.58)',
  },
  prCard: {
    backgroundColor: WK_SURFACES.low,
    gap: 16,
  },
  prList: {
    gap: 12,
  },
  prRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: WK_SURFACES.high,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  prIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(201, 137, 77, 0.18)',
  },
  prCopy: {
    flex: 1,
    gap: 2,
  },
  prTitle: {
    fontFamily: WK_FONTS.semiBold,
    fontSize: 14,
    lineHeight: 18,
    color: '#F1ECF8',
  },
  prDetail: {
    fontFamily: WK_FONTS.medium,
    fontSize: 12,
    lineHeight: 16,
    color: 'rgba(214, 195, 181, 0.74)',
  },
  prDate: {
    fontFamily: WK_FONTS.medium,
    fontSize: 11,
    lineHeight: 14,
    color: WK_ACCENT_LIGHT,
  },
  measurementCard: {
    backgroundColor: WK_SURFACES.low,
    gap: 14,
  },
  measurementHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  measurementCopy: {
    flex: 1,
    gap: 6,
  },
  measurementTitle: {
    fontFamily: WK_FONTS.bold,
    fontSize: 18,
    lineHeight: 22,
    color: '#F1ECF8',
  },
  measurementSubtitle: {
    fontFamily: WK_FONTS.medium,
    fontSize: 12,
    lineHeight: 16,
    color: 'rgba(214, 195, 181, 0.64)',
  },
  tileGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  tileCell: {
    width: '48%',
  },
});
