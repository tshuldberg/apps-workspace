import { Alert, Image, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { Camera, ImageIcon, Minus, Plus, X } from 'lucide-react-native';
import { InfoCard, StepHeader } from '@mylife/bestchef/ui';
import { JAKARTA_FONTS } from '@mylife/bestchef';
import { Text } from '@mylife/ui';
import { useI18n } from '../../../i18n/I18nProvider';
import { useAppThemeColors as useThemeColors } from '../../../providers/AppThemeProvider';
import { pickPhoto } from '../../../utils/media';
import type { SubmitDraftState, DraftIngredient, DraftPhoto } from '../../../state/useSubmitDraft';
import type { Dispatch } from 'react';

type Action =
  | { type: 'SET_INGREDIENT_PHOTO'; photo: DraftPhoto | null }
  | { type: 'ADD_INGREDIENT'; ingredient: DraftIngredient }
  | { type: 'REMOVE_INGREDIENT'; id: string }
  | { type: 'UPDATE_INGREDIENT'; ingredient: DraftIngredient };

interface IngredientsStepProps {
  draft: SubmitDraftState;
  dispatch: Dispatch<Action>;
}

export function IngredientsStep({ draft, dispatch }: IngredientsStepProps) {
  const tc = useThemeColors();
  const { t } = useI18n();

  async function handlePickPhoto(source: 'camera' | 'library') {
    try {
      const uri = await pickPhoto(source, { aspect: [4, 3] }, t);
      if (!uri) return;
      dispatch({
        type: 'SET_INGREDIENT_PHOTO',
        photo: { id: `ip-${Date.now()}`, uri },
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : t('Could not access camera/library. Please try again.');
      Alert.alert(t('Error'), msg);
    }
  }

  function addIngredient() {
    dispatch({
      type: 'ADD_INGREDIENT',
      ingredient: { id: `ing-${Date.now()}`, name: '', quantity: '' },
    });
  }

  function updateIngredient(updated: DraftIngredient) {
    dispatch({ type: 'UPDATE_INGREDIENT', ingredient: updated });
  }

  function removeIngredient(id: string) {
    dispatch({ type: 'REMOVE_INGREDIENT', id });
  }

  return (
    <View style={styles.container}>
      <StepHeader
        title={t('Mise en place')}
        subtitle={t('Mise en place ingredients')}
        required
      />

      <InfoCard
        title={t('Mise en place required')}
        message={t('One photo with all your ingredients pre-portioned and laid out')}
      />

      {/* Mise photo */}
      <View style={styles.section}>
        <Text style={[styles.sectionLabel, { color: tc.text }]}>
          {t('Portioned ingredients photo')}
        </Text>
        {draft.ingredientPhoto ? (
          <View style={styles.largePhotoWrapper}>
            <Image source={{ uri: draft.ingredientPhoto.uri }} style={styles.largePhoto} />
            <Pressable
              style={[styles.largeDeleteBtn, { backgroundColor: 'rgba(0,0,0,0.55)' }]}
              onPress={() => dispatch({ type: 'SET_INGREDIENT_PHOTO', photo: null })}
              hitSlop={6}
            >
              <X size={13} color="#fff" strokeWidth={2.5} />
            </Pressable>
          </View>
        ) : (
          <View style={styles.photoButtons}>
            <Pressable
              style={[styles.dashedButton, { backgroundColor: tc.surface, borderColor: `${tc.accent}80` }]}
              onPress={() => handlePickPhoto('camera')}
            >
              <Camera size={20} color={tc.accent} strokeWidth={2} />
              <Text style={[styles.dashedButtonLabel, { color: tc.text }]}>{t('Take Photo')}</Text>
            </Pressable>
            <Pressable
              style={[styles.dashedButton, { backgroundColor: tc.surface, borderColor: `${tc.accent}80` }]}
              onPress={() => handlePickPhoto('library')}
            >
              <ImageIcon size={20} color={tc.accent} strokeWidth={2} />
              <Text style={[styles.dashedButtonLabel, { color: tc.text }]}>{t('Choose from Library')}</Text>
            </Pressable>
          </View>
        )}
      </View>

      {/* Ingredient list */}
      <View style={styles.section}>
        <View style={styles.sectionHeaderRow}>
          <Text style={[styles.sectionLabel, { color: tc.text }]}>{t('Ingredients')}</Text>
          <Pressable style={[styles.addIngBtn, { backgroundColor: `${tc.accent}1A` }]} onPress={addIngredient}>
            <Plus size={12} color={tc.accent} strokeWidth={2.5} />
            <Text style={[styles.addIngBtnLabel, { color: tc.accent }]}>{t('Add')}</Text>
          </Pressable>
        </View>
        {draft.ingredients.map((ing) => (
          <View key={ing.id} style={styles.ingredientRow}>
            <TextInput
              style={[styles.ingNameInput, { color: tc.text, backgroundColor: tc.surface }]}
              placeholder={t('Ingredient')}
              placeholderTextColor={tc.textTertiary}
              value={ing.name}
              onChangeText={(v) => updateIngredient({ ...ing, name: v })}
            />
            <TextInput
              style={[styles.ingQtyInput, { color: tc.text, backgroundColor: tc.surface }]}
              placeholder={t('Qty')}
              placeholderTextColor={tc.textTertiary}
              value={ing.quantity}
              onChangeText={(v) => updateIngredient({ ...ing, quantity: v })}
            />
            <Pressable onPress={() => removeIngredient(ing.id)} hitSlop={8}>
              <Minus size={20} color={`${tc.accent}B3`} strokeWidth={2} />
            </Pressable>
          </View>
        ))}
        {draft.ingredients.length === 0 && (
          <Text style={[styles.emptyHint, { color: tc.textTertiary }]}>
            {t('Ingredients (one per line)')}
          </Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 18 },
  section: { gap: 10 },
  sectionLabel: { fontFamily: JAKARTA_FONTS.bold, fontSize: 14 },
  sectionHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  addIngBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  addIngBtnLabel: { fontFamily: JAKARTA_FONTS.bold, fontSize: 12 },
  largePhotoWrapper: {
    height: 180,
    borderRadius: 18,
    overflow: 'hidden',
    position: 'relative',
  },
  largePhoto: { width: '100%', height: '100%' },
  largeDeleteBtn: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoButtons: { flexDirection: 'row', gap: 10 },
  dashedButton: {
    flex: 1,
    height: 96,
    borderRadius: 16,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  dashedButtonLabel: { fontFamily: JAKARTA_FONTS.semiBold, fontSize: 12 },
  ingredientRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  ingNameInput: {
    flex: 1,
    fontFamily: JAKARTA_FONTS.regular,
    fontSize: 14,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  ingQtyInput: {
    width: 72,
    fontFamily: JAKARTA_FONTS.regular,
    fontSize: 14,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  emptyHint: { fontFamily: JAKARTA_FONTS.regular, fontSize: 13 },
});
