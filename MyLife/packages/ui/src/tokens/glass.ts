import type { ViewStyle } from 'react-native';

/**
 * Raw glass morphism token values.
 * Import these when composing custom glass styles in redesigned screens.
 */
export const glassFills = {
  subtle: 'rgba(255,255,255,0.03)',
  standard: 'rgba(255,255,255,0.08)',
  prominent: 'rgba(255,255,255,0.12)',
  dock: 'rgba(18,18,26,0.65)',
} as const;

export const glassBorders = {
  subtle: 'rgba(255,255,255,0.06)',
  standard: 'rgba(255,255,255,0.10)',
  prominent: 'rgba(255,255,255,0.14)',
} as const;

export const glassBlurs = {
  light: 'blur(40px) saturate(180%)',
  medium: 'blur(60px) saturate(200%)',
  heavy: 'blur(80px) saturate(200%)',
} as const;

/** Glass morphism presets for the Cool Obsidian theme. */

export const glass = {
  /** Standard glass card -- subtle translucent background */
  card: {
    backgroundColor: glassFills.subtle,
    borderWidth: 1,
    borderColor: glassBorders.subtle,
    borderRadius: 16,
  } satisfies ViewStyle,

  /** Stronger glass -- slightly more opaque for elevated surfaces */
  strong: {
    backgroundColor: glassFills.standard,
    borderWidth: 1,
    borderColor: glassBorders.standard,
    borderRadius: 16,
  } satisfies ViewStyle,

  /** Dock glass -- heavy blur background for bottom dock */
  dock: {
    backgroundColor: glassFills.dock,
    borderWidth: 1,
    borderColor: glassFills.standard,
    borderRadius: 24,
  } satisfies ViewStyle,
} as const;

/**
 * CSS `backdrop-filter` values for web glass morphism.
 * React Native uses expo-blur's BlurView instead.
 */
export const glassWeb = {
  card: glassBlurs.light,
  strong: glassBlurs.medium,
  dock: glassBlurs.heavy,
} as const;
