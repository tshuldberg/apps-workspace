import { useCallback, useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text as RNText,
  View,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import type { DatabaseAdapter } from '@mylife/db';
import {
  Chip,
  GlassPanel,
  MaterialSymbol,
  SectionLabel,
  WK_ACCENT,
  WK_ACCENT_LIGHT,
  WK_CATEGORY_COLORS,
  WK_FONTS,
  WK_SURFACES,
  WORKOUT_CATEGORIES,
  getActivePlanSubscription,
  getCurrentPlanPosition,
  getPlanProgress,
  getWorkoutExercises,
  getWorkoutPlans,
  getWorkoutSessions,
  getWorkouts,
  seedWorkoutExerciseLibrary,
  type WorkoutCategory,
  type WorkoutDefinition,
  type WorkoutExerciseLibraryItem,
  type WorkoutPlan,
} from '@mylife/workouts';
import { EmptyState, ErrorState } from '@mylife/ui';
import { useDatabase } from '../../../components/DatabaseProvider';
import { pushWorkoutRecentView } from '../../../lib/workouts/settings';
import {
  WorkoutHero,
  WorkoutPrimaryButton,
  WorkoutTabScrollView,
  formatMinutes,
} from './_screen-kit';

type Segment = 'workouts' | 'programs';

interface LibraryViewModel {
  workouts: Array<{
    id: string;
    title: string;
    subtitle: string;
    durationLabel: string;
    category: WorkoutCategory | null;
    route: string;
  }>;
  programs: Array<{
    id: string;
    title: string;
    subtitle: string;
    value: string;
    category: WorkoutCategory | null;
    route: string;
  }>;
  activeProgram: {
    id: string;
    title: string;
    subtitle: string;
    progressPercent: number;
    route: string;
  } | null;
}

function inferWorkoutCategory(
  workout: WorkoutDefinition,
  exercisesById: Record<string, WorkoutExerciseLibraryItem>,
): WorkoutCategory | null {
  const counts = new Map<WorkoutCategory, number>();
  for (const exercise of workout.exercises) {
    const category = exercisesById[exercise.exerciseId]?.category ?? exercise.category;
    if (!category) continue;
    counts.set(category, (counts.get(category) ?? 0) + 1);
  }

  let top: WorkoutCategory | null = null;
  let max = 0;
  for (const [category, count] of counts) {
    if (count > max) {
      top = category;
      max = count;
    }
  }
  return top;
}

function getPlanCategory(
  plan: WorkoutPlan,
  workoutsById: Record<string, WorkoutDefinition>,
  exercisesById: Record<string, WorkoutExerciseLibraryItem>,
): WorkoutCategory | null {
  const counts = new Map<WorkoutCategory, number>();
  for (const week of plan.weeks) {
    for (const day of week.days) {
      if (!day.workout_id) continue;
      const workout = workoutsById[day.workout_id];
      if (!workout) continue;
      const category = inferWorkoutCategory(workout, exercisesById);
      if (!category) continue;
      counts.set(category, (counts.get(category) ?? 0) + 1);
    }
  }

  let top: WorkoutCategory | null = null;
  let max = 0;
  for (const [category, count] of counts) {
    if (count > max) {
      top = category;
      max = count;
    }
  }
  return top;
}

function buildLibraryView(db: DatabaseAdapter): LibraryViewModel {
  seedWorkoutExerciseLibrary(db);

  const workouts = getWorkouts(db);
  const plans = getWorkoutPlans(db);
  const sessions = getWorkoutSessions(db, { onlyCompleted: true, limit: 300 });
  const exercises = getWorkoutExercises(db, { limit: 500 });

  const workoutsById = Object.fromEntries(workouts.map((workout) => [workout.id, workout]));
  const exercisesById = Object.fromEntries(exercises.map((exercise) => [exercise.id, exercise]));
  const completedWorkoutIds = new Set(sessions.map((session) => session.workoutId));

  const workoutCards = workouts.map((workout) => ({
    id: workout.id,
    title: workout.title,
    subtitle: `${workout.exercises.length} exercises • ${workout.difficulty}`,
    durationLabel: formatMinutes(Math.round(workout.estimatedDuration / 60)),
    category: inferWorkoutCategory(workout, exercisesById),
    route: `/(workouts)/builder?edit=${workout.id}`,
  }));

  const programCards = plans.map((plan) => {
    const weeklyDays = plan.weeks[0]?.days.filter((day) => !day.rest_day && day.workout_id).length ?? 0;
    const totalWorkouts = plan.weeks.reduce((sum, week) => {
      return sum + week.days.filter((day) => !day.rest_day && day.workout_id).length;
    }, 0);

    return {
      id: plan.id,
      title: plan.title,
      subtitle: `${plan.weeks.length} weeks • ${weeklyDays || 4} days / week`,
      value: `${totalWorkouts} workouts`,
      category: getPlanCategory(plan, workoutsById, exercisesById),
      route: `/(workouts)/program/${plan.id}`,
    };
  });

  const activeSubscription = getActivePlanSubscription(db);
  const activePlan = activeSubscription
    ? plans.find((plan) => plan.id === activeSubscription.planId) ?? null
    : null;

  return {
    workouts: workoutCards,
    programs: programCards,
    activeProgram: activePlan && activeSubscription
      ? {
          id: activePlan.id,
          title: activePlan.title,
          subtitle: (() => {
            const position = getCurrentPlanPosition(activePlan, activeSubscription.startedAt);
            return `Week ${position.weekNumber} • Day ${position.dayIndex + 1}`;
          })(),
          progressPercent: getPlanProgress(activePlan, completedWorkoutIds).percent,
          route: `/(workouts)/program/${activePlan.id}`,
        }
      : null,
  };
}

export default function WorkoutsLibraryScreen() {
  const db = useDatabase();
  const router = useRouter();
  const [segment, setSegment] = useState<Segment>('workouts');
  const [selectedCategory, setSelectedCategory] = useState<WorkoutCategory | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useFocusEffect(
    useCallback(() => {
      setRefreshKey((value) => value + 1);
    }, []),
  );

  const state = useMemo(() => {
    try {
      return { data: buildLibraryView(db), error: null };
    } catch (error) {
      return {
        data: null,
        error: error instanceof Error ? error.message : 'Unable to load training library.',
      };
    }
  }, [db, refreshKey]);

  const filtered = useMemo(() => {
    const matchesCategory = (category: WorkoutCategory | null) => {
      return selectedCategory == null || category === selectedCategory;
    };

    return {
      workouts: state.data?.workouts.filter((item) => matchesCategory(item.category)) ?? [],
      programs: state.data?.programs.filter((item) => matchesCategory(item.category)) ?? [],
    };
  }, [selectedCategory, state.data]);

  const openRoute = useCallback((
    route: string,
    type: 'workout' | 'program',
    title: string,
    subtitle: string,
    category?: WorkoutCategory | null,
  ) => {
    pushWorkoutRecentView(db, {
      id: route,
      type,
      title,
      subtitle,
      route,
      category: category ?? null,
    });
    router.push(route as never);
  }, [db, router]);

  return (
    <WorkoutTabScrollView onRefresh={() => setRefreshKey((value) => value + 1)}>

      <View style={styles.body}>
        <WorkoutHero
          eyebrow="Library"
          title="Your Training"
          subtitle="Swap between custom workouts and multi-week programs without leaving the performance shell."
        />

        {state.error ? (
          <View style={styles.feedbackWrap}>
            <ErrorState
              message={state.error}
              onRetry={() => setRefreshKey((value) => value + 1)}
            />
          </View>
        ) : (
          <>
            <View style={styles.segmentWrap}>
              <Pressable
                onPress={() => setSegment('workouts')}
                style={[styles.segment, segment === 'workouts' && styles.segmentActive]}
              >
                <RNText style={[styles.segmentText, segment === 'workouts' && styles.segmentTextActive]}>
                  Workouts
                </RNText>
              </Pressable>
              <Pressable
                onPress={() => setSegment('programs')}
                style={[styles.segment, segment === 'programs' && styles.segmentActive]}
              >
                <RNText style={[styles.segmentText, segment === 'programs' && styles.segmentTextActive]}>
                  Programs
                </RNText>
              </Pressable>
            </View>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.chipRail}
            >
              <Chip
                label="All"
                selected={selectedCategory == null}
                onPress={() => setSelectedCategory(null)}
              />
              {WORKOUT_CATEGORIES.map((category) => (
                <Chip
                  key={category}
                  label={category.replace('_', ' ').replace(/\b\w/g, (token) => token.toUpperCase())}
                  selected={selectedCategory === category}
                  onPress={() => {
                    setSelectedCategory((current) => current === category ? null : category);
                  }}
                />
              ))}
            </ScrollView>

            {segment === 'workouts' ? (
              <View style={styles.sectionBlock}>
                {filtered.workouts.length > 0 ? (
                  <>
                    <GlassPanel
                      padding={0}
                      style={styles.heroWorkoutCard}
                      onPress={() => openRoute(
                        filtered.workouts[0].route,
                        'workout',
                        filtered.workouts[0].title,
                        filtered.workouts[0].subtitle,
                        filtered.workouts[0].category,
                      )}
                    >
                      <View style={styles.heroWorkoutBackground} />
                      <View style={styles.heroWorkoutContent}>
                        <SectionLabel accent={WK_ACCENT_LIGHT}>Most Recent</SectionLabel>
                        <RNText style={styles.heroWorkoutTitle}>{filtered.workouts[0].title}</RNText>
                        <RNText style={styles.heroWorkoutMeta}>{filtered.workouts[0].subtitle}</RNText>
                        <RNText style={styles.heroWorkoutValue}>{filtered.workouts[0].durationLabel}</RNText>
                      </View>
                    </GlassPanel>

                    <View style={styles.grid}>
                      {filtered.workouts.slice(1).map((workout) => {
                        const tint = workout.category
                          ? WK_CATEGORY_COLORS[
                              workout.category === 'strength'
                                ? 'strength'
                                : workout.category === 'cardio'
                                  ? 'cardio'
                                  : workout.category === 'recovery'
                                    ? 'recovery'
                                    : 'hypertrophy'
                            ]
                          : WK_ACCENT_LIGHT;

                        return (
                          <Pressable
                            key={workout.id}
                            style={[styles.gridCard, { backgroundColor: WK_SURFACES.low }]}
                            onPress={() => openRoute(
                              workout.route,
                              'workout',
                              workout.title,
                              workout.subtitle,
                              workout.category,
                            )}
                          >
                            <View style={[styles.gridCover, { backgroundColor: `${tint}18` }]}>
                              <MaterialSymbol name="fitness_center" size={20} color={tint} />
                            </View>
                            <RNText style={styles.gridTitle}>{workout.title}</RNText>
                            <RNText style={styles.gridMeta}>{workout.subtitle}</RNText>
                            <RNText style={styles.gridValue}>{workout.durationLabel}</RNText>
                          </Pressable>
                        );
                      })}
                    </View>

                    <View style={styles.ctaRow}>
                      <WorkoutPrimaryButton
                        label="Create New Workout"
                        icon="add_circle"
                        onPress={() => router.push('/(workouts)/builder' as never)}
                      />
                    </View>
                  </>
                ) : (
                  <GlassPanel padding={24} style={styles.emptyCard}>
                    <EmptyState
                      title="Build your first workout"
                      message="Custom sessions appear here with cover cards, filters, and quick edit access."
                      actionLabel="Open Builder"
                      onAction={() => router.push('/(workouts)/builder' as never)}
                    />
                  </GlassPanel>
                )}
              </View>
            ) : (
              <View style={styles.sectionBlock}>
                {(() => {
                  const activeProgram = state.data?.activeProgram;

                  if (!activeProgram) {
                    return (
                      <GlassPanel padding={22} style={styles.activeProgramCard}>
                        <SectionLabel accent={WK_ACCENT_LIGHT}>Currently Following</SectionLabel>
                        <RNText style={styles.activeProgramTitle}>No active program yet</RNText>
                        <RNText style={styles.activeProgramSubtitle}>
                          Subscribe to a plan or build your own multi-week block.
                        </RNText>
                      </GlassPanel>
                    );
                  }

                  return (
                    <GlassPanel
                      padding={22}
                      style={styles.activeProgramCard}
                      onPress={() => router.push(activeProgram.route as never)}
                    >
                      <SectionLabel accent={WK_ACCENT_LIGHT}>Currently Following</SectionLabel>
                      <RNText style={styles.activeProgramTitle}>{activeProgram.title}</RNText>
                      <RNText style={styles.activeProgramSubtitle}>{activeProgram.subtitle}</RNText>
                      <View style={styles.activeProgressTrack}>
                        <View
                          style={[
                            styles.activeProgressFill,
                            { width: `${activeProgram.progressPercent}%` },
                          ]}
                        />
                      </View>
                      <RNText style={styles.activeProgressLabel}>
                        {activeProgram.progressPercent}% complete
                      </RNText>
                    </GlassPanel>
                  );
                })()}

                {filtered.programs.length > 0 ? (
                  <View style={styles.grid}>
                    {filtered.programs.map((program) => {
                      const tint = program.category
                        ? WK_CATEGORY_COLORS[
                            program.category === 'strength'
                              ? 'strength'
                              : program.category === 'cardio'
                                ? 'cardio'
                                : program.category === 'recovery'
                                  ? 'recovery'
                                  : 'hypertrophy'
                          ]
                        : WK_ACCENT_LIGHT;

                      return (
                        <Pressable
                          key={program.id}
                          style={styles.gridCard}
                          onPress={() => openRoute(
                            program.route,
                            'program',
                            program.title,
                            program.subtitle,
                            program.category,
                          )}
                        >
                          <View style={[styles.gridCover, { backgroundColor: `${tint}18` }]}>
                            <MaterialSymbol name="menu_book" size={20} color={tint} />
                          </View>
                          <RNText style={styles.gridTitle}>{program.title}</RNText>
                          <RNText style={styles.gridMeta}>{program.subtitle}</RNText>
                          <RNText style={styles.gridValue}>{program.value}</RNText>
                        </Pressable>
                      );
                    })}
                  </View>
                ) : (
                  <GlassPanel padding={24} style={styles.emptyCard}>
                    <EmptyState
                      title="No programs yet"
                      message="Create a structured training block and it will appear here with progress tracking."
                      actionLabel="Create Program"
                      onAction={() => router.push('/(workouts)/program/create' as never)}
                    />
                  </GlassPanel>
                )}

                <View style={styles.ctaRow}>
                  <WorkoutPrimaryButton
                    label="Create Program"
                    icon="add_circle"
                    onPress={() => router.push('/(workouts)/program/create' as never)}
                  />
                </View>
              </View>
            )}
          </>
        )}
      </View>
    </WorkoutTabScrollView>
  );
}

