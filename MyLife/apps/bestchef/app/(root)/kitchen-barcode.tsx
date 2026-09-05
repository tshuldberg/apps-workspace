import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Barcode, ScanLine, Search } from 'lucide-react-native';
import { JAKARTA_FONTS } from '@mylife/bestchef';
import { Text } from '@mylife/ui';
import { useDatabase } from './providers/DatabaseProvider';
import {
  useAppThemeColors as useThemeColors,
  useAppThemeProfile as useTheme,
} from './providers/AppThemeProvider';
import { useI18n } from './i18n/I18nProvider';
import type { GrocerySection } from '@mylife/bestchef';
import { addPantryEntry } from './data/kitchen';
import { lookupBarcode, normalizeBarcode, type BarcodeFoodInfo } from './utils/barcode-lookup';
import { BackArrow } from './components/DirectionalIcons';
import { BarcodeScannerModal } from './components/BarcodeScannerModal';

const VALID_SECTIONS: ReadonlySet<GrocerySection> = new Set([
  'produce',
  'dairy',
  'meat',
  'pantry',
  'frozen',
  'bakery',
  'beverages',
  'snacks',
  'condiments',
  'other',
]);

function coerceSection(value: string | null | undefined): GrocerySection {
  if (value && VALID_SECTIONS.has(value as GrocerySection)) {
    return value as GrocerySection;
  }
  return 'pantry';
}

/**
 * Kitchen barcode food lookup screen (P14-C / F-017, audit M12).
 *
 * A real camera barcode scanner (expo-camera CameraView) reads UPC/EAN
 * codes; the manual keypad remains as a fallback when the camera is denied
 * or a code will not read. Either path fetches Open Food Facts metadata and
 * pre-fills the pantry-add form with name, brand, category, and unit.
 */
