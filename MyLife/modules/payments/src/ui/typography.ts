export const PAY_FONTS = {
  regular: 'PlusJakartaSans_400Regular',
  medium: 'PlusJakartaSans_500Medium',
  semiBold: 'PlusJakartaSans_600SemiBold',
  bold: 'PlusJakartaSans_700Bold',
  extraBold: 'PlusJakartaSans_800ExtraBold',
} as const;

export type PaymentFontWeight = keyof typeof PAY_FONTS;

export const PAY_FONT_REGULAR = PAY_FONTS.regular;
export const PAY_FONT_MEDIUM = PAY_FONTS.medium;
export const PAY_FONT_SEMIBOLD = PAY_FONTS.semiBold;
export const PAY_FONT_BOLD = PAY_FONTS.bold;
export const PAY_FONT_EXTRABOLD = PAY_FONTS.extraBold;

export const PAY_WEB_FONT_STACK =
  "'Plus Jakarta Sans', 'Inter', -apple-system, BlinkMacSystemFont, system-ui, sans-serif";
export const PAY_WEB_MONO_STACK =
  "'SF Mono', 'Roboto Mono', 'IBM Plex Mono', ui-monospace, monospace";
export const PAY_WEB_TABULAR_FONT_FEATURES = '"tnum" 1, "ss01" 1';
export const PAY_NATIVE_TABULAR_NUMS: Array<'tabular-nums'> = ['tabular-nums'];

export const PAY_TYPOGRAPHY = {
  heroBalance: {
    fontFamily: PAY_FONT_EXTRABOLD,
    fontSize: 40,
    letterSpacing: -1.2,
  },
  sectionLabel: {
    fontFamily: PAY_FONT_SEMIBOLD,
    fontSize: 13,
    letterSpacing: 0.3,
  },
  amountInline: {
    fontFamily: PAY_FONT_BOLD,
    fontSize: 22,
    letterSpacing: -0.5,
  },
  microLabel: {
    fontFamily: PAY_FONT_MEDIUM,
    fontSize: 11,
    letterSpacing: 0.6,
  },
} as const;
