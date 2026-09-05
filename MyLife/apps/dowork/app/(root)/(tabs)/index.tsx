// DoWork home tab.
//
// Streamlined adaptation of apps/mobile/app/(workouts)/(tabs)/index.tsx.
// Uses real workout module data (dashboard, sessions, recovery) so the
// app boots into a useful state. Cross-module insight chips are stripped
// per the DoWork v1 plan.

import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { ChevronRight, Dumbbell, Plus } from 'lucide-react-native';
import {
  GlassPanel,
  StatCard,
  WK_FONTS,
  buildRecoveryMap,
  getActivePlanSubscription,
  getBestToTrain,
  getCurrentPlanPosition,
  getTodaysWorkout,
  getWorkoutDashboard,
  getWorkoutPlans,
  getWorkoutSessions,
  getWorkouts,
  seedWorkoutExerciseLibrary,
  MUSCLE_GROUP_LABELS,
  type WorkoutPlan,
  type WorkoutSession,
} from '@mylife/workouts';
import { useDatabase } from '../providers/DatabaseProvider';
import { useDoWorkCloud } from '../providers/DoWorkCloudProvider';
import { resolveRepeatWorkout } from '../../../lib/workouts/run-repeat';
import { listMyClientLinks } from '../data/cloud-coaching';
import { DW_ACCENT, DW_BORDER, DW_ON_ACCENT, DW_SURFACES, DW_TEXT } from '../theme/tokens';
import {
  WorkoutHero,
  WorkoutSectionHeader,
  WorkoutTabScrollView,
  formatDateLabel,
  formatMinutes,
  formatVolume,
} from './_screen-kit';

interface HomeViewModel {
  sessionsThisWeek: number;
  weekVolume: number;
  totalSessions: number;
  recentSessions: Array<{
    id: string;
    workoutId: string;
    title: string;
    dateLabel: string;
    durationLabel: string;
  }>;
  upcomingTitle: string | null;
  upcomingSubtitle: string | null;
  recoveryFresh: Array<{ label: string; score: number }>;
}

function buildHomeView(db: ReturnType<typeof useDatabase>): HomeViewModel {
  seedWorkoutExerciseLibrary(db);

  const dashboard = getWorkoutDashboard(db);
  const sessions = getWorkoutSessions(db, { onlyCompleted: true, limit: 12 });
  const workouts = getWorkouts(db);
  const plans = getWorkoutPlans(db);
  const activeSubscription = getActivePlanSubscription(db);

  const now = Date.now();
  const weekMs = 7 * 24 * 60 * 60 * 1000;
  const sessionsThisWeek = sessions.filter((session) => {
    if (!session.completedAt) return false;
    return now - new Date(session.completedAt).getTime() < weekMs;
  }).length;

  const weekVolume = sessions
    .filter((session) => {
      if (!session.completedAt) return false;
      return now - new Date(session.completedAt).getTime() < weekMs;
    })
    .reduce((sum, session) => {
      return sum + session.exercisesCompleted.reduce((s, ex) => s + (ex.repsCompleted ?? 0) * 10, 0);
    }, 0);

  const workoutMap = Object.fromEntries(workouts.map((w) => [w.id, w] as const));
  const recentSessions = sessions.slice(0, 3).map((session) => {
    const startMs = new Date(session.startedAt).getTime();
    const endMs = session.completedAt ? new Date(session.completedAt).getTime() : startMs;
    const durationSeconds = Math.max(0, Math.round((endMs - startMs) / 1000));
    return {
      id: session.id,
      workoutId: session.workoutId,
      title: workoutMap[session.workoutId]?.title ?? 'Workout',
      dateLabel: formatDateLabel(session.completedAt ?? null),
      durationLabel: formatMinutes(durationSeconds),
    };
  });

  let upcomingTitle: string | null = null;
  let upcomingSubtitle: string | null = null;
  const activePlan = activeSubscription
    ? plans.find((plan: WorkoutPlan) => plan.id === activeSubscription.planId) ?? null
    : null;
  if (activePlan && activeSubscription) {
    const position = getCurrentPlanPosition(activePlan, activeSubscription.startedAt);
    const todays = getTodaysWorkout(activePlan, activeSubscription.startedAt);
    if (todays.workoutId) {
      const planWorkout = workoutMap[todays.workoutId];
      upcomingTitle = planWorkout?.title ?? activePlan.title;
      upcomingSubtitle = `Week ${position.weekNumber} · Day ${position.dayIndex + 1}`;
    } else if (todays.restDay) {
      upcomingTitle = 'Rest day';
      upcomingSubtitle = todays.notes ?? `Week ${position.weekNumber}`;
    } else {
      upcomingTitle = activePlan.title;
      upcomingSubtitle = `Week ${position.weekNumber}`;
    }
  }

  const recoveryMap = buildRecoveryMapFromSessions(sessions, workouts);
  const recoveryFresh = Array.from(recoveryMap.values())
    .filter((item) => item.muscleGroup !== 'full_body')
    .sort((a, b) => b.score - a.score)
    .slice(0, 4)
    .map((item) => ({ label: MUSCLE_GROUP_LABELS[item.muscleGroup], score: item.score }));

  void getBestToTrain(recoveryMap);
  void dashboard;

  return {
    sessionsThisWeek,
    weekVolume,
    totalSessions: sessions.length,
    recentSessions,
    upcomingTitle,
    upcomingSubtitle,
    recoveryFresh,
  };
}

