import { useMemo } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Text, Card, colors, spacing } from '@mylife/ui';
import { getWorkoutSessions, getWorkoutExercises } from '@mylife/workouts';
import { useDatabase } from './providers/DatabaseProvider';
import { DW_ACCENT } from './theme/tokens';

const ACCENT = DW_ACCENT;

export default function MainExercisesScreen() {
  const db = useDatabase();

  const sessions = useMemo(
    () => getWorkoutSessions(db, { onlyCompleted: true }),
    [db],
  );

  const exercises = useMemo(() => getWorkoutExercises(db), [db]);
  const exerciseMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const e of exercises) m.set(e.id, e.name);
    return m;
  }, [exercises]);

  const ranked = useMemo(() => {
    const freq: Record<string, number> = {};
    for (const s of sessions) {
      for (const ex of s.exercisesCompleted ?? []) {
        freq[ex.exerciseId] = (freq[ex.exerciseId] ?? 0) + 1;
      }
    }
    return Object.entries(freq)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
      .map(([id, count]) => ({ id, name: exerciseMap.get(id) ?? id, count }));
  }, [sessions, exerciseMap]);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text variant="heading">Main Exercises</Text>
      <Text variant="body" color={colors.textSecondary}>
        Exercises you do most often
      </Text>

      {ranked.length === 0 ? (
        <Card style={styles.emptyCard}>
          <Text variant="body" color={colors.textSecondary} style={styles.centered}>
            Complete some workouts to see your most frequent exercises.
          </Text>
        </Card>
      ) : (
        ranked.map((ex, i) => (
          <Card key={ex.id} style={styles.row}>
            <View style={styles.rank}>
              <Text style={styles.rankNum}>{i + 1}</Text>
            </View>
            <View style={styles.info}>
              <Text variant="body">{ex.name}</Text>
              <Text variant="caption" color={colors.textSecondary}>
                {ex.count} {ex.count === 1 ? 'session' : 'sessions'}
              </Text>
            </View>
            <Text style={styles.countBadge}>{ex.count}x</Text>
          </Card>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, gap: spacing.sm, paddingBottom: spacing.xxl },
  emptyCard: { padding: spacing.xl, alignItems: 'center' },
  centered: { textAlign: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  rank: {
    width: 32, height: 32, borderRadius: 16, backgroundColor: ACCENT + '22',
    alignItems: 'center', justifyContent: 'center',
  },
  rankNum: { fontSize: 14, fontWeight: '700', color: ACCENT },
  info: { flex: 1, gap: 2 },
  countBadge: { fontSize: 16, fontWeight: '700', color: ACCENT },
});
