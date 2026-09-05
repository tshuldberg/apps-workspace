import { JAKARTA_FONTS } from './typography';

/**
 * MyGarden typography overrides using Plus Jakarta Sans.
 * fontSize values are provided as defaults; consumers should
 * compute letterSpacing and lineHeight relative to their actual fontSize.
 */
export const GARDEN_TYPOGRAPHY = {
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

/** MyGarden primary accent (lime green) */
export const GARDEN_ACCENT = '#84CC16';

/** MyGarden lighter accent for highlights and hover states */
export const GARDEN_ACCENT_LIGHT = '#A3E635';

/** MyGarden dimmer accent for disabled states and subtle elements */
export const GARDEN_ACCENT_DIM = '#65A30D';

/** Obsidian Noir warm gold (used for optional library-style chrome on hero sections) */
export const GARDEN_GOLD = '#FFB877';

/** Obsidian Noir deep gold (used for library CTA gradient end) */
export const GARDEN_GOLD_DEEP = '#C9894D';

/** MyGarden tertiary (water blue for hydration accents) */
export const GARDEN_TERTIARY = '#8BCFF0';

/** MyGarden danger (destructive actions, critical health states) */
export const GARDEN_DANGER = '#FFB4AB';

/**
 * 5-tier surface system for MyGarden Obsidian Noir.
 * Use surface color shifts instead of 1px borders (see GARDEN_NO_BORDER).
 */
export const GARDEN_SURFACES = {
  depth: '#0E0E13',
  base: '#131318',
  lift: '#1B1B20',
  focus: '#2A292F',
  highest: '#35343A',
} as const;

export type GardenSurface = keyof typeof GARDEN_SURFACES;

/**
 * Glass morphism preset for floating navigation in MyGarden.
 * Mobile: use expo-blur BlurView with these fill values.
 * Web: apply backdropFilter directly.
 */
export const GARDEN_GLASS = {
  backgroundColor: 'rgba(19, 19, 24, 0.7)',
  backdropFilter: 'blur(20px)',
} as const;

/**
 * Strict mandate: MyGarden screens must use surface color shifts
 * instead of 1px solid borders for visual boundaries.
 */
export const GARDEN_NO_BORDER = true;

/**
 * Primary CTA gradient for MyGarden action buttons (lime green).
 */
export const GARDEN_CTA_GRADIENT = {
  from: '#A3E635',
  to: '#84CC16',
  angle: 135,
} as const;

/**
 * Library CTA gradient (Obsidian library gold) for optional hero chrome.
 */
export const GARDEN_LIBRARY_GRADIENT = {
  from: '#FFB877',
  to: '#C9894D',
  angle: 135,
} as const;

/**
 * Plant health status colors.
 * healthy = lime, needsWater = error-soft red, harvestReady = gold, dormant = muted outline.
 */
export const GARDEN_HEALTH_COLORS = {
  healthy: '#84CC16',
  needsWater: '#FFB4AB',
  harvestReady: '#FFB877',
  dormant: '#9F8E81',
} as const;

export type GardenHealthStatus = keyof typeof GARDEN_HEALTH_COLORS;
