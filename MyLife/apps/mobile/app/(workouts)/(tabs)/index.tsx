import { useCallback, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text as RNText, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import type { DatabaseAdapter } from '@mylife/db';
import {
  AsymmetricGrid,
  BarChart,
  GlassPanel,
  MUSCLE_GROUP_LABELS,
  MaterialSymbol,
  SectionLabel,
  StartWorkoutFAB,
  StatCard,
  WK_ACCENT,
  WK_ACCENT_LIGHT,
  WK_CATEGORY_COLORS,
  WK_FONTS,
  WK_SURFACES,
  buildRecoveryMap,
  getActivePlanSubscription,
  getBestToTrain,
  getCurrentPlanPosition,
  getSetWeightsForSession,
  getTodaysWorkout,
  getWorkoutDashboard,
  getWorkoutExercises,
  getWorkoutPlans,
  getWorkoutSessions,
  getWorkouts,
  seedWorkoutExerciseLibrary,
  type MuscleGroup,
  type WorkoutDefinition,
  type WorkoutExerciseLibraryItem,
  type WorkoutSession,
} from '@mylife/workouts';
import { EmptyState, ErrorState } from '@mylife/ui';
import { useDatabase } from '../../../components/DatabaseProvider';
import {
  WorkoutHero,
  WorkoutSectionHeader,
  WorkoutTabScrollView,
  formatDateLabel,
  formatDeltaPercent,
  formatMinutes,
  formatVolume,
  getDeltaTint,
} from './_screen-kit';

interface RecentSessionCard {
  id: string;
  title: string;
  dateLabel: string;
  durationLabel: string;
  volumeLabel: string;
}

interface RecoveryChip {
  muscleGroup: MuscleGroup;
  label: string;
  score: number;
}

interface HomeViewModel {
  dashboard: ReturnType<typeof getWorkoutDashboard>;
  sessionsThisWeek: number;
  sessionTarget: number;
  weekVolume: number;
  volumeDelta: number | null;
  weeklyChart: Array<{ label: string; value: number }>;
  recentSessions: RecentSessionCard[];
  upcomingTitle: string;
  upcomingSubtitle: string;
  upcomingRoute: string | null;
  recoveryLabel: string;
  recoveryFresh: RecoveryChip[];
  showEmptyState: boolean;
}

function buildSessionVolumeMap(
  db: DatabaseAdapter,
  sessions: WorkoutSession[],
): Map<string, number> {
  const volumeMap = new Map<string, number>();

  for (const session of sessions) {
    const weightedSets = getSetWeightsForSession(db, session.id);
    if (weightedSets.length > 0) {
      const weightedVolume = weightedSets.reduce((sum, set) => {
        return sum + set.weight * set.reps;
      }, 0);
      volumeMap.set(session.id, Math.round(weightedVolume));
      continue;
    }

    const fallbackVolume = session.exercisesCompleted.reduce((sum, exercise) => {
      return sum + ((exercise.repsCompleted ?? 0) * 10);
    }, 0);
    volumeMap.set(session.id, fallbackVolume);
  }

  return volumeMap;
}

function buildWeeklyBars(
  sessions: WorkoutSession[],
  volumeMap: Map<string, number>,
  weekCount: number,
): Array<{ label: string; value: number }> {
  const now = Date.now();
  const weekMs = 7 * 24 * 60 * 60 * 1000;
  const buckets = Array.from({ length: weekCount }, () => 0);

  for (const session of sessions) {
    if (!session.completedAt) continue;
    const completedMs = new Date(session.completedAt).getTime();
    const ageMs = now - completedMs;
    if (ageMs < 0 || ageMs >= weekCount * weekMs) continue;

    const bucket = Math.floor(ageMs / weekMs);
    buckets[bucket] += volumeMap.get(session.id) ?? 0;
  }

  return buckets
    .map((value, index) => ({
      label: `W${weekCount - index}`,
      value,
    }))
    .reverse();
}

function buildRecoveryFreshMuscles(
  sessions: WorkoutSession[],
  workouts: WorkoutDefinition[],
  exercises: WorkoutExerciseLibraryItem[],
): { label: string; muscles: RecoveryChip[] } {
  const workoutMap = Object.fromEntries(workouts.map((workout) => [workout.id, workout]));
  const exerciseMap = Object.fromEntries(exercises.map((exercise) => [exercise.id, exercise]));

  const recoverySessions = sessions
    .filter((session) => session.completedAt)
    .map((session) => {
      const workout = workoutMap[session.workoutId];
      if (!workout || !session.completedAt) return null;

      const volumeByMuscle = new Map<
        MuscleGroup,
        { totalSets: number; totalReps: number; isPrimary: boolean }
      >();

      for (const completed of session.exercisesCompleted) {
        if (completed.skipped) continue;
        const exercise = exerciseMap[completed.exerciseId];
        if (!exercise) continue;

        exercise.muscleGroups.forEach((muscleGroup, index) => {
          const current = volumeByMuscle.get(muscleGroup) ?? {
            totalSets: 0,
            totalReps: 0,
            isPrimary: false,
          };

          current.totalSets += Math.max(completed.setsCompleted, 1);
          current.totalReps += completed.repsCompleted ?? 0;
          current.isPrimary = current.isPrimary || index === 0;
          volumeByMuscle.set(muscleGroup, current);
        });
      }

      return {
        sessionId: session.id,
        completedAt: session.completedAt,
        muscleVolume: Array.from(volumeByMuscle.entries()).map(([muscleGroup, data]) => ({
          muscleGroup,
          totalSets: data.totalSets,
          totalReps: data.totalReps,
          isPrimary: data.isPrimary,
          avgIntensityPct: null,
        })),
      };
    })
    .filter((item): item is NonNullable<typeof item> => item != null);

  const recoveryMap = buildRecoveryMap(recoverySessions);
  const suggestion = getBestToTrain(recoveryMap);

  const muscles = Array.from(recoveryMap.values())
    .filter((item) => item.muscleGroup !== 'full_body')
    .sort((left, right) => right.score - left.score)
    .slice(0, 3)
    .map((item) => ({
      muscleGroup: item.muscleGroup,
      label: MUSCLE_GROUP_LABELS[item.muscleGroup],
      score: item.score,
    }));

  return {
    label: suggestion.label,
    muscles,
  };
}

function buildHomeView(db: DatabaseAdapter): HomeViewModel {
  seedWorkoutExerciseLibrary(db);

  const dashboard = getWorkoutDashboard(db);
  const workouts = getWorkouts(db);
  const exercises = getWorkoutExercises(db, { limit: 500 });
  const sessions = getWorkoutSessions(db, { onlyCompleted: true, limit: 160 });
  const plans = getWorkoutPlans(db);
  const activeSubscription = getActivePlanSubscription(db);

  const volumeMap = buildSessionVolumeMap(db, sessions);
  const weeklyChart = buildWeeklyBars(sessions, volumeMap, 8);
  const currentWeekVolume = weeklyChart[weeklyChart.length - 1]?.value ?? 0;
  const previousWeekVolume = weeklyChart[weeklyChart.length - 2]?.value ?? 0;
  const volumeDelta =
    previousWeekVolume > 0
      ? Math.round(((currentWeekVolume - previousWeekVolume) / previousWeekVolume) * 100)
      : currentWeekVolume > 0
        ? 100
        : 0;

  const now = Date.now();
  const sessionsThisWeek = sessions.filter((session) => {
    if (!session.completedAt) return false;
    const ageMs = now - new Date(session.completedAt).getTime();
    return ageMs >= 0 && ageMs < 7 * 24 * 60 * 60 * 1000;
  }).length;

  const activePlan = activeSubscription
    ? plans.find((plan) => plan.id === activeSubscription.planId) ?? null
    : null;

  const sessionTarget = activePlan && activeSubscription
    ? (() => {
        const position = getCurrentPlanPosition(activePlan, activeSubscription.startedAt);
        const week = activePlan.weeks.find((item) => item.week_number === position.weekNumber);
        return week
          ? Math.max(
              week.days.filter((day) => !day.rest_day && day.workout_id).length,
              1,
            )
          : 6;
      })()
    : 6;

  const workoutTitleMap = Object.fromEntries(workouts.map((workout) => [workout.id, workout.title]));
  const recentSessions = sessions.slice(0, 4).map((session) => {
    const durationMinutes = session.completedAt
      ? Math.max(
          0,
          Math.round(
            (new Date(session.completedAt).getTime() - new Date(session.startedAt).getTime()) / 60000,
          ),
        )
      : 0;

    return {
      id: session.id,
      title: workoutTitleMap[session.workoutId] ?? 'Workout Session',
      dateLabel: formatDateLabel(session.completedAt),
      durationLabel: formatMinutes(durationMinutes),
      volumeLabel: `${formatVolume(volumeMap.get(session.id) ?? 0)} lbs`,
    };
  });

  let upcomingTitle = 'Build your next workout';
  let upcomingSubtitle = 'Tap to create a session plan';
  let upcomingRoute: string | null = '/(workouts)/builder';

  if (activePlan && activeSubscription) {
    const todaysWorkout = getTodaysWorkout(activePlan, activeSubscription.startedAt);
    if (todaysWorkout.restDay) {
      upcomingTitle = 'Recovery day';
      upcomingSubtitle = activePlan.title;
      upcomingRoute = '/(workouts)/recovery';
    } else if (todaysWorkout.workoutId) {
      const todaysDefinition = workouts.find((item) => item.id === todaysWorkout.workoutId) ?? null;
      upcomingTitle = todaysDefinition?.title ?? 'Scheduled workout';
      upcomingSubtitle = `Today • ${activePlan.title}`;
      upcomingRoute = todaysDefinition
        ? `/(workouts)/builder?edit=${todaysDefinition.id}`
        : '/(workouts)/builder';
    }
  } else if (workouts.length > 0) {
    upcomingTitle = workouts[0].title;
    upcomingSubtitle = 'Ready when you are';
    upcomingRoute = `/(workouts)/builder?edit=${workouts[0].id}`;
  }

  const recovery = buildRecoveryFreshMuscles(sessions, workouts, exercises);

  return {
    dashboard,
    sessionsThisWeek,
    sessionTarget,
    weekVolume: currentWeekVolume,
    volumeDelta,
    weeklyChart,
    recentSessions,
    upcomingTitle,
    upcomingSubtitle,
    upcomingRoute,
    recoveryLabel: recovery.label,
    recoveryFresh: recovery.muscles,
    showEmptyState: workouts.length === 0 && sessions.length === 0,
  };
}

export default function WorkoutsHomeScreen() {
  const db = useDatabase();
  const router = useRouter();
  const [refreshKey, setRefreshKey] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  useFocusEffect(
    useCallback(() => {
      setRefreshKey((value) => value + 1);
    }, []),
  );

  const state = useMemo(() => {
    try {
      return { data: buildHomeView(db), error: null };
    } catch (error) {
      return {
        data: null,
        error: error instanceof Error ? error.message : 'Failed to load dashboard.',
      };
    }
  }, [db, refreshKey]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    setRefreshKey((value) => value + 1);
    setRefreshing(false);
  }, []);

  return (
    <View style={styles.root}>
      <WorkoutTabScrollView refreshing={refreshing} onRefresh={handleRefresh}>
        <View style={styles.body}>
          <WorkoutHero
            eyebrow="Performance Center"
            title="Digital Sanctuary"
            subtitle="A live view of your training volume, streak momentum, and the next session in your rotation."
          />

          {state.error ? (
            <View style={styles.errorWrap}>
              <ErrorState message={state.error} onRetry={handleRefresh} />
            </View>
          ) : state.data?.showEmptyState ? (
            <GlassPanel padding={24} style={styles.emptyCard}>
              <EmptyState
                icon="💪"
                title="Build your first workout"
                message="Create a template, finish one session, and this dashboard will start filling in with weekly volume and recovery insights."
                actionLabel="Open Builder"
                onAction={() => router.push('/(workouts)/builder' as never)}
              />
            </GlassPanel>
          ) : state.data ? (
            <>
              <View style={styles.statGrid}>
                <View style={styles.statSlot}>
                  <StatCard
                    label="This Week Sessions"
                    value={state.data.sessionsThisWeek}
                    suffix={`/ ${state.data.sessionTarget}`}
                    footer={(
                      <View style={styles.progressTrack}>
                        <View
                          style={[
                            styles.progressFill,
                            {
                              width: `${Math.min(
                                (state.data.sessionsThisWeek / Math.max(state.data.sessionTarget, 1)) * 100,
                                100,
                              )}%`,
                            },
                          ]}
                        />
                      </View>
                    )}
                  />
                </View>

                <View style={styles.statSlot}>
                  <StatCard
                    label="Volume (lbs)"
                    value={formatVolume(state.data.weekVolume)}
                    footer={(
                      <View style={styles.deltaRow}>
                        <MaterialSymbol
                          name={(state.data.volumeDelta ?? 0) >= 0 ? 'trending_up' : 'timeline'}
                          size={14}
                          color={getDeltaTint(state.data.volumeDelta)}
                        />
                        <RNText
                          style={[
                            styles.deltaText,
                            { color: getDeltaTint(state.data.volumeDelta) },
                          ]}
                        >
                          {formatDeltaPercent(state.data.volumeDelta)}
                        </RNText>
                      </View>
                    )}
                  />
                </View>

                <View style={styles.statSlot}>
                  <StatCard
                    label="Current Streak"
                    value={state.data.dashboard.streakDays}
                    suffix="Days"
                    footer={(
                      <View style={styles.streakDots}>
                        {Array.from({ length: 7 }).map((_, index) => {
                          const filled = index < Math.min(state.data.dashboard.streakDays, 7);
                          return (
                            <View
                              key={`dot-${index}`}
                              style={[
                                styles.streakDot,
                                filled ? styles.streakDotActive : null,
                              ]}
                            />
                          );
                        })}
                      </View>
                    )}
                  />
                </View>

                <View style={styles.statSlot}>
                  <Pressable
                    onPress={() => {
                      if (state.data?.upcomingRoute) {
                        router.push(state.data.upcomingRoute as never);
                      }
                    }}
                  >
                    <StatCard
                      label="Upcoming Workout"
                      value={state.data.upcomingTitle}
                      backgroundImage="placeholder"
                      footer={(
                        <View style={styles.upcomingFooter}>
                          <RNText style={styles.upcomingText}>{state.data.upcomingSubtitle}</RNText>
                          <MaterialSymbol name="arrow_forward" size={16} color={WK_ACCENT_LIGHT} />
                        </View>
                      )}
                    />
                  </Pressable>
                </View>
              </View>

              <GlassPanel padding={24} style={styles.chartCard}>
                <View style={styles.chartHeader}>
                  <View>
                    <RNText style={styles.sectionTitleText}>Weekly Training Volume</RNText>
                    <RNText style={styles.chartSubtitle}>Last 8 Weeks Analysis</RNText>
                  </View>
                  <View style={styles.legend}>
                    <View style={[styles.legendDot, { backgroundColor: WK_CATEGORY_COLORS.hypertrophy }]} />
                    <RNText style={styles.legendLabel}>Hypertrophy Load</RNText>
                  </View>
                </View>
                <BarChart
                  data={state.data.weeklyChart.map((item) => ({
                    label: item.label,
                    value: item.value,
                    color: WK_CATEGORY_COLORS.hypertrophy,
                  }))}
                  height={220}
                  accent={WK_CATEGORY_COLORS.hypertrophy}
                />
              </GlassPanel>

              <AsymmetricGrid
                left={(
                  <View style={styles.column}>
                    <WorkoutSectionHeader
                      title="Archived Sessions"
                      actionLabel="View Journal"
                      onAction={() => router.push('/(workouts)/history' as never)}
                    />
                    <View style={styles.cardStack}>
                      {state.data.recentSessions.map((session) => (
                        <GlassPanel
                          key={session.id}
                          padding={18}
                          onPress={() => router.push(`/(workouts)/session?id=${session.id}` as never)}
                        >
                          <View style={styles.sessionRow}>
                            <View style={styles.sessionIcon}>
                              <MaterialSymbol
                                name="fitness_center"
                                size={18}
                                color={WK_CATEGORY_COLORS.hypertrophy}
                              />
                            </View>
                            <View style={styles.sessionCopy}>
                              <RNText style={styles.sessionTitle}>{session.title}</RNText>
                              <RNText style={styles.sessionMeta}>{session.dateLabel}</RNText>
                            </View>
                            <View style={styles.sessionStats}>
                              <RNText style={styles.sessionStatText}>{session.durationLabel}</RNText>
                              <RNText style={styles.sessionStatText}>{session.volumeLabel}</RNText>
                            </View>
                            <MaterialSymbol
                              name="chevron_right"
                              size={18}
                              color="rgba(214, 195, 181, 0.54)"
                            />
                          </View>
                        </GlassPanel>
                      ))}
                    </View>
                  </View>
                )}
                right={(
                  <View style={styles.column}>
                    <WorkoutSectionHeader
                      title="Recovery Status"
                      actionLabel="View Heatmap"
                      onAction={() => router.push('/(workouts)/recovery' as never)}
                    />
                    <GlassPanel padding={20} style={styles.recoveryCard}>
                      <SectionLabel accent={WK_CATEGORY_COLORS.recovery}>Freshest today</SectionLabel>
                      <RNText style={styles.recoveryTitle}>{state.data.recoveryLabel}</RNText>
                      <View style={styles.recoveryList}>
                        {state.data.recoveryFresh.map((item) => (
                          <View key={item.muscleGroup} style={styles.recoveryRow}>
                            <View style={styles.recoveryLabelWrap}>
                              <View style={styles.recoveryDot} />
                              <RNText style={styles.recoveryText}>{item.label}</RNText>
                            </View>
                            <RNText style={styles.recoveryScore}>{item.score}%</RNText>
                          </View>
                        ))}
                      </View>
                    </GlassPanel>
                  </View>
                )}
              />
            </>
          ) : null}
        </View>
      </WorkoutTabScrollView>

      <StartWorkoutFAB onPress={() => router.push('/(workouts)/builder' as never)} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: WK_SURFACES.base,
  },
  body: {
    paddingTop: 4,
    gap: 24,
  },
  errorWrap: {
    paddingHorizontal: 24,
  },
  emptyCard: {
    marginHorizontal: 24,
  },
  statGrid: {
    paddingHorizontal: 24,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14,
  },
  statSlot: {
    width: '48%',
  },
  progressTrack: {
    height: 4,
    borderRadius: 999,
    backgroundColor: WK_SURFACES.highest,
    overflow: 'hidden',
  },
  progressFill: {
    height: 4,
    borderRadius: 999,
    backgroundColor: WK_ACCENT,
  },
  deltaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  deltaText: {
    fontFamily: WK_FONTS.medium,
    fontSize: 11,
    lineHeight: 14,
  },
  streakDots: {
    flexDirection: 'row',
    gap: 6,
  },
  streakDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: WK_SURFACES.highest,
  },
  streakDotActive: {
    backgroundColor: WK_CATEGORY_COLORS.hypertrophy,
    shadowColor: WK_CATEGORY_COLORS.hypertrophy,
    shadowOpacity: 0.45,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 0 },
  },
  upcomingFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  upcomingText: {
    flex: 1,
    fontFamily: WK_FONTS.medium,
    fontSize: 12,
    lineHeight: 16,
    color: 'rgba(214, 195, 181, 0.74)',
  },
  chartCard: {
    marginHorizontal: 24,
    gap: 18,
  },
  chartHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  sectionTitleText: {
    fontFamily: WK_FONTS.bold,
    fontSize: 20,
    lineHeight: 24,
    color: '#E4E1E9',
    letterSpacing: -0.4,
  },
  chartSubtitle: {
    fontFamily: WK_FONTS.medium,
    fontSize: 12,
    lineHeight: 16,
    color: 'rgba(214, 195, 181, 0.68)',
    marginTop: 4,
  },
  legend: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  legendLabel: {
    fontFamily: WK_FONTS.medium,
    fontSize: 10,
    lineHeight: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.9,
    color: 'rgba(214, 195, 181, 0.64)',
  },
  column: {
    gap: 14,
  },
  cardStack: {
    paddingHorizontal: 24,
    gap: 12,
  },
  sessionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  sessionIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.16)',
  },
  sessionCopy: {
    flex: 1,
    gap: 4,
  },
  sessionTitle: {
    fontFamily: WK_FONTS.semiBold,
    fontSize: 14,
    lineHeight: 18,
    color: '#E4E1E9',
  },
  sessionMeta: {
    fontFamily: WK_FONTS.medium,
    fontSize: 11,
    lineHeight: 14,
    color: 'rgba(214, 195, 181, 0.66)',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  sessionStats: {
    alignItems: 'flex-end',
    gap: 2,
  },
  sessionStatText: {
    fontFamily: WK_FONTS.medium,
    fontSize: 11,
    lineHeight: 14,
    color: 'rgba(214, 195, 181, 0.74)',
  },
  recoveryCard: {
    marginHorizontal: 24,
    gap: 12,
  },
  recoveryTitle: {
    fontFamily: WK_FONTS.bold,
    fontSize: 18,
    lineHeight: 22,
    color: '#E4E1E9',
    letterSpacing: -0.3,
  },
  recoveryList: {
    gap: 10,
    marginTop: 4,
  },
  recoveryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  recoveryLabelWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  recoveryDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: WK_CATEGORY_COLORS.recovery,
  },
  recoveryText: {
    fontFamily: WK_FONTS.medium,
    fontSize: 13,
    lineHeight: 16,
    color: 'rgba(228, 225, 233, 0.9)',
  },
  recoveryScore: {
    fontFamily: WK_FONTS.bold,
    fontSize: 13,
    lineHeight: 16,
    color: WK_CATEGORY_COLORS.recovery,
  },
});
