import { JAKARTA_FONTS } from './typography';

/**
 * MyMood typography overrides using Plus Jakarta Sans.
 * fontSize values are provided as defaults; consumers should
 * compute letterSpacing and lineHeight relative to their actual fontSize.
 */
export const MOOD_TYPOGRAPHY = {
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

/** MyMood primary accent (warm orange) */
export const MOOD_ACCENT = '#FB923C';

/** MyMood lighter accent for secondary highlights */
export const MOOD_ACCENT_LIGHT = '#FDBA74';

/**
 * 5-tier surface system for MyMood Obsidian Noir.
 * Use surface color shifts instead of 1px borders (see MOOD_NO_BORDER).
 */
export const MOOD_SURFACES = {
  depth: '#0E0E13',
  base: '#131318',
  lift: '#1B1B20',
  focus: '#2A292F',
  highest: '#35343A',
} as const;

/**
 * Glass morphism preset for floating navigation in MyMood.
 * Mobile: use expo-blur BlurView with these fill values.
 * Web: apply backdropFilter directly.
 */
export const MOOD_GLASS = {
  backgroundColor: 'rgba(19, 19, 24, 0.7)',
  backdropFilter: 'blur(20px)',
} as const;

/**
 * Strict mandate: MyMood screens must use surface color shifts
 * instead of 1px solid borders for visual boundaries.
 */
export const MOOD_NO_BORDER = true;

/**
 * Primary CTA gradient for MyMood action buttons.
 * Transitions from light orange to the primary accent.
 */
export const MOOD_CTA_GRADIENT = {
  from: '#FDBA74',
  to: '#FB923C',
  angle: 135,
} as const;

/**
 * Mood score color scale (1-10).
 * Red (low) through orange, yellow, light green, to bright green (high).
 * Used for score indicators, year-in-pixels, and charts.
 */
export const MOOD_SCORE_COLORS = {
  1: '#EF4444',
  2: '#F87171',
  3: '#FB923C',
  4: '#FDBA74',
  5: '#FBBF24',
  6: '#FDE047',
  7: '#A3E635',
  8: '#84CC16',
  9: '#4ADE80',
  10: '#22C55E',
} as const;

export type MoodScore = keyof typeof MOOD_SCORE_COLORS;
