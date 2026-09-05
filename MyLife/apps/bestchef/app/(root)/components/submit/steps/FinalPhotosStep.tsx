import { Alert, Image, Pressable, StyleSheet, View } from 'react-native';
import { Plus, X } from 'lucide-react-native';
import { CountIndicator, InfoCard, StepHeader } from '@mylife/bestchef/ui';
import { JAKARTA_FONTS } from '@mylife/bestchef';
import { Text } from '@mylife/ui';
import { useI18n } from '../../../i18n/I18nProvider';
import { useAppThemeColors as useThemeColors } from '../../../providers/AppThemeProvider';
import { pickPhoto } from '../../../utils/media';
import type { SubmitDraftState, DraftPhoto } from '../../../state/useSubmitDraft';
import type { Dispatch } from 'react';

type Action =
  | { type: 'ADD_FINAL_PHOTO'; photo: DraftPhoto }
  | { type: 'REMOVE_FINAL_PHOTO'; id: string };

const MAX_PHOTOS = 4;

interface FinalPhotosStepProps {
  draft: SubmitDraftState;
  dispatch: Dispatch<Action>;
}

export function FinalPhotosStep({ draft, dispatch }: FinalPhotosStepProps) {
  const tc = useThemeColors();
  const { t, tp } = useI18n();

  async function handleAddPhoto() {
    try {
      const uri = await pickPhoto('library', { aspect: [4, 3] }, t);
      if (!uri) return;
      dispatch({
        type: 'ADD_FINAL_PHOTO',
        photo: { id: `fp-${Date.now()}`, uri },
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : t('Could not access camera/library. Please try again.');
      Alert.alert(t('Error'), msg);
    }
  }

  const atCap = draft.finalPhotos.length >= MAX_PHOTOS;

  return (
    <View style={styles.container}>
      <StepHeader
        title={t('Final photos')}
        subtitle={t('Photos of the plated dish')}
        required
      />

      <InfoCard
        title={t('Make it pop')}
        message={t('Bright, in-focus photos of the plated dish. Add 2-4 angles for the strongest submission.')}
      />

      {/* 2-col photo grid */}
      <View style={styles.grid}>
        {draft.finalPhotos.map((photo) => (
          <View key={photo.id} style={styles.photoTileWrapper}>
            <Image source={{ uri: photo.uri }} style={styles.photoTile} />
            <Pressable
              style={[styles.deleteBtn, { backgroundColor: 'rgba(0,0,0,0.55)' }]}
              onPress={() => dispatch({ type: 'REMOVE_FINAL_PHOTO', id: photo.id })}
              hitSlop={6}
            >
              <X size={11} color="#fff" strokeWidth={2.5} />
            </Pressable>
          </View>
        ))}
        {!atCap && (
          <Pressable
            style={[styles.addTile, { backgroundColor: tc.surface, borderColor: `${tc.accent}80` }]}
            onPress={handleAddPhoto}
          >
            <Plus size={22} color={tc.accent} strokeWidth={2.5} />
            <Text style={[styles.addTileLabel, { color: tc.text }]}>{t('Add photo')}</Text>
          </Pressable>
        )}
      </View>

      <CountIndicator
        count={draft.finalPhotos.length}
        target={1}
        unit={tp(draft.finalPhotos.length, 'photo', 'photos')}
        successTint
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 18 },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  photoTileWrapper: {
    width: '47%',
    aspectRatio: 1,
    borderRadius: 16,
    overflow: 'hidden',
    position: 'relative',
  },
  photoTile: {
    width: '100%',
    height: '100%',
    borderRadius: 16,
  },
  deleteBtn: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addTile: {
    width: '47%',
    aspectRatio: 1,
    borderRadius: 16,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  addTileLabel: { fontFamily: JAKARTA_FONTS.semiBold, fontSize: 12 },
});
