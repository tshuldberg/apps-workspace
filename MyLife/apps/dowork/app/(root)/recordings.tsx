import { useEffect, useMemo, useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import {
  deleteWorkoutFormRecording,
  getWorkoutExercises,
  getWorkoutFormRecordings,
  type WorkoutExerciseLibraryItem,
  type WorkoutFormRecording,
} from '@mylife/workouts';
import { Card, Text, colors, spacing } from '@mylife/ui';
import { useDatabase } from './providers/DatabaseProvider';

export default function WorkoutRecordingsScreen() {
  const db = useDatabase();
  const [recordings, setRecordings] = useState<WorkoutFormRecording[]>([]);
  const [exercises, setExercises] = useState<WorkoutExerciseLibraryItem[]>([]);

  useEffect(() => {
    setRecordings(getWorkoutFormRecordings(db, { limit: 100 }));
    setExercises(getWorkoutExercises(db));
  }, [db]);

  const exerciseNames = useMemo(() => {
    const map = new Map<string, string>();
    exercises.forEach((exercise) => {
      map.set(exercise.id, exercise.name);
    });
    return map;
  }, [exercises]);

  const remove = (id: string) => {
    deleteWorkoutFormRecording(db, id);
    setRecordings(getWorkoutFormRecordings(db, { limit: 100 }));
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.list}>
        {recordings.map((recording) => {
          const duration = Math.max(0, Math.round(recording.timestampEnd - recording.timestampStart));
          return (
            <Card key={recording.id}>
              <View style={styles.item}>
                <View style={styles.main}>
                  <Text variant="body">
                    {exerciseNames.get(recording.exerciseId) ?? recording.exerciseId}
                  </Text>
                  <Text variant="caption" color={colors.textSecondary}>
                    {new Date(recording.createdAt).toLocaleString()} · {duration}s
                  </Text>
                </View>

                <View style={styles.actions}>
                  <Pressable
                    style={styles.secondaryButton}
                    onPress={() => void Linking.openURL(recording.videoUrl)}
                  >
                    <Text variant="caption" color={colors.text}>Open</Text>
                  </Pressable>
                  <Pressable style={styles.dangerButton} onPress={() => remove(recording.id)}>
                    <Text variant="caption" color={colors.background}>Delete</Text>
                  </Pressable>
                </View>
              </View>
            </Card>
          );
        })}

        {recordings.length === 0 ? (
          <Card>
            <Text variant="caption" color={colors.textSecondary}>No recordings yet.</Text>
          </Card>
        ) : null}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.md,
    paddingBottom: spacing.xxl,
    gap: spacing.sm,
  },
  list: {
    gap: spacing.sm,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  main: {
    flex: 1,
    gap: 4,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  secondaryButton: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  dangerButton: {
    borderRadius: 8,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    backgroundColor: colors.danger,
  },
});