function buildRecoveryMapFromSessions(
  sessions: WorkoutSession[],
  workouts: ReturnType<typeof getWorkouts>,
) {
  const workoutMap = Object.fromEntries(workouts.map((w) => [w.id, w] as const));
  const recoverySessions = sessions
    .filter((s) => s.completedAt)
    .map((session) => {
      const workout = workoutMap[session.workoutId];
      if (!workout || !session.completedAt) return null;
      return {
        sessionId: session.id,
        completedAt: session.completedAt,
        muscleVolume: [],
      };
    })
    .filter((item): item is NonNullable<typeof item> => item != null);

  return buildRecoveryMap(recoverySessions);
}

export default function HomeScreen() {
  const router = useRouter();
  const db = useDatabase();
  const { supabase, userId } = useDoWorkCloud();
  const [view, setView] = useState<HomeViewModel | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [trainerName, setTrainerName] = useState<string | null>(null);

  const refresh = useCallback(() => {
    try {
      setView(buildHomeView(db));
    } catch (err) {
      console.warn('[DoWork home] refresh failed', err);
    }
  }, [db]);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );

  // Surface the active-coaching card when the user is a client of a trainer.
  useEffect(() => {
    let mounted = true;
    void (async () => {
      if (!supabase || !userId) {
        if (mounted) setTrainerName(null);
        return;
      }
      const result = await listMyClientLinks(supabase, userId);
      if (!mounted) return;
      const active = result.ok ? result.links.find((l) => l.status === 'active') : undefined;
      setTrainerName(active?.trainer?.displayName ?? (active ? 'Your trainer' : null));
    })();
    return () => {
      mounted = false;
    };
  }, [supabase, userId]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    refresh();
    setTimeout(() => setRefreshing(false), 300);
  }, [refresh]);

  const repeatRecent = useCallback(
    (sessionId: string, title: string) => {
      const result = resolveRepeatWorkout(db, sessionId, title);
      if (!result.ok || !result.workoutId) {
        Alert.alert('Unable to repeat', result.reason ?? 'That session could not be repeated.');
        return;
      }
      router.push(`/(root)/session?workoutId=${result.workoutId}` as never);
    },
    [db, router],
  );

  return (
    <View style={styles.screen}>
      <WorkoutTabScrollView refreshing={refreshing} onRefresh={onRefresh}>
        <WorkoutHero
          title="DoWork"
          subtitle={view ? `${view.sessionsThisWeek} sessions this week` : 'Loading…'}
        />

        <View style={styles.statRow}>
          <StatCard
            label="This week"
            value={view ? view.sessionsThisWeek.toString() : '—'}
            suffix="sessions"
          />
          <StatCard
            label="Volume"
            value={view ? formatVolume(view.weekVolume) : '—'}
            suffix="reps·kg"
          />
          <StatCard
            label="All-time"
            value={view ? view.totalSessions.toString() : '—'}
            suffix="sessions"
          />
        </View>

        {trainerName ? (
          <Pressable
            style={({ pressed }) => [styles.trainerCard, pressed && { opacity: 0.9 }]}
            onPress={() => router.push('/(root)/my-trainer')}
            accessibilityRole="button"
            accessibilityLabel="Open your trainer"
          >
            <View style={styles.trainerIcon}>
              <Dumbbell size={18} color={DW_ACCENT} />
            </View>
            <View style={styles.trainerCardText}>
              <Text style={styles.trainerCardLabel}>YOUR TRAINER</Text>
              <Text style={styles.trainerCardName} numberOfLines={1}>
                {trainerName}
              </Text>
            </View>
            <ChevronRight size={20} color={DW_TEXT.tertiary} />
          </Pressable>
        ) : null}

        {view?.upcomingTitle ? (
          <GlassPanel style={styles.upcomingCard}>
            <Text style={styles.upcomingLabel}>UP NEXT</Text>
            <Text style={styles.upcomingTitle}>{view.upcomingTitle}</Text>
            {view.upcomingSubtitle ? (
              <Text style={styles.upcomingSubtitle}>{view.upcomingSubtitle}</Text>
            ) : null}
          </GlassPanel>
        ) : null}

        <WorkoutSectionHeader
          title="Recent"
          trailing={
            view && view.recentSessions.length > 0 ? (
              <Text style={styles.recentHint}>Tap to repeat</Text>
            ) : null
          }
        />
        {view && view.recentSessions.length > 0 ? (
          <View style={styles.recentList}>
            {view.recentSessions.map((session) => (
              <Pressable
                key={session.id}
                style={({ pressed }) => [styles.recentRow, pressed && { opacity: 0.86 }]}
                onPress={() => repeatRecent(session.id, session.title)}
                accessibilityRole="button"
                accessibilityLabel={`Repeat ${session.title}`}
              >
                <Text style={styles.recentTitle}>{session.title}</Text>
                <Text style={styles.recentMeta}>
                  {session.dateLabel} · {session.durationLabel}
                </Text>
              </Pressable>
            ))}
          </View>
        ) : (
          <View style={styles.emptyHint}>
            <Text style={styles.emptyText}>
              No completed workouts yet. Tap + to start your first.
            </Text>
          </View>
        )}

        {view && view.recoveryFresh.length > 0 ? (
          <>
            <WorkoutSectionHeader title="Recovered & ready" />
            <View style={styles.recoveryRow}>
              {view.recoveryFresh.map((item) => (
                <View key={item.label} style={styles.recoveryChip}>
                  <Text style={styles.recoveryChipLabel}>{item.label}</Text>
                </View>
              ))}
            </View>
          </>
        ) : null}
      </WorkoutTabScrollView>

      <Pressable
        style={({ pressed }) => [styles.fab, pressed && { opacity: 0.85 }]}
        onPress={() => router.push('/(root)/builder')}
        accessibilityRole="button"
        accessibilityLabel="Start workout"
      >
        <Plus color={DW_ON_ACCENT} size={28} strokeWidth={3} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: DW_SURFACES.base,
  },
  statRow: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    gap: 10,
  },
  trainerCard: {
    marginHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 16,
    backgroundColor: DW_SURFACES.low,
    borderWidth: 1,
    borderColor: 'rgba(255, 139, 51, 0.28)',
  },
  trainerIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 107, 0, 0.14)',
  },
  trainerCardText: {
    flex: 1,
    gap: 2,
  },
  trainerCardLabel: {
    fontFamily: WK_FONTS.semiBold,
    fontSize: 10,
    color: DW_TEXT.tertiary,
    letterSpacing: 1.4,
  },
  trainerCardName: {
    fontFamily: WK_FONTS.bold,
    fontSize: 16,
    color: DW_TEXT.primary,
  },
  upcomingCard: {
    marginHorizontal: 20,
    padding: 16,
    gap: 4,
  },
  upcomingLabel: {
    fontFamily: WK_FONTS.semiBold,
    fontSize: 10,
    color: DW_TEXT.tertiary,
    letterSpacing: 1.4,
  },
  upcomingTitle: {
    fontFamily: WK_FONTS.bold,
    fontSize: 20,
    color: DW_TEXT.primary,
  },
  upcomingSubtitle: {
    fontFamily: WK_FONTS.regular,
    fontSize: 13,
    color: DW_TEXT.secondary,
  },
  recentList: {
    paddingHorizontal: 20,
    gap: 8,
  },
  recentRow: {
    backgroundColor: DW_SURFACES.low,
    borderColor: DW_BORDER.subtle,
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    gap: 4,
  },
  recentTitle: {
    fontFamily: WK_FONTS.semiBold,
    fontSize: 15,
    color: DW_TEXT.primary,
  },
  recentMeta: {
    fontFamily: WK_FONTS.regular,
    fontSize: 12,
    color: DW_TEXT.tertiary,
  },
  recentHint: {
    fontFamily: WK_FONTS.regular,
    fontSize: 11,
    color: DW_TEXT.tertiary,
    textTransform: 'none',
    letterSpacing: 0,
  },
  emptyHint: {
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  emptyText: {
    fontFamily: WK_FONTS.regular,
    fontSize: 14,
    color: DW_TEXT.secondary,
    lineHeight: 20,
  },
  recoveryRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 20,
    gap: 8,
  },
  recoveryChip: {
    backgroundColor: DW_SURFACES.mid,
    borderColor: DW_BORDER.default,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  recoveryChipLabel: {
    fontFamily: WK_FONTS.semiBold,
    fontSize: 12,
    color: DW_TEXT.primary,
    letterSpacing: 0.4,
  },
  fab: {
    position: 'absolute',
    right: 24,
    bottom: 110,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: DW_ACCENT,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
});
