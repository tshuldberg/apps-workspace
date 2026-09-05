export const MK_FONT_REGULAR = 'PlusJakartaSans_400Regular';
export const MK_FONT_MEDIUM = 'PlusJakartaSans_500Medium';
export const MK_FONT_SEMIBOLD = 'PlusJakartaSans_600SemiBold';
export const MK_FONT_BOLD = 'PlusJakartaSans_700Bold';
export const MK_FONT_EXTRABOLD = 'PlusJakartaSans_800ExtraBold';
export const MK_FONT_BLACK = 'PlusJakartaSans_900Black';

export const MK_FONTS = {
  regular: MK_FONT_REGULAR,
  medium: MK_FONT_MEDIUM,
  semiBold: MK_FONT_SEMIBOLD,
  bold: MK_FONT_BOLD,
  extraBold: MK_FONT_EXTRABOLD,
  black: MK_FONT_BLACK,
} as const;

export type MarketFontWeight = keyof typeof MK_FONTS;
