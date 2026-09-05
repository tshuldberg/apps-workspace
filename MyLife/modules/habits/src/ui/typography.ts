export const HB_FONTS = {
  regular: 'PlusJakartaSans_400Regular',
  medium: 'PlusJakartaSans_500Medium',
  semiBold: 'PlusJakartaSans_600SemiBold',
  bold: 'PlusJakartaSans_700Bold',
  extraBold: 'PlusJakartaSans_800ExtraBold',
} as const;

export type HabitsFontWeight = keyof typeof HB_FONTS;

export const HB_FONT_REGULAR = HB_FONTS.regular;
export const HB_FONT_MEDIUM = HB_FONTS.medium;
export const HB_FONT_SEMIBOLD = HB_FONTS.semiBold;
export const HB_FONT_BOLD = HB_FONTS.bold;
export const HB_FONT_EXTRABOLD = HB_FONTS.extraBold;
