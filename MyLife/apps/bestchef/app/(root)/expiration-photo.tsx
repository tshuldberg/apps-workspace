import { useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  AlertTriangle,
  CalendarCheck,
  Camera,
  ChevronDown,
  Image as ImageIcon,
  RotateCcw,
  Search,
  X,
} from 'lucide-react-native';
import {
  JAKARTA_FONTS,
  type ExpirationDateCandidate,
  type PantryItem,
} from '@mylife/bestchef';
import { Text } from '@mylife/ui';
import { useDatabase } from './providers/DatabaseProvider';
import { useBestChefCloud } from './providers/BestChefCloudProvider';
import { shouldAllowBestChefByoProviderKeys } from './data/launch-environment';
import { useAppThemeColors as useThemeColors, useAppThemeProfile as useTheme } from './providers/AppThemeProvider';
import { ensureAiPhotoConsent } from './data/ai-consent';
import { useI18n } from './i18n/I18nProvider';
import {
  EXPIRATION_OCR_PROVIDER_OPTIONS,
  confirmKitchenExpirationDate,
  createKitchenExpirationReview,
  getPantry,
  type ExpirationOcrProviderChoice,
} from './data/kitchen';
import { getInitialExpirationOcrText } from './data/demo-fixture-drafts';
import { shouldUseDemoFixturesInDev } from './data/public-render-policy';
import { BackArrow } from './components/DirectionalIcons';

