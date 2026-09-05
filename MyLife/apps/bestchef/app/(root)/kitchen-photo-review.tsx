import { useMemo, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AlertTriangle, Check, Circle, PackagePlus, RotateCcw } from 'lucide-react-native';
import {
  JAKARTA_FONTS,
  type FoodRecognitionCandidate,
  type FoodRecognitionConfirmationInput,
  type NutritionCandidate,
} from '@mylife/bestchef';
import { Text } from '@mylife/ui';
import { useDatabase } from './providers/DatabaseProvider';
import { useAppThemeColors as useThemeColors, useAppThemeProfile as useTheme } from './providers/AppThemeProvider';
import { useI18n } from './i18n/I18nProvider';
import { confirmKitchenFoodPhotoCandidates } from './data/kitchen';
import { BackArrow } from './components/DirectionalIcons';

interface CandidateDraft {
  selected: boolean;
  name: string;
  quantity: string;
  unit: string;
  expirationDate: string;
  lotCode: string;
  selectedNutritionCandidateId: string | null;
}

function parseCandidates(value: string | undefined): FoodRecognitionCandidate[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((entry): FoodRecognitionCandidate[] => {
      if (!entry || typeof entry !== 'object') return [];
      const candidate = entry as FoodRecognitionCandidate;
      if (typeof candidate.id !== 'string' || typeof candidate.name !== 'string') return [];
      return [{
        ...candidate,
        brand: candidate.brand ?? null,
        barcode: candidate.barcode ?? null,
        bounding_box: candidate.bounding_box ?? null,
        crop_uri: candidate.crop_uri ?? null,
        nutrition_candidates: Array.isArray(candidate.nutrition_candidates) ? candidate.nutrition_candidates : [],
        nutrition_provider_statuses: Array.isArray(candidate.nutrition_provider_statuses) ? candidate.nutrition_provider_statuses : [],
      }];
    });
  } catch {
    return [];
  }
}

