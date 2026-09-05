export const PR_FONT_REGULAR = 'PlusJakartaSans_400Regular';
export const PR_FONT_MEDIUM = 'PlusJakartaSans_500Medium';
export const PR_FONT_SEMIBOLD = 'PlusJakartaSans_600SemiBold';
export const PR_FONT_BOLD = 'PlusJakartaSans_700Bold';
export const PR_FONT_EXTRABOLD = 'PlusJakartaSans_800ExtraBold';

export const PR_FONTS = {
  regular: PR_FONT_REGULAR,
  medium: PR_FONT_MEDIUM,
  semiBold: PR_FONT_SEMIBOLD,
  bold: PR_FONT_BOLD,
  extraBold: PR_FONT_EXTRABOLD,
} as const;

export type PresenceFontWeight = keyof typeof PR_FONTS;
