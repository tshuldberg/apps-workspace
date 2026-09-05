import type { TextStyle } from 'react-native';
import { HB_FONTS } from './typography';

export const HB_ACCENT = '#8B5CF6';
export const HB_ACCENT_LIGHT = '#A78BFA';
export const HB_ACCENT_GLOW = 'rgba(139, 92, 246, 0.4)';
export const HB_XP = '#FFD60A';

export const HB_TEXT = '#E4E1E9';
export const HB_TEXT_SECONDARY = 'rgba(228, 225, 233, 0.72)';
export const HB_TEXT_TERTIARY = '#9F8E81';
export const HB_WHITE = '#FFFFFF';

export const HB_STREAK = {
  fire: '#FFB877',
  legendary: '#A78BFA',
  frozen: '#8BCFF0',
} as const;

export const HB_AREAS = {
  health: '#30D158',
  mind: '#A78BFA',
  body: '#FFB4AB',
  money: '#84CC16',
  social: '#FFB877',
  spiritual: '#C4B5FD',
  learning: '#8BCFF0',
  other: '#9F8E81',
} as const;

export const HB_HABIT_TYPES = {
  binary: '#A78BFA',
  timed: '#8BCFF0',
  measurement: '#84CC16',
  sobriety: '#FFB4AB',
} as const;

export const HB_COMPLETION_STATUS = {
  pending: '#9F8E81',
  completed: '#30D158',
  skipped: '#FFB877',
  failed: '#FFB4AB',
} as const;

export const HB_SURFACES = {
  lowest: '#0E0E13',
  base: '#131318',
  low: '#1B1B20',
  mid: '#1F1F25',
  high: '#2A292F',
  highest: '#35343A',
} as const;

export const HB_GLASS = {
  backgroundColor: 'rgba(255, 255, 255, 0.04)',
  blur: 20,
  backdropFilter: 'blur(20px)',
} as const;

export const HB_GLASS_NAV = {
  backgroundColor: 'rgba(19, 19, 24, 0.7)',
  blur: 32,
  backdropFilter: 'blur(32px)',
} as const;

export const HB_CTA_GRADIENT = {
  from: HB_ACCENT_LIGHT,
  to: HB_ACCENT,
} as const;

export const HB_TYPOGRAPHY = {
  displayLg: {
    fontFamily: HB_FONTS.extraBold,
    fontSize: 36,
    lineHeight: 42,
    letterSpacing: -0.72,
  },
  headlineMd: {
    fontFamily: HB_FONTS.bold,
    fontSize: 20,
    lineHeight: 26,
    letterSpacing: -0.24,
  },
  bodyMd: {
    fontFamily: HB_FONTS.regular,
    fontSize: 14,
    lineHeight: 22,
  },
  labelUpper: {
    fontFamily: HB_FONTS.semiBold,
    fontSize: 10,
    lineHeight: 12,
    letterSpacing: 1.2,
    textTransform: 'uppercase' as const,
  },
  streakDisplay: {
    fontFamily: HB_FONTS.extraBold,
    fontSize: 40,
    lineHeight: 44,
    letterSpacing: -1.2,
    fontVariant: ['tabular-nums'] as TextStyle['fontVariant'],
  },
} as const;

export const HB_VIOLET_GLOW_STYLE = {
  shadowColor: HB_ACCENT,
  shadowOpacity: 0.36,
  shadowRadius: 18,
  shadowOffset: { width: 0, height: 8 },
  elevation: 14,
} as const;

export type HabitsTypographyKey = keyof typeof HB_TYPOGRAPHY;

export function withAlpha(hex: string, alpha: number): string {
  const normalized = hex.replace('#', '');
  const expanded = normalized.length === 3
    ? normalized.split('').map((char) => char + char).join('')
    : normalized;

  if (expanded.length !== 6) {
    return hex;
  }

  const r = Number.parseInt(expanded.slice(0, 2), 16);
  const g = Number.parseInt(expanded.slice(2, 4), 16);
  const b = Number.parseInt(expanded.slice(4, 6), 16);

  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
