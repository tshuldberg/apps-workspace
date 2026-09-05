/**
 * Plus Jakarta Sans font family constants for the MyHealth module.
 * These map to the expo-google-fonts weight exports loaded in (health)/_layout.tsx.
 * Other modules continue using Inter.
 */
export const JAKARTA_FONTS = {
  regular: 'PlusJakartaSans_400Regular',
  medium: 'PlusJakartaSans_500Medium',
  semiBold: 'PlusJakartaSans_600SemiBold',
  bold: 'PlusJakartaSans_700Bold',
  extraBold: 'PlusJakartaSans_800ExtraBold',
} as const;

export type JakartaWeight = keyof typeof JAKARTA_FONTS;
