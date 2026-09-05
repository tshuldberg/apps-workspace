export const FR_FONT_REGULAR = 'PlusJakartaSans_400Regular';
export const FR_FONT_MEDIUM = 'PlusJakartaSans_500Medium';
export const FR_FONT_SEMIBOLD = 'PlusJakartaSans_600SemiBold';
export const FR_FONT_BOLD = 'PlusJakartaSans_700Bold';
export const FR_FONT_EXTRABOLD = 'PlusJakartaSans_800ExtraBold';

export const FR_FONTS = {
  regular: FR_FONT_REGULAR,
  medium: FR_FONT_MEDIUM,
  semiBold: FR_FONT_SEMIBOLD,
  bold: FR_FONT_BOLD,
  extraBold: FR_FONT_EXTRABOLD,
} as const;

export type ForumsFontWeight = keyof typeof FR_FONTS;
