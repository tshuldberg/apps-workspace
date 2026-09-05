import type { TextStyle, ViewStyle } from 'react-native';
import {
  FR_FONT_BOLD,
  FR_FONT_EXTRABOLD,
  FR_FONT_MEDIUM,
  FR_FONT_REGULAR,
  FR_FONT_SEMIBOLD,
} from './typography';

export const FR_ACCENT = '#7C4DFF';
export const FR_ACCENT_LIGHT = '#A78BFA';
export const FR_ACCENT_GLOW = 'rgba(124, 77, 255, 0.4)';
export const FR_HUMAN_VERIFIED = FR_ACCENT_LIGHT;

export const FR_VOTE = {
  up: '#30D158',
  down: '#FFB4AB',
} as const;

export const FR_PINNED = '#FFB877';

export const FR_TRUST_TIERS = {
  unverified: '#9F8E81',
  new: '#8BCFF0',
  trusted: '#A78BFA',
  highly_trusted: '#7C4DFF',
  mod: '#FFB877',
} as const;

export type ForumTrustTier = keyof typeof FR_TRUST_TIERS;

export const FR_COMMUNITY_TYPES = {
  public: '#8BCFF0',
  humans_only: '#7C4DFF',
  private: '#9F8E81',
  federated: '#A78BFA',
} as const;

export type ForumCommunityTone = keyof typeof FR_COMMUNITY_TYPES;

export const FR_SURFACES = {
  lowest: '#0E0E13',
  base: '#131318',
  low: '#1B1B20',
  mid: '#1F1F25',
  high: '#2A292F',
  highest: '#35343A',
} as const;

export type ForumSurfaceKey = keyof typeof FR_SURFACES;

export const FR_TEXT = '#E4E1E9';
export const FR_TEXT_SECONDARY = '#D6C3B5';
export const FR_TEXT_TERTIARY = '#9F8E81';
export const FR_TEXT_MUTED = 'rgba(228, 225, 233, 0.4)';
export const FR_ON_ACCENT = '#FFFFFF';
export const FR_BORDER_HINT = 'rgba(255, 255, 255, 0.06)';
export const FR_SUCCESS = FR_VOTE.up;
export const FR_DANGER = FR_VOTE.down;
export const FR_INFO = '#8BCFF0';

export const FR_GLASS = {
  backgroundColor: 'rgba(255, 255, 255, 0.04)',
  blur: 24,
} as const;

export const FR_GLASS_NAV = {
  backgroundColor: 'rgba(19, 19, 24, 0.7)',
  blur: 32,
} as const;

export const FR_TYPOGRAPHY = {
  displayLg: {
    fontFamily: FR_FONT_EXTRABOLD,
    fontSize: 40,
    letterSpacing: -0.02 * 40,
    lineHeight: 1.05 * 40,
  },
  headlineMd: {
    fontFamily: FR_FONT_BOLD,
    fontSize: 20,
    lineHeight: 1.25 * 20,
  },
  titleMd: {
    fontFamily: FR_FONT_SEMIBOLD,
    fontSize: 16,
    lineHeight: 1.35 * 16,
  },
  bodyMd: {
    fontFamily: FR_FONT_REGULAR,
    fontSize: 14,
    lineHeight: 1.6 * 14,
  },
  bodySm: {
    fontFamily: FR_FONT_REGULAR,
    fontSize: 12,
    lineHeight: 1.6 * 12,
  },
  labelUpper: {
    fontFamily: FR_FONT_SEMIBOLD,
    fontSize: 11,
    lineHeight: 16,
    letterSpacing: 0.15 * 11,
    textTransform: 'uppercase' as const,
  },
  labelTight: {
    fontFamily: FR_FONT_MEDIUM,
    fontSize: 10,
    lineHeight: 16,
    letterSpacing: 0.1 * 10,
    textTransform: 'uppercase' as const,
  },
} as const satisfies Record<string, TextStyle>;

export const FR_PURPLE_GLOW_STYLE = {
  shadowColor: FR_ACCENT,
  shadowOpacity: 0.4,
  shadowRadius: 8,
  shadowOffset: { width: 0, height: 0 },
  elevation: 8,
} as const satisfies ViewStyle;

export const FR_CARD_RADIUS = 16;
export const FR_PILL_RADIUS = 999;
export const FR_NO_BORDER = true;
