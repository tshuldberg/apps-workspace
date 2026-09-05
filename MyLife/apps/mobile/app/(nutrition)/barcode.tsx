import { useCallback, useRef, useState } from 'react';
import {
  Alert,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  CameraView,
  useCameraPermissions,
  type BarcodeScanningResult,
} from 'expo-camera';
import { handleBarcodeScan } from '@mylife/nutrition';
import { Card, Text, colors, spacing } from '@mylife/ui';
import { useDatabase } from '../../components/DatabaseProvider';

const ACCENT = colors.modules.nutrition;

export default function BarcodeScreen() {
  const db = useDatabase();
  const router = useRouter();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanning, setScanning] = useState(true);
  const [flashOn, setFlashOn] = useState(false);
  const [manualCode, setManualCode] = useState('');
  const [manualMode, setManualMode] = useState(false);
  const processingRef = useRef(false);

  const lookupCode = useCallback(
    async (barcode: string) => {
      if (processingRef.current) return;
      processingRef.current = true;
      setScanning(false);

      try {
        const res = await handleBarcodeScan(db, barcode);
        const { result } = res;
        if (result.found && result.food) {
          Alert.alert(
            'Found',
            `${result.food.name}${result.food.brand ? ` (${result.food.brand})` : ''}\n${Math.round(result.food.calories)} cal`,
            [
              {
                text: 'Cancel',
                style: 'cancel',
                onPress: () => {
                  processingRef.current = false;
                  setScanning(true);
                },
              },
              {
                text: 'Add to Diary',
                onPress: () => router.push('/(nutrition)/search' as never),
              },
            ],
          );
        } else {
          Alert.alert(
            'Not Found',
            `No food found for barcode ${barcode}.`,
            [
              {
                text: 'Try Again',
                onPress: () => {
                  processingRef.current = false;
                  setScanning(true);
                },
              },
              {
                text: 'Search Instead',
                onPress: () => router.push('/(nutrition)/search' as never),
              },
            ],
          );
        }
      } catch {
        Alert.alert('Error', 'Failed to look up barcode.', [
          {
            text: 'OK',
            onPress: () => {
              processingRef.current = false;
              setScanning(true);
            },
          },
        ]);
      }
    },
    [db, router],
  );

  const handleScan = useCallback(
    (scanResult: BarcodeScanningResult) => {
      if (!scanning) return;
      const code = scanResult.data;
      if (!code) return;
      void lookupCode(code);
    },
    [scanning, lookupCode],
  );

  const handleManual = () => {
    if (!manualCode.trim()) {
      Alert.alert('Empty', 'Please enter a barcode.');
      return;
    }
    void lookupCode(manualCode.trim());
  };

  if (!permission) {
    return (
      <View style={styles.loading}>
        <Text variant="body" color={colors.textSecondary}>
          Requesting camera access...
        </Text>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.permission}>
        <Text style={{ fontSize: 48 }}>{'\ud83d\udcf7'}</Text>
        <Text variant="heading" color={colors.text}>
          Camera Access Needed
        </Text>
        <Text variant="body" color={colors.textSecondary} style={{ textAlign: 'center' }}>
          We need camera access to scan food barcodes and look up nutrition info.
        </Text>
        <Pressable style={styles.primaryBtn} onPress={requestPermission}>
          <Text variant="label" color="#fff" style={{ fontWeight: '700' }}>
            Grant Access
          </Text>
        </Pressable>
      </View>
    );
  }

  if (manualMode) {
    return (
      <View style={styles.manualScreen}>
        <Card>
          <Text variant="subheading" color={colors.text}>
            Enter Barcode
          </Text>
          <Text variant="caption" color={colors.textSecondary} style={{ marginTop: 4 }}>
            Type the UPC or EAN code printed below the barcode
          </Text>
          <TextInput
            style={styles.input}
            placeholder="e.g., 012345678901"
            placeholderTextColor={colors.textTertiary}
            value={manualCode}
            onChangeText={setManualCode}
            keyboardType="number-pad"
            autoFocus
          />
          <View style={styles.manualRow}>
            <Pressable
              style={styles.secondaryBtn}
              onPress={() => setManualMode(false)}
            >
              <Text variant="label" color={colors.textSecondary}>
                Back to Scanner
              </Text>
            </Pressable>
            <Pressable style={styles.primaryBtn} onPress={handleManual}>
              <Text variant="label" color="#fff" style={{ fontWeight: '700' }}>
                Look Up
              </Text>
            </Pressable>
          </View>
        </Card>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        enableTorch={flashOn}
        barcodeScannerSettings={{
          barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e', 'code128', 'code39'],
        }}
        onBarcodeScanned={scanning ? handleScan : undefined}
      />

      {/* Dark overlay with cutout */}
      <View style={styles.overlayTop} />
      <View style={styles.middleRow}>
        <View style={styles.overlaySide} />
        <View style={styles.scanArea}>
          <View style={[styles.corner, styles.cornerTL]} />
          <View style={[styles.corner, styles.cornerTR]} />
          <View style={[styles.corner, styles.cornerBL]} />
          <View style={[styles.corner, styles.cornerBR]} />
          <View style={styles.scanLine} />
        </View>
        <View style={styles.overlaySide} />
      </View>
      <View style={styles.overlayBottom}>
        <Text
          variant="body"
          color="#fff"
          style={{ textAlign: 'center', marginBottom: spacing.md }}
        >
          Position barcode in frame
        </Text>

        <View style={styles.controlRow}>
          <Pressable
            style={styles.controlBtn}
            onPress={() => setFlashOn((v) => !v)}
          >
            <Text style={{ fontSize: 20 }}>
              {flashOn ? '\ud83d\udd26' : '\u26a1'}
            </Text>
            <Text variant="caption" color="#fff">
              Flash
            </Text>
          </Pressable>
          <Pressable
            style={styles.controlBtn}
            onPress={() => setManualMode(true)}
          >
            <Text style={{ fontSize: 20 }}>{'\u2328\ufe0f'}</Text>
            <Text variant="caption" color="#fff">
              Manual
            </Text>
          </Pressable>
          <Pressable
            style={styles.controlBtn}
            onPress={() => router.back()}
          >
            <Text style={{ fontSize: 20 }}>{'\u2715'}</Text>
            <Text variant="caption" color="#fff">
              Close
            </Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const OVERLAY = 'rgba(0,0,0,0.72)';
const SCAN_SIZE = 260;

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#000' },
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
  permission: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    padding: spacing.xl,
    backgroundColor: colors.background,
  },
  manualScreen: {
    flex: 1,
    backgroundColor: colors.background,
    padding: spacing.md,
    justifyContent: 'center',
  },
  input: {
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    color: colors.text,
    fontSize: 18,
    fontFamily: 'Inter',
    marginTop: spacing.md,
  },
  manualRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  primaryBtn: {
    flex: 1,
    backgroundColor: ACCENT,
    borderRadius: 10,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  secondaryBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  overlayTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '25%',
    backgroundColor: OVERLAY,
  },
  middleRow: {
    position: 'absolute',
    top: '25%',
    left: 0,
    right: 0,
    height: SCAN_SIZE,
    flexDirection: 'row',
  },
  overlaySide: {
    flex: 1,
    backgroundColor: OVERLAY,
  },
  scanArea: {
    width: SCAN_SIZE,
    height: SCAN_SIZE,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  corner: {
    position: 'absolute',
    width: 32,
    height: 32,
    borderColor: ACCENT,
  },
  cornerTL: { top: 0, left: 0, borderTopWidth: 4, borderLeftWidth: 4 },
  cornerTR: { top: 0, right: 0, borderTopWidth: 4, borderRightWidth: 4 },
  cornerBL: { bottom: 0, left: 0, borderBottomWidth: 4, borderLeftWidth: 4 },
  cornerBR: { bottom: 0, right: 0, borderBottomWidth: 4, borderRightWidth: 4 },
  scanLine: {
    width: '80%',
    height: 2,
    backgroundColor: ACCENT,
    opacity: 0.6,
  },
  overlayBottom: {
    position: 'absolute',
    top: `${25 + (SCAN_SIZE / 8)}%`,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: OVERLAY,
    padding: spacing.lg,
    justifyContent: 'flex-end',
    paddingBottom: spacing.xxl,
  },
  controlRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    gap: spacing.md,
  },
  controlBtn: {
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    borderRadius: 12,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    minWidth: 80,
  },
});
