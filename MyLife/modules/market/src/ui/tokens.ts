import type { TextStyle, ViewStyle } from 'react-native';
import {
  MK_FONT_BOLD,
  MK_FONT_EXTRABOLD,
  MK_FONT_MEDIUM,
  MK_FONT_REGULAR,
  MK_FONT_SEMIBOLD,
} from './typography';

export const MK_ACCENT = '#14B8A6';
export const MK_ACCENT_LIGHT = '#2DD4BF';
export const MK_ACCENT_DARK = '#002A23';

export const MK_TEXT = '#E4E1E9';
export const MK_TEXT_SECONDARY = '#D6C3B5';
export const MK_TEXT_TERTIARY = '#9F8E81';
export const MK_TEXT_MUTED = 'rgba(228, 225, 233, 0.4)';

export const MK_CONDITION = {
  new: '#30D158',
  likeNew: '#14B8A6',
  good: '#A78BFA',
  fair: '#FFD60A',
  poor: '#FF453A',
} as const;

export const MK_TIER = {
  unverified: '#9F8E81',
  basic: '#8BCFF0',
  verified: '#2DD4BF',
  trusted: '#14B8A6',
  topSeller: '#FFB877',
} as const;

export const MK_LISTING_TYPES = {
  sell: '#14B8A6',
  trade: '#A78BFA',
  free: '#30D158',
  wanted: '#FFB877',
  serviceOffer: '#2DD4BF',
  serviceRequest: '#8BCFF0',
} as const;

export const MK_OFFER_STATUS = {
  pending: '#FFB877',
  accepted: '#30D158',
  declined: '#FFB4AB',
  counter: '#2DD4BF',
  expired: '#9F8E81',
} as const;

export const MK_PAYMENT_STATUS = {
  escrowed: '#FFB877',
  released: '#30D158',
  refunded: '#9F8E81',
  failed: '#FFB4AB',
} as const;

export const MK_SURFACES = {
  lowest: '#0E0E13',
  base: '#131318',
  low: '#1B1B20',
  mid: '#1F1F25',
  high: '#2A292F',
  highest: '#35343A',
} as const;

export const MK_GLASS = {
  backgroundColor: 'rgba(255, 255, 255, 0.04)',
  blur: 24,
} as const;

export const MK_GLASS_NAV = {
  backgroundColor: 'rgba(19, 19, 24, 0.7)',
  blur: 32,
} as const;

export const MK_CTA_GRADIENT = {
  from: MK_ACCENT_LIGHT,
  to: MK_ACCENT,
  angle: 135,
} as const;

export const MK_TYPOGRAPHY = {
  displayLg: {
    fontFamily: MK_FONT_EXTRABOLD,
    fontSize: 40,
    letterSpacing: -0.02 * 40,
    lineHeight: 1.05 * 40,
  },
  headlineMd: {
    fontFamily: MK_FONT_BOLD,
    fontSize: 22,
    lineHeight: 1.2 * 22,
  },
  bodyMd: {
    fontFamily: MK_FONT_REGULAR,
    fontSize: 14,
    lineHeight: 1.6 * 14,
  },
  labelUpper: {
    fontFamily: MK_FONT_SEMIBOLD,
    fontSize: 10,
    letterSpacing: 0.15 * 10,
    lineHeight: 1.2 * 10,
    textTransform: 'uppercase' as const,
  },
  titleMd: {
    fontFamily: MK_FONT_SEMIBOLD,
    fontSize: 16,
    lineHeight: 1.25 * 16,
  },
  caption: {
    fontFamily: MK_FONT_MEDIUM,
    fontSize: 12,
    lineHeight: 1.45 * 12,
  },
} as const satisfies Record<string, TextStyle>;

export const MK_GLOW_STYLE = {
  shadowColor: MK_ACCENT,
  shadowOpacity: 0.28,
  shadowRadius: 12,
  shadowOffset: { width: 0, height: 6 },
  elevation: 10,
} as const satisfies ViewStyle;

export const MK_CARD_RADIUS = 16;
export const MK_PILL_RADIUS = 999;
export const MK_NO_BORDER = true;

export type MarketConditionTone = keyof typeof MK_CONDITION;
export type MarketTierTone = keyof typeof MK_TIER;
export type MarketListingTypeTone = keyof typeof MK_LISTING_TYPES;
export type MarketOfferStatusTone = keyof typeof MK_OFFER_STATUS;
export type MarketPaymentStatusTone = keyof typeof MK_PAYMENT_STATUS;
