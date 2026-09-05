import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Text, colors, spacing } from '@mylife/ui';
import {
  getWorkoutPlans,
  getActivePlanSubscription,
  getPlanProgress,
  getWorkoutSessions,
} from '@mylife/workouts';
import type { WorkoutPlan } from '@mylife/workouts';
import { useDatabase } from '../../components/DatabaseProvider';

const ACCENT = colors.modules.workouts;

type ProgramRow = {
  plan: WorkoutPlan;
  frequencyPerWeek: number;
  difficulty: 'Beginner' | 'Intermediate' | 'Advanced';
  progressPercent: number | null;
  isActive: boolean;
};

function difficultyColor(label: string): string {
  if (label === 'Beginner') return colors.success;
  if (label === 'Advanced') return ACCENT;
  return '#3B82F6';
}

function deriveDifficulty(plan: WorkoutPlan): 'Beginner' | 'Intermediate' | 'Advanced' {
  const title = plan.title.toLowerCase();
  if (title.includes('beginner') || title.includes('starter')) return 'Beginner';
  if (title.includes('advanced') || title.includes('elite')) return 'Advanced';
  return 'Intermediate';
}

function deriveFrequency(plan: WorkoutPlan): number {
  for (const week of plan.weeks) {
    const days = week.days.filter((d) => !d.rest_day && d.workout_id);
    if (days.length > 0) return days.length;
  }
  return 0;
}

export default function ProgramsScreen() {
  const db = useDatabase();
  const router = useRouter();
  const [rows, setRows] = useState<ProgramRow[]>([]);

  const load = useCallback(() => {
    try {
      const plans = getWorkoutPlans(db);
      const subscription = getActivePlanSubscription(db);
      const sessions = getWorkoutSessions(db, { onlyCompleted: true, limit: 500 });
      const completedIds = new Set(sessions.map((s) => s.workoutId));

      const built: ProgramRow[] = plans.map((plan) => {
        const isActive = subscription?.planId === plan.id;
        const progress = isActive ? getPlanProgress(plan, completedIds).percent : null;
        return {
          plan,
          frequencyPerWeek: deriveFrequency(plan),
          difficulty: deriveDifficulty(plan),
          progressPercent: progress,
          isActive,
        };
      });

      setRows(built);
    } catch {
      setRows([]);
    }
  }, [db]);

  useEffect(() => { load(); }, [load]);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text variant="heading">Programs</Text>

      {rows.length === 0 ? (
        <View style={styles.card}>
          <Text variant="body" color={colors.textSecondary} style={{ textAlign: 'center' }}>
            No programs yet. Create your first multi-week plan.
          </Text>
        </View>
      ) : (
        rows.map((row) => (
          <Pressable
            key={row.plan.id}
            onPress={() => router.push(`/(workouts)/program/${row.plan.id}`)}
            style={[styles.card, row.isActive && styles.cardActive]}
          >
            <View style={styles.rowBetween}>
              <Text variant="body" style={styles.title}>{row.plan.title}</Text>
              <View style={[styles.badge, { borderColor: difficultyColor(row.difficulty) }]}>
                <Text variant="caption" color={difficultyColor(row.difficulty)}>{row.difficulty}</Text>
              </View>
            </View>
            {row.plan.description ? (
              <Text variant="caption" color={colors.textSecondary} numberOfLines={1}>
                {row.plan.description}
              </Text>
            ) : null}
            <View style={styles.metaRow}>
              <Text variant="caption" color={colors.textSecondary}>
                {row.plan.weeks.length} {row.plan.weeks.length === 1 ? 'Week' : 'Weeks'}
              </Text>
              <Text variant="caption" color={colors.textSecondary}> | </Text>
              <Text variant="caption" color={colors.textSecondary}>
                {row.frequencyPerWeek} days/week
              </Text>
            </View>
            {row.progressPercent != null ? (
              <View style={styles.progressWrap}>
                <View style={styles.progressTrack}>
                  <View style={[styles.progressFill, { width: `${row.progressPercent}%` }]} />
                </View>
                <Text variant="caption" color={colors.textSecondary}>{row.progressPercent}% complete</Text>
              </View>
            ) : null}
          </Pressable>
        ))
      )}

      <Pressable
        onPress={() => router.push('/(workouts)/program/create')}
        style={[styles.card, styles.createBtn]}
      >
        <Text variant="label" color={colors.background}>+ Create Program</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, paddingBottom: spacing.xxl, gap: spacing.sm },
  card: {
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    borderRadius: 20,
    padding: spacing.md,
    gap: spacing.xs,
  },
  cardActive: { borderLeftWidth: 3, borderLeftColor: ACCENT },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  title: { fontSize: 16, lineHeight: 20, fontWeight: '700', flex: 1 },
  badge: { borderWidth: 1, borderRadius: 999, paddingHorizontal: spacing.sm, paddingVertical: 3 },
  metaRow: { flexDirection: 'row', alignItems: 'center' },
  progressWrap: { gap: 4, marginTop: spacing.xs },
  progressTrack: { height: 6, borderRadius: 3, backgroundColor: colors.surfaceElevated, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: ACCENT },
  createBtn: { backgroundColor: ACCENT, borderColor: ACCENT, alignItems: 'center' },
});
