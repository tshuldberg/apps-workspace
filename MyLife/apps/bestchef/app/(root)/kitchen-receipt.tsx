import { useEffect, useState } from 'react';
import {
  Alert,
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
  Camera,
  Check,
  FileText,
  Image as ImageIcon,
  Network,
  RotateCcw,
} from 'lucide-react-native';
import { JAKARTA_FONTS } from '@mylife/bestchef';
import { Text } from '@mylife/ui';
import { useDatabase } from './providers/DatabaseProvider';
import { useBestChefCloud } from './providers/BestChefCloudProvider';
import { shouldAllowBestChefByoProviderKeys } from './data/launch-environment';
import { useAppThemeColors as useThemeColors, useAppThemeProfile as useTheme } from './providers/AppThemeProvider';
import { ensureAiPhotoConsent } from './data/ai-consent';
import { useI18n } from './i18n/I18nProvider';
import {
  createKitchenReceiptImport,
  RECEIPT_OCR_PROVIDER_OPTIONS,
  type ReceiptOcrProviderChoice,
} from './data/kitchen';
import { getInitialReceiptOcrText } from './data/demo-fixture-drafts';
import { shouldUseDemoFixturesInDev } from './data/public-render-policy';
import { clearByoKey, getByoKey, maskKey, setByoKey } from './utils/byo-keys';
import { BackArrow } from './components/DirectionalIcons';

const SELECTABLE_OCR_PROVIDERS = new Set<ReceiptOcrProviderChoice>(['manual_text', 'claude_vision']);

