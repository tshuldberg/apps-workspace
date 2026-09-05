// Trainer Studio manage grid. Lists every video the trainer owns (including
// hidden ones, visible to the owner through the trainer-modify RLS policy),
// with per-video view counts. Supports edit metadata, hide/unhide, set primary,
// and delete.

import { memo, useCallback, useEffect, useMemo, useState, type ReactElement } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Eye, EyeOff, Pencil, Star, Trash2, Video } from 'lucide-react-native';
import type { SupabaseClient } from '@supabase/supabase-js';
import { WK_FONTS } from '@mylife/workouts';
import {
  deleteTrainerVideo,
  listTrainerVideos,
  setPrimaryTrainerVideo,
  setTrainerVideoHidden,
  updateTrainerVideoMeta,
  type TrainerVideoAngle,
  type TrainerVideoRow,
} from '../../data/cloud-trainer-videos';
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

type LoadState =
  | { state: 'loading' }
  | { state: 'error'; message: string }
  | { state: 'ready'; videos: TrainerVideoRow[] };

interface EditDraft {
  video: TrainerVideoRow;
  title: string;
  description: string;
  isPremium: boolean;
  angle: TrainerVideoAngle | null;
  exerciseSlug: string;
  exerciseName: string | null;
  saving: boolean;
}

const VideoManageCard = memo(function VideoManageCard({
  video,
  exerciseLabel,
  busy,
  onEdit,
  onToggleHidden,
  onMakePrimary,
  onDelete,
}: {
  video: TrainerVideoRow;
  exerciseLabel: string;
  busy: boolean;
  onEdit: (video: TrainerVideoRow) => void;
  onToggleHidden: (video: TrainerVideoRow) => void;
  onMakePrimary: (video: TrainerVideoRow) => void;
  onDelete: (video: TrainerVideoRow) => void;
}) {
  return (
    <View style={[styles.card, video.isHidden && styles.cardHidden]}>
      <View style={styles.cardTop}>
        <View style={styles.thumbWrap}>
          {video.thumbnailUrl ? (
            <Image source={{ uri: video.thumbnailUrl }} style={styles.thumb} />
          ) : (
            <View style={styles.thumbPlaceholder}>
              <Video size={18} color={DW_TEXT.tertiary} />
            </View>
          )}
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.title} numberOfLines={1}>
            {video.title ?? 'Untitled demo'}
          </Text>
          <Text style={styles.meta} numberOfLines={1}>
            {exerciseLabel}
          </Text>
          <View style={styles.badgeRow}>
            {video.isPrimary ? <Text style={[styles.badge, styles.badgePrimary]}>Primary</Text> : null}
            {video.isPremium ? <Text style={[styles.badge, styles.badgePremium]}>Premium</Text> : null}
            {video.isHidden ? <Text style={[styles.badge, styles.badgeHidden]}>Hidden</Text> : null}
            <Text style={styles.viewCount}>
              {video.viewCount} {video.viewCount === 1 ? 'view' : 'views'}
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.cardActions}>
        <ActionButton
          icon={<Pencil size={15} color={DW_TEXT.primary} />}
          label="Edit"
          onPress={() => onEdit(video)}
          disabled={busy}
        />
        <ActionButton
          icon={video.isHidden ? <Eye size={15} color={DW_TEXT.primary} /> : <EyeOff size={15} color={DW_TEXT.primary} />}
          label={video.isHidden ? 'Unhide' : 'Hide'}
          onPress={() => onToggleHidden(video)}
          disabled={busy}
        />
        <ActionButton
          icon={<Star size={15} color={video.isPrimary ? DW_ACCENT : DW_TEXT.primary} />}
          label="Primary"
          onPress={() => onMakePrimary(video)}
          disabled={busy || video.isPrimary}
        />
        <ActionButton
          icon={<Trash2 size={15} color="#FF8B7A" />}
          label="Delete"
          onPress={() => onDelete(video)}
          disabled={busy}
        />
      </View>
    </View>
  );
});

function RowSeparator() {
  return <View style={styles.rowSeparator} />;
}

