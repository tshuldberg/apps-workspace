import { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Switch, View } from 'react-native';
import { getWorkouts, getWorkoutSessions, type WorkoutDefinition } from '@mylife/workouts';
import { Text, colors, spacing } from '@mylife/ui';
import { useDatabase } from '../../components/DatabaseProvider';

const ACCENT = colors.modules.workouts;

export default function ShareScreen() {
  const db = useDatabase();
  const [workouts, setWorkouts] = useState<WorkoutDefinition[]>([]);
  const [selected, setSelected] = useState<WorkoutDefinition | null>(null);
  const [showPRs, setShowPRs] = useState(true);
  const [showVolume, setShowVolume] = useState(true);
  const [showDuration, setShowDuration] = useState(true);

  useEffect(() => {
    const w = getWorkouts(db, { limit: 10 });
    setWorkouts(w);
    if (w.length > 0 && !selected) setSelected(w[0]);
  }, [db]);

  const previewData = useMemo(() => {
    if (!selected) return null;
    const sessions = getWorkoutSessions(db, { onlyCompleted: true, limit: 5 });
    const latest = sessions.find((s) => s.workoutId === selected.id);
    const startMs = latest ? Date.parse(latest.startedAt) : 0;
    const endMs = latest?.completedAt ? Date.parse(latest.completedAt) : startMs;
    const mins = endMs > startMs ? Math.round((endMs - startMs) / 60000) : Math.round(selected.estimatedDuration / 60);
    const totalReps = latest
      ? latest.exercisesCompleted.reduce((sum, e) => sum + (e.skipped ? 0 : (e.repsCompleted ?? 0)), 0)
      : 0;

    return {
      title: selected.title,
      exercises: selected.exercises.length,
      duration: mins,
      volume: totalReps,
      date: latest?.completedAt ? new Date(latest.completedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Today',
    };
  }, [db, selected]);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text variant="heading">Share Workout</Text>

      {/* Workout selector */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.selectorScroll}>
        <View style={styles.selectorRow}>
          {workouts.map((w) => (
            <Pressable
              key={w.id}
              style={[styles.selectorItem, selected?.id === w.id && styles.selectorActive]}
              onPress={() => setSelected(w)}
            >
              <Text variant="caption" color={selected?.id === w.id ? colors.text : colors.textSecondary} numberOfLines={1}>
                {w.title}
              </Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>

      {/* Preview card */}
      {previewData ? (
        <View style={styles.previewCard}>
          <Text variant="heading" style={{ fontSize: 20, lineHeight: 26 }}>{previewData.title}</Text>
          <Text variant="caption" color={colors.textSecondary}>{previewData.date}</Text>

          <View style={styles.statsGrid}>
            {showDuration && (
              <View style={styles.statBox}>
                <Text variant="heading" style={{ fontSize: 24, lineHeight: 30, color: ACCENT }}>{previewData.duration}</Text>
                <Text variant="caption" color={colors.textSecondary}>min</Text>
              </View>
            )}
            {showVolume && previewData.volume > 0 && (
              <View style={styles.statBox}>
                <Text variant="heading" style={{ fontSize: 24, lineHeight: 30, color: ACCENT }}>{previewData.volume}</Text>
                <Text variant="caption" color={colors.textSecondary}>reps</Text>
              </View>
            )}
            <View style={styles.statBox}>
              <Text variant="heading" style={{ fontSize: 24, lineHeight: 30, color: ACCENT }}>{previewData.exercises}</Text>
              <Text variant="caption" color={colors.textSecondary}>exercises</Text>
            </View>
          </View>

          {showPRs && (
            <Text variant="caption" color={colors.textTertiary} style={{ marginTop: spacing.xs }}>
              No PRs detected for this workout
            </Text>
          )}
        </View>
      ) : (
        <View style={styles.card}>
          <Text variant="body" color={colors.textSecondary} style={{ textAlign: 'center' }}>
            Select a workout to preview your share card
          </Text>
        </View>
      )}

      {/* Customization */}
      <View style={styles.card}>
        <Text variant="label" color={colors.textSecondary} style={styles.sectionLabel}>Customize</Text>
        <View style={styles.toggleRow}>
          <Text variant="body">Show PRs</Text>
          <Switch value={showPRs} onValueChange={setShowPRs} trackColor={{ true: ACCENT }} />
        </View>
        <View style={styles.toggleRow}>
          <Text variant="body">Show volume</Text>
          <Switch value={showVolume} onValueChange={setShowVolume} trackColor={{ true: ACCENT }} />
        </View>
        <View style={styles.toggleRow}>
          <Text variant="body">Show duration</Text>
          <Switch value={showDuration} onValueChange={setShowDuration} trackColor={{ true: ACCENT }} />
        </View>
      </View>

      {/* Actions */}
      <Pressable style={styles.primaryBtn} onPress={() => Alert.alert('Export', 'Image export is a stub')}>
        <Text variant="label" color={colors.background}>Export as Image</Text>
      </Pressable>
      <Pressable style={styles.outlineBtn} onPress={() => Alert.alert('Share', 'System share sheet is a stub')}>
        <Text variant="label" color={ACCENT}>Share</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, paddingBottom: spacing.xxl, gap: spacing.sm },
  card: {
    backgroundColor: colors.glass, borderWidth: 1, borderColor: colors.glassBorder,
    borderRadius: 20, padding: spacing.md,
  },
  selectorScroll: { flexGrow: 0 },
  selectorRow: { flexDirection: 'row', gap: spacing.xs },
  selectorItem: {
    borderWidth: 1, borderColor: colors.glassBorder, borderRadius: 999,
    paddingHorizontal: spacing.md, paddingVertical: 8, backgroundColor: colors.glass,
  },
  selectorActive: { backgroundColor: ACCENT, borderColor: ACCENT },
  previewCard: {
    backgroundColor: colors.glass, borderWidth: 2, borderColor: ACCENT,
    borderRadius: 20, padding: spacing.md, gap: spacing.xs,
  },
  statsGrid: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.sm },
  statBox: { flex: 1, alignItems: 'center', gap: 2 },
  sectionLabel: { textTransform: 'uppercase', letterSpacing: 1, marginBottom: spacing.sm },
  toggleRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.glassBorder,
  },
  primaryBtn: {
    backgroundColor: ACCENT, borderRadius: 999, paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  outlineBtn: {
    borderWidth: 1, borderColor: ACCENT, borderRadius: 999, paddingVertical: spacing.sm,
    alignItems: 'center',
  },
});
