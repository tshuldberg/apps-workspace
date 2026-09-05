/**
 * Font family constants.
 * Plus Jakarta Sans is the primary display font for the Obsidian Noir redesign.
 * Inter remains the fallback and is used for body/utility text.
 */
export const fontFamilies = {
  display: 'Plus Jakarta Sans',
  body: 'Inter',
  serif: 'Literata',
  fallback: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
} as const;

/**
 * CSS font-family stacks for web usage.
 * Mobile uses expo-google-fonts or asset-loaded fonts instead.
 */
export const fontStacks = {
  display: `"${fontFamilies.display}", "${fontFamilies.body}", ${fontFamilies.fallback}`,
  body: `"${fontFamilies.body}", ${fontFamilies.fallback}`,
  serif: `"${fontFamilies.serif}", Georgia, serif`,
} as const;

// Every variant pairs fontSize with an explicit lineHeight (~1.2-1.4x).
// React Native clips ascenders and descenders when fontSize is overridden
// without an accompanying lineHeight, which surfaces as garbled doubled
// letterforms in the rendered glyph (especially for emoji at large sizes).
// Documented in Key Patterns Learned: "fontSize without lineHeight clips
// text in RN. Always pair (e.g., 36/44)."
export const typography = {
  heading: {
    fontFamily: fontFamilies.display,
    fontSize: 24,
    fontWeight: '700' as const,
    lineHeight: 32,
  },
  subheading: {
    fontFamily: fontFamilies.display,
    fontSize: 18,
    fontWeight: '600' as const,
    lineHeight: 24,
  },
  body: {
    fontFamily: fontFamilies.body,
    fontSize: 16,
    fontWeight: '400' as const,
    lineHeight: 26,
  },
  caption: {
    fontFamily: fontFamilies.body,
    fontSize: 13,
    fontWeight: '500' as const,
    lineHeight: 18,
  },
  label: {
    fontFamily: fontFamilies.body,
    fontSize: 12,
    fontWeight: '600' as const,
    lineHeight: 16,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.8,
  },
  stat: {
    fontFamily: fontFamilies.display,
    fontSize: 36,
    fontWeight: '700' as const,
    lineHeight: 44,
  },
  heroTitle: {
    fontFamily: fontFamilies.display,
    fontSize: 36,
    fontWeight: '800' as const,
    lineHeight: 44,
  },
  iconCaption: {
    fontFamily: fontFamilies.body,
    fontSize: 12,
    fontWeight: '600' as const,
    lineHeight: 16,
  },
} as const;

export type TypographyVariant = keyof typeof typography;