export default function KitchenBarcodeScreen() {
  const router = useRouter();
  const db = useDatabase();
  const insets = useSafeAreaInsets();
  const tc = useThemeColors();
  const theme = useTheme();
  const { t } = useI18n();

  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [info, setInfo] = useState<BarcodeFoodInfo | null>(null);
  const [unrecognized, setUnrecognized] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);

  const runLookup = async (normalized: string) => {
    setBusy(true);
    setUnrecognized(false);
    try {
      const result = await lookupBarcode(normalized);
      if (!result) {
        setInfo(null);
        setUnrecognized(true);
        return;
      }
      setInfo(result);
    } finally {
      setBusy(false);
    }
  };

  const onLookup = async () => {
    const normalized = normalizeBarcode(code);
    if (!normalized) {
      Alert.alert(t('Invalid barcode'), t('Enter an 8, 12, or 13-digit code.'));
      return;
    }
    await runLookup(normalized);
  };

  const onScanned = (normalized: string) => {
    setScannerOpen(false);
    setCode(normalized);
    void runLookup(normalized);
  };

  const onAddToPantry = () => {
    if (!info) return;
    addPantryEntry(db, {
      name: info.name,
      quantity: info.quantity,
      unit: info.unit,
      storage_location: 'pantry',
      grocery_section: coerceSection(info.category),
      batch_source: 'barcode_scan',
      receipt_link: `https://world.openfoodfacts.org/product/${encodeURIComponent(info.barcode)}`,
    });
    Alert.alert(t('Added to pantry'), info.name);
    router.back();
  };

  const onManualEntry = () => {
    router.push('/pantry');
  };

  return (
    <View style={[styles.screen, { backgroundColor: tc.background }]}>
      <View style={[styles.topBar, { paddingTop: insets.top + 12 }]}>
        <Pressable
          style={({ pressed }) => [styles.iconButton, pressed && { opacity: 0.7 }]}
          onPress={() => router.back()}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel={t('Back')}
        >
          <BackArrow size={24} color={tc.text} strokeWidth={2} />
        </Pressable>
        <Text style={[styles.title, { color: tc.text }]}>{t('kitchen_scan_barcode')}</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.card, { backgroundColor: theme.glass.cardFill, borderColor: theme.glass.cardBorder }]}>
          <View style={[styles.iconWrap, { backgroundColor: `${tc.accent}1F` }]}>
            <Barcode size={28} color={tc.accent} strokeWidth={2} />
          </View>
          <Text style={[styles.cardTitle, { color: tc.text }]}>{t('Scan barcode')}</Text>
          <Text style={[styles.cardBody, { color: tc.textSecondary }]}>
            {t('Scan a grocery barcode with your camera, or type the UPC or EAN code from the package. We look it up against Open Food Facts.')}
          </Text>
          <Pressable
            style={({ pressed }) => [
              styles.primaryButton,
              { backgroundColor: tc.accent },
              pressed && { opacity: 0.82 },
            ]}
            onPress={() => setScannerOpen(true)}
            accessibilityRole="button"
            accessibilityLabel={t('Scan barcode')}
          >
            <ScanLine size={18} color={tc.background} strokeWidth={2.4} />
            <Text style={[styles.primaryButtonText, { color: tc.background }]}>{t('Scan barcode')}</Text>
          </Pressable>
          <View style={styles.dividerRow}>
            <View style={[styles.dividerLine, { backgroundColor: theme.glass.cardBorder }]} />
            <Text style={[styles.dividerText, { color: tc.textTertiary }]}>{t('or')}</Text>
            <View style={[styles.dividerLine, { backgroundColor: theme.glass.cardBorder }]} />
          </View>
          <TextInput
            style={[styles.input, { color: tc.text, backgroundColor: tc.surface }]}
            value={code}
            onChangeText={setCode}
            placeholder="0123456789012"
            placeholderTextColor={tc.textTertiary}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="number-pad"
            maxLength={14}
          />
          <Pressable
            style={({ pressed }) => [
              styles.primaryButton,
              { backgroundColor: tc.accent },
              !code.trim() && { opacity: 0.45 },
              pressed && code.trim() && { opacity: 0.82 },
            ]}
            disabled={!code.trim() || busy}
            onPress={onLookup}
          >
            {busy ? <ActivityIndicator color={tc.background} /> : <Search size={18} color={tc.background} strokeWidth={2.4} />}
            <Text style={[styles.primaryButtonText, { color: tc.background }]}>
              {busy ? t('Looking up...') : t('Look up')}
            </Text>
          </Pressable>
        </View>

        {info && (
          <View style={[styles.card, { backgroundColor: theme.glass.cardFill, borderColor: theme.glass.cardBorder }]}>
            <Text style={[styles.cardTitle, { color: tc.text }]}>{info.name}</Text>
            {info.brand && (
              <Text style={[styles.cardMeta, { color: tc.textSecondary }]}>{info.brand}</Text>
            )}
            <View style={styles.metaRow}>
              {info.quantity !== null && info.unit && (
                <View style={[styles.metaChip, { backgroundColor: tc.surface }]}>
                  <Text style={[styles.metaChipText, { color: tc.textSecondary }]}>
                    {info.quantity} {info.unit}
                  </Text>
                </View>
              )}
              {info.category && (
                <View style={[styles.metaChip, { backgroundColor: tc.surface }]}>
                  <Text style={[styles.metaChipText, { color: tc.textSecondary }]}>{info.category}</Text>
                </View>
              )}
            </View>
            <Pressable
              style={({ pressed }) => [
                styles.primaryButton,
                { backgroundColor: tc.accent },
                pressed && { opacity: 0.82 },
              ]}
              onPress={onAddToPantry}
            >
              <Text style={[styles.primaryButtonText, { color: tc.background }]}>
                {t('Add to pantry')}
              </Text>
            </Pressable>
          </View>
        )}

        {unrecognized && (
          <View style={[styles.card, { backgroundColor: theme.glass.cardFill, borderColor: theme.glass.cardBorder }]}>
            <Text style={[styles.cardTitle, { color: tc.text }]}>{t('kitchen_item_not_recognized')}</Text>
            <Text style={[styles.cardBody, { color: tc.textSecondary }]}>
              {t('No product matched that barcode. You can add it manually instead.')}
            </Text>
            <Pressable
              style={({ pressed }) => [
                styles.secondaryButton,
                { borderColor: tc.accent },
                pressed && { opacity: 0.78 },
              ]}
              onPress={onManualEntry}
            >
              <Text style={[styles.secondaryButtonText, { color: tc.accent }]}>
                {t('kitchen_search_by_name')}
              </Text>
            </Pressable>
          </View>
        )}
      </ScrollView>

      <BarcodeScannerModal
        visible={scannerOpen}
        onScanned={onScanned}
        onClose={() => setScannerOpen(false)}
        onManualEntry={() => setScannerOpen(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 12 },
  iconButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: JAKARTA_FONTS.bold, fontSize: 17 },
  content: { padding: 20, gap: 16, paddingBottom: 40 },
  card: { borderRadius: 18, borderWidth: 1, padding: 20, gap: 12 },
  iconWrap: { alignSelf: 'flex-start', width: 56, height: 56, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  cardTitle: { fontFamily: JAKARTA_FONTS.bold, fontSize: 18 },
  cardMeta: { fontFamily: JAKARTA_FONTS.medium, fontSize: 13 },
  cardBody: { fontFamily: JAKARTA_FONTS.medium, fontSize: 14, lineHeight: 20 },
  input: { borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontFamily: JAKARTA_FONTS.regular, fontSize: 16 },
  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  dividerLine: { flex: 1, height: 1 },
  dividerText: { fontFamily: JAKARTA_FONTS.medium, fontSize: 12, textTransform: 'uppercase' },
  primaryButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 12, paddingVertical: 14 },
  primaryButtonText: { fontFamily: JAKARTA_FONTS.bold, fontSize: 15 },
  secondaryButton: { borderWidth: 1, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  secondaryButtonText: { fontFamily: JAKARTA_FONTS.bold, fontSize: 15 },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  metaChip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999 },
  metaChipText: { fontFamily: JAKARTA_FONTS.medium, fontSize: 12 },
});