function parseQuantity(value: string): number | null {
  const parsed = Number.parseFloat(value.trim());
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function nutritionSummary(candidate: NutritionCandidate): string {
  const facts = [
    candidate.nutrients.calories == null ? null : `${Math.round(candidate.nutrients.calories)} cal`,
    candidate.nutrients.protein_g == null ? null : `${candidate.nutrients.protein_g}g protein`,
    candidate.nutrients.carbs_g == null ? null : `${candidate.nutrients.carbs_g}g carbs`,
    candidate.nutrients.fat_g == null ? null : `${candidate.nutrients.fat_g}g fat`,
  ].filter(Boolean);
  return facts.length > 0 ? facts.join(' / ') : 'Missing nutrition facts';
}

function nutritionTitle(candidate: NutritionCandidate): string {
  return [candidate.display.shortLabel, candidate.brand, candidate.product_name]
    .filter(Boolean)
    .join(' / ');
}

function defaultNutritionCandidateId(candidate: FoodRecognitionCandidate): string | null {
  return candidate.nutrition_candidates.find((entry) => entry.auto_selectable)?.id ?? null;
}

function regionLabel(candidate: FoodRecognitionCandidate): string | null {
  if (candidate.crop_uri) return 'Crop available';
  if (!candidate.bounding_box) return null;
  const { x, y, width, height } = candidate.bounding_box;
  return `Region ${Math.round(x * 100)},${Math.round(y * 100)} / ${Math.round(width * 100)}x${Math.round(height * 100)}%`;
}

function CandidateCard({
  candidate,
  draft,
  onToggle,
  onChange,
}: {
  candidate: FoodRecognitionCandidate;
  draft: CandidateDraft;
  onToggle: () => void;
  onChange: (updates: Partial<CandidateDraft>) => void;
}) {
  const tc = useThemeColors();
  const theme = useTheme();
  const { t } = useI18n();
  const region = regionLabel(candidate);

  return (
    <View style={[styles.card, { backgroundColor: theme.glass.cardFill, borderColor: draft.selected ? tc.accent : theme.glass.cardBorder }]}>
      <Pressable
        style={({ pressed }) => [styles.cardTop, pressed && { opacity: 0.84, transform: [{ scale: 0.99 }] }]}
        onPress={onToggle}
      >
        <View style={[styles.checkIcon, { borderColor: draft.selected ? tc.accent : tc.textTertiary, backgroundColor: draft.selected ? `${tc.accent}24` : 'transparent' }]}>
          {draft.selected ? <Check size={15} color={tc.accent} strokeWidth={2.6} /> : <Circle size={13} color={tc.textTertiary} strokeWidth={2} />}
        </View>
        <View style={styles.cardTitleWrap}>
          <Text style={[styles.cardTitle, { color: tc.text }]} numberOfLines={1}>{draft.name}</Text>
          <Text style={[styles.cardMeta, { color: tc.textTertiary }]} numberOfLines={1}>
            {t(candidate.grocery_section)} / {t(candidate.storage_location)} / {Math.round(candidate.confidence * 100)}%
          </Text>
          {region ? (
            <Text style={[styles.cardMeta, { color: tc.textTertiary }]} numberOfLines={1}>
              {t(region)}
            </Text>
          ) : null}
        </View>
        {candidate.crop_uri ? (
          <Image source={{ uri: candidate.crop_uri }} style={styles.cropPreview} contentFit="cover" />
        ) : null}
      </Pressable>

      <View style={styles.nutritionBlock}>
        <View style={styles.nutritionHeader}>
          <Text style={[styles.nutritionTitle, { color: tc.text }]}>{t('Nutrition Source')}</Text>
          <Text style={[styles.nutritionMeta, { color: tc.textTertiary }]}>
            {candidate.nutrition_candidates.length > 1
              ? t('{count} matches', { count: candidate.nutrition_candidates.length })
              : t('{count} match', { count: candidate.nutrition_candidates.length })}
          </Text>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.nutritionChoices}>
          <Pressable
            style={({ pressed }) => [
              styles.nutritionChoice,
              { backgroundColor: draft.selectedNutritionCandidateId === null ? `${tc.accent}20` : tc.surface, borderColor: draft.selectedNutritionCandidateId === null ? tc.accent : 'transparent' },
              pressed && { opacity: 0.78, transform: [{ scale: 0.98 }] },
            ]}
            onPress={() => onChange({ selectedNutritionCandidateId: null })}
          >
            <Text style={[styles.nutritionChoiceTitle, { color: draft.selectedNutritionCandidateId === null ? tc.accent : tc.text }]}>
              {t('Pantry only')}
            </Text>
            <Text style={[styles.nutritionChoiceMeta, { color: tc.textTertiary }]}>{t('Reject matches')}</Text>
          </Pressable>
          {candidate.nutrition_candidates.map((match) => {
            const selected = draft.selectedNutritionCandidateId === match.id;
            return (
              <Pressable
                key={match.id}
                style={({ pressed }) => [
                  styles.nutritionChoice,
                  { backgroundColor: selected ? `${tc.accent}20` : tc.surface, borderColor: selected ? tc.accent : 'transparent' },
                  pressed && { opacity: 0.78, transform: [{ scale: 0.98 }] },
                ]}
                onPress={() => onChange({ selectedNutritionCandidateId: match.id })}
              >
                <Text style={[styles.nutritionChoiceTitle, { color: selected ? tc.accent : tc.text }]} numberOfLines={1}>
                  {nutritionTitle(match)}
                </Text>
                <Text style={[styles.nutritionChoiceMeta, { color: tc.textTertiary }]} numberOfLines={2}>
                  {nutritionSummary(match)} / {Math.round(match.confidence * 100)}% / {t(match.serving_basis)}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      <View style={styles.inputs}>
        <TextInput
          style={[styles.input, { color: tc.text, backgroundColor: tc.surface }]}
          value={draft.name}
          onChangeText={(name) => onChange({ name })}
          placeholder={t('Item name')}
          placeholderTextColor={tc.textTertiary}
        />
        <View style={styles.inline}>
          <TextInput
            style={[styles.input, styles.inlineInput, { color: tc.text, backgroundColor: tc.surface }]}
            value={draft.quantity}
            onChangeText={(quantity) => onChange({ quantity })}
            placeholder={t('Qty')}
            placeholderTextColor={tc.textTertiary}
            keyboardType="decimal-pad"
          />
          <TextInput
            style={[styles.input, styles.inlineInput, { color: tc.text, backgroundColor: tc.surface }]}
            value={draft.unit}
            onChangeText={(unit) => onChange({ unit })}
            placeholder={t('Unit')}
            placeholderTextColor={tc.textTertiary}
          />
        </View>
        <View style={styles.inline}>
          <TextInput
            style={[styles.input, styles.inlineInput, { color: tc.text, backgroundColor: tc.surface }]}
            value={draft.expirationDate}
            onChangeText={(expirationDate) => onChange({ expirationDate })}
            placeholder={t('YYYY-MM-DD')}
            placeholderTextColor={tc.textTertiary}
          />
          <TextInput
            style={[styles.input, styles.inlineInput, { color: tc.text, backgroundColor: tc.surface }]}
            value={draft.lotCode}
            onChangeText={(lotCode) => onChange({ lotCode })}
            placeholder={t('Lot')}
            placeholderTextColor={tc.textTertiary}
          />
        </View>
      </View>
    </View>
  );
}

export default function KitchenPhotoReviewScreen() {
  const db = useDatabase();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ photoUri?: string; candidatesJson?: string }>();
  const photoUri = typeof params.photoUri === 'string' ? params.photoUri : null;
  const [candidates] = useState(() => parseCandidates(typeof params.candidatesJson === 'string' ? params.candidatesJson : undefined));
  const tc = useThemeColors();
  const theme = useTheme();
  const { t, formatNumber } = useI18n();
  const [drafts, setDrafts] = useState<Record<string, CandidateDraft>>(() => Object.fromEntries(
    candidates.map((candidate) => [
      candidate.id,
      {
        selected: candidate.confidence >= 0.65,
        name: candidate.name,
        quantity: candidate.quantity == null ? '' : String(candidate.quantity),
        unit: candidate.unit ?? '',
        expirationDate: '',
        lotCode: '',
        selectedNutritionCandidateId: defaultNutritionCandidateId(candidate),
      },
    ]),
  ));
  const [busy, setBusy] = useState(false);

  const selectedCount = useMemo(() => (
    Object.values(drafts).filter((draft) => draft.selected).length
  ), [drafts]);

  const updateDraft = (candidateId: string, updates: Partial<CandidateDraft>) => {
    setDrafts((current) => ({
      ...current,
      [candidateId]: { ...current[candidateId]!, ...updates },
    }));
  };

  const confirmSelected = () => {
    if (busy || selectedCount === 0) return;
    const inputs = candidates
      .flatMap<FoodRecognitionConfirmationInput>((candidate) => {
        const draft = drafts[candidate.id];
        if (!draft?.selected || !draft.name.trim()) return [];
        const nutritionCandidate = draft.selectedNutritionCandidateId
          ? candidate.nutrition_candidates.find((match) => match.id === draft.selectedNutritionCandidateId) ?? null
          : null;
        return [{
          candidateId: candidate.id,
          name: draft.name.trim(),
          brand: candidate.brand,
          barcode: nutritionCandidate?.barcode ?? candidate.barcode,
          grocerySection: candidate.grocery_section,
          storageLocation: candidate.storage_location,
          quantity: parseQuantity(draft.quantity),
          unit: draft.unit.trim() || null,
          expirationDate: draft.expirationDate.trim() || null,
          lotCode: draft.lotCode.trim() || null,
          photoUri,
          cropUri: candidate.crop_uri,
          labels: candidate.labels,
          confidence: candidate.confidence,
          productId: nutritionCandidate?.product_id ?? null,
          nutritionDataId: nutritionCandidate?.nutrition_data_id ?? null,
          selectedNutritionCandidateId: nutritionCandidate?.id ?? null,
          nutritionCandidate,
        }];
      });

    setBusy(true);
    try {
      confirmKitchenFoodPhotoCandidates(db, inputs);
      router.replace('/pantry');
    } catch (error) {
      Alert.alert(t('Confirmation failed'), error instanceof Error ? error.message : t('Unable to update pantry.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={[styles.screen, { backgroundColor: tc.background }]}>
      <View style={[styles.topBar, { paddingTop: insets.top + 14 }]}>
        <Pressable
          style={({ pressed }) => [styles.iconButton, pressed && { opacity: 0.68, transform: [{ scale: 0.96 }] }]}
          onPress={() => router.back()}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel={t('Back')}
        >
          <BackArrow size={23} color={tc.text} strokeWidth={2} />
        </Pressable>
        <Text style={[styles.topBarTitle, { color: tc.text }]}>{t('Food Review')}</Text>
        <View style={styles.iconButton} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {candidates.length === 0 ? (
          <View style={[styles.emptyState, { backgroundColor: theme.glass.cardFill, borderColor: theme.glass.cardBorder }]}>
            <AlertTriangle size={28} color={tc.primaryContainer} strokeWidth={1.7} />
            <Text style={[styles.emptyTitle, { color: tc.text }]}>{t('No food candidates')}</Text>
            <Text style={[styles.emptyBody, { color: tc.textSecondary }]}>
              {t('Try another photo or paste candidate JSON from the recognition provider.')}
            </Text>
            <View style={styles.emptyActions}>
              <Pressable
                style={({ pressed }) => [
                  styles.retryButton,
                  { backgroundColor: tc.accent },
                  pressed && { opacity: 0.78, transform: [{ scale: 0.98 }] },
                ]}
                onPress={() => router.back()}
                accessibilityRole="button"
                accessibilityLabel={t('ocr_retry')}
              >
                <RotateCcw size={16} color={tc.background} strokeWidth={2.4} />
                <Text style={[styles.retryButtonText, { color: tc.background }]}>{t('ocr_retry')}</Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [
                  styles.retryButton,
                  { backgroundColor: theme.glass.cardFill, borderColor: theme.glass.cardBorder, borderWidth: 1 },
                  pressed && { opacity: 0.78, transform: [{ scale: 0.98 }] },
                ]}
                onPress={() => router.back()}
                accessibilityRole="button"
                accessibilityLabel={t('ocr_pick_different_photo')}
              >
                <Text style={[styles.retryButtonText, { color: tc.text }]}>{t('ocr_pick_different_photo')}</Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <>
            <View style={[styles.summaryCard, { backgroundColor: theme.glass.cardFill, borderColor: theme.glass.cardBorder }]}>
              <Text style={[styles.summaryTitle, { color: tc.text }]}>{t('Confirm Pantry Additions')}</Text>
              <Text style={[styles.summaryMeta, { color: tc.textTertiary }]}>
                {formatNumber(candidates.length)} {t('candidates')} / {formatNumber(selectedCount)} {t('selected')}
              </Text>
            </View>
            {candidates.map((candidate) => (
              <CandidateCard
                key={candidate.id}
                candidate={candidate}
                draft={drafts[candidate.id]!}
                onToggle={() => updateDraft(candidate.id, { selected: !drafts[candidate.id]?.selected })}
                onChange={(updates) => updateDraft(candidate.id, updates)}
              />
            ))}
          </>
        )}
      </ScrollView>

      <View style={[styles.footer, { backgroundColor: tc.background, borderTopColor: theme.glass.cardBorder }]}>
        <Pressable
          style={({ pressed }) => [
            styles.confirmButton,
            { backgroundColor: tc.accent },
            (selectedCount === 0 || busy) && { opacity: 0.45 },
            pressed && selectedCount > 0 && !busy && { opacity: 0.82, transform: [{ scale: 0.99 }] },
          ]}
          disabled={selectedCount === 0 || busy}
          onPress={confirmSelected}
        >
          <PackagePlus size={18} color={tc.background} strokeWidth={2.5} />
          <Text style={[styles.confirmText, { color: tc.background }]}>
            {busy ? t('Updating') : t('Add Selected to Pantry')}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  topBar: { paddingHorizontal: 20, paddingBottom: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  iconButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  topBarTitle: { fontFamily: JAKARTA_FONTS.extraBold, fontSize: 18 },
  content: { paddingHorizontal: 24, paddingBottom: 116, gap: 12 },
  summaryCard: { borderWidth: 1, borderRadius: 18, padding: 14, gap: 4 },
  summaryTitle: { fontFamily: JAKARTA_FONTS.extraBold, fontSize: 16 },
  summaryMeta: { fontFamily: JAKARTA_FONTS.bold, fontSize: 12 },
  card: { borderWidth: 1, borderRadius: 18, padding: 14, gap: 12 },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  checkIcon: { width: 26, height: 26, borderRadius: 13, borderWidth: 1, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  cardTitleWrap: { flex: 1, gap: 3 },
  cropPreview: { width: 54, height: 54, borderRadius: 12, overflow: 'hidden' },
  cardTitle: { fontFamily: JAKARTA_FONTS.bold, fontSize: 15 },
  cardMeta: { fontFamily: JAKARTA_FONTS.medium, fontSize: 11, textTransform: 'capitalize' },
  inputs: { gap: 10 },
  nutritionBlock: { gap: 8 },
  nutritionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  nutritionTitle: { fontFamily: JAKARTA_FONTS.bold, fontSize: 12 },
  nutritionMeta: { fontFamily: JAKARTA_FONTS.medium, fontSize: 10 },
  nutritionChoices: { gap: 8 },
  nutritionChoice: { width: 188, minHeight: 76, borderWidth: 1, borderRadius: 14, paddingHorizontal: 11, paddingVertical: 10, gap: 4 },
  nutritionChoiceTitle: { fontFamily: JAKARTA_FONTS.bold, fontSize: 11 },
  nutritionChoiceMeta: { fontFamily: JAKARTA_FONTS.medium, fontSize: 10, lineHeight: 14 },
  inline: { flexDirection: 'row', gap: 10 },
  input: { minHeight: 42, borderRadius: 13, paddingHorizontal: 12, paddingVertical: 9, fontFamily: JAKARTA_FONTS.medium, fontSize: 13 },
  inlineInput: { flex: 1 },
  emptyState: { borderWidth: 1, borderRadius: 18, padding: 22, alignItems: 'center', gap: 12 },
  emptyTitle: { fontFamily: JAKARTA_FONTS.bold, fontSize: 16 },
  emptyBody: { fontFamily: JAKARTA_FONTS.medium, fontSize: 13, lineHeight: 19, textAlign: 'center' },
  emptyActions: { flexDirection: 'row', gap: 10, alignSelf: 'stretch' },
  retryButton: { flex: 1, minHeight: 44, borderRadius: 999, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8, paddingHorizontal: 14 },
  retryButtonText: { fontFamily: JAKARTA_FONTS.extraBold, fontSize: 13 },
  footer: { position: 'absolute', left: 0, right: 0, bottom: 0, borderTopWidth: 1, paddingHorizontal: 24, paddingTop: 12, paddingBottom: 32 },
  confirmButton: { minHeight: 52, borderRadius: 999, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 },
  confirmText: { fontFamily: JAKARTA_FONTS.extraBold, fontSize: 14 },
});