export function ManageGrid({
  supabase,
  trainerId,
  exercises,
  reloadToken,
  header,
}: {
  supabase: SupabaseClient;
  trainerId: string;
  exercises: ExerciseOption[];
  reloadToken: number;
  header?: ReactElement;
}) {
  const [load, setLoad] = useState<LoadState>({ state: 'loading' });
  const [draft, setDraft] = useState<EditDraft | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const exerciseName = useMemo(() => {
    const map = new Map(exercises.map((exercise) => [exercise.id, exercise.name]));
    return (slug: string) => map.get(slug) ?? slug;
  }, [exercises]);

  const reload = useCallback(async () => {
    const result = await listTrainerVideos(supabase, trainerId);
    if (!result.ok) {
      setLoad({ state: 'error', message: result.error });
      return;
    }
    setLoad({ state: 'ready', videos: result.videos });
  }, [supabase, trainerId]);

  useEffect(() => {
    setLoad({ state: 'loading' });
    void reload();
  }, [reload, reloadToken]);

  const openEditor = useCallback((video: TrainerVideoRow) => {
    setDraft({
      video,
      title: video.title ?? '',
      description: video.description ?? '',
      isPremium: video.isPremium,
      angle: video.angle,
      exerciseSlug: video.exerciseSlug,
      exerciseName: null,
      saving: false,
    });
  }, []);

  const saveDraft = useCallback(async () => {
    if (!draft) return;
    setDraft({ ...draft, saving: true });
    const result = await updateTrainerVideoMeta(supabase, draft.video.id, {
      title: draft.title,
      description: draft.description,
      isPremium: draft.isPremium,
      angle: draft.angle,
      exerciseSlug: draft.exerciseSlug,
    });
    if (!result.ok) {
      setDraft({ ...draft, saving: false });
      Alert.alert('Could not save', result.error);
      return;
    }
    setDraft(null);
    await reload();
  }, [draft, supabase, reload]);

  const toggleHidden = useCallback(
    async (video: TrainerVideoRow) => {
      setBusyId(video.id);
      const result = await setTrainerVideoHidden(supabase, video.id, !video.isHidden);
      setBusyId(null);
      if (!result.ok) {
        Alert.alert('Could not update', result.error);
        return;
      }
      await reload();
    },
    [supabase, reload],
  );

  const makePrimary = useCallback(
    async (video: TrainerVideoRow) => {
      setBusyId(video.id);
      const result = await setPrimaryTrainerVideo(supabase, video.exerciseSlug, video.id);
      setBusyId(null);
      if (!result.ok) {
        Alert.alert('Could not update', result.error);
        return;
      }
      await reload();
    },
    [supabase, reload],
  );

  const confirmDelete = useCallback(
    (video: TrainerVideoRow) => {
      Alert.alert('Delete video?', 'This removes the video from your library. This cannot be undone.', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              setBusyId(video.id);
              const result = await deleteTrainerVideo(supabase, video.id);
              setBusyId(null);
              if (!result.ok) {
                Alert.alert('Could not delete', result.error);
                return;
              }
              await reload();
            })();
          },
        },
      ]);
    },
    [supabase, reload],
  );

  const renderVideo = useCallback(
    ({ item }: { item: TrainerVideoRow }) => (
      <VideoManageCard
        video={item}
        exerciseLabel={exerciseName(item.exerciseSlug)}
        busy={busyId === item.id}
        onEdit={openEditor}
        onToggleHidden={toggleHidden}
        onMakePrimary={makePrimary}
        onDelete={confirmDelete}
      />
    ),
    [exerciseName, busyId, openEditor, toggleHidden, makePrimary, confirmDelete],
  );

  const keyExtractor = useCallback((item: TrainerVideoRow) => item.id, []);

  const listEmpty =
    load.state === 'loading' ? (
      <View style={styles.centered}>
        <ActivityIndicator color={DW_ACCENT} />
        <Text style={styles.centeredText}>Loading your library…</Text>
      </View>
    ) : load.state === 'error' ? (
      <View style={styles.centered}>
        <Text style={styles.errorTitle}>Can&rsquo;t load your library</Text>
        <Text style={styles.centeredText}>{load.message}</Text>
        <StudioButton label="Retry" variant="secondary" onPress={() => void reload()} />
      </View>
    ) : (
      <View style={styles.centered}>
        <View style={styles.emptyIcon}>
          <Video size={24} color={DW_ACCENT} />
        </View>
        <Text style={styles.errorTitle}>No videos yet</Text>
        <Text style={styles.centeredText}>Upload demos from the Upload tab to see them here.</Text>
      </View>
    );

  const videos = load.state === 'ready' ? load.videos : [];

  return (
    <View style={styles.flex}>
      <FlatList
        data={videos}
        renderItem={renderVideo}
        keyExtractor={keyExtractor}
        ListHeaderComponent={header ? <View style={styles.headerWrap}>{header}</View> : undefined}
        ListEmptyComponent={listEmpty}
        ItemSeparatorComponent={RowSeparator}
        contentContainerStyle={styles.scrollerContent}
        initialNumToRender={8}
        windowSize={7}
        keyboardShouldPersistTaps="handled"
      />

      <Modal
        visible={draft !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setDraft(null)}
      >
        <View style={styles.modalBackdrop}>
          <Pressable
            style={StyleSheet.absoluteFillObject}
            onPress={() => setDraft(null)}
            accessibilityRole="button"
            accessibilityLabel="Close"
          />
          <View style={styles.modalSheet}>
            <View style={styles.sheetHandle} />
            <Text style={styles.modalTitle}>Edit video</Text>
            {draft ? (
              <ScrollView keyboardShouldPersistTaps="handled" style={styles.modalScroll}>
                <View style={{ gap: 12 }}>
                  <StudioField
                    label="Title"
                    value={draft.title}
                    onChangeText={(text) => setDraft({ ...draft, title: text })}
                    placeholder="Video title"
                  />
                  <StudioTextArea
                    label="Description"
                    value={draft.description}
                    onChangeText={(text) => setDraft({ ...draft, description: text })}
                    placeholder="Coaching cues…"
                  />
                  <View style={styles.field}>
                    <Text style={styles.fieldLabel}>Exercise</Text>
                    <Pressable
                      style={styles.exercisePick}
                      onPress={() => setPickerOpen(true)}
                      accessibilityRole="button"
                    >
                      <Text style={styles.exercisePickText}>
                        {draft.exerciseName ?? exerciseName(draft.exerciseSlug)}
                      </Text>
                    </Pressable>
                  </View>
                  <AngleSelector value={draft.angle} onChange={(next) => setDraft({ ...draft, angle: next })} />
                  <PremiumToggle
                    value={draft.isPremium}
                    onChange={(next) => setDraft({ ...draft, isPremium: next })}
                  />
                  <View style={styles.modalButtons}>
                    <View style={{ flex: 1 }}>
                      <StudioButton label="Cancel" variant="secondary" onPress={() => setDraft(null)} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <StudioButton
                        label={draft.saving ? 'Saving…' : 'Save'}
                        onPress={() => void saveDraft()}
                        disabled={draft.saving}
                      />
                    </View>
                  </View>
                </View>
              </ScrollView>
            ) : null}
          </View>
        </View>
      </Modal>

      <ExercisePickerSheet
        visible={pickerOpen}
        exercises={exercises}
        onSelect={(exercise) => {
          if (draft) setDraft({ ...draft, exerciseSlug: exercise.id, exerciseName: exercise.name });
          setPickerOpen(false);
        }}
        onClose={() => setPickerOpen(false)}
      />
    </View>
  );
}