const styles = StyleSheet.create({
  body: {
    paddingTop: 4,
    gap: 22,
  },
  feedbackWrap: {
    paddingHorizontal: 24,
  },
  segmentWrap: {
    marginHorizontal: 24,
    padding: 4,
    borderRadius: 999,
    backgroundColor: WK_SURFACES.low,
    flexDirection: 'row',
    gap: 4,
  },
  segment: {
    flex: 1,
    minHeight: 40,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentActive: {
    backgroundColor: WK_ACCENT,
  },
  segmentText: {
    fontFamily: WK_FONTS.semiBold,
    fontSize: 12,
    lineHeight: 14,
    color: 'rgba(214, 195, 181, 0.8)',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  segmentTextActive: {
    color: '#4B2700',
  },
  chipRail: {
    paddingHorizontal: 24,
    gap: 10,
  },
  sectionBlock: {
    gap: 16,
  },
  heroWorkoutCard: {
    marginHorizontal: 24,
  },
  heroWorkoutBackground: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(239, 68, 68, 0.16)',
  },
  heroWorkoutContent: {
    padding: 24,
    gap: 8,
  },
  heroWorkoutTitle: {
    fontFamily: WK_FONTS.extraBold,
    fontSize: 28,
    lineHeight: 32,
    color: '#E4E1E9',
    letterSpacing: -0.9,
  },
  heroWorkoutMeta: {
    fontFamily: WK_FONTS.medium,
    fontSize: 14,
    lineHeight: 18,
    color: 'rgba(214, 195, 181, 0.74)',
  },
  heroWorkoutValue: {
    fontFamily: WK_FONTS.bold,
    fontSize: 12,
    lineHeight: 14,
    color: WK_ACCENT_LIGHT,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginTop: 4,
  },
  grid: {
    paddingHorizontal: 24,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  gridCard: {
    width: '48%',
    minHeight: 182,
    borderRadius: 24,
    padding: 18,
    backgroundColor: WK_SURFACES.low,
    gap: 10,
  },
  gridCover: {
    height: 88,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gridTitle: {
    fontFamily: WK_FONTS.bold,
    fontSize: 15,
    lineHeight: 18,
    color: '#E4E1E9',
    letterSpacing: -0.3,
  },
  gridMeta: {
    fontFamily: WK_FONTS.medium,
    fontSize: 12,
    lineHeight: 16,
    color: 'rgba(214, 195, 181, 0.74)',
  },
  gridValue: {
    fontFamily: WK_FONTS.semiBold,
    fontSize: 11,
    lineHeight: 14,
    color: WK_ACCENT_LIGHT,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  ctaRow: {
    paddingHorizontal: 24,
    alignItems: 'flex-start',
  },
  emptyCard: {
    marginHorizontal: 24,
  },
  activeProgramCard: {
    marginHorizontal: 24,
    gap: 10,
  },
  activeProgramTitle: {
    fontFamily: WK_FONTS.extraBold,
    fontSize: 24,
    lineHeight: 28,
    color: '#E4E1E9',
    letterSpacing: -0.7,
  },
  activeProgramSubtitle: {
    fontFamily: WK_FONTS.medium,
    fontSize: 13,
    lineHeight: 18,
    color: 'rgba(214, 195, 181, 0.74)',
  },
  activeProgressTrack: {
    height: 6,
    borderRadius: 999,
    backgroundColor: WK_SURFACES.highest,
    overflow: 'hidden',
    marginTop: 4,
  },
  activeProgressFill: {
    height: 6,
    borderRadius: 999,
    backgroundColor: WK_ACCENT,
  },
  activeProgressLabel: {
    fontFamily: WK_FONTS.semiBold,
    fontSize: 12,
    lineHeight: 14,
    color: WK_ACCENT_LIGHT,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
});
