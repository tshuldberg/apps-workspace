import { JAKARTA_FONTS } from './typography';

/**
 * MyBooks typography overrides using Plus Jakarta Sans.
 * Every variant pairs fontSize with an explicit lineHeight (~1.25x) so RN
 * never falls back to a smaller inherited lineHeight that clips ascenders
 * and descenders. Documented in Key Patterns Learned: "fontSize without
 * lineHeight clips text in RN. Always pair (e.g., 36/44)."
 */
export const BOOKS_TYPOGRAPHY = {
  displayLg: {
    fontFamily: JAKARTA_FONTS.bold,
    fontSize: 32,
    lineHeight: 40,
    letterSpacing: -0.02 * 32,
  },
  headlineMd: {
    fontFamily: JAKARTA_FONTS.semiBold,
    fontSize: 20,
    lineHeight: 26,
  },
  bodyMd: {
    fontFamily: JAKARTA_FONTS.regular,
    fontSize: 16,
    lineHeight: 1.6 * 16,
  },
  labelUpper: {
    fontFamily: JAKARTA_FONTS.medium,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 0.05 * 12,
    textTransform: 'uppercase' as const,
  },
} as const;

/**
 * 5-tier surface system for MyBooks Obsidian Noir.
 * Use surface color shifts instead of 1px borders (see BOOKS_NO_BORDER).
 */
export const BOOKS_SURFACES = {
  depth: '#0E0E13',
  base: '#131318',
  lift: '#1B1B20',
  focus: '#2A292F',
  highest: '#35343A',
} as const;

/**
 * Glass morphism preset for floating navigation in MyBooks.
 * Mobile: use expo-blur BlurView with these fill values.
 * Web: apply backdropFilter directly.
 */
export const BOOKS_GLASS = {
  backgroundColor: 'rgba(19, 19, 24, 0.7)',
  backdropFilter: 'blur(20px)',
} as const;

/**
 * Strict mandate: MyBooks screens must use surface color shifts
 * instead of 1px solid borders for visual boundaries.
 */
export const BOOKS_NO_BORDER = true;

/**
 * Primary CTA gradient for MyBooks action buttons.
 */
export const BOOKS_CTA_GRADIENT = {
  from: '#FFB877',
  to: '#C9894D',
  angle: 135,
} as const;

/**
 * Ghost border for book covers -- a subtle hint, not a boundary.
 * Apply as a 1px inner stroke.
 */
export const BOOKS_GHOST_BORDER = 'rgba(82, 68, 58, 0.15)';
