// Trainer Studio upload queue. Multi-select videos from the library (or record
// one), edit per-video metadata (title / description / linked exercise / angle
// / premium), generate a client-side thumbnail, then run serial background
// uploads through the cloud-media sign -> put -> finalize pipeline with per-item
// progress and retry.

import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as VideoThumbnails from 'expo-video-thumbnails';
import { Film, Plus, RefreshCw, Trash2, Video } from 'lucide-react-native';
import type { SupabaseClient } from '@supabase/supabase-js';
import { WK_FONTS } from '@mylife/workouts';
import { uploadTrainerVideoToCloud } from '../../data/cloud-media';
import { friendlyError } from '../../data/friendly-errors';
import type { TrainerVideoAngle, TrainerVideoRow } from '../../data/cloud-trainer-videos';
import { DW_ACCENT, DW_BORDER, DW_SURFACES, DW_TEXT } from '../../theme/tokens';
import {
  AngleSelector,
  ExercisePickerSheet,
  PremiumToggle,
  StudioButton,
  StudioField,
  StudioTextArea,
  type ExerciseOption,
} from './studio-kit';

const MAX_DURATION_SECONDS = 600;
const MAX_FILE_SIZE = 500 * 1024 * 1024;

type ItemStatus = 'draft' | 'uploading' | 'done' | 'error';

interface UploadItem {
  id: string;
  uri: string;
  contentType: string;
  contentLength: number;
  durationSeconds: number;
  thumbnailUri: string | null;
  thumbnailContentLength: number;
  title: string;
  description: string;
  exerciseSlug: string | null;
  exerciseName: string | null;
  angle: TrainerVideoAngle | null;
  isPremium: boolean;
  status: ItemStatus;
  progress: number;
  error?: string;
}

function guessContentType(uri: string): string {
  return uri.toLowerCase().endsWith('.mov') ? 'video/quicktime' : 'video/mp4';
}

