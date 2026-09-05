import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View, Pressable } from 'react-native';
import { Text, Card, colors, spacing } from '@mylife/ui';
import { getWorkoutSessions } from '@mylife/workouts';
import { useDatabase } from './providers/DatabaseProvider';
import { DW_ACCENT } from './theme/tokens';

const ACCENT = DW_ACCENT;
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function getMonthDays(year: number, month: number) {
  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);
  return { firstDayOfWeek: first.getDay(), daysInMonth: last.getDate() };
}

export default function MonthlyReportScreen() {
  const db = useDatabase();
  const now = new Date();
  const [monthOffset, setMonthOffset] = useState(0);

  const viewDate = useMemo(() => {
    const d = new Date(now.getFullYear(), now.getMonth() + monthOffset, 1);
    return d;
  }, [monthOffset]);

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const monthName = viewDate.toLocaleString('default', { month: 'long' });

  const sessions = useMemo(
    () => getWorkoutSessions(db, { onlyCompleted: true }),
    [db],
  );

  const workoutDays = useMemo(() => {
    const days = new Set<string>();
    for (const s of sessions) {
      if (!s.completedAt) continue;
      const d = new Date(s.completedAt);
      if (d.getFullYear() === year && d.getMonth() === month) {
        days.add(String(d.getDate()));
      }
    }
    return days;
  }, [sessions, year, month]);

  const { firstDayOfWeek, daysInMonth } = getMonthDays(year, month);

  // Week streak calculation (computed inline from camelCase WorkoutSession[]
  // per DoWork P5 §3.6 — no progress.ts engine usage).
  const weekStreak = useMemo(() => {
    let streak = 0;
    const weekEnd = new Date();
    let checking = true;
    while (checking) {
      const weekStart = new Date(weekEnd);
      weekStart.setDate(weekEnd.getDate() - weekEnd.getDay());
      weekStart.setHours(0, 0, 0, 0);
      const weekEndDate = new Date(weekStart);
      weekEndDate.setDate(weekStart.getDate() + 7);

      const hasWorkout = sessions.some((s) => {
        if (!s.completedAt) return false;
        const d = new Date(s.completedAt);
        return d >= weekStart && d < weekEndDate;
      });

      if (hasWorkout) {
        streak++;
        weekEnd.setDate(weekEnd.getDate() - 7);
      } else {
        checking = false;
      }
    }
    return streak;
  }, [sessions]);

  // Exercise frequency for the visible month.
  const muscleFreq = useMemo(() => {
    const freq: Record<string, number> = {};
    for (const s of sessions) {
      if (!s.completedAt) continue;
      const d = new Date(s.completedAt);
      if (d.getFullYear() !== year || d.getMonth() !== month) continue;
      for (const ex of s.exercisesCompleted ?? []) {
        const id = ex.exerciseId;
        freq[id] = (freq[id] ?? 0) + 1;
      }
    }
    return freq;
  }, [sessions, year, month]);

  const totalWorkouts = workoutDays.size;
  const topExercises = Object.entries(muscleFreq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  const calendarCells = [];
  for (let i = 0; i < firstDayOfWeek; i++) {
    calendarCells.push(<View key={`pad-${i}`} style={styles.calCell} />);
  }
  for (let day = 1; day <= daysInMonth; day++) {
    const isWorkout = workoutDays.has(String(day));
    const isToday = day === now.getDate() && month === now.getMonth() && year === now.getFullYear();
    calendarCells.push(
      <View
        key={day}
        style={[
          styles.calCell,
          isWorkout && styles.calWorkout,
          isToday && styles.calToday,
        ]}
      >
        <Text
          variant="caption"
          color={isWorkout ? colors.background : colors.textSecondary}
          style={isToday ? styles.todayText : undefined}
        >
          {day}
        </Text>
      </View>,
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.monthNav}>
        <Pressable onPress={() => setMonthOffset((v) => v - 1)}>
          <Text variant="body" color={ACCENT}>{'<'}</Text>
        </Pressable>
        <Text variant="heading">{monthName} {year}</Text>
        <Pressable onPress={() => setMonthOffset((v) => v + 1)}>
          <Text variant="body" color={ACCENT}>{'>'}</Text>
        </Pressable>
      </View>

      <Card style={styles.card}>
        <View style={styles.streakRow}>
          <Text style={styles.streakIcon}>🔥</Text>
          <Text variant="subheading">{weekStreak} Week Streak</Text>
        </View>
      </Card>

      <Card style={styles.card}>
        <Text variant="subheading">Workout Days</Text>
        <Text variant="caption" color={colors.textSecondary}>
          {totalWorkouts} workouts this month
        </Text>
        <View style={styles.calHeader}>
          {DAYS.map((d) => (
            <View key={d} style={styles.calCell}>
              <Text variant="caption" color={colors.textTertiary}>{d}</Text>
            </View>
          ))}
        </View>
        <View style={styles.calGrid}>
          {calendarCells}
        </View>
      </Card>

      {topExercises.length > 0 && (
        <Card style={styles.card}>
          <Text variant="subheading">Top Exercises</Text>
          {topExercises.map(([id, count]) => (
            <View key={id} style={styles.exerciseRow}>
              <Text variant="body" color={colors.text} numberOfLines={1} style={styles.exerciseName}>
                {id}
              </Text>
              <Text variant="caption" color={colors.textSecondary}>
                {count}x
              </Text>
            </View>
          ))}
        </Card>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, gap: spacing.md, paddingBottom: spacing.xxl },
  monthNav: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: spacing.sm,
  },
  card: { gap: spacing.sm },
  streakRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  streakIcon: { fontSize: 28 },
  calHeader: { flexDirection: 'row' },
  calGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  calCell: {
    width: `${100 / 7}%`, aspectRatio: 1, alignItems: 'center', justifyContent: 'center',
  },
  calWorkout: {
    backgroundColor: ACCENT, borderRadius: 999,
  },
  calToday: {
    borderWidth: 2, borderColor: ACCENT, borderRadius: 999,
  },
  todayText: { fontWeight: '700' },
  exerciseRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: spacing.xs, borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  exerciseName: { flex: 1, marginRight: spacing.sm },
});
