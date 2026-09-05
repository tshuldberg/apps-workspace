// Post-session save screen (hub twin of the DoWork screen). The session
// engine has already written the completed wk_workout_sessions row; this
// screen persists the user's title and notes, and Discard really deletes the
// just-completed session row after confirmation. The hub has no workout
// share layer, so no visibility control is offered here (DoWork adds one on
// top of its cloud share pipeline).

import { useCallback, useState } from 'react';
import { Alert, ScrollView, StyleSheet, TextInput, View, Pressable } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Text, Card, Button, colors, spacing } from '@mylife/ui';
import { annotateWorkoutSession, deleteWorkoutSession } from '@mylife/workouts';
import { useDatabase } from '../../components/DatabaseProvider';

const ACCENT = colors.modules.workouts;

export default function SaveWorkoutScreen() {
  const router = useRouter();
  const db = useDatabase();
  const params = useLocalSearchParams<{
    sessionId?: string;
    duration?: string;
    exerciseCount?: string;
    totalSets?: string;
  }>();

  const sessionId = params.sessionId ?? null;
  const duration = params.duration ?? '0';
  const exerciseCount = params.exerciseCount ?? '0';
  const totalSets = params.totalSets ?? '0';

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [notice, setNotice] = useState<string | null>(null);

  const now = new Date();
  const [dateStr] = useState(
    `${now.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })}, ${now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`,
  );

  const handleSave = useCallback(() => {
    try {
      if (sessionId) {
        annotateWorkoutSession(db, sessionId, {
          title: title.trim() || null,
          notes: description.trim() || null,
        });
      }
      router.back();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'The workout could not be saved.');
    }
  }, [sessionId, db, title, description, router]);

  const handleDiscard = useCallback(() => {
    if (!sessionId) {
      router.back();
      return;
    }
    Alert.alert(
      'Discard workout?',
      'This deletes the workout you just finished from your history. This cannot be undone.',
      [
        { text: 'Keep it', style: 'cancel' },
        {
          text: 'Discard',
          style: 'destructive',
          onPress: () => {
            try {
              deleteWorkoutSession(db, sessionId);
            } catch {
              // Deleting an already-gone row is not worth blocking navigation.
            }
            router.back();
          },
        },
      ],
    );
  }, [sessionId, db, router]);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text variant="heading">Save Workout</Text>

      <TextInput
        style={styles.titleInput}
        value={title}
        onChangeText={setTitle}
        placeholder="Workout title"
        placeholderTextColor={colors.textTertiary}
      />

      <View style={styles.statsRow}>
        <View style={styles.statItem}>
          <Text variant="caption" color={colors.textSecondary}>Duration</Text>
          <Text style={styles.statValue}>{duration}</Text>
        </View>
        <View style={styles.statItem}>
          <Text variant="caption" color={colors.textSecondary}>Exercises</Text>
          <Text style={styles.statValue}>{exerciseCount}</Text>
        </View>
        <View style={styles.statItem}>
          <Text variant="caption" color={colors.textSecondary}>Sets</Text>
          <Text style={styles.statValue}>{totalSets}</Text>
        </View>
      </View>

      <Card style={styles.card}>
        <Text variant="caption" color={colors.textSecondary}>When</Text>
        <Text variant="body" color={ACCENT}>{dateStr}</Text>
      </Card>

      <Card style={styles.card}>
        <Text variant="caption" color={colors.textSecondary}>Description</Text>
        <TextInput
          style={styles.descInput}
          value={description}
          onChangeText={setDescription}
          placeholder="How did your workout go? Leave some notes here..."
          placeholderTextColor={colors.textTertiary}
          multiline
          numberOfLines={3}
        />
      </Card>

      {notice ? (
        <Card style={styles.card}>
          <Text variant="caption" color={colors.danger}>{notice}</Text>
        </Card>
      ) : null}

      <Button variant="primary" label="Save" onPress={handleSave} />
      <Pressable style={styles.discardButton} onPress={handleDiscard}>
        <Text variant="body" color={colors.danger}>Discard Workout</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, gap: spacing.md, paddingBottom: spacing.xxl },
  titleInput: {
    color: colors.text, fontSize: 20, fontWeight: '600',
    borderBottomWidth: 2, borderBottomColor: ACCENT,
    paddingVertical: spacing.sm,
  },
  statsRow: { flexDirection: 'row', justifyContent: 'space-around' },
  statItem: { alignItems: 'center', gap: spacing.xs },
  statValue: { fontSize: 20, fontWeight: '700', color: ACCENT },
  card: { gap: spacing.xs },
  descInput: {
    color: colors.text, fontSize: 14, minHeight: 60,
    textAlignVertical: 'top', padding: 0,
  },
  discardButton: { alignItems: 'center', paddingVertical: spacing.md },
});
