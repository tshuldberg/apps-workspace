import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import {
  Chip,
  GlassPanel,
  MaterialSymbol,
  PHOTO_VIEW_TYPES,
  WK_ACCENT_LIGHT,
  WK_FONTS,
  WK_SURFACES,
  WK_TYPOGRAPHY,
  createProgressPhoto,
  deleteProgressPhoto,
  getProgressPhotos,
  type PhotoViewType,
  type ProgressPhoto,
} from '@mylife/workouts';
import { spacing } from '@mylife/ui';
import { useDatabase } from '../../components/DatabaseProvider';
import { WorkoutHero, WorkoutPrimaryButton, WorkoutSecondaryButton } from './(tabs)/_screen-kit';

type ViewFilter = 'all' | PhotoViewType;

function formatDisplayDate(value: string): string {
  return new Date(value).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export default function PhotosScreen() {
  const db = useDatabase();
  const [viewFilter, setViewFilter] = useState<ViewFilter>('all');
  const [photos, setPhotos] = useState<ProgressPhoto[]>([]);
  const [compareMode, setCompareMode] = useState(false);
  const [compareSelection, setCompareSelection] = useState<ProgressPhoto[]>([]);
  const [previewPhoto, setPreviewPhoto] = useState<ProgressPhoto | null>(null);
  const [showCompareModal, setShowCompareModal] = useState(false);
  const [showComposer, setShowComposer] = useState(false);
  const [draftViewType, setDraftViewType] = useState<PhotoViewType>('front');
  const [draftNotes, setDraftNotes] = useState('');

  const loadPhotos = useCallback(() => {
    setPhotos(getProgressPhotos(db, viewFilter === 'all' ? undefined : viewFilter));
  }, [db, viewFilter]);

  useEffect(() => {
    loadPhotos();
  }, [loadPhotos]);

  const compareReady = compareSelection.length === 2;
  const filteredLabel = useMemo(() => {
    if (viewFilter === 'all') return 'All angles';
    return viewFilter.replace(/_/g, ' ');
  }, [viewFilter]);

  const handleDelete = (photo: ProgressPhoto) => {
    Alert.alert('Delete photo', 'Remove this progress photo from the timeline?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          deleteProgressPhoto(db, photo.id);
          setPreviewPhoto(null);
          loadPhotos();
        },
      },
    ]);
  };

  const persistPickedPhoto = async (
    launchResult: ImagePicker.ImagePickerResult,
  ) => {
    if (launchResult.canceled || !launchResult.assets[0]) return;

    const asset = launchResult.assets[0];

    try {
      createProgressPhoto(db, {
        photoUri: asset.uri,
        viewType: draftViewType,
        notes: draftNotes,
        takenAt: new Date().toISOString(),
        fileSizeBytes: asset.fileSize ?? 0,
        width: asset.width ?? 0,
        height: asset.height ?? 0,
      });
      setDraftNotes('');
      setShowComposer(false);
      loadPhotos();
    } catch (error) {
      Alert.alert(
        'Could not save photo',
        error instanceof Error ? error.message : 'Please try again.',
      );
    }
  };

  const handleLaunchCamera = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Camera access needed', 'Allow camera access to capture progress photos.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      allowsEditing: false,
      quality: 0.8,
    });
    await persistPickedPhoto(result);
  };

  const handleLaunchLibrary = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Library access needed', 'Allow photo library access to import progress photos.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: false,
      quality: 0.8,
      selectionLimit: 1,
    });
    await persistPickedPhoto(result);
  };

  const handlePhotoPress = (photo: ProgressPhoto) => {
    if (!compareMode) {
      setPreviewPhoto(photo);
      return;
    }

    setCompareSelection((current) => {
      if (current.some((item) => item.id === photo.id)) {
        return current.filter((item) => item.id !== photo.id);
      }
      if (current.length === 2) {
        return [current[1], photo];
      }
      return [...current, photo];
    });
  };

  return (
    <>
      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
        <WorkoutHero
          eyebrow="Tracking Surface"
          title="Visual Journey"
          subtitle="Filter by angle, build comparisons, and keep every progress shot offline and private."
          accent={WK_ACCENT_LIGHT}
          action={
            <WorkoutSecondaryButton
              label="Add Photo"
              icon="photo_camera"
              onPress={() => setShowComposer(true)}
            />
          }
        />

        <GlassPanel style={styles.panel}>
          <View style={styles.rowBetween}>
            <Text style={styles.sectionLabel}>View Type</Text>
            <Pressable onPress={() => setCompareMode((value) => !value)} style={styles.comparePill}>
              <MaterialSymbol name="photo_camera" size={16} color={WK_ACCENT_LIGHT} />
              <Text style={styles.comparePillText}>
                {compareMode ? `Compare (${compareSelection.length}/2)` : 'Compare'}
              </Text>
            </Pressable>
          </View>

          <View style={styles.chipRow}>
            <Chip label="All" selected={viewFilter === 'all'} onPress={() => setViewFilter('all')} />
            {PHOTO_VIEW_TYPES.map((viewType) => (
              <Chip
                key={viewType}
                label={viewType.replace(/_/g, ' ')}
                selected={viewFilter === viewType}
                onPress={() => setViewFilter(viewType)}
              />
            ))}
          </View>

          <Text style={styles.helperCopy}>
            {photos.length} stored locally • {filteredLabel}
          </Text>
        </GlassPanel>

        <View style={styles.grid}>
          {photos.map((photo) => {
            const isSelected = compareSelection.some((item) => item.id === photo.id);

            return (
              <Pressable
                key={photo.id}
                onPress={() => handlePhotoPress(photo)}
                onLongPress={() => handleDelete(photo)}
                style={[styles.photoTile, isSelected && styles.photoTileSelected]}
              >
                <Image source={{ uri: photo.photoUri }} style={styles.photoImage} />
                <View style={styles.photoOverlay}>
                  <Text style={styles.photoDate}>{formatDisplayDate(photo.takenAt)}</Text>
                  <Text style={styles.photoView}>{photo.viewType.replace(/_/g, ' ')}</Text>
                </View>
              </Pressable>
            );
          })}
        </View>

        {!photos.length ? (
          <GlassPanel style={styles.emptyPanel}>
            <MaterialSymbol name="photo_camera" size={22} color={WK_ACCENT_LIGHT} />
            <Text style={styles.emptyTitle}>No progress photos yet</Text>
            <Text style={styles.emptyCopy}>
              Use consistent lighting and the same angles to make the compare view more useful.
            </Text>
          </GlassPanel>
        ) : null}

        {compareReady ? (
          <WorkoutPrimaryButton
            label="Open Compare"
            icon="photo_camera"
            onPress={() => setShowCompareModal(true)}
          />
        ) : null}
      </ScrollView>

      <Modal visible={showComposer} animationType="slide" transparent>
        <View style={styles.modalScrim}>
          <View style={styles.modalCard}>
            <View style={styles.rowBetween}>
              <View>
                <Text style={styles.modalTitle}>Add Progress Photo</Text>
                <Text style={styles.modalSubtitle}>
                  Choose a view type first, then capture or import the image.
                </Text>
              </View>
              <Pressable onPress={() => setShowComposer(false)} style={styles.closeButton}>
                <MaterialSymbol name="close" size={18} color="rgba(214, 195, 181, 0.72)" />
              </Pressable>
            </View>

            <View style={styles.chipRow}>
              {PHOTO_VIEW_TYPES.map((viewType) => (
                <Chip
                  key={viewType}
                  label={viewType.replace(/_/g, ' ')}
                  selected={draftViewType === viewType}
                  onPress={() => setDraftViewType(viewType)}
                />
              ))}
            </View>

            <View style={styles.inputCard}>
              <Text style={styles.inputLabel}>Notes</Text>
              <TextInput
                value={draftNotes}
                onChangeText={setDraftNotes}
                placeholder="Front pose after lower body block"
                placeholderTextColor="rgba(214, 195, 181, 0.36)"
                style={styles.input}
              />
            </View>

            <WorkoutPrimaryButton label="Use Camera" icon="photo_camera" onPress={handleLaunchCamera} />
            <WorkoutSecondaryButton label="Choose Library" icon="menu_book" onPress={handleLaunchLibrary} />
          </View>
        </View>
      </Modal>

      <Modal visible={previewPhoto != null || showCompareModal} animationType="fade" transparent>
        <View style={styles.previewScrim}>
          <View style={styles.previewCard}>
            <View style={styles.rowBetween}>
              <View>
                <Text style={styles.modalTitle}>
                  {compareReady ? 'Compare Photos' : previewPhoto?.viewType.replace(/_/g, ' ')}
                </Text>
                <Text style={styles.modalSubtitle}>
                  {compareReady ? 'Tap and hold any tile to delete it from the timeline.' : previewPhoto ? formatDisplayDate(previewPhoto.takenAt) : ''}
                </Text>
              </View>
              <Pressable
                onPress={() => {
                  setPreviewPhoto(null);
                  setShowCompareModal(false);
                  setCompareSelection([]);
                  setCompareMode(false);
                }}
                style={styles.closeButton}
              >
                <MaterialSymbol name="close" size={18} color="rgba(214, 195, 181, 0.72)" />
              </Pressable>
            </View>

            {compareReady ? (
              <View style={styles.compareRow}>
                {compareSelection.map((photo) => (
                  <View key={photo.id} style={styles.compareColumn}>
                    <Image source={{ uri: photo.photoUri }} style={styles.compareImage} />
                    <Text style={styles.compareLabel}>{photo.viewType.replace(/_/g, ' ')}</Text>
                  </View>
                ))}
              </View>
            ) : previewPhoto ? (
              <Image source={{ uri: previewPhoto.photoUri }} style={styles.previewImage} />
            ) : null}
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: WK_SURFACES.lowest,
  },
  content: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
    gap: spacing.lg,
  },
  panel: {
    gap: spacing.md,
    backgroundColor: WK_SURFACES.low,
  },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  sectionLabel: {
    ...WK_TYPOGRAPHY.labelUpper,
    color: 'rgba(214, 195, 181, 0.68)',
  },
  comparePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    borderRadius: 999,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    backgroundColor: 'rgba(255, 184, 119, 0.12)',
  },
  comparePillText: {
    fontFamily: WK_FONTS.medium,
    fontSize: 12,
    color: WK_ACCENT_LIGHT,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  helperCopy: {
    fontFamily: WK_FONTS.medium,
    fontSize: 12,
    color: 'rgba(214, 195, 181, 0.62)',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  photoTile: {
    width: '31%',
    aspectRatio: 0.78,
    borderRadius: 22,
    overflow: 'hidden',
    backgroundColor: WK_SURFACES.low,
  },
  photoTileSelected: {
    shadowColor: '#FFB877',
    shadowOpacity: 0.28,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
  },
  photoImage: {
    width: '100%',
    height: '100%',
  },
  photoOverlay: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    left: 0,
    padding: spacing.sm,
    backgroundColor: 'rgba(10, 10, 15, 0.68)',
    gap: 2,
  },
  photoDate: {
    fontFamily: WK_FONTS.semiBold,
    fontSize: 11,
    color: '#FFF3E7',
  },
  photoView: {
    fontFamily: WK_FONTS.regular,
    fontSize: 10,
    color: 'rgba(214, 195, 181, 0.7)',
    textTransform: 'capitalize',
  },
  emptyPanel: {
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: WK_SURFACES.low,
  },
  emptyTitle: {
    fontFamily: WK_FONTS.semiBold,
    fontSize: 16,
    color: '#FFF3E7',
  },
  emptyCopy: {
    fontFamily: WK_FONTS.regular,
    fontSize: 14,
    lineHeight: 20,
    color: 'rgba(214, 195, 181, 0.62)',
    textAlign: 'center',
  },
  modalScrim: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.72)',
  },
  modalCard: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: spacing.lg,
    gap: spacing.md,
    backgroundColor: WK_SURFACES.base,
  },
  modalTitle: {
    fontFamily: WK_FONTS.bold,
    fontSize: 22,
    lineHeight: 28,
    color: '#FFF3E7',
    textTransform: 'capitalize',
  },
  modalSubtitle: {
    fontFamily: WK_FONTS.regular,
    fontSize: 13,
    lineHeight: 18,
    color: 'rgba(214, 195, 181, 0.66)',
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: WK_SURFACES.low,
  },
  inputCard: {
    borderRadius: 22,
    padding: spacing.md,
    gap: spacing.sm,
    backgroundColor: WK_SURFACES.low,
  },
  inputLabel: {
    fontFamily: WK_FONTS.medium,
    fontSize: 12,
    color: 'rgba(214, 195, 181, 0.72)',
  },
  input: {
    fontFamily: WK_FONTS.medium,
    fontSize: 16,
    lineHeight: 22,
    color: '#FFF3E7',
    paddingVertical: 0,
  },
  previewScrim: {
    flex: 1,
    justifyContent: 'center',
    padding: spacing.lg,
    backgroundColor: 'rgba(0, 0, 0, 0.82)',
  },
  previewCard: {
    borderRadius: 28,
    padding: spacing.lg,
    gap: spacing.md,
    backgroundColor: WK_SURFACES.base,
  },
  previewImage: {
    width: '100%',
    aspectRatio: 0.74,
    borderRadius: 22,
  },
  compareRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  compareColumn: {
    flex: 1,
    gap: spacing.xs,
  },
  compareImage: {
    width: '100%',
    aspectRatio: 0.74,
    borderRadius: 22,
  },
  compareLabel: {
    fontFamily: WK_FONTS.medium,
    fontSize: 12,
    textTransform: 'capitalize',
    color: 'rgba(214, 195, 181, 0.7)',
    textAlign: 'center',
  },
});
