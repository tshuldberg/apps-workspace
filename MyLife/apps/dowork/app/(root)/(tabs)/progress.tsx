// DoWork progress tab — session history + simple streak summary.
//
// Computes streak / volume / history inline from camelCase
// `WorkoutSession[]` rather than going through the snake_case
// `ProgressSession`-shaped helpers in `@mylife/workouts`. The full
// progress.ts engine path is a P5 polish item that needs a row-format
// adapter; for v1 the inline math is good enough.

import { useCallback, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import {
  StatCard,
  WK_FONTS,
  deleteWorkoutSession,
  getWorkoutSessions,
  getWorkouts,
  type WorkoutDefinition,
  type WorkoutSession,
} from '@mylife/workouts';
import { useDatabase } from '../providers/DatabaseProvider';
import { resolveRepeatWorkout } from '../../../lib/workouts/run-repeat';
import { DW_BORDER, DW_SURFACES, DW_TEXT } from '../theme/tokens';
import {
  WorkoutHero,
  WorkoutSectionHeader,
  WorkoutTabScrollView,
  formatDateLabel,
  formatVolume,
} from './_screen-kit';

interface HistoryEntry {
  sessionId: string;
  workoutId: string;
  workoutTitle: string;
  completedAt: string;
  exercisesCompleted: number;
}

interface ProgressViewModel {
  currentStreak: number;
  longestStreak: number;
  totalReps: number;
  history: HistoryEntry[];
}

const DAY_MS = 86_400_000;

// Finished analytics + tool screens that previously had no navigation
// entry point (audit M4). The Toolbox is their front door.
const TOOLBOX: Array<{ title: string; hint: string; route: string }> = [
  { title: 'Calendar History', hint: 'Heatmap + weekly recaps', route: '/(root)/history' },
  { title: 'Insights', hint: 'Consistency + timing analysis', route: '/(root)/insights' },
  { title: 'Monthly Report', hint: 'Sessions by calendar month', route: '/(root)/monthly-report' },
  { title: 'Progress Photos', hint: 'Compare by date + pose', route: '/(root)/photos' },
  { title: 'Measurements', hint: 'Body metrics over time', route: '/(root)/measurements' },
  { title: 'Form Recordings', hint: 'Your saved lift videos', route: '/(root)/recordings' },
  { title: 'Plate Loader', hint: 'Plates per side for a target weight', route: '/(root)/plate-loader' },
  { title: '1RM Tracker', hint: 'Log + save your maxes', route: '/(root)/one-rm' },
  { title: 'Overload Tracker', hint: 'Progressive overload presets', route: '/(root)/overload' },
  { title: 'Top Exercises', hint: 'Frequency by movement', route: '/(root)/main-exercises' },
  { title: 'AI Workout', hint: 'Generate a workout by goal', route: '/(root)/generate' },
  { title: 'GPS Workout', hint: 'Route, pace + elevation', route: '/(root)/gps' },
  { title: 'Recovery', hint: 'Muscle readiness heatmap', route: '/(root)/recovery' },
  { title: 'Body Map', hint: 'Fatigue by muscle group', route: '/(root)/body-map' },
];

function computeStreaks(sessions: WorkoutSession[]): { current: number; longest: number } {
  const days = new Set<number>();
  for (const session of sessions) {
    if (!session.completedAt) continue;
    const ms = Date.parse(session.completedAt);
    if (!Number.isFinite(ms)) continue;
    days.add(Math.floor(ms / DAY_MS));
  }
  if (days.size === 0) return { current: 0, longest: 0 };

  const sorted = Array.from(days).sort((a, b) => b - a);
  const todayEpochDay = Math.floor(Date.now() / DAY_MS);
  const streakActive = sorted[0] === todayEpochDay || sorted[0] === todayEpochDay - 1;

  let current = 0;
  let longest = 1;
  let streak = 1;

  for (let i = 1; i < sorted.length; i += 1) {
    const diff = sorted[i - 1] - sorted[i];
    if (diff === 1) {
      streak += 1;
    } else {
      longest = Math.max(longest, streak);
      streak = 1;
    }
  }

  longest = Math.max(longest, streak);
  if (streakActive) current = streak;
  return { current, longest };
}

function computeTotalReps(sessions: WorkoutSession[]): number {
  let total = 0;
  for (const session of sessions) {
    for (const exercise of session.exercisesCompleted) {
      if (exercise.skipped) continue;
      total += exercise.repsCompleted ?? 0;
    }
  }
  return total;
}

function buildHistoryEntries(
  sessions: WorkoutSession[],
  workouts: WorkoutDefinition[],
): HistoryEntry[] {
  const titles = Object.fromEntries(workouts.map((w) => [w.id, w.title] as const));
  const entries: HistoryEntry[] = [];
  for (const session of sessions) {
    if (!session.completedAt) continue;
    let count = 0;
    for (const ex of session.exercisesCompleted) {
      if (!ex.skipped) count += 1;
    }
    entries.push({
      sessionId: session.id,
      workoutId: session.workoutId,
      workoutTitle: session.title?.trim() || titles[session.workoutId] || 'Workout',
      completedAt: session.completedAt,
      exercisesCompleted: count,
    });
  }
  entries.sort((a, b) => Date.parse(b.completedAt) - Date.parse(a.completedAt));
  return entries;
}

export default function ProgressScreen() {
  const db = useDatabase();
  const router = useRouter();
  const [view, setView] = useState<ProgressViewModel | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const refresh = useCallback(() => {
    const sessions = getWorkoutSessions(db, { onlyCompleted: true, limit: 365 });
    const workouts = getWorkouts(db);
    const streaks = computeStreaks(sessions);
    setView({
      currentStreak: streaks.current,
      longestStreak: streaks.longest,
      totalReps: computeTotalReps(sessions),
      history: buildHistoryEntries(sessions, workouts),
    });
  }, [db]);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    refresh();
    setTimeout(() => setRefreshing(false), 300);
  }, [refresh]);

  const repeatSession = useCallback(
    (entry: HistoryEntry) => {
      const result = resolveRepeatWorkout(db, entry.sessionId, entry.workoutTitle);
      if (!result.ok || !result.workoutId) {
        Alert.alert('Unable to repeat', result.reason ?? 'That session could not be repeated.');
        return;
      }
      router.push(`/(root)/session?workoutId=${result.workoutId}` as never);
    },
    [db, router],
  );

  const confirmDeleteSession = useCallback(
    (entry: HistoryEntry) => {
      Alert.alert(
        'Delete this session?',
        `"${entry.workoutTitle}" from ${formatDateLabel(entry.completedAt)} will be removed from your history, along with its logged sets. This cannot be undone.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: () => {
              deleteWorkoutSession(db, entry.sessionId);
              refresh();
            },
          },
        ],
      );
    },
    [db, refresh],
  );

  const openHistoryMenu = useCallback(
    (entry: HistoryEntry) => {
      Alert.alert(entry.workoutTitle, formatDateLabel(entry.completedAt), [
        { text: 'Repeat this workout', onPress: () => repeatSession(entry) },
        {
          text: 'Delete session',
          style: 'destructive',
          onPress: () => confirmDeleteSession(entry),
        },
        { text: 'Cancel', style: 'cancel' },
      ]);
    },
    [confirmDeleteSession, repeatSession],
  );

  const mostRecent = view?.history[0] ?? null;

  return (
    <WorkoutTabScrollView refreshing={refreshing} onRefresh={onRefresh}>
      <WorkoutHero
        title="Progress"
        subtitle={view ? `${view.currentStreak}-day streak` : 'Loading…'}
      />

      <View style={styles.statRow}>
        <StatCard
          label="Current"
          value={view ? view.currentStreak.toString() : '—'}
          suffix="days"
        />
        <StatCard
          label="Longest"
          value={view ? view.longestStreak.toString() : '—'}
          suffix="days"
        />
        <StatCard
          label="Total reps"
          value={view ? formatVolume(view.totalReps) : '—'}
          suffix="reps"
        />
      </View>

      <WorkoutSectionHeader title="Toolbox" />
      <View style={styles.toolGrid}>
        {TOOLBOX.map((tool) => (
          <Pressable
            key={tool.route}
            style={({ pressed }) => [styles.toolCard, pressed && { opacity: 0.86 }]}
            onPress={() => router.push(tool.route as never)}
          >
            <Text style={styles.toolTitle}>{tool.title}</Text>
            <Text style={styles.toolHint}>{tool.hint}</Text>
          </Pressable>
        ))}
      </View>

      {mostRecent ? (
        <View style={styles.quickRepeatWrap}>
          <Pressable
            style={({ pressed }) => [styles.quickRepeat, pressed && { opacity: 0.86 }]}
            onPress={() => repeatSession(mostRecent)}
            accessibilityRole="button"
            accessibilityLabel={`Repeat last session: ${mostRecent.workoutTitle}`}
          >
            <View style={styles.quickRepeatText}>
              <Text style={styles.quickRepeatLabel}>REPEAT LAST SESSION</Text>
              <Text style={styles.quickRepeatTitle} numberOfLines={1}>
                {mostRecent.workoutTitle}
              </Text>
            </View>
            <Text style={styles.quickRepeatGo}>Start</Text>
          </Pressable>
        </View>
      ) : null}

      <WorkoutSectionHeader
        title="History"
        trailing={
          view && view.history.length > 0 ? (
            <Text style={styles.hint}>Long press for options</Text>
          ) : null
        }
      />

      {view && view.history.length > 0 ? (
        <View style={styles.list}>
          {view.history.slice(0, 20).map((entry) => (
            <Pressable
              key={entry.sessionId}
              style={({ pressed }) => [styles.row, pressed && { opacity: 0.86 }]}
              onPress={() => openHistoryMenu(entry)}
              onLongPress={() => openHistoryMenu(entry)}
              delayLongPress={300}
              accessibilityRole="button"
              accessibilityLabel={`${entry.workoutTitle} on ${formatDateLabel(entry.completedAt)}. Repeat or delete.`}
            >
              <Text style={styles.rowTitle}>{entry.workoutTitle}</Text>
              <Text style={styles.rowMeta}>
                {formatDateLabel(entry.completedAt)} · {entry.exercisesCompleted} exercises
              </Text>
            </Pressable>
          ))}
        </View>
      ) : (
        <View style={styles.emptyHint}>
          <Text style={styles.emptyText}>
            Complete a workout to start your streak.
          </Text>
        </View>
      )}
    </WorkoutTabScrollView>
  );
}

const styles = StyleSheet.create({
  statRow: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    gap: 10,
  },
  toolGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 20,
    gap: 8,
  },
  toolCard: {
    flexBasis: '48%',
    flexGrow: 1,
    backgroundColor: DW_SURFACES.low,
    borderColor: DW_BORDER.subtle,
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    gap: 3,
  },
  toolTitle: {
    fontFamily: WK_FONTS.semiBold,
    fontSize: 13.5,
    color: DW_TEXT.primary,
  },
  toolHint: {
    fontFamily: WK_FONTS.regular,
    fontSize: 11,
    color: DW_TEXT.tertiary,
  },
  list: {
    paddingHorizontal: 20,
    gap: 8,
  },
  row: {
    backgroundColor: DW_SURFACES.low,
    borderColor: DW_BORDER.subtle,
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    gap: 4,
  },
  rowTitle: {
    fontFamily: WK_FONTS.semiBold,
    fontSize: 15,
    color: DW_TEXT.primary,
  },
  rowMeta: {
    fontFamily: WK_FONTS.regular,
    fontSize: 12,
    color: DW_TEXT.tertiary,
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
  quickRepeatWrap: {
    paddingHorizontal: 20,
  },
  quickRepeat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 16,
    backgroundColor: DW_SURFACES.low,
    borderWidth: 1,
    borderColor: 'rgba(255, 139, 51, 0.28)',
  },
  quickRepeatText: {
    flex: 1,
    gap: 2,
  },
  quickRepeatLabel: {
    fontFamily: WK_FONTS.semiBold,
    fontSize: 10,
    color: DW_TEXT.tertiary,
    letterSpacing: 1.4,
  },
  quickRepeatTitle: {
    fontFamily: WK_FONTS.bold,
    fontSize: 16,
    color: DW_TEXT.primary,
  },
  quickRepeatGo: {
    fontFamily: WK_FONTS.bold,
    fontSize: 13,
    color: '#FF8B33',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  hint: {
    fontFamily: WK_FONTS.regular,
    fontSize: 11,
    color: DW_TEXT.tertiary,
    textTransform: 'none',
    letterSpacing: 0,
  },
});
