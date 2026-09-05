import { useCallback, useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text as RNText,
  TextInput,
  View,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import type { DatabaseAdapter } from '@mylife/db';
import {
  Chip,
  GlassPanel,
  MaterialSymbol,
  WK_ACCENT,
  WK_ACCENT_LIGHT,
  WK_CATEGORY_COLORS,
  WK_FONTS,
  WK_SURFACES,
  WORKOUT_CATEGORIES,
  getAllPlanWorkoutIds,
  getWorkoutExercises,
  getWorkoutPlans,
  getWorkouts,
  seedWorkoutExerciseLibrary,
  type WorkoutCategory,
  type WorkoutDefinition,
  type WorkoutExerciseLibraryItem,
  type WorkoutPlan,
} from '@mylife/workouts';
import { EmptyState, ErrorState } from '@mylife/ui';
import { useDatabase } from '../../../components/DatabaseProvider';
import {
  getWorkoutRecentViews,
  pushWorkoutRecentView,
} from '../../../lib/workouts/settings';
import {
  WorkoutHero,
  WorkoutPrimaryButton,
  WorkoutSectionHeader,
  WorkoutTabScrollView,
  WorkoutTile,
  formatDateTimeLabel,
  formatMinutes,
} from './_screen-kit';

interface ExploreViewModel {
  featured:
    | {
        id: string;
        type: 'program' | 'workout';
        title: string;
        subtitle: string;
        route: string;
      }
    | null;
  workouts: Array<{
    id: string;
    title: string;
    subtitle: string;
    durationLabel: string;
    category: WorkoutCategory | null;
    route: string;
  }>;
  plans: Array<{
    id: string;
    title: string;
    subtitle: string;
    durationLabel: string;
    category: WorkoutCategory | null;
    route: string;
  }>;
  recentViews: ReturnType<typeof getWorkoutRecentViews>;
}

function normalizeText(value: string): string {
  return value.trim().toLowerCase();
}

function inferWorkoutCategory(
  workout: WorkoutDefinition,
  exercisesById: Record<string, WorkoutExerciseLibraryItem>,
): WorkoutCategory | null {
  const counts = new Map<WorkoutCategory, number>();

  for (const entry of workout.exercises) {
    const category = exercisesById[entry.exerciseId]?.category ?? entry.category;
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
  for (const workoutId of getAllPlanWorkoutIds(plan)) {
    const workout = workoutsById[workoutId];
    if (!workout) continue;
    const category = inferWorkoutCategory(workout, exercisesById);
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

function buildExploreView(db: DatabaseAdapter): ExploreViewModel {
  seedWorkoutExerciseLibrary(db);

  const workouts = getWorkouts(db);
  const workoutPlans = getWorkoutPlans(db);
  const exercises = getWorkoutExercises(db, { limit: 500 });
  const workoutsById = Object.fromEntries(workouts.map((workout) => [workout.id, workout]));
  const exercisesById = Object.fromEntries(exercises.map((exercise) => [exercise.id, exercise]));

  const workoutCards = workouts.map((workout) => {
    const category = inferWorkoutCategory(workout, exercisesById);
    return {
      id: workout.id,
      title: workout.title,
      subtitle: `${workout.exercises.length} exercises • ${workout.difficulty}`,
      durationLabel: formatMinutes(Math.round(workout.estimatedDuration / 60)),
      category,
      route: `/(workouts)/builder?edit=${workout.id}`,
    };
  });

  const planCards = workoutPlans.map((plan) => {
    const trainingDays = plan.weeks[0]?.days.filter((day) => !day.rest_day && day.workout_id).length ?? 0;
    const category = getPlanCategory(plan, workoutsById, exercisesById);
    return {
      id: plan.id,
      title: plan.title,
      subtitle: `${plan.weeks.length} weeks • ${trainingDays || 4} days / week`,
      durationLabel: `${getAllPlanWorkoutIds(plan).length} workouts`,
      category,
      route: `/(workouts)/program/${plan.id}`,
    };
  });

  const featuredPlan = planCards[0];
  const featuredWorkout = workoutCards[0];

  return {
    featured: featuredPlan
      ? {
          id: featuredPlan.id,
          type: 'program',
          title: featuredPlan.title,
          subtitle: featuredPlan.subtitle,
          route: featuredPlan.route,
        }
      : featuredWorkout
        ? {
            id: featuredWorkout.id,
            type: 'workout',
            title: featuredWorkout.title,
            subtitle: featuredWorkout.subtitle,
            route: featuredWorkout.route,
          }
        : null,
    workouts: workoutCards,
    plans: planCards,
    recentViews: getWorkoutRecentViews(db),
  };
}

export default function WorkoutsExploreScreen() {
  const db = useDatabase();
  const router = useRouter();
  const [refreshKey, setRefreshKey] = useState(0);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<WorkoutCategory | null>(null);

  useFocusEffect(
    useCallback(() => {
      setRefreshKey((value) => value + 1);
    }, []),
  );

  const state = useMemo(() => {
    try {
      return { data: buildExploreView(db), error: null };
    } catch (error) {
      return {
        data: null,
        error: error instanceof Error ? error.message : 'Unable to load discovery hub.',
      };
    }
  }, [db, refreshKey]);

  const filtered = useMemo(() => {
    if (!state.data) {
      return { featured: null, plans: [], workouts: [] };
    }

    const query = normalizeText(search);
    const matchesSearch = (title: string, subtitle: string) => {
      if (query.length === 0) return true;
      return normalizeText(`${title} ${subtitle}`).includes(query);
    };

    const matchesCategory = (category: WorkoutCategory | null) => {
      return selectedCategory == null || category === selectedCategory;
    };

    return {
      featured:
        state.data.featured &&
        matchesSearch(state.data.featured.title, state.data.featured.subtitle)
          ? state.data.featured
          : null,
      plans: state.data.plans.filter((item) => {
        return matchesSearch(item.title, item.subtitle) && matchesCategory(item.category);
      }),
      workouts: state.data.workouts.filter((item) => {
        return matchesSearch(item.title, item.subtitle) && matchesCategory(item.category);
      }),
    };
  }, [search, selectedCategory, state.data]);
  const featuredItem = filtered.featured;

  const openRoute = useCallback((
    route: string,
    view: {
      id: string;
      type: 'workout' | 'program' | 'exercise';
      title: string;
      subtitle?: string;
      category?: string | null;
    },
  ) => {
    pushWorkoutRecentView(db, {
      id: view.id,
      type: view.type,
      title: view.title,
      subtitle: view.subtitle,
      route,
      category: view.category ?? null,
    });
    router.push(route as never);
  }, [db, router]);

  return (
    <WorkoutTabScrollView onRefresh={() => setRefreshKey((value) => value + 1)}>
      <View style={styles.body}>
        <WorkoutHero
          eyebrow="Discovery"
          title="Curated Library"
          subtitle="Browse programs, surface old favorites, and keep a warm queue of sessions ready to run."
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
            <View style={styles.searchWrap}>
              <MaterialSymbol name="search" size={18} color="rgba(214, 195, 181, 0.7)" />
              <TextInput
                value={search}
                onChangeText={setSearch}
                placeholder="Search exercises, programs, trainers..."
                placeholderTextColor="rgba(214, 195, 181, 0.52)"
                style={styles.searchInput}
              />
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
                  accent={WK_ACCENT}
                />
              ))}
            </ScrollView>

            {featuredItem ? (
              <GlassPanel padding={0} style={styles.featuredCard}>
                <View style={styles.featuredBackground} />
                <View style={styles.featuredContent}>
                  <RNText style={styles.featuredEyebrow}>Featured</RNText>
                  <RNText style={styles.featuredTitle}>{featuredItem.title}</RNText>
                  <RNText style={styles.featuredSubtitle}>{featuredItem.subtitle}</RNText>
                  <WorkoutPrimaryButton
                    label={featuredItem.type === 'program' ? 'Open Program' : 'Start Workout'}
                    icon="play_arrow"
                    onPress={() => openRoute(featuredItem.route, {
                      id: featuredItem.id,
                      type: featuredItem.type,
                      title: featuredItem.title,
                      subtitle: featuredItem.subtitle,
                    })}
                  />
                </View>
              </GlassPanel>
            ) : null}

            <View style={styles.sectionBlock}>
              <WorkoutSectionHeader title="Trending Programs" />
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.rail}
              >
                {filtered.plans.length > 0 ? (
                  filtered.plans.map((plan) => {
                    const tint = plan.category ? WK_CATEGORY_COLORS[plan.category === 'strength' ? 'strength' : plan.category === 'cardio' ? 'cardio' : plan.category === 'recovery' ? 'recovery' : 'hypertrophy'] : WK_ACCENT_LIGHT;
                    return (
                      <Pressable
                        key={plan.id}
                        style={[styles.railCard, { backgroundColor: `${tint}14` }]}
                        onPress={() => openRoute(plan.route, {
                          id: plan.id,
                          type: 'program',
                          title: plan.title,
                          subtitle: plan.subtitle,
                          category: plan.category,
                        })}
                      >
                        <View style={[styles.railImage, { backgroundColor: `${tint}22` }]} />
                        <RNText style={styles.railTitle}>{plan.title}</RNText>
                        <RNText style={styles.railMeta}>{plan.subtitle}</RNText>
                        <RNText style={styles.railValue}>{plan.durationLabel}</RNText>
                      </Pressable>
                    );
                  })
                ) : (
                  <GlassPanel padding={22} style={styles.emptyRailCard}>
                    <EmptyState
                      title="No programs yet"
                      message="Create a structured block or import one from your plan builder."
                      actionLabel="Create Program"
                      onAction={() => router.push('/(workouts)/program/create' as never)}
                    />
                  </GlassPanel>
                )}
              </ScrollView>
            </View>

            <View style={styles.sectionBlock}>
              <WorkoutSectionHeader title="For You" />
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.rail}
              >
                {filtered.workouts.length > 0 ? (
                  filtered.workouts.slice(0, 8).map((workout) => {
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
                        style={[styles.railCard, { backgroundColor: WK_SURFACES.low }]}
                        onPress={() => openRoute(workout.route, {
                          id: workout.id,
                          type: 'workout',
                          title: workout.title,
                          subtitle: workout.subtitle,
                          category: workout.category,
                        })}
                      >
                        <View style={[styles.railImage, { backgroundColor: `${tint}20` }]}>
                          <MaterialSymbol name="fitness_center" size={22} color={tint} />
                        </View>
                        <RNText style={styles.railTitle}>{workout.title}</RNText>
                        <RNText style={styles.railMeta}>{workout.subtitle}</RNText>
                        <RNText style={styles.railValue}>{workout.durationLabel}</RNText>
                      </Pressable>
                    );
                  })
                ) : (
                  <GlassPanel padding={22} style={styles.emptyRailCard}>
                    <EmptyState
                      title="Build your first workout"
                      message="Once you have custom sessions, this row turns into a personal recommendation rail."
                      actionLabel="Open Builder"
                      onAction={() => router.push('/(workouts)/builder' as never)}
                    />
                  </GlassPanel>
                )}
              </ScrollView>
            </View>

            <View style={styles.sectionBlock}>
              <WorkoutSectionHeader title="Recently Viewed" />
              <View style={styles.recentList}>
                {state.data?.recentViews.length ? (
                  state.data.recentViews.map((item) => (
                    <WorkoutTile
                      key={`${item.type}-${item.id}`}
                      icon={item.type === 'program' ? 'menu_book' : item.type === 'exercise' ? 'fitness_center' : 'play_arrow'}
                      title={item.title}
                      subtitle={`${item.subtitle ?? 'Viewed item'} • ${formatDateTimeLabel(item.seenAt)}`}
                      onPress={() => router.push(item.route as never)}
                    />
                  ))
                ) : (
                  <GlassPanel padding={24}>
                    <EmptyState
                      title="No recent views yet"
                      message="Open a workout, plan, or exercise and we will pin it here for quick return trips."
                    />
                  </GlassPanel>
                )}
              </View>
            </View>
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
  searchWrap: {
    marginHorizontal: 24,
    minHeight: 54,
    borderRadius: 999,
    backgroundColor: WK_SURFACES.highest,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 18,
  },
  searchInput: {
    flex: 1,
    color: '#E4E1E9',
    fontFamily: WK_FONTS.medium,
    fontSize: 15,
    lineHeight: 20,
  },
  chipRail: {
    paddingHorizontal: 24,
    gap: 10,
  },
  featuredCard: {
    marginHorizontal: 24,
    overflow: 'hidden',
  },
  featuredBackground: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(201, 137, 77, 0.18)',
  },
  featuredContent: {
    padding: 24,
    gap: 10,
  },
  featuredEyebrow: {
    fontFamily: WK_FONTS.bold,
    fontSize: 10,
    lineHeight: 12,
    letterSpacing: 1.4,
    color: WK_ACCENT_LIGHT,
    textTransform: 'uppercase',
  },
  featuredTitle: {
    fontFamily: WK_FONTS.extraBold,
    fontSize: 26,
    lineHeight: 30,
    letterSpacing: -0.8,
    color: '#E4E1E9',
  },
  featuredSubtitle: {
    fontFamily: WK_FONTS.medium,
    fontSize: 14,
    lineHeight: 20,
    color: 'rgba(214, 195, 181, 0.76)',
    marginBottom: 4,
  },
  sectionBlock: {
    gap: 14,
  },
  rail: {
    paddingHorizontal: 24,
    gap: 12,
  },
  railCard: {
    width: 230,
    minHeight: 196,
    borderRadius: 24,
    padding: 18,
    gap: 10,
  },
  railImage: {
    height: 94,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  railTitle: {
    fontFamily: WK_FONTS.bold,
    fontSize: 16,
    lineHeight: 20,
    color: '#E4E1E9',
    letterSpacing: -0.3,
  },
  railMeta: {
    fontFamily: WK_FONTS.medium,
    fontSize: 12,
    lineHeight: 16,
    color: 'rgba(214, 195, 181, 0.74)',
  },
  railValue: {
    fontFamily: WK_FONTS.semiBold,
    fontSize: 12,
    lineHeight: 16,
    color: WK_ACCENT_LIGHT,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  emptyRailCard: {
    width: 280,
  },
  recentList: {
    paddingHorizontal: 24,
    gap: 12,
  },
});
