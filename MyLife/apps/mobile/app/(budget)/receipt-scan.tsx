import { useCallback, useRef, useState } from 'react';
import {
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import {
  BG_ACCENT_LIGHT,
  BG_DANGER,
  BG_FONTS,
  BG_MONEY,
  BG_SURFACES,
  BG_TEXT,
  BG_TEXT_SECONDARY,
  BG_TEXT_TERTIARY,
  GlassCard,
  MaterialSymbol,
  createReceipt,
  normalizeReceiptMerchant,
  parseReceiptText,
  type ParsedReceipt,
} from '@mylife/budget';
import { useDatabase } from '../../components/DatabaseProvider';
import { uuid } from '../../lib/uuid';

type CaptureStep = 'capture' | 'review';

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function formatCurrency(cents: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(cents / 100);
}

function parseCurrencyInput(value: string): number | null {
  const normalized = value.replace(/[^0-9.-]/g, '').trim();
  if (!normalized) {
    return null;
  }
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) {
    return null;
  }
  return Math.round(parsed * 100);
}

function mockOCR(source: 'camera' | 'library') {
  const merchant = source === 'camera' ? 'Green Market' : 'Corner Pantry';
  const total = source === 'camera' ? '46.18' : '19.83';
  return `${merchant}
124 Mission St
Date: ${todayISO()}

Milk 1 x 4.99        4.99
Granola 1 x 8.75     8.75
Produce 1 x 28.90    28.90

Subtotal             42.64
Tax                   3.54
Total                ${total}

Thank you for shopping!`;
}

