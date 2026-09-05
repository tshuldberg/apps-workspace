/**
 * Plus Jakarta Sans font family constants for the MyMeds module.
 * These are loaded in apps/mobile/app/(meds)/_layout.tsx only.
 */
export const MD_FONTS = {
  regular: 'PlusJakartaSans_400Regular',
  medium: 'PlusJakartaSans_500Medium',
  semiBold: 'PlusJakartaSans_600SemiBold',
  bold: 'PlusJakartaSans_700Bold',
  extraBold: 'PlusJakartaSans_800ExtraBold',
} as const;

export type MedsFontWeight = keyof typeof MD_FONTS;

export const MD_FONT_REGULAR = MD_FONTS.regular;
export const MD_FONT_MEDIUM = MD_FONTS.medium;
export const MD_FONT_SEMIBOLD = MD_FONTS.semiBold;
export const MD_FONT_BOLD = MD_FONTS.bold;
export const MD_FONT_EXTRABOLD = MD_FONTS.extraBold;
