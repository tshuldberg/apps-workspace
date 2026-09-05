export const TR_FONT_REGULAR = 'PlusJakartaSans_400Regular';
export const TR_FONT_MEDIUM = 'PlusJakartaSans_500Medium';
export const TR_FONT_SEMIBOLD = 'PlusJakartaSans_600SemiBold';
export const TR_FONT_BOLD = 'PlusJakartaSans_700Bold';
export const TR_FONT_EXTRABOLD = 'PlusJakartaSans_800ExtraBold';

export const TR_FONTS = {
  regular: TR_FONT_REGULAR,
  medium: TR_FONT_MEDIUM,
  semiBold: TR_FONT_SEMIBOLD,
  bold: TR_FONT_BOLD,
  extraBold: TR_FONT_EXTRABOLD,
} as const;

export type TrailsFontWeight = keyof typeof TR_FONTS;
