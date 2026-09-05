import { BG_FONTS } from './typography';

export const BG_ACCENT = '#C9894D';
export const BG_ACCENT_LIGHT = '#FFB877';
export const BG_ACCENT_DARK = '#4A2600';

export const BG_MONEY = '#22C55E';
export const BG_MONEY_LIGHT = '#4ADE80';

export const BG_TEXT = '#E4E1E9';
export const BG_TEXT_SECONDARY = 'rgba(228, 225, 233, 0.72)';
export const BG_TEXT_TERTIARY = 'rgba(228, 225, 233, 0.4)';
export const BG_TEXT_MUTED = '#9F8E81';
export const BG_WHITE = '#FFFFFF';
export const BG_DANGER = '#FFB4AB';
export const BG_TRANSFER = '#8BCFF0';
export const BG_ON_ACCENT = BG_ACCENT_DARK;

export const BG_TX_TYPES = {
  income: BG_MONEY_LIGHT,
  expense: BG_DANGER,
  transfer: BG_TRANSFER,
} as const;

export type BudgetTransactionTone = keyof typeof BG_TX_TYPES;

export const BG_ENVELOPE_STATUS = {
  on_track: BG_MONEY,
  close: BG_ACCENT_LIGHT,
  over: BG_DANGER,
  empty: BG_TEXT_MUTED,
} as const;

export type BudgetEnvelopeStatusTone = keyof typeof BG_ENVELOPE_STATUS;

export const BG_ACCOUNT_TYPES = {
  cash: BG_ACCENT_LIGHT,
  checking: BG_MONEY,
  savings: BG_MONEY_LIGHT,
  credit: BG_ACCENT_LIGHT,
  investment: BG_TRANSFER,
  loan: '#A78BFA',
  mortgage: BG_DANGER,
  other: BG_TEXT_MUTED,
} as const;

export type BudgetAccountTone = keyof typeof BG_ACCOUNT_TYPES;

export const BG_GOAL_STATUS = {
  ahead: BG_MONEY_LIGHT,
  on_track: BG_MONEY,
  behind: BG_ACCENT_LIGHT,
  missed: BG_DANGER,
} as const;

export type BudgetGoalStatusTone = keyof typeof BG_GOAL_STATUS;

export const BG_SURFACES = {
  lowest: '#0E0E13',
  base: '#131318',
  low: '#1B1B20',
  mid: '#1F1F25',
  high: '#2A292F',
  highest: '#35343A',
} as const;

export const BG_GLASS = {
  backgroundColor: 'rgba(255, 255, 255, 0.04)',
  blur: 20,
  backdropFilter: 'blur(20px)',
} as const;

export const BG_GLASS_NAV = {
  backgroundColor: 'rgba(19, 19, 24, 0.7)',
  blur: 32,
  backdropFilter: 'blur(32px)',
} as const;

export const BG_CTA_GRADIENT = {
  from: BG_MONEY_LIGHT,
  to: BG_MONEY,
} as const;

export const BG_CARD_RADIUS = 16;
export const BG_PILL_RADIUS = 999;

export const BG_SHADOW = {
  color: BG_MONEY,
  opacity: 0.18,
  radius: 24,
  offset: { width: 0, height: 10 },
  elevation: 18,
} as const;

export const BG_TYPOGRAPHY = {
  displayLg: {
    fontFamily: BG_FONTS.extraBold,
    fontSize: 60,
    lineHeight: 66,
    letterSpacing: -1.2,
  },
  headlineMd: {
    fontFamily: BG_FONTS.bold,
    fontSize: 20,
    lineHeight: 26,
    letterSpacing: -0.2,
  },
  bodyMd: {
    fontFamily: BG_FONTS.regular,
    fontSize: 14,
    lineHeight: 22,
  },
  labelUpper: {
    fontFamily: BG_FONTS.semiBold,
    fontSize: 10,
    lineHeight: 12,
    letterSpacing: 1.2,
    textTransform: 'uppercase' as const,
  },
  amountDisplay: {
    fontFamily: BG_FONTS.extraBold,
    fontSize: 40,
    lineHeight: 44,
    letterSpacing: -1.2,
    fontVariant: ['tabular-nums'] as const,
  },
} as const;

export type BudgetTypographyKey = keyof typeof BG_TYPOGRAPHY;

export function getBudgetEnvelopeStatusColor(
  spent: number,
  allocated: number,
): string {
  if (allocated <= 0) {
    return BG_ENVELOPE_STATUS.empty;
  }
  const ratio = spent / allocated;
  if (ratio > 1) {
    return BG_ENVELOPE_STATUS.over;
  }
  if (ratio >= 0.8) {
    return BG_ENVELOPE_STATUS.close;
  }
  return BG_ENVELOPE_STATUS.on_track;
}

export function getBudgetGoalStatusColor(progress: number): string {
  if (progress >= 1) {
    return BG_GOAL_STATUS.ahead;
  }
  if (progress >= 0.75) {
    return BG_GOAL_STATUS.on_track;
  }
  if (progress >= 0.45) {
    return BG_GOAL_STATUS.behind;
  }
  return BG_GOAL_STATUS.missed;
}
