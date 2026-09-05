import React from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text, colors, navigation } from '@mylife/ui';

export interface FabConfig {
  /** MaterialSymbol icon name or emoji */
  icon: string;
  /** Press handler */
  onPress: () => void;
  /** Accessibility label */
  label: string;
}

export interface ModuleTabBarProps {
  /** Per-module accent color for active tab tint */
  accentColor: string;
  /** Optional FAB configuration */
  fab?: FabConfig;
}

/**
 * Shared tab bar background component for the unified navigation system.
 * Used as `tabBarBackground` in Expo Router Tabs screenOptions.
 */
export function ModuleTabBarBackground() {
  return (
    <BlurView
      tint="dark"
      intensity={navigation.tabBarBlurIntensity}
      style={[
        StyleSheet.absoluteFill,
        styles.blurBackground,
      ]}
    />
  );
}

/**
 * Returns the unified tabBarStyle for Expo Router Tabs screenOptions.
 * Includes absolute positioning, height, padding, and border radius.
 */
export function getTabBarStyle() {
  return {
    position: 'absolute' as const,
    left: navigation.tabBarHorizontalInset,
    right: navigation.tabBarHorizontalInset,
    bottom: 0,
    height: navigation.tabBarHeight,
    paddingTop: navigation.tabBarTopPadding,
    paddingBottom: navigation.tabBarBottomPadding,
    backgroundColor: 'rgba(18, 18, 26, 0.75)',
    borderTopWidth: 0,
    borderTopColor: 'transparent',
    borderTopLeftRadius: navigation.tabBarBorderRadius,
    borderTopRightRadius: navigation.tabBarBorderRadius,
    overflow: 'hidden' as const,
    elevation: 0,
  };
}

/**
 * Returns the unified tabBarLabelStyle for Expo Router Tabs screenOptions.
 */
export function getTabBarLabelStyle() {
  return {
    fontSize: navigation.tabLabelFontSize,
    fontWeight: '500' as const,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.7,
    marginTop: 2,
  };
}

/**
 * Optional FAB overlay rendered above the tab bar.
 * Place this as a sibling to the Tabs component, not inside it.
 */
export function TabBarFAB({ fab }: { fab: FabConfig }) {
  const insets = useSafeAreaInsets();

  return (
    <View
      pointerEvents="box-none"
      style={[
        styles.fabOverlay,
        { bottom: navigation.tabBarHeight + insets.bottom - 20 },
      ]}
    >
      <TouchableOpacity
        style={styles.fabButton}
        onPress={fab.onPress}
        accessibilityLabel={fab.label}
        accessibilityRole="button"
      >
        <Text style={styles.fabIcon}>{fab.icon}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  blurBackground: {
    borderTopLeftRadius: navigation.tabBarBorderRadius,
    borderTopRightRadius: navigation.tabBarBorderRadius,
    overflow: 'hidden',
  },
  fabOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  fabButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.primary,
    shadowOpacity: 0.35,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  fabIcon: {
    fontSize: 24,
    color: colors.background,
  },
});
