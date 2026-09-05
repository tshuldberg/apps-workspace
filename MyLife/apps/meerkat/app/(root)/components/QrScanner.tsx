import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { BarcodeScanningResult } from 'expo-camera';
import { MK_RADIUS, type MkColors } from '../theme/tokens';
import { useMkStyles } from '../providers/AppThemeProvider';
import { Button } from './kit';

// expo-camera is lazy-required so a build (or Expo Go) without the native module
// degrades to paste-only import instead of crashing. The screen calls
// isQrScannerAvailable() before offering "Scan QR".
type CameraModule = typeof import('expo-camera');

let cameraModule: CameraModule | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  cameraModule = require('expo-camera') as CameraModule;
} catch {
  cameraModule = null;
}

export function isQrScannerAvailable(): boolean {
  return cameraModule !== null;
}

// permissionRationale + scanHint default to the theme-code copy; callers in
// other flows (e.g. the friend code) pass their own so the permission prompt and
// on-camera hint describe what is actually being scanned.
const DEFAULT_PERMISSION_RATIONALE =
  'Meerkat needs the camera only to scan a theme code. Nothing is photographed or stored.';
const DEFAULT_SCAN_HINT = 'Point the camera at a theme QR code.';

export function QrScanner({
  onScan,
  onCancel,
  permissionRationale = DEFAULT_PERMISSION_RATIONALE,
  scanHint = DEFAULT_SCAN_HINT,
}: {
  onScan: (value: string) => void;
  onCancel: () => void;
  permissionRationale?: string;
  scanHint?: string;
}): React.ReactElement | null {
  if (!cameraModule) return null;
  return (
    <QrScannerInner
      module={cameraModule}
      onScan={onScan}
      onCancel={onCancel}
      permissionRationale={permissionRationale}
      scanHint={scanHint}
    />
  );
}

// Hooks live here so they are called unconditionally (this component only mounts
// when the camera module is present).
function QrScannerInner({
  module,
  onScan,
  onCancel,
  permissionRationale,
  scanHint,
}: {
  module: CameraModule;
  onScan: (value: string) => void;
  onCancel: () => void;
  permissionRationale: string;
  scanHint: string;
}): React.ReactElement {
  const styles = useMkStyles(makeStyles);
  const [permission, requestPermission] = module.useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const { CameraView } = module;

  if (!permission) {
    return (
      <View style={styles.center}>
        <Text style={styles.hint}>Preparing the camera…</Text>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.center}>
        <Text style={styles.title}>Camera access</Text>
        <Text style={styles.hint}>{permissionRationale}</Text>
        <View style={styles.actions}>
          <Button title="Allow camera" onPress={() => void requestPermission()} />
          <Button title="Cancel" variant="ghost" onPress={onCancel} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.scannerWrap}>
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        onBarcodeScanned={
          scanned
            ? undefined
            : (result: BarcodeScanningResult) => {
                setScanned(true);
                onScan(result.data);
              }
        }
      />
      <View style={styles.overlay} pointerEvents="box-none">
        <View style={styles.reticle} />
        <Text style={styles.scanHint}>{scanHint}</Text>
        <Button title="Cancel" variant="secondary" onPress={onCancel} />
      </View>
    </View>
  );
}

const makeStyles = (c: MkColors) =>
  StyleSheet.create({
    center: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 14,
      padding: 24,
      backgroundColor: c.background,
    },
    title: { color: c.text, fontSize: 20, fontWeight: '800' },
    hint: {
      color: c.textSecondary,
      fontSize: 14,
      lineHeight: 20,
      textAlign: 'center',
    },
    actions: { gap: 10, alignSelf: 'stretch' },
    scannerWrap: { flex: 1, backgroundColor: '#000000' },
    overlay: {
      ...StyleSheet.absoluteFillObject,
      alignItems: 'center',
      justifyContent: 'flex-end',
      paddingBottom: 48,
      gap: 18,
    },
    reticle: {
      position: 'absolute',
      top: '28%',
      width: 232,
      height: 232,
      borderRadius: MK_RADIUS.lg,
      borderWidth: 3,
      borderColor: '#FFFFFF',
    },
    scanHint: {
      color: '#FFFFFF',
      fontSize: 14,
      fontWeight: '600',
      textAlign: 'center',
      paddingHorizontal: 24,
    },
  });
