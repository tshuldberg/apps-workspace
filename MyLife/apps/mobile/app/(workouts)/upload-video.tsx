import { useCallback, useState } from 'react';
import { Alert, Image, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import {
  createExerciseVideo,
  getActiveTrainer,
  getWorkoutExerciseById,
  VIDEO_ANGLES,
  VIDEO_ANGLE_LABELS,
  type VideoAngle,
} from '@mylife/workouts';
import { Card, Text, colors, spacing } from '@mylife/ui';
import { useDatabase } from '../../components/DatabaseProvider';

const MAX_FILE_SIZE = 200 * 1024 * 1024; // 200 MB
const DEMOS_DIR = `${FileSystem.documentDirectory}exercise-demos`;

export default function UploadVideoScreen() {
  const db = useDatabase();
  const router = useRouter();
  const params = useLocalSearchParams<{ exerciseId: string }>();

  const [videoUri, setVideoUri] = useState<string | null>(null);
  const [angle, setAngle] = useState<VideoAngle>('front');
  const [notes, setNotes] = useState('');
  const [uploading, setUploading] = useState(false);

  const exercise = params.exerciseId ? getWorkoutExerciseById(db, params.exerciseId) : null;
  const trainer = getActiveTrainer(db);

  const pickVideo = useCallback(async (useCamera: boolean) => {
    const method = useCamera
      ? ImagePicker.launchCameraAsync
      : ImagePicker.launchImageLibraryAsync;

    const result = await method({
      mediaTypes: ['videos'],
      quality: 0.8,
      videoMaxDuration: 30,
      allowsEditing: true,
    });

    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      const info = await FileSystem.getInfoAsync(asset.uri);
      if (info.exists && info.size && info.size > MAX_FILE_SIZE) {
        Alert.alert('File too large', 'Videos must be under 200 MB.');
        return;
      }
      setVideoUri(asset.uri);
    }
  }, []);

  const handleUpload = useCallback(async () => {
    if (!videoUri || !exercise || !trainer) return;
    setUploading(true);

    try {
      const destDir = `${DEMOS_DIR}/${exercise.id}`;
      const dirInfo = await FileSystem.getInfoAsync(destDir);
      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(destDir, { intermediates: true });
      }

      const videoId = `vid-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const destUri = `${destDir}/${videoId}.mp4`;
      await FileSystem.copyAsync({ from: videoUri, to: destUri });

      const fileInfo = await FileSystem.getInfoAsync(destUri);
      const fileSizeBytes = (fileInfo.exists && fileInfo.size) ? fileInfo.size : 0;

      createExerciseVideo(db, videoId, {
        exerciseId: exercise.id,
        trainerId: trainer.id,
        videoUri: destUri,
        thumbnailUri: null,
        angle,
        durationSeconds: 0,
        fileSizeBytes,
        width: 0,
        height: 0,
        notes,
      });

      Alert.alert('Demo uploaded', `${VIDEO_ANGLE_LABELS[angle]} demo saved for ${exercise.name}.`);
      router.back();
    } catch (err) {
      Alert.alert('Upload failed', err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setUploading(false);
    }
  }, [videoUri, exercise, trainer, angle, notes, db, router]);

  if (!exercise) {
    return (
      <View style={styles.screen}>
        <Card><Text variant="caption" color={colors.textSecondary}>Exercise not found.</Text></Card>
      </View>
    );
  }

  if (!trainer) {
    return (
      <View style={styles.screen}>
        <Card>
          <Text variant="caption" color={colors.textSecondary}>
            Trainer mode not active. Triple-tap the MyWorkouts header to activate.
          </Text>
        </Card>
      </View>
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Card>
        <Text variant="heading">Upload Demo</Text>
        <Text variant="caption" color={colors.textSecondary}>{exercise.name}</Text>
      </Card>

      {!videoUri && (
        <View style={styles.row}>
          <Pressable style={styles.optionCard} onPress={() => void pickVideo(true)}>
            <Text variant="subheading" color={colors.text}>Record Video</Text>
            <Text variant="caption" color={colors.textSecondary}>Use camera</Text>
          </Pressable>
          <Pressable style={styles.optionCard} onPress={() => void pickVideo(false)}>
            <Text variant="subheading" color={colors.text}>Gallery</Text>
            <Text variant="caption" color={colors.textSecondary}>Choose existing</Text>
          </Pressable>
        </View>
      )}

      {videoUri && (
        <Card>
          <Text variant="subheading">Video Selected</Text>
          <View style={styles.previewBox}>
            <Image source={{ uri: videoUri }} style={styles.thumbnail} />
            <Text variant="caption" color={colors.textSecondary} style={styles.previewLabel}>
              Video ready for upload
            </Text>
          </View>
          <Pressable style={styles.changeButton} onPress={() => setVideoUri(null)}>
            <Text variant="caption" color={colors.modules.workouts}>Change video</Text>
          </Pressable>
        </Card>
      )}

      {videoUri && (
        <Card>
          <Text variant="subheading">Angle</Text>
          <View style={styles.angleGrid}>
            {VIDEO_ANGLES.map((a) => (
              <Pressable
                key={a}
                style={[styles.anglePill, angle === a && styles.anglePillActive]}
                onPress={() => setAngle(a)}
              >
                <Text
                  variant="caption"
                  color={angle === a ? colors.background : colors.text}
                >
                  {VIDEO_ANGLE_LABELS[a]}
                </Text>
              </Pressable>
            ))}
          </View>
        </Card>
      )}

      {videoUri && (
        <Card>
          <Text variant="subheading">Notes (optional)</Text>
          <TextInput
            style={styles.notesInput}
            value={notes}
            onChangeText={setNotes}
            placeholder="e.g., Keep elbows tucked"
            placeholderTextColor={colors.textTertiary}
            maxLength={200}
          />
        </Card>
      )}

      {videoUri && (
        <Pressable
          style={[styles.uploadButton, uploading && styles.uploadButtonDisabled]}
          onPress={() => void handleUpload()}
          disabled={uploading}
        >
          <Text variant="label" color={colors.background}>
            {uploading ? 'Uploading...' : 'Upload Demo'}
          </Text>
        </Pressable>
      )}
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
    gap: spacing.md,
    paddingBottom: spacing.xl,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  optionCard: {
    flex: 1,
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    borderRadius: 12,
    padding: spacing.lg,
    alignItems: 'center',
    gap: spacing.xs,
  },
  previewBox: {
    marginTop: spacing.sm,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: colors.surface,
    alignItems: 'center',
    padding: spacing.md,
  },
  thumbnail: {
    width: '100%',
    aspectRatio: 16 / 9,
    borderRadius: 8,
    backgroundColor: colors.surfaceElevated,
  },
  previewLabel: {
    marginTop: spacing.sm,
  },
  changeButton: {
    marginTop: spacing.sm,
    alignSelf: 'center',
  },
  angleGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  anglePill: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: 20,
    backgroundColor: colors.border,
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  anglePillActive: {
    backgroundColor: colors.modules.workouts,
    borderColor: colors.modules.workouts,
  },
  notesInput: {
    marginTop: spacing.sm,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    borderRadius: 8,
    padding: spacing.sm,
    fontFamily: 'Inter',
    fontSize: 14,
  },
  uploadButton: {
    backgroundColor: colors.modules.workouts,
    borderRadius: 12,
    padding: spacing.md,
    alignItems: 'center',
  },
  uploadButtonDisabled: {
    opacity: 0.5,
  },
});
