/**
 * Plus Jakarta Sans font family constants for the MyBudget module.
 * These fonts are loaded in apps/mobile/app/(budget)/_layout.tsx only.
 */
export const BG_FONTS = {
  regular: 'PlusJakartaSans_400Regular',
  medium: 'PlusJakartaSans_500Medium',
  semiBold: 'PlusJakartaSans_600SemiBold',
  bold: 'PlusJakartaSans_700Bold',
  extraBold: 'PlusJakartaSans_800ExtraBold',
} as const;

export type BudgetFontWeight = keyof typeof BG_FONTS;

export const BG_FONT_REGULAR = BG_FONTS.regular;
export const BG_FONT_MEDIUM = BG_FONTS.medium;
export const BG_FONT_SEMIBOLD = BG_FONTS.semiBold;
export const BG_FONT_BOLD = BG_FONTS.bold;
export const BG_FONT_EXTRABOLD = BG_FONTS.extraBold;
