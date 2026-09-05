import React, { useCallback, useState } from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text, colors, navigation } from '@mylife/ui';
import { MODULE_METADATA } from '@mylife/module-registry';
import type { ModuleId } from '@mylife/module-registry';
import { HamburgerMenu } from './HamburgerMenu';

export interface ModuleHeaderProps {
  /** Module identifier used to resolve name and accent color */
  moduleId: ModuleId;
  /** Optional override for the displayed module name */
  title?: string;
  /** Optional right-side accessory rendered before the hamburger icon */
  rightAccessory?: React.ReactNode;
  /** Whether to show the hamburger menu icon (default: true) */
  showHamburger?: boolean;
}

/**
 * Shared top navigation bar for every module screen.
 *
 * Left: back chevron + "Apps" label (navigates to hub)
 * Center: module display name in accent color
 * Right: optional per-screen accessory followed by hamburger menu icon
 */
export function ModuleHeader({
  moduleId,
  title,
  rightAccessory,
  showHamburger = true,
}: ModuleHeaderProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [menuVisible, setMenuVisible] = useState(false);

  const meta = MODULE_METADATA[moduleId];
  const displayName = title ?? meta?.name ?? 'Module';
  const accentColor = colors.modules[moduleId] ?? colors.accent;

  const goBack = useCallback(() => {
    router.replace('/(hub)');
  }, [router]);

  return (
    <>
      <View
        style={[
          styles.container,
          {
            height: navigation.headerHeight + insets.top,
            paddingTop: insets.top,
            paddingHorizontal: navigation.headerPaddingHorizontal,
          },
        ]}
      >
        {/* Back button */}
        <TouchableOpacity
          style={styles.backButton}
          onPress={goBack}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityLabel="Back to Apps"
          accessibilityRole="button"
        >
          <Text color={colors.textSecondary} style={styles.backLabel}>
            {'‹ Apps'}
          </Text>
        </TouchableOpacity>

        {/* Module name */}
        <Text color={accentColor} style={styles.title} numberOfLines={1}>
          {displayName}
        </Text>

        {/* Right side: optional per-screen accessory + hamburger */}
        <View style={styles.rightSlot}>
          {rightAccessory}
          {showHamburger ? (
            <TouchableOpacity
              onPress={() => setMenuVisible(true)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityLabel="Open menu"
              accessibilityRole="button"
            >
              <Text color={colors.textSecondary} style={styles.hamburgerIcon}>
                {'☰'}
              </Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      <HamburgerMenu
        visible={menuVisible}
        onClose={() => setMenuVisible(false)}
        currentModuleId={moduleId}
      />
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'transparent',
  },
  backButton: {
    minWidth: 60,
  },
  backLabel: {
    fontSize: 16,
    fontWeight: '500',
  },
  title: {
    flex: 1,
    textAlign: 'center',
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  rightSlot: {
    minWidth: 60,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 10,
  },
  hamburgerIcon: {
    fontSize: 22,
  },
});
