// Post-session save screen. The session engine has already written the
// completed wk_workout_sessions row; this screen persists the user's title,
// notes, and (when visibility is Everyone) posts a cloud share. Discard
// really deletes the just-completed session row after confirmation.

import { useCallback, useState } from 'react';
import { Alert, ScrollView, StyleSheet, TextInput, View, Pressable } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Text, Card, Button, colors, spacing } from '@mylife/ui';
import {
  annotateWorkoutSession,
  deleteWorkoutSession,
  getSetWeightsForSession,
} from '@mylife/workouts';
import { uploadWorkoutShare } from './data/cloud-shares';
import { friendlyError } from './data/friendly-errors';
import { useDatabase } from './providers/DatabaseProvider';
import { useDoWorkCloud } from './providers/DoWorkCloudProvider';
import { DW_ACCENT, DW_ON_ACCENT } from './theme/tokens';

const ACCENT = DW_ACCENT;
const LB_TO_KG = 0.453592;

export default function SaveWorkoutScreen() {
  const router = useRouter();
  const db = useDatabase();
  const cloud = useDoWorkCloud();
  const params = useLocalSearchParams<{
    sessionId?: string;
    duration?: string;
    durationSeconds?: string;
    exerciseCount?: string;
    totalSets?: string;
  }>();

  const sessionId = params.sessionId ?? null;
  const duration = params.duration ?? '0';
  const exerciseCount = params.exerciseCount ?? '0';
  const totalSets = params.totalSets ?? '0';

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [visibility, setVisibility] = useState<'private' | 'everyone'>('private');
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const now = new Date();
  const [dateStr] = useState(
    `${now.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })}, ${now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`,
  );

  const canShare = cloud.isConfigured && cloud.supabase !== null;

  const handleSave = useCallback(async () => {
    if (saving) return;
    setSaving(true);
    setNotice(null);
    try {
      if (sessionId) {
        annotateWorkoutSession(db, sessionId, {
          title: title.trim() || null,
          notes: description.trim() || null,
        });
      }

      if (visibility === 'everyone') {
        if (!canShare || !cloud.supabase) {
          setNotice(
            'Sharing needs a cloud connection, so this workout was saved privately on this device.',
          );
          setSaving(false);
          return;
        }
        let totalVolumeKg = 0;
        if (sessionId) {
          for (const set of getSetWeightsForSession(db, sessionId)) {
            const kg = set.unit === 'lbs' ? set.weight * LB_TO_KG : set.weight;
            totalVolumeKg += kg * set.reps;
          }
        }
        const result = await uploadWorkoutShare(cloud.supabase, {
          title: title.trim() || 'Workout',
          summary: description.trim() || undefined,
          durationSeconds: Number(params.durationSeconds ?? 0) || 0,
          totalVolumeKg: Math.round(totalVolumeKg * 10) / 10,
          exerciseCount: Number(exerciseCount) || 0,
          privacy: 'public',
        });
        if (!result.ok && !result.queued) {
          setNotice(friendlyError(result.error, 'The workout was saved but could not be shared.'));
          setSaving(false);
          return;
        }
      }
      router.back();
    } catch (error) {
      setNotice(friendlyError(error instanceof Error ? error.message : String(error)));
    } finally {
      setSaving(false);
    }
  }, [
    saving,
    sessionId,
    db,
    title,
    description,
    visibility,
    canShare,
    cloud.supabase,
    params.durationSeconds,
    exerciseCount,
    router,
  ]);

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
              // Deleting a already-gone row is not worth blocking navigation.
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

      <Card style={styles.card}>
        <Text variant="caption" color={colors.textSecondary}>Visibility</Text>
        <View style={styles.visRow}>
          {(['private', 'everyone'] as const).map((opt) => (
            <Pressable
              key={opt}
              style={[styles.visChip, visibility === opt && styles.visChipActive]}
              onPress={() => setVisibility(opt)}
            >
              <Text
                variant="caption"
                color={visibility === opt ? DW_ON_ACCENT : colors.textSecondary}
              >
                {opt === 'private' ? 'Private' : 'Everyone'}
              </Text>
            </Pressable>
          ))}
        </View>
        {visibility === 'everyone' && !canShare ? (
          <Text variant="caption" color={colors.textTertiary}>
            This build has no cloud connection, so the workout will stay on this device.
          </Text>
        ) : null}
      </Card>

      {notice ? (
        <Card style={styles.card}>
          <Text variant="caption" color={colors.danger}>{notice}</Text>
        </Card>
      ) : null}

      <Button
        variant="primary"
        label={saving ? 'Saving…' : 'Save'}
        onPress={() => void handleSave()}
        disabled={saving}
      />
      <Pressable style={styles.discardButton} onPress={handleDiscard} disabled={saving}>
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
  visRow: { flexDirection: 'row', gap: spacing.sm },
  visChip: {
    paddingHorizontal: spacing.md, paddingVertical: spacing.xs,
    borderRadius: 999, borderWidth: 1, borderColor: colors.border,
    backgroundColor: colors.surfaceElevated,
  },
  visChipActive: { backgroundColor: ACCENT, borderColor: ACCENT },
  discardButton: { alignItems: 'center', paddingVertical: spacing.md },
});