function localId(): string {
  return `up-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function isReadyToUpload(item: UploadItem): boolean {
  return (
    item.status !== 'uploading' &&
    item.status !== 'done' &&
    !!item.exerciseSlug &&
    item.title.trim().length > 0
  );
}

export function UploadQueue({
  supabase,
  exercises,
  onUploaded,
}: {
  supabase: SupabaseClient;
  exercises: ExerciseOption[];
  onUploaded: (video: TrainerVideoRow) => void;
}) {
  const [items, setItems] = useState<UploadItem[]>([]);
  const [pickerItemId, setPickerItemId] = useState<string | null>(null);
  const itemsRef = useRef<UploadItem[]>([]);

  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  const updateItem = useCallback((id: string, patch: Partial<UploadItem>) => {
    setItems((current) => current.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  }, []);

  const buildItem = useCallback(async (asset: ImagePicker.ImagePickerAsset): Promise<UploadItem> => {
    const contentType = guessContentType(asset.uri);
    let contentLength = 0;
    try {
      const info = await FileSystem.getInfoAsync(asset.uri);
      contentLength = info.exists && info.size ? info.size : 0;
    } catch {
      contentLength = 0;
    }

    let thumbnailUri: string | null = null;
    let thumbnailContentLength = 0;
    try {
      const thumb = await VideoThumbnails.getThumbnailAsync(asset.uri, { time: 1000 });
      thumbnailUri = thumb.uri;
      const thumbInfo = await FileSystem.getInfoAsync(thumb.uri);
      thumbnailContentLength = thumbInfo.exists && thumbInfo.size ? thumbInfo.size : 0;
    } catch {
      thumbnailUri = null;
    }

    return {
      id: localId(),
      uri: asset.uri,
      contentType,
      contentLength,
      durationSeconds: asset.duration ? Math.round(asset.duration / 1000) : 0,
      thumbnailUri,
      thumbnailContentLength,
      title: '',
      description: '',
      exerciseSlug: null,
      exerciseName: null,
      angle: null,
      isPremium: false,
      status: 'draft',
      progress: 0,
    };
  }, []);

  const addAssets = useCallback(
    async (assets: ImagePicker.ImagePickerAsset[]) => {
      const accepted: ImagePicker.ImagePickerAsset[] = [];
      for (const asset of assets) {
        try {
          const info = await FileSystem.getInfoAsync(asset.uri);
          if (info.exists && info.size && info.size > MAX_FILE_SIZE) continue;
        } catch {
          // if we cannot stat it, still let the server enforce the cap
        }
        accepted.push(asset);
      }
      if (accepted.length < assets.length) {
        Alert.alert('Some videos skipped', 'Videos must be under 500 MB.');
      }
      const built = await Promise.all(accepted.map((asset) => buildItem(asset)));
      if (built.length > 0) setItems((current) => [...current, ...built]);
    },
    [buildItem],
  );

  const pickFromLibrary = useCallback(async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['videos'],
      allowsMultipleSelection: true,
      quality: 0.8,
      videoMaxDuration: MAX_DURATION_SECONDS,
    });
    if (!result.canceled && result.assets.length > 0) {
      await addAssets(result.assets);
    }
  }, [addAssets]);

  const recordVideo = useCallback(async () => {
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['videos'],
      quality: 0.8,
      videoMaxDuration: MAX_DURATION_SECONDS,
    });
    if (!result.canceled && result.assets.length > 0) {
      await addAssets(result.assets);
    }
  }, [addAssets]);

  const removeItem = useCallback((id: string) => {
    setItems((current) => current.filter((item) => item.id !== id));
  }, []);

  const uploadOne = useCallback(
    async (item: UploadItem) => {
      updateItem(item.id, { status: 'uploading', progress: 0, error: undefined });
      const result = await uploadTrainerVideoToCloud(supabase, {
        fileUri: item.uri,
        contentType: item.contentType,
        contentLength: item.contentLength,
        exerciseSlug: item.exerciseSlug as string,
        angle: item.angle ?? undefined,
        durationSeconds: item.durationSeconds || undefined,
        title: item.title.trim(),
        description: item.description.trim() || undefined,
        isPremium: item.isPremium,
        thumbnailUri: item.thumbnailUri ?? undefined,
        thumbnailContentType: 'image/jpeg',
        thumbnailContentLength: item.thumbnailContentLength || undefined,
        onProgress: (fraction) => updateItem(item.id, { progress: fraction }),
      });
      if (result.ok) {
        updateItem(item.id, { status: 'done', progress: 1 });
        onUploaded(result.video);
      } else {
        updateItem(item.id, { status: 'error', error: friendlyError(result.error, 'Upload failed. Try again.') });
      }
    },
    [supabase, onUploaded, updateItem],
  );

  const uploadAll = useCallback(async () => {
    const pending = itemsRef.current.filter(isReadyToUpload);
    for (const queued of pending) {
      const latest = itemsRef.current.find((item) => item.id === queued.id);
      if (latest && isReadyToUpload(latest)) {
        await uploadOne(latest);
      }
    }
  }, [uploadOne]);

  const retryOne = useCallback(
    (id: string) => {
      const item = itemsRef.current.find((entry) => entry.id === id);
      if (item && isReadyToUpload(item)) void uploadOne(item);
    },
    [uploadOne],
  );

  const activeItem = items.find((item) => item.id === pickerItemId) ?? null;
  const anyUploading = items.some((item) => item.status === 'uploading');
  const readyCount = items.filter(isReadyToUpload).length;

  return (
    <View style={styles.container}>
      <View style={styles.actionRow}>
        <View style={{ flex: 1 }}>
          <StudioButton label="Add videos" variant="secondary" onPress={() => void pickFromLibrary()} />
        </View>
        <View style={{ flex: 1 }}>
          <StudioButton label="Record" variant="secondary" onPress={() => void recordVideo()} />
        </View>
      </View>

      {items.length === 0 ? (
        <View style={styles.emptyState}>
          <View style={styles.emptyIcon}>
            <Film size={24} color={DW_ACCENT} />
          </View>
          <Text style={styles.emptyTitle}>Build your library</Text>
          <Text style={styles.emptyBody}>
            Add filmed demos from your camera roll or record a new one. Set a title and link each
            clip to an exercise, then upload them all at once.
          </Text>
        </View>
      ) : (
        items.map((item) => (
          <View key={item.id} style={styles.itemCard}>
            <View style={styles.itemHeader}>
              <View style={styles.thumbWrap}>
                {item.thumbnailUri ? (
                  <Image source={{ uri: item.thumbnailUri }} style={styles.thumb} />
                ) : (
                  <View style={styles.thumbPlaceholder}>
                    <Video size={18} color={DW_TEXT.tertiary} />
                  </View>
                )}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.itemStatus}>{statusLabel(item)}</Text>
                {item.status === 'uploading' || item.status === 'done' ? (
                  <View style={styles.progressTrack}>
                    <View style={[styles.progressFill, { width: `${Math.round(item.progress * 100)}%` }]} />
                  </View>
                ) : null}
                {item.error ? <Text style={styles.itemError}>{item.error}</Text> : null}
              </View>
              {item.status !== 'uploading' ? (
                <Pressable
                  onPress={() => removeItem(item.id)}
                  style={styles.iconButton}
                  accessibilityRole="button"
                  accessibilityLabel="Remove video"
                >
                  <Trash2 size={16} color={DW_TEXT.tertiary} />
                </Pressable>
              ) : null}
            </View>

            {item.status !== 'done' ? (
              <View style={styles.itemBody}>
                <StudioField
                  label="Title"
                  value={item.title}
                  onChangeText={(text) => updateItem(item.id, { title: text })}
                  placeholder="e.g. Barbell bench setup"
                  editable={item.status !== 'uploading'}
                />
                <StudioTextArea
                  label="Description"
                  value={item.description}
                  onChangeText={(text) => updateItem(item.id, { description: text })}
                  placeholder="Coaching cues, tempo, common mistakes…"
                />
                <View style={styles.field}>
                  <Text style={styles.label}>Exercise</Text>
                  <Pressable
                    style={styles.exercisePick}
                    onPress={() => setPickerItemId(item.id)}
                    accessibilityRole="button"
                    accessibilityLabel="Link an exercise"
                  >
                    <Plus size={15} color={item.exerciseSlug ? DW_ACCENT : DW_TEXT.tertiary} />
                    <Text style={[styles.exercisePickText, item.exerciseSlug && { color: DW_TEXT.primary }]}>
                      {item.exerciseName ?? 'Link an exercise (required)'}
                    </Text>
                  </Pressable>
                </View>
                <AngleSelector value={item.angle} onChange={(next) => updateItem(item.id, { angle: next })} />
                <PremiumToggle value={item.isPremium} onChange={(next) => updateItem(item.id, { isPremium: next })} />
                {item.status === 'error' ? (
                  <Pressable
                    style={styles.retryRow}
                    onPress={() => retryOne(item.id)}
                    accessibilityRole="button"
                    accessibilityLabel="Retry upload"
                  >
                    <RefreshCw size={15} color={DW_ACCENT} />
                    <Text style={styles.retryText}>Retry upload</Text>
                  </Pressable>
                ) : null}
              </View>
            ) : null}
          </View>
        ))
      )}

      {readyCount > 0 ? (
        <StudioButton
          label={anyUploading ? 'Uploading…' : `Upload ${readyCount} ${readyCount === 1 ? 'video' : 'videos'}`}
          onPress={() => void uploadAll()}
          disabled={anyUploading}
        />
      ) : null}

      <ExercisePickerSheet
        visible={activeItem !== null}
        exercises={exercises}
        onSelect={(exercise) => {
          if (pickerItemId) {
            updateItem(pickerItemId, { exerciseSlug: exercise.id, exerciseName: exercise.name });
          }
          setPickerItemId(null);
        }}
        onClose={() => setPickerItemId(null)}
      />
    </View>
  );
}

function statusLabel(item: UploadItem): string {
  switch (item.status) {
    case 'draft':
      return item.exerciseSlug && item.title.trim() ? 'Ready to upload' : 'Needs a title + exercise';
    case 'uploading':
      return `Uploading ${Math.round(item.progress * 100)}%`;
    case 'done':
      return 'Uploaded';
    case 'error':
      return 'Upload failed';
  }
}

const styles = StyleSheet.create({
  container: {
    gap: 14,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 12,
  },
  emptyState: {
    alignItems: 'center',
    gap: 8,
    paddingVertical: 28,
    paddingHorizontal: 16,
  },
  emptyIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: `${DW_ACCENT}18`,
  },
  emptyTitle: {
    fontFamily: WK_FONTS.bold,
    fontSize: 17,
    color: DW_TEXT.primary,
  },
  emptyBody: {
    fontFamily: WK_FONTS.regular,
    fontSize: 14,
    color: DW_TEXT.secondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  itemCard: {
    backgroundColor: DW_SURFACES.low,
    borderColor: DW_BORDER.subtle,
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
    gap: 12,
  },
  itemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  thumbWrap: {
    width: 64,
    height: 64,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: DW_SURFACES.high,
  },
  thumb: {
    width: '100%',
    height: '100%',
  },
  thumbPlaceholder: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemStatus: {
    fontFamily: WK_FONTS.semiBold,
    fontSize: 13,
    color: DW_TEXT.secondary,
  },
  itemError: {
    marginTop: 4,
    fontFamily: WK_FONTS.regular,
    fontSize: 12,
    color: '#FF8B7A',
  },
  progressTrack: {
    marginTop: 8,
    height: 6,
    borderRadius: 999,
    backgroundColor: DW_SURFACES.high,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: DW_ACCENT,
    borderRadius: 999,
  },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: DW_SURFACES.high,
  },
  itemBody: {
    gap: 12,
  },
  field: {
    gap: 6,
  },
  label: {
    fontFamily: WK_FONTS.semiBold,
    fontSize: 12,
    color: DW_TEXT.secondary,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  exercisePick: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: DW_SURFACES.mid,
    borderColor: DW_BORDER.subtle,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  exercisePickText: {
    fontFamily: WK_FONTS.medium,
    fontSize: 15,
    color: DW_TEXT.tertiary,
  },
  retryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 4,
  },
  retryText: {
    fontFamily: WK_FONTS.bold,
    fontSize: 13,
    color: DW_ACCENT,
  },
});
