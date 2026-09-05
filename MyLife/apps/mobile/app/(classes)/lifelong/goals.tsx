import { useCallback } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Text, borderRadius, colors, spacing } from '@mylife/ui';
import {
  getGoalProgress,
  listLearningGoals,
  type LearningGoalProgress,
  type LearningGoalRow,
} from '@mylife/classes';
import { useDatabase } from '../../../components/DatabaseProvider';
import {
  CLASSES_ACCENT,
  CLASSES_ACCENT_BORDER,
  ClassesEmptyCard,
  ClassesMetricRow,
  ClassesScreen,
  useClassesFocusedSnapshot,
} from '../_ui';
import { GOAL_STATUS_LABEL, Pill, ProgressBar, formatDate } from './_ui';

interface Snapshot {
  goals: Array<{ goal: LearningGoalRow; progress: LearningGoalProgress }>;
  active: number;
  completed: number;
}

export default function GoalsListScreen() {
  const db = useDatabase();
  const router = useRouter();

  const load = useCallback((): Snapshot => {
    const all = listLearningGoals(db);
    const goals = all.map((goal) => ({
      goal,
      progress: getGoalProgress(db, goal.id),
    }));
    const active = all.filter((g) => g.status === 'active').length;
    const completed = all.filter((g) => g.status === 'completed').length;
    return { goals, active, completed };
  }, [db]);

  const snap = useClassesFocusedSnapshot(load);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ClassesScreen
        title="Learning goals"
        subtitle="Why you're learning, with the courses and certs that get you there."
      >
        <ClassesMetricRow
          items={[
            { label: 'Total', value: String(snap.goals.length) },
            { label: 'Active', value: String(snap.active) },
            { label: 'Completed', value: String(snap.completed) },
          ]}
        />

        {snap.goals.length === 0 ? (
          <ClassesEmptyCard
            title="No goals yet"
            body="Frame the why. Tie courses and certs to the version of you they unlock."
            actionLabel="Set a goal"
            onAction={() => router.push('/(classes)/lifelong/goal/add')}
          />
        ) : (
          <View style={{ gap: spacing.sm }}>
            {snap.goals.map(({ goal, progress }) => (
              <Pressable
                key={goal.id}
                onPress={() =>
                  router.push(`/(classes)/lifelong/goal/${goal.id}`)
                }
                style={styles.goalRow}
              >
                <View style={styles.goalRowTop}>
                  <Text style={styles.goalTitle}>{goal.title}</Text>
                  <Pill label={GOAL_STATUS_LABEL[goal.status] ?? goal.status} />
                </View>
                <Text variant="caption" color={colors.textSecondary}>
                  {goal.target_date
                    ? `Target ${formatDate(goal.target_date)}`
                    : 'No target date'}
                </Text>
                <ProgressBar percent={progress.percent} />
                <Text variant="caption" color={colors.textSecondary}>
                  {progress.completed_items} of {progress.total_items} items
                  complete · {progress.percent.toFixed(0)}%
                </Text>
              </Pressable>
            ))}
          </View>
        )}
      </ClassesScreen>

      <Pressable
        style={[styles.fab, { backgroundColor: CLASSES_ACCENT }]}
        onPress={() => router.push('/(classes)/lifelong/goal/add')}
      >
        <Text style={[styles.fabLabel, { color: colors.background }]}>
          + Goal
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  goalRow: {
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: CLASSES_ACCENT_BORDER,
    backgroundColor: 'rgba(59,130,246,0.08)',
    padding: spacing.md,
    gap: spacing.xs,
  },
  goalRowTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  goalTitle: {
    color: colors.text,
    fontWeight: '700',
    fontSize: 15,
    flex: 1,
  },
  fab: {
    position: 'absolute',
    right: spacing.lg,
    bottom: spacing.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.pill,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  fabLabel: {
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
});