export default function KitchenReceiptScreen() {
  const db = useDatabase();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const tc = useThemeColors();
  const theme = useTheme();
  const { t } = useI18n();
  const { supabase } = useBestChefCloud();
  const allowByoKeys = shouldAllowBestChefByoProviderKeys();
  const [photoUri, setPhotoUri] = useState('manual://receipt');
  const [photoMime, setPhotoMime] = useState('image/jpeg');
  const [imageBase64, setImageBase64] = useState<string | undefined>();
  const [rawText, setRawText] = useState(getInitialReceiptOcrText);
  const [rawTextEditedByUser, setRawTextEditedByUser] = useState(false);
  const [ocrProvider, setOcrProvider] = useState<ReceiptOcrProviderChoice>('manual_text');
  const [apiKey, setApiKey] = useState('');
  const [keyHydrated, setKeyHydrated] = useState(false);
  const [includeNetworkNutrition, setIncludeNetworkNutrition] = useState(false);
  const [busy, setBusy] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);
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

  useEffect(() => {
    if (!allowByoKeys) {
      setKeyHydrated(true);
      return;
    }
    let cancelled = false;
    void getByoKey('claude_vision').then((stored) => {
      if (cancelled) return;
      if (stored) setApiKey(stored);
      setKeyHydrated(true);
    });
    return () => {
      cancelled = true;
    };
  }, [allowByoKeys]);

  const persistApiKey = () => {
    if (!allowByoKeys) return;
    void setByoKey('claude_vision', apiKey);
  };

  const handleClearApiKey = () => {
    Alert.alert(t('Claude API key'), t('byo_clear_key'), [
      { text: t('Cancel'), style: 'cancel' },
      {
        text: t('byo_clear_key'),
        style: 'destructive',
        onPress: () => {
          void clearByoKey('claude_vision').then(() => setApiKey(''));
        },
      },
    ]);
  };

  const selectPhoto = async (source: 'camera' | 'library') => {
    const permission = source === 'camera'
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(t('Photo access needed'), t('Receipt import needs photo access.'));
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
  };

  const resetDraft = (options: { keepPhoto?: boolean } = {}) => {
    if (!options.keepPhoto) {
      setPhotoUri('manual://receipt');
      setPhotoMime('image/jpeg');
      setImageBase64(undefined);
    }
    setRawText(getInitialReceiptOcrText());
    setRawTextEditedByUser(false);
    setOcrProvider('manual_text');
    setIncludeNetworkNutrition(false);
    setReviewError(null);
    // BYO key is persisted in secure store; resetting the draft does not clear
    // the user's saved provider credential.
  };

  const reviewReceipt = async () => {
    if (busy) return;
    if (photoRecognitionUnavailable) return;
    if (ocrProvider === 'manual_text' && !submittedRawText) {
      Alert.alert(t('OCR text needed'), t('Paste or correct receipt OCR text before review.'));
      return;
    }
    if (ocrProvider === 'claude_vision' && !supabase && !apiKey.trim()) {
      Alert.alert(t('Provider key needed'), t('Vision receipt OCR is not available in this build.'));
      return;
    }
    if (imageBase64) {
      const consented = await ensureAiPhotoConsent(db, t);
      if (!consented) return;
    }
    setBusy(true);
    setReviewError(null);
    try {
      const review = await createKitchenReceiptImport(db, {
        photoUri,
        photoMime,
        imageBase64,
        rawOcrText: ocrProvider === 'manual_text' ? submittedRawText : undefined,
        ocrProvider,
        apiKey: allowByoKeys ? apiKey.trim() || undefined : undefined,
        includeNetworkNutrition,
        supabase,
      });
      router.push({ pathname: '/kitchen-receipt-review', params: { importId: review.receipt.id } });
    } catch (error) {
      const message = error instanceof Error ? error.message : t('Unable to import receipt.');
      setReviewError(message);
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
        <Text style={[styles.topBarTitle, { color: tc.text }]}>{t('Receipt Import')}</Text>
        <Pressable
          style={({ pressed }) => [styles.iconButton, pressed && { opacity: 0.68, transform: [{ scale: 0.96 }] }]}
          onPress={() => resetDraft()}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel={t('Reset receipt draft')}
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
              <FileText size={42} color={tc.accent} strokeWidth={1.7} />
            )}
          </View>
          <View style={styles.photoActions}>
            <Pressable
              style={({ pressed }) => [styles.photoButton, { backgroundColor: tc.accent }, pressed && { opacity: 0.8, transform: [{ scale: 0.98 }] }]}
              onPress={() => void selectPhoto('camera')}
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
            >
              <ImageIcon size={18} color={tc.accent} strokeWidth={2.2} />
              <Text style={[styles.photoButtonText, { color: tc.accent }]}>{t('Library')}</Text>
            </Pressable>
          </View>
        </View>

        <View style={[styles.providerPanel, { backgroundColor: theme.glass.cardFill, borderColor: theme.glass.cardBorder }]}>
          <View style={styles.panelHeader}>
            <Network size={18} color={tc.accent} strokeWidth={2} />
            <Text style={[styles.panelTitle, { color: tc.text }]}>{t('OCR Provider')}</Text>
          </View>
          <View style={styles.providerGrid}>
            {RECEIPT_OCR_PROVIDER_OPTIONS.map((option) => {
              const selected = option.id === ocrProvider;
              const selectable = SELECTABLE_OCR_PROVIDERS.has(option.id);
              const body = (
                <>
                  <View style={styles.providerTitleRow}>
                    <Text style={[styles.providerTitle, { color: selected ? tc.accent : tc.text }]} numberOfLines={1}>
                      {t(option.title)}
                    </Text>
                    {selected ? <Check size={14} color={tc.accent} strokeWidth={2.4} /> : null}
                  </View>
                  <Text style={[styles.providerDetail, { color: tc.textTertiary }]} numberOfLines={3}>
                    {t(option.detail)}
                  </Text>
                  <Text style={[styles.providerStatus, { color: selectable ? tc.textSecondary : tc.textTertiary }]} numberOfLines={1}>
                    {t(option.status.replace(/_/g, ' '))}
                  </Text>
                </>
              );

              if (!selectable) {
                return (
                  <View
                    key={option.id}
                    style={[
                      styles.providerOption,
                      { backgroundColor: tc.surface, borderColor: theme.glass.cardBorder, opacity: 0.62 },
                    ]}
                  >
                    {body}
                  </View>
                );
              }

              return (
                <Pressable
                  key={option.id}
                  style={({ pressed }) => [
                    styles.providerOption,
                    {
                      backgroundColor: selected ? `${tc.accent}18` : tc.surface,
                      borderColor: selected ? tc.accent : theme.glass.cardBorder,
                    },
                    pressed && { opacity: 0.78, transform: [{ scale: 0.98 }] },
                  ]}
                  onPress={() => setOcrProvider(option.id)}
                  accessibilityRole="button"
                  accessibilityLabel={t(`Select ${option.title}`)}
                >
                  {body}
                </Pressable>
              );
            })}
          </View>

          {ocrProvider === 'claude_vision' && allowByoKeys ? (
            <>
              <Text style={[styles.betaBadge, { color: tc.primaryContainer }]}>{t('Internal beta only')}</Text>
              <View style={styles.keyRow}>
                <TextInput
                  style={[styles.apiKeyInput, styles.keyInput, { color: tc.text, backgroundColor: tc.surface }]}
                  value={apiKey}
                  onChangeText={setApiKey}
                  onBlur={persistApiKey}
                  placeholder={keyHydrated && apiKey ? maskKey(apiKey) : t('Claude API key')}
                  placeholderTextColor={tc.textTertiary}
                  autoCapitalize="none"
                  autoCorrect={false}
                  secureTextEntry
                />
                {apiKey ? (
                  <Pressable
                    style={({ pressed }) => [styles.clearKey, pressed && { opacity: 0.72 }]}
                    onPress={handleClearApiKey}
                    accessibilityRole="button"
                    accessibilityLabel={t('byo_clear_key')}
                  >
                    <Text style={[styles.clearKeyText, { color: tc.danger }]}>{t('byo_clear_key')}</Text>
                  </Pressable>
                ) : null}
              </View>
            </>
          ) : null}

          <Pressable
            style={({ pressed }) => [
              styles.networkToggle,
              { backgroundColor: includeNetworkNutrition ? `${tc.accent}18` : tc.surface, borderColor: includeNetworkNutrition ? tc.accent : theme.glass.cardBorder },
              pressed && { opacity: 0.78, transform: [{ scale: 0.98 }] },
            ]}
            onPress={() => setIncludeNetworkNutrition((value) => !value)}
          >
            <View style={[styles.toggleIcon, { borderColor: includeNetworkNutrition ? tc.accent : tc.textTertiary }]}>
              {includeNetworkNutrition ? <Check size={13} color={tc.accent} strokeWidth={2.6} /> : null}
            </View>
            <View style={styles.networkText}>
              <Text style={[styles.networkTitle, { color: tc.text }]}>{t('Enrich matches with nutrition providers')}</Text>
              <Text style={[styles.networkDetail, { color: tc.textTertiary }]} numberOfLines={2}>
                {t('Search local cache first, then approved provider adapters during review.')}
              </Text>
            </View>
          </Pressable>
        </View>

        <View style={[styles.ocrPanel, { backgroundColor: theme.glass.cardFill, borderColor: theme.glass.cardBorder }]}>
          <View style={styles.panelHeader}>
            <FileText size={18} color={tc.accent} strokeWidth={2} />
            <Text style={[styles.panelTitle, { color: tc.text }]}>{t('OCR Text')}</Text>
          </View>
          <TextInput
            style={[styles.ocrInput, { color: tc.text, backgroundColor: tc.surface }]}
            value={rawText}
            onChangeText={(value) => {
              setRawText(value);
              setRawTextEditedByUser(true);
            }}
            placeholder={t('Paste receipt OCR text')}
            placeholderTextColor={tc.textTertiary}
            multiline
            textAlignVertical="top"
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>

        {photoRecognitionUnavailable ? (
          <View style={[styles.unavailableBanner, { backgroundColor: theme.glass.cardFill, borderColor: tc.danger }]}>
            <AlertTriangle size={18} color={tc.danger} strokeWidth={2.2} />
            <Text style={[styles.unavailableText, { color: tc.textSecondary }]}>
              {t('Photo recognition is not available in this build.')}
            </Text>
          </View>
        ) : null}

        {reviewError ? (
          <View style={[styles.errorBanner, { backgroundColor: theme.glass.cardFill, borderColor: tc.danger }]}>
            <View style={styles.errorTop}>
              <AlertTriangle size={18} color={tc.danger} strokeWidth={2.2} />
              <Text style={[styles.errorTitle, { color: tc.danger }]}>{t('Receipt import failed')}</Text>
            </View>
            <Text style={[styles.errorBody, { color: tc.textSecondary }]} numberOfLines={3}>{reviewError}</Text>
            <View style={styles.errorActions}>
              <Pressable
                style={({ pressed }) => [
                  styles.errorButton,
                  { backgroundColor: tc.accent },
                  pressed && { opacity: 0.78, transform: [{ scale: 0.98 }] },
                ]}
                onPress={() => void reviewReceipt()}
                accessibilityRole="button"
                accessibilityLabel={t('receipt_retry_review')}
              >
                <Text style={[styles.errorButtonText, { color: tc.background }]}>{t('receipt_retry_review')}</Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [
                  styles.errorButton,
                  { backgroundColor: theme.glass.cardFill, borderColor: theme.glass.cardBorder, borderWidth: 1 },
                  pressed && { opacity: 0.78, transform: [{ scale: 0.98 }] },
                ]}
                onPress={() => resetDraft({ keepPhoto: true })}
                accessibilityRole="button"
                accessibilityLabel={t('receipt_reset_draft')}
              >
                <Text style={[styles.errorButtonText, { color: tc.text }]}>{t('receipt_reset_draft')}</Text>
              </Pressable>
            </View>
          </View>
        ) : null}

        <Pressable
          style={({ pressed }) => [
            styles.reviewButton,
            { backgroundColor: tc.accent },
            (busy || photoRecognitionUnavailable) && { opacity: 0.45 },
            pressed && !busy && !photoRecognitionUnavailable && { opacity: 0.82, transform: [{ scale: 0.99 }] },
          ]}
          disabled={busy || photoRecognitionUnavailable}
          accessibilityState={{ disabled: busy || photoRecognitionUnavailable }}
          onPress={() => void reviewReceipt()}
        >
          <Text style={[styles.reviewButtonText, { color: tc.background }]}>
            {busy ? t('Importing') : t('Review Receipt')}
          </Text>
        </Pressable>
      </ScrollView>
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
  photoPreview: { height: 190, borderRadius: 14, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  photoImage: { width: '100%', height: '100%' },
  photoActions: { flexDirection: 'row', gap: 10 },
  photoButton: { flex: 1, minHeight: 46, borderRadius: 999, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 },
  photoButtonText: { fontFamily: JAKARTA_FONTS.bold, fontSize: 13 },
  providerPanel: { borderWidth: 1, borderRadius: 18, padding: 14, gap: 12 },
  providerGrid: { gap: 10 },
  providerOption: { minHeight: 88, borderWidth: 1, borderRadius: 14, padding: 12, gap: 7 },
  providerTitleRow: { minHeight: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  providerTitle: { flex: 1, fontFamily: JAKARTA_FONTS.extraBold, fontSize: 13 },
  providerDetail: { fontFamily: JAKARTA_FONTS.medium, fontSize: 11, lineHeight: 16 },
  providerStatus: { fontFamily: JAKARTA_FONTS.bold, fontSize: 10, textTransform: 'capitalize' },
  apiKeyInput: { minHeight: 44, borderRadius: 13, paddingHorizontal: 12, paddingVertical: 9, fontFamily: JAKARTA_FONTS.medium, fontSize: 13 },
  networkToggle: { minHeight: 72, borderWidth: 1, borderRadius: 14, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 10 },
  toggleIcon: { width: 24, height: 24, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  networkText: { flex: 1, gap: 3 },
  networkTitle: { fontFamily: JAKARTA_FONTS.extraBold, fontSize: 12 },
  networkDetail: { fontFamily: JAKARTA_FONTS.medium, fontSize: 11, lineHeight: 15 },
  ocrPanel: { borderWidth: 1, borderRadius: 18, padding: 14, gap: 12 },
  panelHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  panelTitle: { fontFamily: JAKARTA_FONTS.extraBold, fontSize: 16 },
  ocrInput: { minHeight: 220, borderRadius: 14, padding: 12, fontFamily: JAKARTA_FONTS.medium, fontSize: 13, lineHeight: 19 },
  reviewButton: { minHeight: 52, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  reviewButtonText: { fontFamily: JAKARTA_FONTS.extraBold, fontSize: 15 },
  betaBadge: { fontFamily: JAKARTA_FONTS.extraBold, fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.6 },
  keyRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  keyInput: { flex: 1 },
  clearKey: { paddingHorizontal: 10, paddingVertical: 9 },
  clearKeyText: { fontFamily: JAKARTA_FONTS.bold, fontSize: 12 },
  errorBanner: { borderWidth: 1, borderRadius: 18, padding: 14, gap: 10 },
  errorTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  errorTitle: { fontFamily: JAKARTA_FONTS.extraBold, fontSize: 14 },
  errorBody: { fontFamily: JAKARTA_FONTS.medium, fontSize: 12, lineHeight: 17 },
  errorActions: { flexDirection: 'row', gap: 10 },
  errorButton: { flex: 1, minHeight: 44, borderRadius: 999, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 14 },
  errorButtonText: { fontFamily: JAKARTA_FONTS.extraBold, fontSize: 13 },
  unavailableBanner: { borderWidth: 1, borderRadius: 16, padding: 13, flexDirection: 'row', alignItems: 'center', gap: 9 },
  unavailableText: { flex: 1, fontFamily: JAKARTA_FONTS.medium, fontSize: 12, lineHeight: 17 },
});
