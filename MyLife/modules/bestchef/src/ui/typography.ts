/**
 * Plus Jakarta Sans font family constants for the MyRecipes module.
 * These map to the expo-google-fonts weight exports loaded by BOTH surfaces:
 * the hub in apps/mobile/app/(recipes)/_layout.tsx and the standalone app in
 * apps/bestchef/app/_layout.tsx. Screens referencing JAKARTA_FONTS names on a
 * surface that skips that registration silently fall back to the system font.
 * Other modules continue using Inter unless they have their own override.
 */
export const JAKARTA_FONTS = {
  regular: 'PlusJakartaSans_400Regular',
  medium: 'PlusJakartaSans_500Medium',
  semiBold: 'PlusJakartaSans_600SemiBold',
  bold: 'PlusJakartaSans_700Bold',
  extraBold: 'PlusJakartaSans_800ExtraBold',
} as const;

export type JakartaWeight = keyof typeof JAKARTA_FONTS;

/**
 * are-blaze 6-step rounded type ramp.
 *
 * Sizes, weights, and letter spacing mirror are-blaze BCTheme.swift
 * Font.system(..., design: .rounded) ramp. The fontFamily field is provided
 * via getRoundedFontFamily() at consumer sites so this module stays free of
 * react-native imports and can be re-exported from the @mylife/bestchef
 * package barrel without pulling RN into web bundles.
 *
 * On iOS, leave fontFamily undefined so consumers can opt into the system
 * SF Rounded face by setting fontVariant: ['rounded']. On Android and web,
 * fall back to Plus Jakarta Sans (loaded by the bestchef app at startup).
 *
 * Use the ramp like this from RN code:
 *   const { fontFamily } = getRoundedFontFamily();
 *   <Text style={[styles.title, { fontFamily }]} fontVariant={['rounded']} />
 */
export const RECIPES_TYPOGRAPHY_ROUNDED = {
  bcTitleXL: {
    fontSize: 34,
    fontWeight: '800',
    letterSpacing: -1.2,
  },
  bcTitle: {
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: -0.8,
  },
  bcHeadline: {
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: -0.4,
  },
  bcBody: {
    fontSize: 16,
    fontWeight: '400',
    letterSpacing: 0,
  },
  bcCaption: {
    fontSize: 13,
    fontWeight: '500',
    letterSpacing: 0.1,
  },
  bcTiny: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
} as const;

export type RecipesRoundedVariant = keyof typeof RECIPES_TYPOGRAPHY_ROUNDED;
