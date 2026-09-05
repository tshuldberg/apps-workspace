import { useCallback, useRef, useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  CameraView,
  useCameraPermissions,
  type BarcodeScanningResult,
} from 'expo-camera';
import { Flashlight, Keyboard, X } from 'lucide-react-native';
import { JAKARTA_FONTS } from '@mylife/bestchef';
import { Text } from '@mylife/ui';
import { useAppThemeColors as useThemeColors } from '../providers/AppThemeProvider';
import { useI18n } from '../i18n/I18nProvider';
import { normalizeBarcode } from '../utils/barcode-lookup';

interface BarcodeScannerModalProps {
  visible: boolean;
  /** Called with the normalized code (8/12/13 digits) once a valid barcode is read. */
  onScanned: (code: string) => void;
  onClose: () => void;
  /** Fall back to the manual keypad already on the host screen. */
  onManualEntry: () => void;
}

const SCAN_BARCODE_TYPES = ['ean13', 'ean8', 'upc_a', 'upc_e'] as const;

/**
 * Real camera barcode scanner for the kitchen barcode screen (audit M12).
 * Uses expo-camera CameraView. The manual keypad on the host screen stays as
 * the fallback for when the camera is denied or a code will not read.
 */
export function BarcodeScannerModal({
  visible,
  onScanned,
  onClose,
  onManualEntry,
}: BarcodeScannerModalProps) {
  const tc = useThemeColors();
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const [permission, requestPermission] = useCameraPermissions();
  const [torchOn, setTorchOn] = useState(false);
  // Guards against the scanner firing the same code dozens of times per
  // second while the camera keeps the barcode in frame.
  const handledRef = useRef(false);

  const handleClose = useCallback(() => {
    handledRef.current = false;
    setTorchOn(false);
    onClose();
  }, [onClose]);

  const handleBarcode = useCallback(
    (result: BarcodeScanningResult) => {
      if (handledRef.current) return;
      const normalized = normalizeBarcode(result.data ?? '');
      // Ignore reads that are not a valid UPC/EAN (e.g. a QR code in frame).
      if (!normalized) return;
      handledRef.current = true;
      setTorchOn(false);
      onScanned(normalized);
    },
    [onScanned],
  );

  const handleManual = useCallback(() => {
    handledRef.current = false;
    setTorchOn(false);
    onManualEntry();
  }, [onManualEntry]);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={handleClose} onShow={() => {
      handledRef.current = false;
    }}>
      <View style={styles.screen}>
        {!permission || !permission.granted ? (
          <View style={[styles.permission, { backgroundColor: tc.background }]}>
            <Text style={[styles.permTitle, { color: tc.text }]}>
              {t('Camera Access Required')}
            </Text>
            <Text style={[styles.permBody, { color: tc.textSecondary }]}>
              {t('BestChef uses the camera to scan grocery barcodes so you can add pantry items quickly.')}
            </Text>
            <Pressable
              style={({ pressed }) => [
                styles.primaryButton,
                { backgroundColor: tc.accent },
                pressed && { opacity: 0.82 },
              ]}
              onPress={() => {
                void requestPermission();
              }}
            >
              <Text style={[styles.primaryButtonText, { color: tc.background }]}>
                {t('Grant Access')}
              </Text>
            </Pressable>
            <Pressable style={styles.linkButton} onPress={handleManual}>
              <Text style={[styles.linkText, { color: tc.accent }]}>{t('Enter barcode')}</Text>
            </Pressable>
            <Pressable style={styles.linkButton} onPress={handleClose}>
              <Text style={[styles.linkText, { color: tc.textSecondary }]}>{t('Cancel')}</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.cameraWrap}>
            <CameraView
              style={StyleSheet.absoluteFill}
              facing="back"
              enableTorch={torchOn}
              barcodeScannerSettings={{ barcodeTypes: [...SCAN_BARCODE_TYPES] }}
              onBarcodeScanned={handleBarcode}
            />

            <View style={[styles.topBar, { paddingTop: insets.top + 12 }]}>
              <Pressable
                style={styles.iconButton}
                onPress={handleClose}
                hitSlop={12}
                accessibilityRole="button"
                accessibilityLabel={t('Close')}
              >
                <X size={24} color="#FFFFFF" strokeWidth={2.2} />
              </Pressable>
              <Text style={styles.topTitle}>{t('Scan barcode')}</Text>
              <Pressable
                style={styles.iconButton}
                onPress={() => setTorchOn((v) => !v)}
                hitSlop={12}
                accessibilityRole="button"
                accessibilityLabel={t('Toggle flash')}
              >
                <Flashlight size={22} color={torchOn ? tc.accent : '#FFFFFF'} strokeWidth={2.2} />
              </Pressable>
            </View>

            <View style={styles.reticleWrap} pointerEvents="none">
              <View style={[styles.reticle, { borderColor: tc.accent }]} />
              <Text style={styles.hint}>{t('Position the barcode inside the frame')}</Text>
            </View>

            <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 20 }]}>
              <Pressable
                style={({ pressed }) => [
                  styles.manualButton,
                  pressed && { opacity: 0.82 },
                ]}
                onPress={handleManual}
                accessibilityRole="button"
              >
                <Keyboard size={18} color="#FFFFFF" strokeWidth={2.2} />
                <Text style={styles.manualButtonText}>{t('Enter barcode')}</Text>
              </Pressable>
            </View>
          </View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#000' },
  cameraWrap: { flex: 1 },
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  iconButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  topTitle: { color: '#FFFFFF', fontFamily: JAKARTA_FONTS.bold, fontSize: 17 },
  reticleWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 18 },
  reticle: {
    width: 260,
    height: 170,
    borderWidth: 3,
    borderRadius: 20,
    backgroundColor: 'transparent',
  },
  hint: {
    color: '#FFFFFF',
    fontFamily: JAKARTA_FONTS.medium,
    fontSize: 14,
    textAlign: 'center',
    paddingHorizontal: 32,
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  manualButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderColor: 'rgba(255,255,255,0.24)',
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  manualButtonText: { color: '#FFFFFF', fontFamily: JAKARTA_FONTS.bold, fontSize: 14 },
  permission: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    paddingHorizontal: 32,
  },
  permTitle: { fontFamily: JAKARTA_FONTS.extraBold, fontSize: 20, textAlign: 'center' },
  permBody: { fontFamily: JAKARTA_FONTS.medium, fontSize: 14, lineHeight: 21, textAlign: 'center' },
  primaryButton: {
    minWidth: 200,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  primaryButtonText: { fontFamily: JAKARTA_FONTS.bold, fontSize: 15 },
  linkButton: { paddingVertical: 8 },
  linkText: { fontFamily: JAKARTA_FONTS.bold, fontSize: 14 },
});
