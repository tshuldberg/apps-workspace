import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { Text, Button, colors, spacing } from '@mybooks/ui';

export default function ScanScreen() {
  const router = useRouter();

  // Camera/barcode scanning requires a physical device.
  // This is the placeholder UI; expo-camera integration wired in later.
  return (
    <>
      <Stack.Screen options={{ title: 'Scan Barcode' }} />
      <View style={styles.container}>
        {/* Camera viewfinder placeholder */}
        <View style={styles.viewfinder}>
          <View style={styles.guide}>
            <View style={[styles.corner, styles.topLeft]} />
            <View style={[styles.corner, styles.topRight]} />
            <View style={[styles.corner, styles.bottomLeft]} />
            <View style={[styles.corner, styles.bottomRight]} />
          </View>
          <Text variant="caption" color={colors.text} style={styles.guideText}>
            Point at a book's barcode
          </Text>
        </View>

        <View style={styles.footer}>
          <Text variant="body" color={colors.textSecondary} style={styles.hint}>
            Camera access required. Barcode scanning works on physical devices.
          </Text>
          <Button variant="secondary" label="Enter ISBN Manually" onPress={() => router.back()} />
        </View>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  viewfinder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  guide: {
    width: 260,
    height: 160,
    position: 'relative',
  },
  corner: {
    position: 'absolute',
    width: 32,
    height: 32,
    borderColor: colors.accent,
  },
  topLeft: {
    top: 0, left: 0,
    borderTopWidth: 3, borderLeftWidth: 3,
  },
  topRight: {
    top: 0, right: 0,
    borderTopWidth: 3, borderRightWidth: 3,
  },
  bottomLeft: {
    bottom: 0, left: 0,
    borderBottomWidth: 3, borderLeftWidth: 3,
  },
  bottomRight: {
    bottom: 0, right: 0,
    borderBottomWidth: 3, borderRightWidth: 3,
  },
  guideText: {
    marginTop: spacing.md,
  },
  footer: {
    padding: spacing.lg,
    gap: spacing.md,
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  hint: {
    textAlign: 'center',
  },
});
