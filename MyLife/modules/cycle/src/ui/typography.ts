/**
 * Plus Jakarta Sans font family constants for the MyCycle module.
 * These map to the expo-google-fonts weight exports loaded in (cycle)/_layout.tsx.
 * Other modules continue using Inter unless they have their own override.
 */
export const CYCLE_FONTS = {
  regular: 'PlusJakartaSans_400Regular',
  medium: 'PlusJakartaSans_500Medium',
  semiBold: 'PlusJakartaSans_600SemiBold',
  bold: 'PlusJakartaSans_700Bold',
  extraBold: 'PlusJakartaSans_800ExtraBold',
} as const;

export type CycleFontWeight = keyof typeof CYCLE_FONTS;

/**
 * Re-export aliases for backward-compatibility with prompts that
 * reference CYCLE_FONT_* individual constants.
 */
export const CYCLE_FONT_REGULAR = CYCLE_FONTS.regular;
export const CYCLE_FONT_MEDIUM = CYCLE_FONTS.medium;
export const CYCLE_FONT_SEMIBOLD = CYCLE_FONTS.semiBold;
export const CYCLE_FONT_BOLD = CYCLE_FONTS.bold;
export const CYCLE_FONT_EXTRABOLD = CYCLE_FONTS.extraBold;
