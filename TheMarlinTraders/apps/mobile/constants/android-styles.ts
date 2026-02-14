import { Platform, StatusBar, StyleSheet } from 'react-native'
import type { ViewStyle, TextStyle } from 'react-native'
import { colors, spacing } from './theme'

/**
 * Android-specific style overrides and Material Design adaptations.
 * Import and apply these conditionally with Platform.OS === 'android'.
 */

/**
 * Android elevation shadow presets.
 * On Android, box shadows are not supported -- use `elevation` instead.
 */
export const elevations = {
  none: 0,
  xs: 1,
  sm: 2,
  md: 4,
  lg: 8,
  xl: 12,
  xxl: 24,
} as const

/**
 * Converts iOS shadow styles to Android elevation.
 * Pass this through getPlatformShadow() from utils/platform for convenience,
 * or use these presets directly.
 */
export const androidShadows = StyleSheet.create({
  card: {
    elevation: elevations.md,
  },
  fab: {
    elevation: elevations.lg,
  },
  modal: {
    elevation: elevations.xxl,
  },
  bottomSheet: {
    elevation: elevations.xl,
  },
  appBar: {
    elevation: elevations.md,
  },
})

/**
 * StatusBar configuration for Android.
 * Sets translucent status bar with the navy-black background.
 */
export const androidStatusBar = {
  translucent: true,
  backgroundColor: 'transparent',
  barStyle: 'light-content' as const,
}

/**
 * Android ripple effect configuration for touchable elements.
 * Use with Pressable's `android_ripple` prop.
 */
export const rippleConfig = {
  default: {
    color: 'rgba(255, 255, 255, 0.08)',
    borderless: false,
    foreground: true,
  },
  accent: {
    color: 'rgba(59, 130, 246, 0.15)',
    borderless: false,
    foreground: true,
  },
  success: {
    color: 'rgba(34, 197, 94, 0.15)',
    borderless: false,
    foreground: true,
  },
  danger: {
    color: 'rgba(239, 68, 68, 0.15)',
    borderless: false,
    foreground: true,
  },
  circular: {
    color: 'rgba(255, 255, 255, 0.12)',
    borderless: true,
    foreground: true,
  },
} as const

/**
 * Font family overrides for Android.
 * Android uses Roboto by default; these provide weight-specific variants.
 */
export const androidFonts: Record<string, TextStyle> = {
  regular: {
    fontFamily: 'Roboto',
    fontWeight: '400',
  },
  medium: {
    fontFamily: 'Roboto',
    fontWeight: '500',
  },
  bold: {
    fontFamily: 'Roboto',
    fontWeight: '700',
  },
  mono: {
    fontFamily: 'monospace',
  },
}

/**
 * Android-specific style overrides for common components.
 * Apply these when Platform.OS === 'android' to adjust iOS-first designs.
 */
export const androidOverrides = StyleSheet.create({
  /** Tab bar: smaller height since Android lacks home indicator */
  tabBar: {
    height: 60,
    paddingBottom: 8,
    paddingTop: 8,
    elevation: elevations.lg,
    borderTopWidth: 0,
  },

  /** Header: add status bar padding on Android when translucent */
  header: {
    paddingTop: StatusBar.currentHeight ?? 24,
    elevation: elevations.md,
  },

  /** Cards: use elevation instead of iOS shadow */
  card: {
    elevation: elevations.md,
    shadowColor: undefined,
    shadowOffset: undefined,
    shadowOpacity: undefined,
    shadowRadius: undefined,
    borderWidth: 0,
  },

  /** FAB: Material Design elevation */
  fab: {
    elevation: elevations.lg,
    shadowColor: undefined,
    shadowOffset: undefined,
    shadowOpacity: undefined,
    shadowRadius: undefined,
  },

  /** Text input: different underline style on Android */
  textInput: {
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },

  /** Bottom sheet: higher elevation for Material feel */
  bottomSheet: {
    elevation: elevations.xl,
  },

  /** Search bar: slightly different border radius for Material */
  searchBar: {
    borderRadius: 28,
  },
})

/**
 * Merges base styles with Android overrides when running on Android.
 * Usage: `StyleSheet.flatten([baseStyle, androidOnly(androidOverrides.card)])`
 */
export function androidOnly(style: ViewStyle | TextStyle): ViewStyle | TextStyle | undefined {
  if (Platform.OS === 'android') {
    return style
  }
  return undefined
}
