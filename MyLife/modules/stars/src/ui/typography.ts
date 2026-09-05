/**
 * Plus Jakarta Sans font family constants for the MyStars module.
 * The mobile layout loads these exact font IDs through expo-font.
 */
export const ST_FONTS = {
  regular: 'PlusJakartaSans_400Regular',
  medium: 'PlusJakartaSans_500Medium',
  semiBold: 'PlusJakartaSans_600SemiBold',
  bold: 'PlusJakartaSans_700Bold',
  extraBold: 'PlusJakartaSans_800ExtraBold',
} as const;

export type StarsFontWeight = keyof typeof ST_FONTS;

export const ST_FONT_REGULAR = ST_FONTS.regular;
export const ST_FONT_MEDIUM = ST_FONTS.medium;
export const ST_FONT_SEMIBOLD = ST_FONTS.semiBold;
export const ST_FONT_BOLD = ST_FONTS.bold;
export const ST_FONT_EXTRABOLD = ST_FONTS.extraBold;
