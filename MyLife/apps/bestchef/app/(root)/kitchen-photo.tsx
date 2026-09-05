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
  Image as ImageIcon,
  PackageSearch,
  RotateCcw,
} from 'lucide-react-native';
import { JAKARTA_FONTS } from '@mylife/bestchef';
import { Text } from '@mylife/ui';
import { useAppThemeColors as useThemeColors, useAppThemeProfile as useTheme } from './providers/AppThemeProvider';
import { ensureAiPhotoConsent } from './data/ai-consent';
import { useI18n } from './i18n/I18nProvider';
import { createKitchenFoodPhotoReview } from './data/kitchen';
import { getInitialGroceryPhotoCandidates } from './data/demo-fixture-drafts';
import { shouldUseDemoFixturesInDev } from './data/public-render-policy';
import { useDatabase } from './providers/DatabaseProvider';
import { useBestChefCloud } from './providers/BestChefCloudProvider';
import { shouldAllowBestChefByoProviderKeys } from './data/launch-environment';
import { type ByoKeyId, clearByoKey, loadAllByoKeys, maskKey, setByoKey } from './utils/byo-keys';
import { BackArrow } from './components/DirectionalIcons';

export default function KitchenPhotoScreen() {
  const db = useDatabase();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const tc = useThemeColors();
  const theme = useTheme();
  const { t } = useI18n();
  const { supabase } = useBestChefCloud();
  const allowByoKeys = shouldAllowBestChefByoProviderKeys();
  const [photoUri, setPhotoUri] = useState('manual://grocery-photo');
  const [photoMime, setPhotoMime] = useState('image/jpeg');
  const [imageBase64, setImageBase64] = useState<string | undefined>();
  const [rawCandidates, setRawCandidates] = useState(getInitialGroceryPhotoCandidates);
  const [rawCandidatesEditedByUser, setRawCandidatesEditedByUser] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [usdaApiKey, setUsdaApiKey] = useState('');
  const [gs1Endpoint, setGs1Endpoint] = useState('');
  const [gs1ApiKey, setGs1ApiKey] = useState('');
  const [keysHydrated, setKeysHydrated] = useState(false);
  const [busy, setBusy] = useState(false);
  const demoFixturesAllowed = shouldUseDemoFixturesInDev();
  const submittedRawCandidates = demoFixturesAllowed || rawCandidatesEditedByUser
    ? rawCandidates.trim() || undefined
    : undefined;
  const hasPhotoRecognitionProvider = Boolean(
    supabase || (allowByoKeys && apiKey.trim()),
  );
  const hasSelectedPhoto = !photoUri.startsWith('manual://');
  const photoRecognitionUnavailable = Boolean(
    hasSelectedPhoto
    && !submittedRawCandidates
    && (!hasPhotoRecognitionProvider || !imageBase64),
  );

  useEffect(() => {
    if (!allowByoKeys) {
      setKeysHydrated(true);
      return;
    }
    let cancelled = false;
    void loadAllByoKeys().then((stored) => {
      if (cancelled) return;
      if (stored.vision) setApiKey(stored.vision);
      if (stored.usda) setUsdaApiKey(stored.usda);
      if (stored.gs1_endpoint) setGs1Endpoint(stored.gs1_endpoint);
      if (stored.gs1_key) setGs1ApiKey(stored.gs1_key);
      setKeysHydrated(true);
    });
    return () => {
      cancelled = true;
    };
  }, [allowByoKeys]);

  const persistKey = async (id: ByoKeyId, value: string) => {
    await setByoKey(id, value);
  };

  const clearKey = (id: ByoKeyId, label: string) => {
    Alert.alert(label, t('byo_clear_key'), [
      { text: t('Cancel'), style: 'cancel' },
      {
        text: t('byo_clear_key'),
        style: 'destructive',
        onPress: () => {
          void clearByoKey(id).then(() => {
            switch (id) {
              case 'vision':
                setApiKey('');
                break;
              case 'usda':
                setUsdaApiKey('');
                break;
              case 'gs1_endpoint':
                setGs1Endpoint('');
                break;
              case 'gs1_key':
                setGs1ApiKey('');
                break;
              default:
                break;
            }
          });
        },
      },
    ]);
  };

  const applySelectedPhoto = (
    asset: ImagePicker.ImagePickerAsset,
    clearCandidates: boolean,
  ) => {
    setPhotoUri(asset.uri);
    setPhotoMime(asset.mimeType ?? 'image/jpeg');
    setImageBase64(asset.base64 ?? undefined);
    if (clearCandidates) {
      setRawCandidates('');
      setRawCandidatesEditedByUser(false);
    }
  };

  const selectPhoto = async (source: 'camera' | 'library') => {
    const permission = source === 'camera'
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(t('Photo access needed'), t('Grocery photo recognition needs photo access.'));
      return;
    }

    const result = source === 'camera'
      ? await ImagePicker.launchCameraAsync({ base64: true, quality: 0.8 })
      : await ImagePicker.launchImageLibraryAsync({ base64: true, quality: 0.8, mediaTypes: ['images'] });
    if (result.canceled || !result.assets[0]) return;

    const asset = result.assets[0];
    const trimmedCandidates = rawCandidates.trim();
    const wouldOverwriteCandidates =
      hasPhotoRecognitionProvider
      && rawCandidatesEditedByUser
      && trimmedCandidates.length > 0;
    if (wouldOverwriteCandidates) {
      Alert.alert(
        t('Replace pasted candidates?'),
        t('Replace your pasted candidates with this photo?'),
        [
          { text: t('Cancel'), style: 'cancel' },
          {
            text: t('Replace'),
            style: 'destructive',
            onPress: () => applySelectedPhoto(asset, true),
          },
        ],
      );
      return;
    }
    applySelectedPhoto(asset, hasPhotoRecognitionProvider && !rawCandidatesEditedByUser);
  };

  const resetDraft = () => {
    setPhotoUri('manual://grocery-photo');
    setPhotoMime('image/jpeg');
    setImageBase64(undefined);
    setRawCandidates(getInitialGroceryPhotoCandidates());
    setRawCandidatesEditedByUser(false);
    // BYO keys are persisted in secure store; resetting the draft only clears
    // the draft, not the user's saved provider credentials.
  };

  const reviewPhoto = async () => {
    if (busy) return;
    if (photoRecognitionUnavailable) return;
    if (imageBase64) {
      const consented = await ensureAiPhotoConsent(db, t);
      if (!consented) return;
    }
    setBusy(true);
    try {
      const review = await createKitchenFoodPhotoReview(db, {
        photoUri,
        photoMime,
        imageBase64,
        rawCandidateJson: submittedRawCandidates,
        apiKey: allowByoKeys ? apiKey.trim() || null : null,
        usdaApiKey: allowByoKeys ? usdaApiKey.trim() || null : null,
        gs1Endpoint: allowByoKeys ? gs1Endpoint.trim() || null : null,
        gs1ApiKey: allowByoKeys ? gs1ApiKey.trim() || null : null,
        supabase,
      });
      router.push({
        pathname: '/kitchen-photo-review',
        params: {
          photoUri: review.photoUri,
          photoMime: review.photoMime,
          candidatesJson: JSON.stringify(review.candidates),
        },
      });
    } catch (error) {
      Alert.alert(t('Photo review failed'), error instanceof Error ? error.message : t('Unable to review grocery photo.'));
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
        <Text style={[styles.topBarTitle, { color: tc.text }]}>{t('Grocery Photo')}</Text>
        <Pressable
          style={({ pressed }) => [styles.iconButton, pressed && { opacity: 0.68, transform: [{ scale: 0.96 }] }]}
          onPress={resetDraft}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel={t('Reset grocery photo draft')}
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
              <PackageSearch size={44} color={tc.accent} strokeWidth={1.7} />
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

        <View style={[styles.panel, { backgroundColor: theme.glass.cardFill, borderColor: theme.glass.cardBorder }]}>
          <Text style={[styles.panelTitle, { color: tc.text }]}>{t('Recognition Input')}</Text>
          {allowByoKeys ? (
            <>
              <Text style={[styles.betaBadge, { color: tc.primaryContainer }]}>{t('Internal beta only')}</Text>
              <View style={styles.keyRow}>
                <TextInput
                  style={[styles.input, styles.keyInput, { color: tc.text, backgroundColor: tc.surface }]}
                  value={apiKey}
                  onChangeText={setApiKey}
                  onBlur={() => { void persistKey('vision', apiKey); }}
                  placeholder={keysHydrated && apiKey ? maskKey(apiKey) : t('Optional vision API key')}
                  placeholderTextColor={tc.textTertiary}
                  autoCapitalize="none"
                  autoCorrect={false}
                  secureTextEntry
                />
                {apiKey ? (
                  <Pressable
                    style={({ pressed }) => [styles.clearKey, pressed && { opacity: 0.72 }]}
                    onPress={() => clearKey('vision', t('Optional vision API key'))}
                    accessibilityRole="button"
                    accessibilityLabel={t('byo_clear_key')}
                  >
                    <Text style={[styles.clearKeyText, { color: tc.danger }]}>{t('byo_clear_key')}</Text>
                  </Pressable>
                ) : null}
              </View>
              <View style={styles.keyRow}>
                <TextInput
                  style={[styles.input, styles.keyInput, { color: tc.text, backgroundColor: tc.surface }]}
                  value={usdaApiKey}
                  onChangeText={setUsdaApiKey}
                  onBlur={() => { void persistKey('usda', usdaApiKey); }}
                  placeholder={keysHydrated && usdaApiKey ? maskKey(usdaApiKey) : t('Optional USDA API key')}
                  placeholderTextColor={tc.textTertiary}
                  autoCapitalize="none"
                  autoCorrect={false}
                  secureTextEntry
                />
                {usdaApiKey ? (
                  <Pressable
                    style={({ pressed }) => [styles.clearKey, pressed && { opacity: 0.72 }]}
                    onPress={() => clearKey('usda', t('Optional USDA API key'))}
                    accessibilityRole="button"
                    accessibilityLabel={t('byo_clear_key')}
                  >
                    <Text style={[styles.clearKeyText, { color: tc.danger }]}>{t('byo_clear_key')}</Text>
                  </Pressable>
                ) : null}
              </View>
              <View style={styles.keyRow}>
                <TextInput
                  style={[styles.input, styles.keyInput, { color: tc.text, backgroundColor: tc.surface }]}
                  value={gs1Endpoint}
                  onChangeText={setGs1Endpoint}
                  onBlur={() => { void persistKey('gs1_endpoint', gs1Endpoint); }}
                  placeholder={t('Optional GS1 endpoint')}
                  placeholderTextColor={tc.textTertiary}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                {gs1Endpoint ? (
                  <Pressable
                    style={({ pressed }) => [styles.clearKey, pressed && { opacity: 0.72 }]}
                    onPress={() => clearKey('gs1_endpoint', t('Optional GS1 endpoint'))}
                    accessibilityRole="button"
                    accessibilityLabel={t('byo_clear_key')}
                  >
                    <Text style={[styles.clearKeyText, { color: tc.danger }]}>{t('byo_clear_key')}</Text>
                  </Pressable>
                ) : null}
              </View>
              <View style={styles.keyRow}>
                <TextInput
                  style={[styles.input, styles.keyInput, { color: tc.text, backgroundColor: tc.surface }]}
                  value={gs1ApiKey}
                  onChangeText={setGs1ApiKey}
                  onBlur={() => { void persistKey('gs1_key', gs1ApiKey); }}
                  placeholder={keysHydrated && gs1ApiKey ? maskKey(gs1ApiKey) : t('Optional GS1 API key')}
                  placeholderTextColor={tc.textTertiary}
                  autoCapitalize="none"
                  autoCorrect={false}
                  secureTextEntry
                />
                {gs1ApiKey ? (
                  <Pressable
                    style={({ pressed }) => [styles.clearKey, pressed && { opacity: 0.72 }]}
                    onPress={() => clearKey('gs1_key', t('Optional GS1 API key'))}
                    accessibilityRole="button"
                    accessibilityLabel={t('byo_clear_key')}
                  >
                    <Text style={[styles.clearKeyText, { color: tc.danger }]}>{t('byo_clear_key')}</Text>
                  </Pressable>
                ) : null}
              </View>
            </>
          ) : null}
          <TextInput
            style={[styles.jsonInput, { color: tc.text, backgroundColor: tc.surface }]}
            value={rawCandidates}
            onChangeText={(value) => {
              setRawCandidates(value);
              setRawCandidatesEditedByUser(true);
            }}
            placeholder={t('Paste food candidate JSON')}
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

        <Pressable
          style={({ pressed }) => [
            styles.reviewButton,
            { backgroundColor: tc.accent },
            (busy || photoRecognitionUnavailable) && { opacity: 0.45 },
            pressed && !busy && !photoRecognitionUnavailable && { opacity: 0.82, transform: [{ scale: 0.99 }] },
          ]}
          disabled={busy || photoRecognitionUnavailable}
          accessibilityState={{ disabled: busy || photoRecognitionUnavailable }}
          onPress={() => void reviewPhoto()}
        >
          <Text style={[styles.reviewButtonText, { color: tc.background }]}>
            {busy ? t('Recognizing') : t('Review Foods')}
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
  panel: { borderWidth: 1, borderRadius: 18, padding: 14, gap: 12 },
  panelTitle: { fontFamily: JAKARTA_FONTS.extraBold, fontSize: 16 },
  input: { minHeight: 44, borderRadius: 13, paddingHorizontal: 12, paddingVertical: 10, fontFamily: JAKARTA_FONTS.medium, fontSize: 13 },
  keyRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  keyInput: { flex: 1 },
  clearKey: { paddingHorizontal: 10, paddingVertical: 9 },
  clearKeyText: { fontFamily: JAKARTA_FONTS.bold, fontSize: 12 },
  jsonInput: { minHeight: 210, borderRadius: 14, padding: 12, fontFamily: JAKARTA_FONTS.medium, fontSize: 12, lineHeight: 18 },
  reviewButton: { minHeight: 52, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  reviewButtonText: { fontFamily: JAKARTA_FONTS.extraBold, fontSize: 15 },
  betaBadge: { fontFamily: JAKARTA_FONTS.extraBold, fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.6 },
  unavailableBanner: { borderWidth: 1, borderRadius: 16, padding: 13, flexDirection: 'row', alignItems: 'center', gap: 9 },
  unavailableText: { flex: 1, fontFamily: JAKARTA_FONTS.medium, fontSize: 12, lineHeight: 17 },
});