export default function ReceiptScanScreen() {
  const db = useDatabase();
  const router = useRouter();
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView | null>(null);

  const [step, setStep] = useState<CaptureStep>('capture');
  const [flashOn, setFlashOn] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [ocrText, setOcrText] = useState('');
  const [parsed, setParsed] = useState<ParsedReceipt | null>(null);
  const [merchant, setMerchant] = useState('');
  const [date, setDate] = useState(todayISO());
  const [total, setTotal] = useState('');
  const [tax, setTax] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const applyOCR = useCallback(async (uri: string, source: 'camera' | 'library') => {
    const nextOcrText = mockOCR(source);
    const result = parseReceiptText(nextOcrText);

    setImageUri(uri);
    setOcrText(nextOcrText);
    setParsed(result);
    setMerchant(
      result.merchant ? normalizeReceiptMerchant(result.merchant) : 'Receipt merchant',
    );
    setDate(result.date ?? todayISO());
    setTotal(result.total != null ? (result.total / 100).toFixed(2) : '');
    setTax(result.tax != null ? (result.tax / 100).toFixed(2) : '');
    setStep('review');
    setError(null);
  }, []);

  const handleCapture = useCallback(async () => {
    if (capturing) {
      return;
    }

    setCapturing(true);

    try {
      const captured = await cameraRef.current?.takePictureAsync({
        quality: 0.7,
      });
      const uri = captured?.uri ?? `mock://receipt-${Date.now()}`;
      await applyOCR(uri, 'camera');
    } catch {
      await applyOCR(`mock://receipt-${Date.now()}`, 'camera');
    } finally {
      setCapturing(false);
    }
  }, [applyOCR, capturing]);

  const handlePickFromLibrary = useCallback(async () => {
    const mediaPermission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!mediaPermission.granted) {
      Alert.alert(
        'Photo access needed',
        'Allow library access to import a receipt image.',
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
    });

    if (result.canceled || !result.assets[0]?.uri) {
      return;
    }

    await applyOCR(result.assets[0].uri, 'library');
  }, [applyOCR]);

  const handleSave = useCallback(() => {
    if (saving) {
      return;
    }

    const totalCents = parseCurrencyInput(total);
    const taxCents = parseCurrencyInput(tax) ?? 0;
    if (totalCents == null || totalCents <= 0) {
      setError('Enter a valid total before saving.');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      createReceipt(db, uuid(), {
        currency_raw: parsed?.currency ?? 'USD',
        date_raw: date.trim() || null,
        image_uri: imageUri ?? `mock://receipt-${Date.now()}`,
        line_items: JSON.stringify(parsed?.lineItems ?? []),
        merchant_raw: merchant.trim() || null,
        ocr_confidence: parsed?.confidence ?? null,
        ocr_provider: 'phase4-placeholder',
        raw_ocr_text: ocrText,
        status: 'reviewed',
        subtotal: Math.max(totalCents - taxCents, 0),
        tax_amount: taxCents > 0 ? taxCents : null,
        total_raw: total.trim(),
      });

      router.back();
    } catch (saveError) {
      setError(
        saveError instanceof Error ? saveError.message : 'Failed to save receipt.',
      );
      setSaving(false);
    }
  }, [date, db, imageUri, merchant, ocrText, parsed, router, saving, tax, total]);

  const handleCreateTransaction = useCallback(() => {
    const totalCents = parseCurrencyInput(total);
    if (totalCents == null || totalCents <= 0) {
      setError('Enter a valid total before creating a transaction.');
      return;
    }

    router.push(
      `/(budget)/transaction/create?merchant=${encodeURIComponent(merchant)}&amount=${(totalCents / 100).toFixed(2)}&date=${date}` as never,
    );
  }, [date, merchant, router, total]);

  if (!permission) {
    return (
      <View style={styles.loadingState}>
        <Text style={styles.loadingText}>Checking camera permission...</Text>
      </View>
    );
  }

  if (step === 'capture') {
    return (
      <View style={styles.captureScreen}>
        <Stack.Screen options={{ headerShown: false }} />

        {permission.granted ? (
          <CameraView
            enableTorch={flashOn}
            facing="back"
            ref={cameraRef}
            style={StyleSheet.absoluteFillObject}
          />
        ) : (
          <View style={styles.permissionFallback}>
            <GlassCard style={styles.permissionCard}>
              <Text style={styles.permissionTitle}>Camera access needed</Text>
              <Text style={styles.permissionCopy}>
                Phase 4 uses a full-bleed camera shell for receipt capture. Grant access to continue or import from your library instead.
              </Text>
              <View style={styles.permissionActions}>
                <Pressable onPress={() => requestPermission()} style={styles.primaryAction}>
                  <Text style={styles.primaryActionLabel}>Allow camera</Text>
                </Pressable>
                <Pressable onPress={handlePickFromLibrary} style={styles.secondaryAction}>
                  <Text style={styles.secondaryActionLabel}>Use gallery</Text>
                </Pressable>
              </View>
            </GlassCard>
          </View>
        )}

        <View style={styles.captureOverlay}>
          <View style={styles.topBar}>
            <Pressable onPress={() => router.back()} style={styles.overlayButton}>
              <MaterialSymbol color={BG_TEXT} name="close" size={18} />
            </Pressable>
            <View style={styles.topBarActions}>
              <Pressable onPress={() => setFlashOn((current) => !current)} style={styles.overlayButton}>
                <MaterialSymbol
                  color={flashOn ? BG_ACCENT_LIGHT : BG_TEXT}
                  name={flashOn ? 'flash_on' : 'flash_off'}
                  size={18}
                />
              </Pressable>
              <Pressable onPress={handlePickFromLibrary} style={styles.overlayButton}>
                <MaterialSymbol color={BG_TEXT} name="photo_library" size={18} />
              </Pressable>
            </View>
          </View>

          <View style={styles.captureCopy}>
            <Text style={styles.captureTitle}>Scan Receipt</Text>
            <Text style={styles.captureSubtitle}>
              Center the receipt inside the frame to review merchant, date, amount, and line items.
            </Text>
          </View>

          <View style={styles.scanFrameWrap}>
            <View style={styles.scanFrame}>
              <View style={[styles.corner, styles.cornerTopLeft]} />
              <View style={[styles.corner, styles.cornerTopRight]} />
              <View style={[styles.corner, styles.cornerBottomLeft]} />
              <View style={[styles.corner, styles.cornerBottomRight]} />
            </View>
          </View>

          <View style={styles.bottomBar}>
            <Pressable onPress={handlePickFromLibrary} style={styles.galleryAction}>
              <MaterialSymbol color={BG_TEXT} name="photo_library" size={18} />
              <Text style={styles.galleryActionLabel}>Gallery</Text>
            </Pressable>

            <Pressable onPress={handleCapture} style={styles.captureButton}>
              <View style={styles.captureButtonInner} />
            </Pressable>

            <View style={styles.galleryAction}>
              <Text style={styles.galleryActionLabel}>
                {capturing ? 'Scanning...' : 'Capture'}
              </Text>
            </View>
          </View>
        </View>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.reviewContent} style={styles.reviewScreen}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={styles.reviewHeader}>
        <Pressable onPress={() => setStep('capture')} style={styles.reviewHeaderButton}>
          <MaterialSymbol color={BG_TEXT} name="arrow_back" size={18} />
          <Text style={styles.reviewHeaderButtonLabel}>Retake</Text>
        </Pressable>
        <Text style={styles.reviewHeaderTitle}>Receipt Review</Text>
        <Pressable onPress={() => router.back()} style={styles.reviewHeaderButton}>
          <MaterialSymbol color={BG_TEXT} name="close" size={18} />
        </Pressable>
      </View>

      <GlassCard style={styles.previewCard}>
        {imageUri ? (
          <Image resizeMode="cover" source={{ uri: imageUri }} style={styles.previewImage} />
        ) : null}
        <View style={styles.previewFooter}>
          <View style={styles.confidencePill}>
            <Text style={styles.confidenceLabel}>
              {Math.round((parsed?.confidence ?? 0.55) * 100)}% OCR
            </Text>
          </View>
          <Text style={styles.previewMeta}>
            {parsed?.lineItems.length ?? 0} items · {date}
          </Text>
        </View>
      </GlassCard>

      <GlassCard style={styles.sectionCard}>
        <Text style={styles.sectionLabel}>Parsed receipt</Text>

        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>Merchant</Text>
          <TextInput
            onChangeText={setMerchant}
            placeholder="Store name"
            placeholderTextColor={BG_TEXT_TERTIARY}
            style={styles.input}
            value={merchant}
          />
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>Date</Text>
          <TextInput
            onChangeText={setDate}
            placeholder="YYYY-MM-DD"
            placeholderTextColor={BG_TEXT_TERTIARY}
            style={styles.input}
            value={date}
          />
        </View>

        <View style={styles.inlineFieldRow}>
          <View style={styles.inlineField}>
            <Text style={styles.fieldLabel}>Total</Text>
            <TextInput
              keyboardType="decimal-pad"
              onChangeText={setTotal}
              placeholder="0.00"
              placeholderTextColor={BG_TEXT_TERTIARY}
              style={styles.input}
              value={total}
            />
          </View>
          <View style={styles.inlineField}>
            <Text style={styles.fieldLabel}>Tax</Text>
            <TextInput
              keyboardType="decimal-pad"
              onChangeText={setTax}
              placeholder="0.00"
              placeholderTextColor={BG_TEXT_TERTIARY}
              style={styles.input}
              value={tax}
            />
          </View>
        </View>
      </GlassCard>

      <GlassCard style={styles.sectionCard}>
        <Text style={styles.sectionLabel}>Line items</Text>
        {parsed?.lineItems.length ? (
          parsed.lineItems.map((item) => (
            <View key={`${item.description}-${item.total}`} style={styles.lineItemRow}>
              <View style={styles.lineItemCopy}>
                <Text style={styles.lineItemTitle}>{item.description}</Text>
                <Text style={styles.lineItemMeta}>
                  Qty {item.quantity} · {formatCurrency(item.unitPrice)}
                </Text>
              </View>
              <Text style={styles.lineItemAmount}>{formatCurrency(item.total)}</Text>
            </View>
          ))
        ) : (
          <Text style={styles.rawOcrText}>No line items detected from OCR.</Text>
        )}
      </GlassCard>

      <GlassCard style={styles.sectionCard}>
        <Text style={styles.sectionLabel}>Raw OCR</Text>
        <Text style={styles.rawOcrText}>{ocrText}</Text>
      </GlassCard>

      {error ? (
        <GlassCard style={styles.errorCard}>
          <Text style={styles.errorText}>{error}</Text>
        </GlassCard>
      ) : null}

      <View style={styles.actionRow}>
        <Pressable onPress={handleSave} style={[styles.primaryAction, saving ? styles.primaryActionDisabled : null]}>
          <Text style={styles.primaryActionLabel}>{saving ? 'Saving...' : 'Save receipt'}</Text>
        </Pressable>
        <Pressable onPress={handleCreateTransaction} style={styles.secondaryAction}>
          <Text style={styles.secondaryActionLabel}>Save as transaction</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  captureScreen: {
    backgroundColor: '#000000',
    flex: 1,
  },
  loadingState: {
    alignItems: 'center',
    backgroundColor: BG_SURFACES.base,
    flex: 1,
    justifyContent: 'center',
  },
  loadingText: {
    color: BG_TEXT_SECONDARY,
    fontFamily: BG_FONTS.medium,
    fontSize: 15,
    lineHeight: 20,
  },
  permissionFallback: {
    alignItems: 'center',
    backgroundColor: BG_SURFACES.base,
    flex: 1,
    justifyContent: 'center',
    padding: 20,
  },
  permissionCard: {
    gap: 14,
  },
  permissionTitle: {
    color: BG_TEXT,
    fontFamily: BG_FONTS.bold,
    fontSize: 18,
    lineHeight: 24,
  },
  permissionCopy: {
    color: BG_TEXT_SECONDARY,
    fontFamily: BG_FONTS.regular,
    fontSize: 13,
    lineHeight: 18,
  },
  permissionActions: {
    flexDirection: 'row',
    gap: 12,
  },
  captureOverlay: {
    backgroundColor: 'rgba(0, 0, 0, 0.28)',
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 56,
    paddingBottom: 34,
  },
  topBar: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  topBarActions: {
    flexDirection: 'row',
    gap: 10,
  },
  overlayButton: {
    alignItems: 'center',
    backgroundColor: 'rgba(14, 14, 19, 0.75)',
    borderRadius: 20,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  captureCopy: {
    gap: 8,
    marginTop: 24,
  },
  captureTitle: {
    color: '#FFFFFF',
    fontFamily: BG_FONTS.bold,
    fontSize: 30,
    lineHeight: 34,
  },
  captureSubtitle: {
    color: 'rgba(255,255,255,0.78)',
    fontFamily: BG_FONTS.regular,
    fontSize: 13,
    lineHeight: 18,
    maxWidth: 260,
  },
  scanFrameWrap: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
  scanFrame: {
    borderRadius: 28,
    height: 280,
    position: 'relative',
    width: 210,
  },
  corner: {
    borderColor: BG_ACCENT_LIGHT,
    height: 42,
    position: 'absolute',
    width: 42,
  },
  cornerTopLeft: {
    borderLeftWidth: 4,
    borderRadius: 18,
    borderTopWidth: 4,
    left: 0,
    top: 0,
  },
  cornerTopRight: {
    borderRadius: 18,
    borderRightWidth: 4,
    borderTopWidth: 4,
    right: 0,
    top: 0,
  },
  cornerBottomLeft: {
    borderBottomWidth: 4,
    borderLeftWidth: 4,
    borderRadius: 18,
    bottom: 0,
    left: 0,
  },
  cornerBottomRight: {
    borderBottomWidth: 4,
    borderRadius: 18,
    borderRightWidth: 4,
    bottom: 0,
    right: 0,
  },
  bottomBar: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  galleryAction: {
    alignItems: 'center',
    gap: 6,
    minWidth: 80,
  },
  galleryActionLabel: {
    color: '#FFFFFF',
    fontFamily: BG_FONTS.medium,
    fontSize: 12,
    lineHeight: 16,
  },
  captureButton: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: 40,
    height: 80,
    justifyContent: 'center',
    width: 80,
  },
  captureButtonInner: {
    backgroundColor: '#FFFFFF',
    borderRadius: 30,
    height: 60,
    width: 60,
  },
  reviewScreen: {
    flex: 1,
    backgroundColor: BG_SURFACES.base,
  },
  reviewContent: {
    padding: 20,
    paddingBottom: 48,
    gap: 18,
  },
  reviewHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  reviewHeaderButton: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
    minWidth: 64,
  },
  reviewHeaderButtonLabel: {
    color: BG_TEXT,
    fontFamily: BG_FONTS.medium,
    fontSize: 13,
    lineHeight: 18,
  },
  reviewHeaderTitle: {
    color: BG_TEXT,
    fontFamily: BG_FONTS.bold,
    fontSize: 18,
    lineHeight: 24,
  },
  previewCard: {
    gap: 0,
    overflow: 'hidden',
    padding: 0,
  },
  previewImage: {
    backgroundColor: BG_SURFACES.low,
    height: 220,
    width: '100%',
  },
  previewFooter: {
    alignItems: 'center',
    backgroundColor: BG_SURFACES.low,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  confidencePill: {
    backgroundColor: `${BG_MONEY}22`,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  confidenceLabel: {
    color: BG_MONEY,
    fontFamily: BG_FONTS.semiBold,
    fontSize: 12,
    lineHeight: 16,
  },
  previewMeta: {
    color: BG_TEXT_SECONDARY,
    fontFamily: BG_FONTS.regular,
    fontSize: 12,
    lineHeight: 17,
  },
  sectionCard: {
    gap: 16,
  },
  sectionLabel: {
    color: BG_TEXT_TERTIARY,
    fontFamily: BG_FONTS.semiBold,
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  fieldGroup: {
    gap: 8,
  },
  fieldLabel: {
    color: BG_TEXT_SECONDARY,
    fontFamily: BG_FONTS.medium,
    fontSize: 13,
    lineHeight: 18,
  },
  input: {
    backgroundColor: BG_SURFACES.low,
    borderRadius: 16,
    color: BG_TEXT,
    fontFamily: BG_FONTS.medium,
    fontSize: 15,
    lineHeight: 20,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  inlineFieldRow: {
    flexDirection: 'row',
    gap: 12,
  },
  inlineField: {
    flex: 1,
    gap: 8,
  },
  lineItemRow: {
    alignItems: 'center',
    backgroundColor: BG_SURFACES.low,
    borderRadius: 18,
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  lineItemCopy: {
    flex: 1,
    gap: 4,
  },
  lineItemTitle: {
    color: BG_TEXT,
    fontFamily: BG_FONTS.semiBold,
    fontSize: 14,
    lineHeight: 18,
  },
  lineItemMeta: {
    color: BG_TEXT_SECONDARY,
    fontFamily: BG_FONTS.regular,
    fontSize: 12,
    lineHeight: 17,
  },
  lineItemAmount: {
    color: BG_ACCENT_LIGHT,
    fontFamily: BG_FONTS.bold,
    fontSize: 13,
    lineHeight: 18,
  },
  rawOcrText: {
    color: BG_TEXT_SECONDARY,
    fontFamily: BG_FONTS.regular,
    fontSize: 12,
    lineHeight: 18,
  },
  errorCard: {
    backgroundColor: `${BG_DANGER}18`,
  },
  errorText: {
    color: BG_DANGER,
    fontFamily: BG_FONTS.medium,
    fontSize: 13,
    lineHeight: 18,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 12,
  },
  primaryAction: {
    alignItems: 'center',
    backgroundColor: BG_MONEY,
    borderRadius: 18,
    flex: 1,
    justifyContent: 'center',
    minHeight: 52,
    paddingHorizontal: 16,
  },
  primaryActionDisabled: {
    opacity: 0.72,
  },
  primaryActionLabel: {
    color: BG_SURFACES.base,
    fontFamily: BG_FONTS.bold,
    fontSize: 14,
    lineHeight: 18,
  },
  secondaryAction: {
    alignItems: 'center',
    backgroundColor: BG_SURFACES.high,
    borderRadius: 18,
    flex: 1,
    justifyContent: 'center',
    minHeight: 52,
    paddingHorizontal: 16,
  },
  secondaryActionLabel: {
    color: BG_TEXT,
    fontFamily: BG_FONTS.semiBold,
    fontSize: 14,
    lineHeight: 18,
  },
});
