import { WK_FONTS } from './typography';

export const WK_CATEGORY_COLORS = {
  hypertrophy: '#EF4444',
  strength: '#FFB877',
  cardio: '#8BCFF0',
  recovery: '#30D158',
} as const;

export type WorkoutCategoryColorKey = keyof typeof WK_CATEGORY_COLORS;

export const WK_ACCENT = '#C9894D';
export const WK_ACCENT_LIGHT = '#FFB877';
export const WK_ACCENT_DARK = '#4B2700';
export const WK_ON_ACCENT = WK_ACCENT_DARK;

export const WK_SURFACES = {
  lowest: '#0E0E13',
  base: '#131318',
  low: '#1B1B20',
  mid: '#1F1F25',
  high: '#2A292F',
  highest: '#35343A',
} as const;

export const WK_GLASS = {
  backgroundColor: 'rgba(255, 255, 255, 0.04)',
  blur: 40,
  backdropFilter: 'blur(40px)',
} as const;

export const WK_GLASS_NAV = {
  backgroundColor: 'rgba(19, 19, 24, 0.7)',
  blur: 20,
  backdropFilter: 'blur(20px)',
} as const;

export const WK_NO_BORDER = true;

export const WK_CTA_GRADIENT = {
  from: WK_ACCENT_LIGHT,
  to: WK_ACCENT,
  angle: 135,
} as const;

export const WK_TYPOGRAPHY = {
  displayLg: {
    fontFamily: WK_FONTS.extraBold,
    fontSize: 60,
    letterSpacing: -0.02 * 60,
    lineHeight: 1.05 * 60,
  },
  headlineMd: {
    fontFamily: WK_FONTS.bold,
    fontSize: 20,
    letterSpacing: -0.01 * 20,
    lineHeight: 1.25 * 20,
  },
  titleMd: {
    fontFamily: WK_FONTS.semiBold,
    fontSize: 16,
    lineHeight: 1.35 * 16,
  },
  bodyMd: {
    fontFamily: WK_FONTS.regular,
    fontSize: 14,
    lineHeight: 1.6 * 14,
  },
  bodySm: {
    fontFamily: WK_FONTS.regular,
    fontSize: 12,
    lineHeight: 1.6 * 12,
  },
  labelUpper: {
    fontFamily: WK_FONTS.medium,
    fontSize: 10,
    letterSpacing: 0.2 * 10,
    lineHeight: 1.2 * 10,
    textTransform: 'uppercase' as const,
  },
} as const;

export type WorkoutTypographyKey = keyof typeof WK_TYPOGRAPHY;

/**
 * Maps workout categories and recovery-style screens onto the four visual accents
 * used by the MyWorkouts redesign.
 */
export function getWorkoutCategoryColor(
  category: string | null | undefined,
): string {
  switch (category?.toLowerCase()) {
    case 'strength':
      return WK_CATEGORY_COLORS.strength;
    case 'cardio':
      return WK_CATEGORY_COLORS.cardio;
    case 'recovery':
    case 'mobility':
    case 'fascia':
    case 'flexibility':
    case 'balance':
      return WK_CATEGORY_COLORS.recovery;
    default:
      return WK_CATEGORY_COLORS.hypertrophy;
  }
}