function parseQuantity(value: string): number | null {
  const parsed = Number.parseFloat(value.trim());
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

export default function ExpirationPhotoScreen() {
  const db = useDatabase();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const tc = useThemeColors();
  const theme = useTheme();
  const { t, formatNumber } = useI18n();
  const { supabase } = useBestChefCloud();
  const allowByoKeys = shouldAllowBestChefByoProviderKeys();
  const [photoUri, setPhotoUri] = useState('manual://expiration-photo');
  const [photoMime, setPhotoMime] = useState('image/jpeg');
  const [imageBase64, setImageBase64] = useState<string | undefined>();
  const [rawText, setRawText] = useState(getInitialExpirationOcrText);
  const [rawTextEditedByUser, setRawTextEditedByUser] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [ocrProvider, setOcrProvider] = useState<ExpirationOcrProviderChoice>('manual_text');
  const [providerStatus, setProviderStatus] = useState('');
  const [requiresManualSelection, setRequiresManualSelection] = useState(false);
  const [candidates, setCandidates] = useState<ExpirationDateCandidate[]>([]);
  const [selectedDate, setSelectedDate] = useState('');
  const [pantryItems, setPantryItems] = useState<PantryItem[]>(() => getPantry(db));
  const [selectedPantryItemId, setSelectedPantryItemId] = useState<string | null>(null);
  const [itemName, setItemName] = useState('');
  const [quantity, setQuantity] = useState('');
  const [unit, setUnit] = useState('');
  const [lotCode, setLotCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [pickerVisible, setPickerVisible] = useState(false);
  const [pickerSearch, setPickerSearch] = useState('');
  const demoFixturesAllowed = shouldUseDemoFixturesInDev();
  const submittedRawText = demoFixturesAllowed || rawTextEditedByUser
    ? rawText.trim() || undefined
    : undefined;
  const hasPhotoRecognitionProvider = Boolean(
    supabase || (allowByoKeys && apiKey.trim()),
  );
  const hasSelectedPhoto = !photoUri.startsWith('manual://');
  const photoRecognitionUnavailable = Boolean(
    hasSelectedPhoto
    && !submittedRawText
    && (!hasPhotoRecognitionProvider || !imageBase64),
  );

  const selectedPantryItem = useMemo(
    () => (selectedPantryItemId ? pantryItems.find((item) => item.id === selectedPantryItemId) ?? null : null),
    [pantryItems, selectedPantryItemId],
  );
  const filteredPantryItems = useMemo(() => {
    const query = pickerSearch.trim().toLowerCase();
    if (!query) return pantryItems;
    return pantryItems.filter((item) => item.name.toLowerCase().includes(query));
  }, [pantryItems, pickerSearch]);
  const hasAssignment = Boolean(selectedPantryItemId) || itemName.trim().length > 0;
  const canConfirm = Boolean(selectedDate) && hasAssignment;

  const selectPhoto = async (source: 'camera' | 'library') => {
    const permission = source === 'camera'
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(t('Photo access needed'), t('Expiration OCR needs photo access.'));
      return;
    }

    const result = source === 'camera'
      ? await ImagePicker.launchCameraAsync({ base64: true, quality: 0.8 })
      : await ImagePicker.launchImageLibraryAsync({ base64: true, quality: 0.8, mediaTypes: ['images'] });
    if (result.canceled || !result.assets[0]) return;

    const asset = result.assets[0];
    setPhotoUri(asset.uri);
    setPhotoMime(asset.mimeType ?? 'image/jpeg');
    setImageBase64(asset.base64 ?? undefined);
    if (hasPhotoRecognitionProvider && !rawTextEditedByUser) {
      setRawText('');
    }
  };

  const resetDraft = () => {
    const initialRawText = getInitialExpirationOcrText();
    setPhotoUri('manual://expiration-photo');
    setPhotoMime('image/jpeg');
    setImageBase64(undefined);
    setRawText(initialRawText);
    setRawTextEditedByUser(false);
    setApiKey('');
    setOcrProvider('manual_text');
    setProviderStatus('');
    setRequiresManualSelection(false);
    setCandidates([]);
    setSelectedDate('');
    setSelectedPantryItemId(null);
    setItemName('');
    setQuantity('');
    setUnit('');
    setLotCode('');
    setPickerSearch('');
    setPickerVisible(false);
  };

  const readDate = async () => {
    if (busy) return;
    if (photoRecognitionUnavailable) return;
    if (imageBase64) {
      const consented = await ensureAiPhotoConsent(db, t);
      if (!consented) return;
    }
    setBusy(true);
    try {
      const review = await createKitchenExpirationReview({
        photoUri,
        photoMime,
        imageBase64,
        rawOcrText: submittedRawText,
        apiKey: allowByoKeys ? apiKey.trim() || null : null,
        ocrProvider,
        supabase,
      });
      setCandidates(review.candidates);
      setSelectedDate(review.requiresManualSelection ? '' : review.candidates[0]?.normalizedDate ?? '');
      const nextRawText = review.rawText || rawText;
      setRawText(nextRawText);
      if (nextRawText.trim()) setRawTextEditedByUser(true);
      setProviderStatus(`${review.providerStatus}: ${review.providerMessage}`);
      setRequiresManualSelection(review.requiresManualSelection);
      setPantryItems(getPantry(db));
    } catch (error) {
      Alert.alert(t('Expiration OCR failed'), error instanceof Error ? error.message : t('Unable to read expiration date.'));
    } finally {
      setBusy(false);
    }
  };

  const confirmDate = () => {
    if (!selectedDate) {
      Alert.alert(t('Select a date'), t('Choose a detected date or type one manually.'));
      return;
    }
    if (!hasAssignment) {
      Alert.alert(t('Assign Item'), t('expiration_pick_or_type'));
      return;
    }
    const selectedCandidate = candidates.find((candidate) => candidate.normalizedDate === selectedDate);
    try {
      confirmKitchenExpirationDate(db, {
        pantryItemId: selectedPantryItemId,
        itemName: selectedPantryItemId ? null : itemName.trim(),
        expirationDate: selectedDate,
        photoUri,
        cropUri: selectedCandidate?.crop_uri ?? null,
        rawText,
        confidence: selectedCandidate?.confidence ?? null,
        quantity: parseQuantity(quantity),
        unit: unit.trim() || null,
        lotCode: lotCode.trim() || null,
      });
      router.replace('/pantry');
    } catch (error) {
      Alert.alert(t('Date confirmation failed'), error instanceof Error ? error.message : t('Unable to update pantry.'));
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
        <Text style={[styles.topBarTitle, { color: tc.text }]}>{t('Expiration Photo')}</Text>
        <Pressable
          style={({ pressed }) => [styles.iconButton, pressed && { opacity: 0.68, transform: [{ scale: 0.96 }] }]}
          onPress={resetDraft}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel={t('Reset expiration photo draft')}
        >
          <RotateCcw size={21} color={tc.textSecondary} strokeWidth={2} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <View style={[styles.photoPanel, { backgroundColor: theme.glass.cardFill, borderColor: theme.glass.cardBorder }]}>
          <View style={[styles.photoPreview, { backgroundColor: tc.surface }]}>
            {photoUri.startsWith('file') ? (
              <Image source={{ uri: photoUri }} style={styles.photoImage} contentFit="cover" />
            ) : (
              <CalendarCheck size={44} color={tc.accent} strokeWidth={1.7} />
            )}
          </View>
          <View style={styles.photoActions}>
            <Pressable
              style={({ pressed }) => [styles.photoButton, { backgroundColor: tc.accent }, pressed && { opacity: 0.8, transform: [{ scale: 0.98 }] }]}
              onPress={() => void selectPhoto('camera')}
              accessibilityRole="button"
              accessibilityLabel={t('Open camera for expiration photo')}
            >
              <Camera size={18} color={tc.background} strokeWidth={2.4} />
              <Text style={[styles.photoButtonText, { color: tc.background }]}>{t('Camera')}</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [
                styles.photoButton,
                { backgroundColor: theme.glass.cardFill, borderColor: theme.glass.cardBorder, borderWidth: 1 },
                pressed && { opacity: 0.8, transform: [{ scale: 0.98 }] },
              ]}
              onPress={() => void selectPhoto('library')}
              accessibilityRole="button"
              accessibilityLabel={t('Choose expiration photo from library')}
            >
              <ImageIcon size={18} color={tc.accent} strokeWidth={2.2} />
              <Text style={[styles.photoButtonText, { color: tc.accent }]}>{t('Library')}</Text>
            </Pressable>
          </View>
        </View>

        <View style={[styles.panel, { backgroundColor: theme.glass.cardFill, borderColor: theme.glass.cardBorder }]}>
          <Text style={[styles.panelTitle, { color: tc.text }]}>{t('OCR Text')}</Text>
          <Text style={[styles.panelMeta, { color: tc.textTertiary }]}>{t('OCR Provider')}</Text>
          <View style={styles.chipRow}>
            {EXPIRATION_OCR_PROVIDER_OPTIONS.map((option) => (
              <Pressable
                key={option.id}
                style={({ pressed }) => [
                  styles.providerChip,
                  { backgroundColor: ocrProvider === option.id ? `${tc.accent}24` : tc.surface },
                  pressed && { opacity: 0.76, transform: [{ scale: 0.97 }] },
                ]}
                onPress={() => setOcrProvider(option.id)}
                accessibilityRole="button"
                accessibilityLabel={t('Use {provider} expiration OCR', { provider: option.title })}
                accessibilityState={{ selected: ocrProvider === option.id }}
              >
                <Text style={[styles.chipText, { color: ocrProvider === option.id ? tc.accent : tc.textSecondary }]}>
                  {t(option.title)}
                </Text>
                <Text style={[styles.chipMeta, { color: tc.textTertiary }]} numberOfLines={2}>
                  {t(option.status)}
                </Text>
              </Pressable>
            ))}
          </View>
          <Text style={[styles.providerStatus, { color: providerStatus ? tc.textSecondary : tc.textTertiary }]}>
            {providerStatus || t(EXPIRATION_OCR_PROVIDER_OPTIONS.find((option) => option.id === ocrProvider)?.detail ?? 'Choose an OCR provider.')}
          </Text>
          {allowByoKeys ? (
            <>
              <Text style={[styles.betaBadge, { color: tc.primaryContainer }]}>{t('Internal beta only')}</Text>
              <TextInput
                style={[styles.input, { color: tc.text, backgroundColor: tc.surface }]}
                value={apiKey}
                onChangeText={setApiKey}
                placeholder={t('Optional vision API key')}
                placeholderTextColor={tc.textTertiary}
                autoCapitalize="none"
                autoCorrect={false}
                secureTextEntry
              />
            </>
          ) : null}
          <TextInput
            style={[styles.ocrInput, { color: tc.text, backgroundColor: tc.surface }]}
            value={rawText}
            onChangeText={(value) => {
              setRawText(value);
              setRawTextEditedByUser(true);
            }}
            placeholder={t('Paste expiration OCR text')}
            placeholderTextColor={tc.textTertiary}
            multiline
            textAlignVertical="top"
            autoCapitalize="none"
            autoCorrect={false}
          />
          <Pressable
            style={({ pressed }) => [
              styles.readButton,
              { backgroundColor: tc.accent },
              (busy || photoRecognitionUnavailable) && { opacity: 0.45 },
              pressed && !busy && !photoRecognitionUnavailable && { opacity: 0.82, transform: [{ scale: 0.99 }] },
            ]}
            disabled={busy || photoRecognitionUnavailable}
            onPress={() => void readDate()}
            accessibilityRole="button"
            accessibilityLabel={busy ? t('Reading expiration date') : t('Read expiration date')}
            accessibilityState={{ disabled: busy || photoRecognitionUnavailable }}
          >
            <Text style={[styles.readButtonText, { color: tc.background }]}>
              {busy ? t('Reading') : t('Read Date')}
            </Text>
          </Pressable>
        </View>

        {photoRecognitionUnavailable ? (
          <View style={[styles.unavailableBanner, { backgroundColor: theme.glass.cardFill, borderColor: tc.danger }]}>
            <AlertTriangle size={18} color={tc.danger} strokeWidth={2.2} />
            <Text style={[styles.unavailableText, { color: tc.textSecondary }]}>
              {t('Photo recognition is not available in this build.')}
            </Text>
          </View>
        ) : null}

        <View style={[styles.panel, { backgroundColor: theme.glass.cardFill, borderColor: theme.glass.cardBorder }]}>
          <Text style={[styles.panelTitle, { color: tc.text }]}>{t('Confirm Date')}</Text>
          {requiresManualSelection ? (
            <Text style={[styles.panelMeta, { color: tc.primaryContainer }]}>
              {t('Select a detected date or type a date before confirming.')}
            </Text>
          ) : null}
          <View style={styles.chipRow}>
            {candidates.map((candidate) => (
              <Pressable
                key={candidate.id}
                style={({ pressed }) => [
                  styles.chip,
                  { backgroundColor: selectedDate === candidate.normalizedDate ? `${tc.accent}24` : tc.surface },
                  pressed && { opacity: 0.76, transform: [{ scale: 0.97 }] },
                ]}
                onPress={() => setSelectedDate(candidate.normalizedDate)}
                accessibilityRole="button"
                accessibilityLabel={t('Select expiration date {date}', { date: candidate.normalizedDate })}
                accessibilityState={{ selected: selectedDate === candidate.normalizedDate }}
              >
                <Text style={[styles.chipText, { color: selectedDate === candidate.normalizedDate ? tc.accent : tc.textSecondary }]}>
                  {candidate.normalizedDate}
                </Text>
                <Text style={[styles.chipMeta, { color: tc.textTertiary }]}>
                  {formatNumber(Math.round(candidate.confidence * 100))}% / {t(candidate.reason)}
                </Text>
                {candidate.context ? (
                  <Text style={[styles.chipContext, { color: tc.textTertiary }]} numberOfLines={2}>
                    {candidate.context}
                  </Text>
                ) : null}
                {candidate.crop_uri || candidate.bounding_box ? (
                  <Text style={[styles.chipMeta, { color: tc.accent }]}>{t('Region evidence retained')}</Text>
                ) : null}
              </Pressable>
            ))}
          </View>
          <TextInput
            style={[styles.input, { color: tc.text, backgroundColor: tc.surface }]}
            value={selectedDate}
            onChangeText={setSelectedDate}
            placeholder={t('YYYY-MM-DD')}
            placeholderTextColor={tc.textTertiary}
          />
          <View style={styles.inline}>
            <TextInput
              style={[styles.input, styles.inlineInput, { color: tc.text, backgroundColor: tc.surface }]}
              value={quantity}
              onChangeText={setQuantity}
              placeholder={t('Qty')}
              placeholderTextColor={tc.textTertiary}
              keyboardType="decimal-pad"
            />
            <TextInput
              style={[styles.input, styles.inlineInput, { color: tc.text, backgroundColor: tc.surface }]}
              value={unit}
              onChangeText={setUnit}
              placeholder={t('Unit')}
              placeholderTextColor={tc.textTertiary}
            />
          </View>
          <TextInput
            style={[styles.input, { color: tc.text, backgroundColor: tc.surface }]}
            value={lotCode}
            onChangeText={setLotCode}
            placeholder={t('Lot or batch')}
            placeholderTextColor={tc.textTertiary}
          />
        </View>

        <View style={[styles.panel, { backgroundColor: theme.glass.cardFill, borderColor: theme.glass.cardBorder }]}>
          <Text style={[styles.panelTitle, { color: tc.text }]}>{t('Assign Item')}</Text>
          <Text style={[styles.panelMeta, { color: tc.textTertiary }]}>
            {formatNumber(pantryItems.length)} {t('pantry items')}
          </Text>
          {selectedPantryItem ? (
            <View style={[styles.selectedItemChip, { backgroundColor: `${tc.accent}1F`, borderColor: tc.accent }]}>
              <View style={styles.selectedItemBody}>
                <Text style={[styles.itemName, { color: tc.accent }]} numberOfLines={1}>
                  {selectedPantryItem.name}
                </Text>
                <Text style={[styles.itemMeta, { color: tc.textTertiary }]} numberOfLines={1}>
                  {t(selectedPantryItem.storage_location)} / {t(selectedPantryItem.grocery_section)}
                </Text>
              </View>
              <Pressable
                style={({ pressed }) => [
                  styles.changeButton,
                  { backgroundColor: tc.surface },
                  pressed && { opacity: 0.78, transform: [{ scale: 0.97 }] },
                ]}
                onPress={() => {
                  setPickerSearch('');
                  setPickerVisible(true);
                }}
                accessibilityRole="button"
                accessibilityLabel={t('expiration_change_item')}
              >
                <Text style={[styles.changeButtonText, { color: tc.accent }]}>{t('expiration_change_item')}</Text>
              </Pressable>
            </View>
          ) : (
            <Pressable
              style={({ pressed }) => [
                styles.pickerButton,
                { backgroundColor: tc.surface, borderColor: theme.glass.cardBorder },
                pressed && { opacity: 0.82, transform: [{ scale: 0.99 }] },
              ]}
              onPress={() => {
                setPickerSearch('');
                setPickerVisible(true);
              }}
              accessibilityRole="button"
              accessibilityLabel={t('expiration_pick_pantry_item')}
            >
              <Text style={[styles.pickerButtonText, { color: tc.text }]}>{t('expiration_pick_pantry_item')}</Text>
              <ChevronDown size={18} color={tc.textSecondary} strokeWidth={2} />
            </Pressable>
          )}
          <TextInput
            style={[styles.input, { color: tc.text, backgroundColor: tc.surface }]}
            value={itemName}
            onChangeText={(value) => {
              setItemName(value);
              if (value.trim()) setSelectedPantryItemId(null);
            }}
            placeholder={t('Or enter a new item name')}
            placeholderTextColor={tc.textTertiary}
          />
        </View>

        <Pressable
          style={({ pressed }) => [
            styles.confirmButton,
            { backgroundColor: tc.accent },
            !canConfirm && { opacity: 0.45 },
            canConfirm && pressed && { opacity: 0.82, transform: [{ scale: 0.99 }] },
          ]}
          onPress={confirmDate}
          disabled={!canConfirm}
          accessibilityRole="button"
          accessibilityLabel={t('Confirm expiration date')}
          accessibilityState={{ disabled: !canConfirm }}
        >
          <Text style={[styles.confirmButtonText, { color: tc.background }]}>{t('Confirm Expiration')}</Text>
        </Pressable>
        {!canConfirm ? (
          <Text style={[styles.confirmHint, { color: tc.textTertiary }]}>
            {!selectedDate
              ? t('Choose a detected date or type one manually.')
              : t('expiration_pick_or_type')}
          </Text>
        ) : null}
      </ScrollView>

      <Modal visible={pickerVisible} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setPickerVisible(false)}>
        <View style={[styles.modalScreen, { backgroundColor: tc.background }]}>
          <View style={[styles.modalHeader, { paddingTop: insets.top + 14 }]}>
            <Text style={[styles.modalTitle, { color: tc.text }]}>{t('expiration_pick_pantry_item')}</Text>
            <Pressable
              style={({ pressed }) => [styles.iconButton, pressed && { opacity: 0.68, transform: [{ scale: 0.96 }] }]}
              onPress={() => setPickerVisible(false)}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel={t('Close')}
            >
              <X size={22} color={tc.text} strokeWidth={2} />
            </Pressable>
          </View>
          <View style={[styles.searchRow, { backgroundColor: tc.surface, borderColor: theme.glass.cardBorder }]}>
            <Search size={16} color={tc.textSecondary} strokeWidth={2} />
            <TextInput
              style={[styles.searchInput, { color: tc.text }]}
              value={pickerSearch}
              onChangeText={setPickerSearch}
              placeholder={t('expiration_search_pantry')}
              placeholderTextColor={tc.textTertiary}
              autoCapitalize="none"
              autoCorrect={false}
              autoFocus
            />
            {pickerSearch ? (
              <Pressable
                style={({ pressed }) => [pressed && { opacity: 0.68, transform: [{ scale: 0.94 }] }]}
                onPress={() => setPickerSearch('')}
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel={t('Close')}
              >
                <X size={16} color={tc.textSecondary} strokeWidth={2} />
              </Pressable>
            ) : null}
          </View>
          <FlatList
            data={filteredPantryItems}
            keyExtractor={(item) => item.id}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.modalListContent}
            ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
            ListEmptyComponent={
              <Text style={[styles.modalEmpty, { color: tc.textTertiary }]}>
                {pantryItems.length === 0 ? t('No entries yet') : t('No results')}
              </Text>
            }
            renderItem={({ item }) => {
              const isSelected = selectedPantryItemId === item.id;
              return (
                <Pressable
                  style={({ pressed }) => [
                    styles.itemRow,
                    { backgroundColor: isSelected ? `${tc.accent}1F` : tc.surface },
                    pressed && { opacity: 0.78, transform: [{ scale: 0.99 }] },
                  ]}
                  onPress={() => {
                    setSelectedPantryItemId(item.id);
                    setItemName('');
                    setPickerVisible(false);
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={t('Assign expiration date to {item}', { item: item.name })}
                  accessibilityState={{ selected: isSelected }}
                >
                  <Text style={[styles.itemName, { color: isSelected ? tc.accent : tc.text }]} numberOfLines={1}>
                    {item.name}
                  </Text>
                  <Text style={[styles.itemMeta, { color: tc.textTertiary }]} numberOfLines={1}>
                    {t(item.storage_location)} / {t(item.grocery_section)}
                  </Text>
                </Pressable>
              );
            }}
          />
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  topBar: { paddingHorizontal: 20, paddingBottom: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  iconButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  topBarTitle: { fontFamily: JAKARTA_FONTS.extraBold, fontSize: 18 },
  content: { paddingHorizontal: 24, paddingBottom: 48, gap: 16 },
  photoPanel: { borderWidth: 1, borderRadius: 18, padding: 14, gap: 12 },
  photoPreview: { height: 176, borderRadius: 14, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  photoImage: { width: '100%', height: '100%' },
  photoActions: { flexDirection: 'row', gap: 10 },
  photoButton: { flex: 1, minHeight: 46, borderRadius: 999, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 },
  photoButtonText: { fontFamily: JAKARTA_FONTS.bold, fontSize: 13 },
  panel: { borderWidth: 1, borderRadius: 18, padding: 14, gap: 12 },
  panelTitle: { fontFamily: JAKARTA_FONTS.extraBold, fontSize: 16 },
  panelMeta: { fontFamily: JAKARTA_FONTS.bold, fontSize: 11 },
  input: { minHeight: 44, borderRadius: 13, paddingHorizontal: 12, paddingVertical: 10, fontFamily: JAKARTA_FONTS.medium, fontSize: 13 },
  ocrInput: { minHeight: 120, borderRadius: 14, padding: 12, fontFamily: JAKARTA_FONTS.medium, fontSize: 13, lineHeight: 19 },
  readButton: { minHeight: 46, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  readButtonText: { fontFamily: JAKARTA_FONTS.bold, fontSize: 14 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderRadius: 14, paddingHorizontal: 12, paddingVertical: 8, maxWidth: '100%', gap: 4 },
  providerChip: { borderRadius: 14, paddingHorizontal: 12, paddingVertical: 8, maxWidth: 160, gap: 4 },
  chipText: { fontFamily: JAKARTA_FONTS.bold, fontSize: 12 },
  chipMeta: { fontFamily: JAKARTA_FONTS.bold, fontSize: 10, lineHeight: 14 },
  chipContext: { fontFamily: JAKARTA_FONTS.medium, fontSize: 10, lineHeight: 14, maxWidth: 260 },
  providerStatus: { fontFamily: JAKARTA_FONTS.medium, fontSize: 12, lineHeight: 17 },
  inline: { flexDirection: 'row', gap: 10 },
  inlineInput: { flex: 1 },
  itemRow: { borderRadius: 14, padding: 12, gap: 3 },
  itemName: { fontFamily: JAKARTA_FONTS.bold, fontSize: 14 },
  itemMeta: { fontFamily: JAKARTA_FONTS.medium, fontSize: 11, textTransform: 'capitalize' },
  confirmButton: { minHeight: 52, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  confirmButtonText: { fontFamily: JAKARTA_FONTS.extraBold, fontSize: 15 },
  confirmHint: { fontFamily: JAKARTA_FONTS.medium, fontSize: 12, textAlign: 'center', lineHeight: 17 },
  betaBadge: { fontFamily: JAKARTA_FONTS.extraBold, fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.6 },
  unavailableBanner: { borderWidth: 1, borderRadius: 16, padding: 13, flexDirection: 'row', alignItems: 'center', gap: 9 },
  unavailableText: { flex: 1, fontFamily: JAKARTA_FONTS.medium, fontSize: 12, lineHeight: 17 },
  pickerButton: {
    minHeight: 46,
    borderRadius: 13,
    borderWidth: 1,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  pickerButtonText: { fontFamily: JAKARTA_FONTS.bold, fontSize: 13 },
  selectedItemChip: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  selectedItemBody: { flex: 1, gap: 3 },
  changeButton: { borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 },
  changeButtonText: { fontFamily: JAKARTA_FONTS.bold, fontSize: 12 },
  modalScreen: { flex: 1 },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingBottom: 14,
  },
  modalTitle: { fontFamily: JAKARTA_FONTS.extraBold, fontSize: 20 },
  searchRow: {
    marginHorizontal: 24,
    marginBottom: 12,
    borderRadius: 13,
    borderWidth: 1,
    paddingHorizontal: 12,
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  searchInput: { flex: 1, fontFamily: JAKARTA_FONTS.medium, fontSize: 13, paddingVertical: 10 },
  modalListContent: { paddingHorizontal: 24, paddingBottom: 36, gap: 0 },
  modalEmpty: { fontFamily: JAKARTA_FONTS.medium, fontSize: 13, textAlign: 'center', paddingVertical: 36 },
});
