export const NU_FONTS = {
  regular: 'PlusJakartaSans_400Regular',
  medium: 'PlusJakartaSans_500Medium',
  semiBold: 'PlusJakartaSans_600SemiBold',
  bold: 'PlusJakartaSans_700Bold',
  extraBold: 'PlusJakartaSans_800ExtraBold',
} as const;

export type NutritionFontWeight = keyof typeof NU_FONTS;

export const NU_FONT_REGULAR = NU_FONTS.regular;
export const NU_FONT_MEDIUM = NU_FONTS.medium;
export const NU_FONT_SEMIBOLD = NU_FONTS.semiBold;
export const NU_FONT_BOLD = NU_FONTS.bold;
export const NU_FONT_EXTRABOLD = NU_FONTS.extraBold;
