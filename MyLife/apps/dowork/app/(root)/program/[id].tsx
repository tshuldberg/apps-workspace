import { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text as RNText,
  View,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import {
  Chip,
  GlassPanel,
  MaterialSymbol,
  SectionLabel,
  WK_FONTS,
  WK_SURFACES,
  getActivePlanSubscription,
  getCurrentPlanPosition,
  getPlanProgress,
  getWeekSchedule,
  getWorkoutExercises,
  getWorkoutPlanById,
  getWorkoutSessions,
  getWorkouts,
  subscribeToPlan,
  unsubscribeFromPlan,
} from '@mylife/workouts';
import { useDatabase } from '../providers/DatabaseProvider';
import { getWorkoutProgramCover, pushWorkoutRecentView } from '../../../lib/workouts/settings';
import {
  formatDifficultyLabel,
  getPlanDifficulty,
  getPlanEquipmentSummary,
  getPlanFrequency,
  getPlanWorkoutCount,
} from '../../../lib/workouts/phase3';
import { ExerciseArtwork, StickyActionBar, WorkoutRouteHeader } from '../phase3-kit';
import { uuid } from '../../../lib/uuid';
import { DW_ACCENT, DW_ACCENT_LIGHT, DW_ON_ACCENT } from '../theme/tokens';

export default function ProgramDetailScreen() {
  const db = useDatabase();
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string }>();
  const [refreshKey, setRefreshKey] = useState(0);
  const [collapsedWeeks, setCollapsedWeeks] = useState<Set<number>>(new Set());

  useFocusEffect(
    useCallback(() => {
      setRefreshKey((value) => value + 1);
    }, []),
  );

  const state = useMemo(() => {
    try {
      if (!params.id) {
        return { error: 'Program not found.', plan: null };
      }

      const plan = getWorkoutPlanById(db, params.id);
      const workouts = getWorkouts(db);
      const exercises = getWorkoutExercises(db, { limit: 500 });
      const workoutsById = Object.fromEntries(workouts.map((workout) => [workout.id, workout]));
      const exercisesById = Object.fromEntries(exercises.map((exercise) => [exercise.id, exercise]));
      const subscription = getActivePlanSubscription(db);
      const sessions = getWorkoutSessions(db, { onlyCompleted: true, limit: 300 });
      const completedWorkoutIds = new Set(sessions.map((session) => session.workoutId));
      const coverUri = plan ? getWorkoutProgramCover(db, plan.id) : null;

      if (plan) {
        pushWorkoutRecentView(db, {
          id: plan.id,
          type: 'program',
          title: plan.title,
          subtitle: `${plan.weeks.length} weeks • ${getPlanFrequency(plan)} days / week`,
          route: `/(root)/program/${plan.id}`,
          category: null,
        });
      }

      return {
        error: null,
        plan,
        workoutsById,
        exercisesById,
        subscription,
        completedWorkoutIds,
        coverUri,
      };
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : 'Unable to load the program.',
        plan: null,
        workoutsById: {} as Record<string, ReturnType<typeof getWorkouts>[number]>,
        exercisesById: {} as Record<string, ReturnType<typeof getWorkoutExercises>[number]>,
        subscription: null,
        completedWorkoutIds: new Set<string>(),
        coverUri: null,
      };
    }
  }, [db, params.id, refreshKey]);

  const plan = state.plan;
  const isSubscribed = Boolean(plan && state.subscription?.planId === plan.id);
  const difficulty = plan ? getPlanDifficulty(plan, state.workoutsById) : 'intermediate';
  const progress = plan ? getPlanProgress(plan, state.completedWorkoutIds) : null;
  const position = plan && state.subscription
    ? getCurrentPlanPosition(plan, state.subscription.startedAt)
    : null;
  const todaysSchedule = plan && position ? getWeekSchedule(plan, position.weekNumber)?.[position.dayIndex] ?? null : null;
  const equipmentSummary = plan
    ? getPlanEquipmentSummary(plan, state.workoutsById, state.exercisesById)
    : [];

  const toggleWeek = (weekNumber: number) => {
    setCollapsedWeeks((current) => {
      const next = new Set(current);
      if (next.has(weekNumber)) {
        next.delete(weekNumber);
      } else {
        next.add(weekNumber);
      }
      return next;
    });
  };

  const handleSubscribe = () => {
    if (!plan) return;
    try {
      subscribeToPlan(db, uuid(), plan.id);
      setRefreshKey((value) => value + 1);
    } catch (error) {
      Alert.alert('Unable to subscribe', error instanceof Error ? error.message : 'Try again.');
    }
  };

  const handleUnsubscribe = () => {
    if (!plan) return;
    Alert.alert('Unsubscribe', 'Stop following this program?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Unsubscribe',
        style: 'destructive',
        onPress: () => {
          try {
            unsubscribeFromPlan(db, plan.id);
            setRefreshKey((value) => value + 1);
          } catch (error) {
            Alert.alert('Unable to unsubscribe', error instanceof Error ? error.message : 'Try again.');
          }
        },
      },
    ]);
  };

  const handleShare = async () => {
    if (!plan) return;
    await Clipboard.setStringAsync(`dowork://program/${plan.id}`);
    Alert.alert('Link copied', `${plan.title} is ready to share.`);
  };

  const handlePrimaryAction = () => {
    if (!plan) return;
    if (!isSubscribed) {
      handleSubscribe();
      return;
    }

    if (todaysSchedule?.workout_id) {
      router.push(`/(root)/session?workoutId=${todaysSchedule.workout_id}` as never);
      return;
    }

    router.push('/(root)/recovery' as never);
  };

  if (!plan || state.error) {
    return (
      <View style={styles.screen}>
        <Stack.Screen options={{ headerShown: false }} />
        <WorkoutRouteHeader title="Program" overline="Detail" onBack={() => router.back()} />
        <View style={styles.body}>
          <GlassPanel style={styles.errorCard}>
            <RNText style={styles.errorTitle}>Program detail unavailable</RNText>
            <RNText style={styles.errorBody}>{state.error ?? 'This program could not be found.'}</RNText>
          </GlassPanel>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ headerShown: false }} />

      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
        <WorkoutRouteHeader
          title={plan.title}
          overline="Program"
          onBack={() => router.back()}
          right={(
            <Pressable onPress={() => void handleShare()} style={styles.headerIcon}>
              <MaterialSymbol name="share" size={18} color="rgba(228, 225, 233, 0.72)" />
            </Pressable>
          )}
        />

        <View style={styles.body}>
          <View style={styles.heroWrap}>
            <ExerciseArtwork
              title={plan.title}
              accent={DW_ACCENT}
              uri={state.coverUri}
              height={248}
            />
            <View style={styles.heroOverlay}>
              <SectionLabel accent={DW_ACCENT_LIGHT}>Advanced Strength</SectionLabel>
              <RNText style={styles.heroTitle}>{plan.title}</RNText>
              <View style={styles.heroChips}>
                <Chip label={`${plan.weeks.length} Weeks`} selected />
                <Chip label={`${getPlanFrequency(plan)} Days / Week`} />
                <Chip label={formatDifficultyLabel(difficulty)} />
                <Chip label={isSubscribed ? '1 Subscriber' : 'Local Plan'} />
              </View>
            </View>
          </View>

          {isSubscribed && progress && position ? (
            <GlassPanel style={styles.progressCard}>
              <View style={styles.progressHeader}>
                <View>
                  <SectionLabel accent={DW_ACCENT_LIGHT}>Active Subscription</SectionLabel>
                  <RNText style={styles.progressTitle}>Week {position.weekNumber} of {plan.weeks.length}</RNText>
                </View>
                <Chip label={todaysSchedule?.workout_id ? 'Today queued' : 'Recovery day'} selected />
              </View>
              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: `${progress.percent}%` }]} />
              </View>
              <RNText style={styles.progressBody}>
                {progress.completed} of {progress.total} workouts completed.
              </RNText>
            </GlassPanel>
          ) : null}

          <GlassPanel style={styles.overviewCard}>
            <View style={styles.overviewGrid}>
              <View style={styles.metricBlock}>
                <MaterialSymbol name="schedule" size={18} color={DW_ACCENT_LIGHT} />
                <RNText style={styles.metricLabel}>Duration</RNText>
                <RNText style={styles.metricValue}>{plan.weeks.length} weeks</RNText>
              </View>
              <View style={styles.metricBlock}>
                <MaterialSymbol name="calendar_today" size={18} color={DW_ACCENT_LIGHT} />
                <RNText style={styles.metricLabel}>Frequency</RNText>
                <RNText style={styles.metricValue}>{getPlanFrequency(plan)} days / wk</RNText>
              </View>
              <View style={styles.metricBlock}>
                <MaterialSymbol name="fitness_center" size={18} color={DW_ACCENT_LIGHT} />
                <RNText style={styles.metricLabel}>Workouts</RNText>
                <RNText style={styles.metricValue}>{getPlanWorkoutCount(plan)}</RNText>
              </View>
            </View>
          </GlassPanel>

          <View style={styles.sectionHeader}>
            <SectionLabel accent={DW_ACCENT_LIGHT}>Week Schedule</SectionLabel>
            <RNText style={styles.sectionMeta}>Tap week cards to collapse</RNText>
          </View>

          {plan.weeks.map((week) => {
            const collapsed = collapsedWeeks.has(week.week_number);
            return (
              <GlassPanel key={week.week_number} style={styles.weekCard}>
                <Pressable onPress={() => toggleWeek(week.week_number)} style={styles.weekHeader}>
                  <View>
                    <RNText style={styles.weekTitle}>Week {week.week_number}</RNText>
                    <RNText style={styles.weekBody}>
                      {week.days.filter((day) => !day.rest_day && day.workout_id).length} training days
                    </RNText>
                  </View>
                  <MaterialSymbol
                    name={collapsed ? 'chevron_right' : 'expand_more'}
                    size={20}
                    color="rgba(228, 225, 233, 0.48)"
                  />
                </Pressable>

                {!collapsed ? (
                  <View style={styles.weekDays}>
                    {week.days.map((day, index) => {
                      const workout = day.workout_id ? state.workoutsById[day.workout_id] : null;
                      const isToday = isSubscribed &&
                        position?.weekNumber === week.week_number &&
                        position.dayIndex === index;
                      const isDone = Boolean(day.workout_id && state.completedWorkoutIds.has(day.workout_id));

                      return (
                        <Pressable
                          key={`${week.week_number}-${day.day_number}`}
                          onPress={() => {
                            if (day.workout_id) {
                              router.push(`/(root)/session?workoutId=${day.workout_id}` as never);
                            }
                          }}
                          style={[
                            styles.dayRow,
                            isToday && styles.dayRowCurrent,
                          ]}
                        >
                          <View style={[
                            styles.dayIndicator,
                            day.rest_day && styles.dayIndicatorRest,
                            isDone && styles.dayIndicatorDone,
                          ]}>
                            <MaterialSymbol
                              name={day.rest_day ? 'hotel' : isDone ? 'check_circle' : isToday ? 'play_arrow' : 'fitness_center'}
                              size={18}
                              color={day.rest_day ? 'rgba(214, 195, 181, 0.42)' : isDone ? DW_ON_ACCENT : DW_ACCENT_LIGHT}
                            />
                          </View>
                          <View style={{ flex: 1 }}>
                            <RNText style={styles.dayLabel}>Day {index + 1}</RNText>
                            <RNText style={styles.dayTitle}>{day.rest_day ? 'Rest Day' : workout?.title ?? 'Workout Slot'}</RNText>
                            <RNText style={styles.dayBody}>
                              {day.rest_day
                                ? 'Recovery'
                                : `${workout?.exercises.length ?? 0} exercises${isToday ? ' • Today' : isDone ? ' • Completed' : ''}`}
                            </RNText>
                          </View>
                          {!day.rest_day ? (
                            <MaterialSymbol name="chevron_right" size={18} color="rgba(228, 225, 233, 0.36)" />
                          ) : null}
                        </Pressable>
                      );
                    })}
                  </View>
                ) : null}
              </GlassPanel>
            );
          })}

          <GlassPanel style={styles.aboutCard}>
            <SectionLabel accent={DW_ACCENT_LIGHT}>About</SectionLabel>
            <RNText style={styles.aboutBody}>
              {plan.description || 'A structured progression block built for focused, repeatable weekly training.'}
            </RNText>
            <View style={styles.aboutList}>
              <RNText style={styles.aboutItem}>Goal: {formatDifficultyLabel(difficulty)} progression with consistent weekly volume.</RNText>
              <RNText style={styles.aboutItem}>
                Equipment: {equipmentSummary.length > 0 ? equipmentSummary.join(', ') : 'Bodyweight + mixed tools'}
              </RNText>
              <RNText style={styles.aboutItem}>Workout count: {getPlanWorkoutCount(plan)} programmed sessions.</RNText>
            </View>
          </GlassPanel>
        </View>
      </ScrollView>

      <StickyActionBar
        primaryLabel={
          !isSubscribed
            ? 'Subscribe'
            : todaysSchedule?.workout_id
              ? 'Continue Today'
              : 'Recovery Day'
        }
        primaryIcon={!isSubscribed ? 'check_circle' : todaysSchedule?.workout_id ? 'play_arrow' : 'hotel'}
        onPrimary={handlePrimaryAction}
        secondaryLabel={isSubscribed ? 'Unsubscribe' : undefined}
        onSecondary={isSubscribed ? handleUnsubscribe : undefined}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: WK_SURFACES.base,
  },
  content: {
    paddingBottom: 108,
  },
  body: {
    paddingHorizontal: 24,
    gap: 22,
  },
  headerIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: WK_SURFACES.low,
  },
  errorCard: {
    padding: 20,
  },
  errorTitle: {
    fontFamily: WK_FONTS.bold,
    fontSize: 20,
    lineHeight: 24,
    color: '#E4E1E9',
  },
  errorBody: {
    marginTop: 8,
    fontFamily: WK_FONTS.regular,
    fontSize: 14,
    lineHeight: 22,
    color: 'rgba(214, 195, 181, 0.72)',
  },
  heroWrap: {
    position: 'relative',
  },
  heroOverlay: {
    position: 'absolute',
    left: 18,
    right: 18,
    bottom: 18,
    gap: 10,
  },
  heroTitle: {
    fontFamily: WK_FONTS.extraBold,
    fontSize: 34,
    lineHeight: 36,
    letterSpacing: -1,
    color: '#E4E1E9',
  },
  heroChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  progressCard: {
    gap: 12,
    padding: 18,
  },
  progressHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  progressTitle: {
    marginTop: 4,
    fontFamily: WK_FONTS.bold,
    fontSize: 18,
    lineHeight: 22,
    color: '#E4E1E9',
  },
  progressTrack: {
    height: 10,
    borderRadius: 999,
    overflow: 'hidden',
    backgroundColor: WK_SURFACES.highest,
  },
  progressFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: DW_ACCENT,
  },
  progressBody: {
    fontFamily: WK_FONTS.regular,
    fontSize: 13,
    lineHeight: 18,
    color: 'rgba(214, 195, 181, 0.68)',
  },
  overviewCard: {
    padding: 18,
  },
  overviewGrid: {
    flexDirection: 'row',
    gap: 10,
  },
  metricBlock: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
    paddingVertical: 16,
    borderRadius: 20,
    backgroundColor: WK_SURFACES.low,
  },
  metricLabel: {
    fontFamily: WK_FONTS.medium,
    fontSize: 10,
    lineHeight: 12,
    letterSpacing: 1.1,
    textTransform: 'uppercase',
    color: 'rgba(214, 195, 181, 0.52)',
  },
  metricValue: {
    fontFamily: WK_FONTS.bold,
    fontSize: 14,
    lineHeight: 18,
    color: '#E4E1E9',
    textAlign: 'center',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  sectionMeta: {
    fontFamily: WK_FONTS.medium,
    fontSize: 11,
    lineHeight: 14,
    color: 'rgba(214, 195, 181, 0.46)',
  },
  weekCard: {
    gap: 16,
    padding: 18,
  },
  weekHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  weekTitle: {
    fontFamily: WK_FONTS.bold,
    fontSize: 18,
    lineHeight: 22,
    color: '#E4E1E9',
  },
  weekBody: {
    marginTop: 4,
    fontFamily: WK_FONTS.regular,
    fontSize: 12,
    lineHeight: 18,
    color: 'rgba(214, 195, 181, 0.66)',
  },
  weekDays: {
    gap: 10,
  },
  dayRow: {
    minHeight: 72,
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderRadius: 24,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: WK_SURFACES.low,
  },
  dayRowCurrent: {
    backgroundColor: WK_SURFACES.high,
  },
  dayIndicator: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: WK_SURFACES.highest,
  },
  dayIndicatorRest: {
    backgroundColor: WK_SURFACES.low,
  },
  dayIndicatorDone: {
    backgroundColor: DW_ACCENT_LIGHT,
  },
  dayLabel: {
    fontFamily: WK_FONTS.medium,
    fontSize: 10,
    lineHeight: 12,
    letterSpacing: 1.1,
    textTransform: 'uppercase',
    color: DW_ACCENT_LIGHT,
  },
  dayTitle: {
    marginTop: 4,
    fontFamily: WK_FONTS.semiBold,
    fontSize: 14,
    lineHeight: 18,
    color: '#E4E1E9',
  },
  dayBody: {
    marginTop: 4,
    fontFamily: WK_FONTS.regular,
    fontSize: 12,
    lineHeight: 18,
    color: 'rgba(214, 195, 181, 0.66)',
  },
  aboutCard: {
    gap: 10,
    padding: 18,
  },
  aboutBody: {
    fontFamily: WK_FONTS.regular,
    fontSize: 14,
    lineHeight: 22,
    color: 'rgba(214, 195, 181, 0.74)',
  },
  aboutList: {
    gap: 6,
  },
  aboutItem: {
    fontFamily: WK_FONTS.regular,
    fontSize: 13,
    lineHeight: 20,
    color: 'rgba(214, 195, 181, 0.66)',
  },
});
