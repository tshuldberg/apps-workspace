import { CYCLE_FONTS } from './typography';

/**
 * MyCycle phase-semantic color palette.
 * Four colors layered on top of the Obsidian Noir gold chrome for
 * data visualization across cycles, calendar cells, and history.
 */
export const CYCLE_PHASE_COLORS = {
  menstrual: '#EF4444',
  follicular: '#FBCFE8',
  ovulation: '#F472B6',
  luteal: '#FDA4AF',
} as const;

export type CyclePhaseKey = keyof typeof CYCLE_PHASE_COLORS;

/**
 * MyCycle primary accent (warm library gold).
 * Used for chrome, tab bar active state, primary CTAs, and the Log Today FAB gradient.
 */
export const CYCLE_ACCENT = '#C9894D';

/** MyCycle lighter accent for CTA gradients and highlights */
export const CYCLE_ACCENT_LIGHT = '#FFB877';

/** MyCycle on-primary text (for content on gold CTA fills) */
export const CYCLE_ON_ACCENT = '#4B2700';

/**
 * 5-tier surface system for MyCycle Obsidian Noir.
 * Use surface color shifts instead of 1px borders (see CYCLE_NO_BORDER).
 */
export const CYCLE_SURFACES = {
  lowest: '#0E0E13',
  base: '#131318',
  low: '#1B1B20',
  mid: '#1F1F25',
  high: '#2A292F',
  highest: '#35343A',
} as const;

/**
 * Glass morphism preset for floating navigation and sheets.
 * Mobile: use expo-blur BlurView with these fill values and intensity 80.
 * Web: apply backdropFilter directly.
 */
export const CYCLE_GLASS = {
  backgroundColor: 'rgba(19, 19, 24, 0.7)',
  blur: 20,
  backdropFilter: 'blur(20px)',
} as const;

/**
 * Strict mandate: MyCycle screens must use surface color shifts
 * instead of 1px solid borders for visual boundaries.
 */
export const CYCLE_NO_BORDER = true;

/**
 * Primary CTA gradient for the Log Today FAB and primary buttons.
 */
export const CYCLE_CTA_GRADIENT = {
  from: CYCLE_ACCENT_LIGHT,
  to: CYCLE_ACCENT,
  angle: 135,
} as const;

/**
 * MyCycle typography presets.
 * fontSize values are numeric defaults; letterSpacing and lineHeight
 * are expressed in pixels relative to the chosen fontSize.
 */
export const CYCLE_TYPOGRAPHY = {
  displayLg: {
    fontFamily: CYCLE_FONTS.extraBold,
    fontSize: 60,
    letterSpacing: -0.02 * 60,
    lineHeight: 1.1 * 60,
  },
  displayMd: {
    fontFamily: CYCLE_FONTS.extraBold,
    fontSize: 32,
    letterSpacing: -0.02 * 32,
    lineHeight: 1.15 * 32,
  },
  headlineLg: {
    fontFamily: CYCLE_FONTS.bold,
    fontSize: 24,
    letterSpacing: -0.01 * 24,
    lineHeight: 1.25 * 24,
  },
  headlineMd: {
    fontFamily: CYCLE_FONTS.bold,
    fontSize: 20,
    lineHeight: 1.3 * 20,
  },
  titleMd: {
    fontFamily: CYCLE_FONTS.semiBold,
    fontSize: 16,
    lineHeight: 1.4 * 16,
  },
  bodyMd: {
    fontFamily: CYCLE_FONTS.regular,
    fontSize: 14,
    lineHeight: 1.6 * 14,
  },
  bodySm: {
    fontFamily: CYCLE_FONTS.regular,
    fontSize: 12,
    lineHeight: 1.6 * 12,
  },
  labelUpper: {
    fontFamily: CYCLE_FONTS.semiBold,
    fontSize: 11,
    lineHeight: 16,
    letterSpacing: 0.1 * 11,
    textTransform: 'uppercase' as const,
  },
  labelTight: {
    fontFamily: CYCLE_FONTS.medium,
    fontSize: 10,
    lineHeight: 16,
    letterSpacing: 0.05 * 10,
    textTransform: 'uppercase' as const,
  },
} as const;

export type CycleTypographyKey = keyof typeof CYCLE_TYPOGRAPHY;

/**
 * Helper returning the phase color for a given cycle phase string.
 * Safe fallback to ovulation when the phase is missing or unknown.
 */
export function getPhaseColor(phase: string | null | undefined): string {
  if (!phase) return CYCLE_PHASE_COLORS.ovulation;
  const key = phase.toLowerCase() as CyclePhaseKey;
  return CYCLE_PHASE_COLORS[key] ?? CYCLE_PHASE_COLORS.ovulation;
}
