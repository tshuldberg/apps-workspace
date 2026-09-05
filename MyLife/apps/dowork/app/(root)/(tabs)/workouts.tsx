// DoWork workouts tab — list of saved workouts + quick start.
//
// Streamlined version of apps/mobile/app/(workouts)/(tabs)/workouts.tsx.

import { useCallback, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import {
  WK_FONTS,
  deleteWorkout,
  getWorkouts,
  type WorkoutDefinition,
} from '@mylife/workouts';
import { useDatabase } from '../providers/DatabaseProvider';
import { DW_ACCENT, DW_BORDER, DW_SURFACES, DW_TEXT } from '../theme/tokens';
import {
  WorkoutHero,
  WorkoutPrimaryButton,
  WorkoutSectionHeader,
  WorkoutTabScrollView,
  formatMinutes,
} from './_screen-kit';

export default function WorkoutsScreen() {
  const router = useRouter();
  const db = useDatabase();
  const [workouts, setWorkouts] = useState<WorkoutDefinition[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const refresh = useCallback(() => {
    setWorkouts(getWorkouts(db));
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

  const confirmDelete = useCallback(
    (workout: WorkoutDefinition) => {
      Alert.alert(
        'Delete workout?',
        `"${workout.title}" will be removed from your library. Completed sessions stay in your history. This cannot be undone.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: () => {
              deleteWorkout(db, workout.id);
              refresh();
            },
          },
        ],
      );
    },
    [db, refresh],
  );

  const openRowMenu = useCallback(
    (workout: WorkoutDefinition) => {
      Alert.alert(workout.title, undefined, [
        {
          text: 'Edit',
          onPress: () => router.push(`/(root)/builder?edit=${workout.id}` as never),
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => confirmDelete(workout),
        },
        { text: 'Cancel', style: 'cancel' },
      ]);
    },
    [confirmDelete, router],
  );

  return (
    <WorkoutTabScrollView refreshing={refreshing} onRefresh={onRefresh}>
      <WorkoutHero
        title="Workouts"
        subtitle={workouts.length === 0 ? 'No saved workouts yet' : `${workouts.length} saved`}
        trailing={
          <WorkoutPrimaryButton
            label="Create"
            onPress={() => router.push('/(root)/builder' as never)}
          />
        }
      />

      <WorkoutSectionHeader
        title="Your library"
        trailing={
          workouts.length > 0 ? (
            <Text style={styles.hint}>Long press to edit</Text>
          ) : null
        }
      />
      {workouts.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>Build your first workout</Text>
          <Text style={styles.emptyBody}>
            Tap Create to assemble exercises into a sequence with sets, reps, and rest.
          </Text>
        </View>
      ) : (
        <View style={styles.list}>
          {workouts.map((workout) => (
            <Pressable
              key={workout.id}
              style={({ pressed }) => [styles.row, pressed && { opacity: 0.86 }]}
              onPress={() => router.push(`/(root)/session?workoutId=${workout.id}` as never)}
              onLongPress={() => openRowMenu(workout)}
              delayLongPress={300}
              accessibilityRole="button"
              accessibilityLabel={`${workout.title}. Tap to start, long press to edit or delete.`}
            >
              <Text style={styles.rowTitle}>{workout.title}</Text>
              <Text style={styles.rowMeta}>
                {workout.exercises.length} exercises · {formatMinutes((workout.estimatedDuration ?? 0) * 60)}
              </Text>
            </Pressable>
          ))}
        </View>
      )}

      <WorkoutSectionHeader title="Programs" />
      <View style={styles.list}>
        <Pressable
          style={({ pressed }) => [styles.row, pressed && { opacity: 0.86 }]}
          onPress={() => router.push('/(root)/programs' as never)}
          accessibilityRole="button"
          accessibilityLabel="Browse programs"
        >
          <Text style={styles.rowTitle}>Programs</Text>
          <Text style={styles.rowMeta}>Browse multi-week training programs</Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [styles.row, pressed && { opacity: 0.86 }]}
          onPress={() => router.push('/(root)/plans' as never)}
          accessibilityRole="button"
          accessibilityLabel="Manage workout plans"
        >
          <Text style={styles.rowTitle}>Plans</Text>
          <Text style={styles.rowMeta}>Create and subscribe to a weekly plan</Text>
        </Pressable>
      </View>

      <WorkoutSectionHeader title="Tools" />
      <View style={styles.list}>
        <Pressable
          style={({ pressed }) => [styles.row, pressed && { opacity: 0.86 }]}
          onPress={() => router.push('/(root)/timer' as never)}
          accessibilityRole="button"
          accessibilityLabel="Open the rest timer"
        >
          <Text style={styles.rowTitle}>Rest Timer</Text>
          <Text style={styles.rowMeta}>Interval countdown with presets</Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [styles.row, pressed && { opacity: 0.86 }]}
          onPress={() => router.push('/(root)/warmup' as never)}
          accessibilityRole="button"
          accessibilityLabel="Open the warmup builder"
        >
          <Text style={styles.rowTitle}>Warmup Builder</Text>
          <Text style={styles.rowMeta}>Ramp sets up to your working weight</Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [styles.row, pressed && { opacity: 0.86 }]}
          onPress={() => router.push('/(root)/superset' as never)}
          accessibilityRole="button"
          accessibilityLabel="Open the superset builder"
        >
          <Text style={styles.rowTitle}>Superset Builder</Text>
          <Text style={styles.rowMeta}>Pair movements into a superset</Text>
        </Pressable>
      </View>
    </WorkoutTabScrollView>
  );
}

const styles = StyleSheet.create({
  emptyCard: {
    marginHorizontal: 20,
    padding: 18,
    backgroundColor: DW_SURFACES.low,
    borderColor: DW_BORDER.subtle,
    borderWidth: 1,
    borderRadius: 14,
    gap: 6,
  },
  emptyTitle: {
    fontFamily: WK_FONTS.semiBold,
    fontSize: 16,
    color: DW_TEXT.primary,
  },
  emptyBody: {
    fontFamily: WK_FONTS.regular,
    fontSize: 14,
    color: DW_TEXT.secondary,
    lineHeight: 20,
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
  hint: {
    fontFamily: WK_FONTS.regular,
    fontSize: 11,
    color: DW_TEXT.tertiary,
    textTransform: 'none',
    letterSpacing: 0,
  },
});

void DW_ACCENT;