function ActionButton({
  icon,
  label,
  onPress,
  disabled,
}: {
  icon: React.ReactNode;
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      style={({ pressed }) => [styles.actionButton, pressed && { opacity: 0.86 }, disabled && { opacity: 0.4 }]}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      {icon}
      <Text style={styles.actionLabel}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  scrollerContent: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 60,
  },
  headerWrap: {
    paddingBottom: 16,
  },
  rowSeparator: {
    height: 12,
  },
  centered: {
    alignItems: 'center',
    gap: 10,
    paddingVertical: 32,
    paddingHorizontal: 20,
  },
  centeredText: {
    fontFamily: WK_FONTS.regular,
    fontSize: 14,
    color: DW_TEXT.secondary,
    textAlign: 'center',
  },
  errorTitle: {
    fontFamily: WK_FONTS.bold,
    fontSize: 17,
    color: DW_TEXT.primary,
  },
  emptyIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: `${DW_ACCENT}18`,
  },
  card: {
    backgroundColor: DW_SURFACES.low,
    borderColor: DW_BORDER.subtle,
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
    gap: 12,
  },
  cardHidden: {
    opacity: 0.7,
  },
  cardTop: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },
  thumbWrap: {
    width: 68,
    height: 68,
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
  title: {
    fontFamily: WK_FONTS.bold,
    fontSize: 15,
    color: DW_TEXT.primary,
  },
  meta: {
    marginTop: 2,
    fontFamily: WK_FONTS.regular,
    fontSize: 13,
    color: DW_TEXT.secondary,
    textTransform: 'capitalize',
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 6,
  },
  badge: {
    fontFamily: WK_FONTS.bold,
    fontSize: 10,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 3,
    overflow: 'hidden',
  },
  badgePrimary: {
    color: DW_ACCENT,
    backgroundColor: `${DW_ACCENT}1A`,
  },
  badgePremium: {
    color: '#8BCFF0',
    backgroundColor: 'rgba(139, 207, 240, 0.14)',
  },
  badgeHidden: {
    color: DW_TEXT.tertiary,
    backgroundColor: DW_SURFACES.high,
  },
  viewCount: {
    fontFamily: WK_FONTS.semiBold,
    fontSize: 11,
    color: DW_TEXT.tertiary,
  },
  cardActions: {
    flexDirection: 'row',
    gap: 8,
    borderTopColor: DW_BORDER.subtle,
    borderTopWidth: 1,
    paddingTop: 12,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'column',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: DW_SURFACES.mid,
  },
  actionLabel: {
    fontFamily: WK_FONTS.semiBold,
    fontSize: 11,
    color: DW_TEXT.secondary,
  },
  modalBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.62)',
  },
  modalSheet: {
    maxHeight: '88%',
    backgroundColor: DW_SURFACES.low,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 28,
    gap: 12,
  },
  modalScroll: {
    flexGrow: 0,
  },
  sheetHandle: {
    alignSelf: 'center',
    width: 44,
    height: 4,
    borderRadius: 999,
    backgroundColor: DW_BORDER.strong,
  },
  modalTitle: {
    fontFamily: WK_FONTS.extraBold,
    fontSize: 20,
    color: DW_TEXT.primary,
  },
  field: {
    gap: 6,
  },
  fieldLabel: {
    fontFamily: WK_FONTS.semiBold,
    fontSize: 12,
    color: DW_TEXT.secondary,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  exercisePick: {
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
    color: DW_TEXT.primary,
    textTransform: 'capitalize',
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 4,
  },
});
