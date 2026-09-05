/**
 * Plus Jakarta Sans font family constants for the MyWorkouts module.
 * These are loaded in apps/mobile/app/(workouts)/_layout.tsx only.
 */
export const WK_FONTS = {
  regular: 'PlusJakartaSans_400Regular',
  medium: 'PlusJakartaSans_500Medium',
  semiBold: 'PlusJakartaSans_600SemiBold',
  bold: 'PlusJakartaSans_700Bold',
  extraBold: 'PlusJakartaSans_800ExtraBold',
} as const;

export type WorkoutFontWeight = keyof typeof WK_FONTS;

export const WK_FONT_REGULAR = WK_FONTS.regular;
export const WK_FONT_MEDIUM = WK_FONTS.medium;
export const WK_FONT_SEMIBOLD = WK_FONTS.semiBold;
export const WK_FONT_BOLD = WK_FONTS.bold;
export const WK_FONT_EXTRABOLD = WK_FONTS.extraBold;
