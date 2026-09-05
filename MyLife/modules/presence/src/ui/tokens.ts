import type { TextStyle, ViewStyle } from 'react-native';
import {
  PR_FONT_BOLD,
  PR_FONT_EXTRABOLD,
  PR_FONT_MEDIUM,
  PR_FONT_REGULAR,
  PR_FONT_SEMIBOLD,
} from './typography';

export const PR_ACCENT = '#0891B2';
export const PR_ACCENT_LIGHT = '#22D3EE';
export const PR_ACCENT_GLOW = 'rgba(8, 145, 178, 0.4)';

export const PR_SESSION_TYPES = {
  solo: '#22D3EE',
  group: '#A855F7',
  beast: '#EF4444',
} as const;

export const PR_GOAL_STATUS = {
  met: '#30D158',
  approaching: '#FFB877',
  exceeded: '#FFB4AB',
} as const;

export const PR_CATEGORY_COLORS = {
  social: '#C084FC',
  entertainment: '#F59E0B',
  productivity: '#34D399',
  communication: '#60A5FA',
  utilities: '#38BDF8',
  media: '#EF4444',
  audio: '#22C55E',
  work: '#6366F1',
  gaming: '#A855F7',
  news: '#94A3B8',
  shopping: '#FB923C',
  health: '#10B981',
  education: '#818CF8',
  other: '#6B7280',
} as const;

export const PR_CATEGORY_GRADIENTS = {
  social: ['#A855F7', '#EC4899'],
  entertainment: ['#F97316', '#F59E0B'],
  productivity: ['#14B8A6', '#22C55E'],
  communication: ['#6366F1', '#3B82F6'],
  utilities: ['#0EA5E9', '#38BDF8'],
  media: ['#DC2626', '#F97316'],
  audio: ['#16A34A', '#22C55E'],
  work: ['#4F46E5', '#2563EB'],
  gaming: ['#7C3AED', '#EC4899'],
  news: ['#475569', '#94A3B8'],
  shopping: ['#EA580C', '#FB923C'],
  health: ['#059669', '#34D399'],
  education: ['#4F46E5', '#818CF8'],
  other: ['#4B5563', '#9CA3AF'],
} as const;

export const PR_SURFACES = {
  lowest: '#0E0E13',
  base: '#131318',
  low: '#1B1B20',
  mid: '#1F1F25',
  high: '#2A292F',
  highest: '#35343A',
} as const;

export const PR_TEXT = '#E4E1E9';
export const PR_TEXT_SECONDARY = '#D6C3B5';
export const PR_TEXT_TERTIARY = '#9F8E81';
export const PR_TEXT_MUTED = 'rgba(228, 225, 233, 0.4)';
export const PR_SUCCESS = PR_GOAL_STATUS.met;
export const PR_DANGER = PR_GOAL_STATUS.exceeded;

export const PR_GLASS = {
  backgroundColor: 'rgba(255, 255, 255, 0.04)',
  blur: 24,
} as const;

export const PR_GLASS_NAV = {
  backgroundColor: 'rgba(19, 19, 24, 0.7)',
  blur: 48,
} as const;

export const PR_CTA_GRADIENT = {
  from: PR_ACCENT_LIGHT,
  to: PR_ACCENT,
} as const;

export const PR_TYPOGRAPHY = {
  displayLg: {
    fontFamily: PR_FONT_EXTRABOLD,
    fontSize: 48,
    letterSpacing: -0.02 * 48,
    lineHeight: 1.05 * 48,
  },
  headlineMd: {
    fontFamily: PR_FONT_BOLD,
    fontSize: 20,
    lineHeight: 1.25 * 20,
  },
  titleMd: {
    fontFamily: PR_FONT_SEMIBOLD,
    fontSize: 16,
    lineHeight: 1.35 * 16,
  },
  bodyMd: {
    fontFamily: PR_FONT_REGULAR,
    fontSize: 14,
    lineHeight: 1.6 * 14,
  },
  bodySm: {
    fontFamily: PR_FONT_REGULAR,
    fontSize: 12,
    lineHeight: 1.6 * 12,
  },
  labelUpper: {
    fontFamily: PR_FONT_SEMIBOLD,
    fontSize: 11,
    lineHeight: 16,
    letterSpacing: 0.15 * 11,
    textTransform: 'uppercase' as const,
  },
  labelTight: {
    fontFamily: PR_FONT_MEDIUM,
    fontSize: 10,
    lineHeight: 16,
    letterSpacing: 0.1 * 10,
    textTransform: 'uppercase' as const,
  },
} as const satisfies Record<string, TextStyle>;

export const PR_CYAN_GLOW_STYLE = {
  shadowColor: PR_ACCENT,
  shadowOpacity: 0.4,
  shadowRadius: 8,
  shadowOffset: { width: 0, height: 0 },
  elevation: 8,
} as const satisfies ViewStyle;

export const PR_CARD_RADIUS = 16;
export const PR_PILL_RADIUS = 999;
export const PR_NO_BORDER = true;

export type PresenceSessionTypeKey = keyof typeof PR_SESSION_TYPES;
export type PresenceGoalStatusKey = keyof typeof PR_GOAL_STATUS;
export type PresenceSurfaceKey = keyof typeof PR_SURFACES;
export type PresenceTypographyKey = keyof typeof PR_TYPOGRAPHY;
