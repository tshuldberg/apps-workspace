import { JAKARTA_FONTS } from './typography';

/**
 * MyHealth typography overrides using Plus Jakarta Sans.
 * fontSize values are provided as defaults; consumers should
 * compute letterSpacing and lineHeight relative to their actual fontSize.
 */
export const HEALTH_TYPOGRAPHY = {
  displayLg: {
    fontFamily: JAKARTA_FONTS.extraBold,
    fontSize: 32,
    lineHeight: 40,
    letterSpacing: -0.02 * 32,
  },
  headlineMd: {
    fontFamily: JAKARTA_FONTS.bold,
    fontSize: 20,
    lineHeight: 26,
  },
  bodyMd: {
    fontFamily: JAKARTA_FONTS.regular,
    fontSize: 16,
    lineHeight: 1.6 * 16,
  },
  labelUpper: {
    fontFamily: JAKARTA_FONTS.semiBold,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 0.1 * 12,
    textTransform: 'uppercase' as const,
  },
} as const;

/** MyHealth primary accent (warm red) */
export const HEALTH_ACCENT = '#EF4444';

/** MyHealth lighter accent for secondary highlights */
export const HEALTH_ACCENT_LIGHT = '#F87171';

/** MyHealth secondary (emerald for exercise ring) */
export const HEALTH_SECONDARY = '#34D399';

/** MyHealth tertiary (blue for stand ring, sleep) */
export const HEALTH_TERTIARY = '#60A5FA';

/**
 * 5-tier surface system for MyHealth Obsidian Noir.
 * Use surface color shifts instead of 1px borders (see HEALTH_NO_BORDER).
 */
export const HEALTH_SURFACES = {
  depth: '#0E0E13',
  base: '#131318',
  lift: '#1B1B20',
  focus: '#2A292F',
  highest: '#35343A',
} as const;

/**
 * Glass morphism preset for floating navigation in MyHealth.
 * Mobile: use expo-blur BlurView with these fill values.
 * Web: apply backdropFilter directly.
 */
export const HEALTH_GLASS = {
  backgroundColor: 'rgba(19, 19, 24, 0.7)',
} as const;

/**
 * Strict mandate: MyHealth screens must use surface color shifts
 * instead of 1px solid borders for visual boundaries.
 */
export const HEALTH_NO_BORDER = true;

/**
 * Primary CTA gradient for MyHealth action buttons.
 * Uses the hub warm gold for navigation chrome and CTAs.
 */
export const HEALTH_CTA_GRADIENT = {
  from: '#FFB877',
  to: '#C9894D',
  angle: 135,
} as const;

/**
 * Activity ring colors for the health dashboard.
 * Move = health red, Exercise = emerald, Stand = blue.
 */
export const HEALTH_RING_COLORS = {
  move: '#EF4444',
  exercise: '#34D399',
  stand: '#60A5FA',
} as const;
