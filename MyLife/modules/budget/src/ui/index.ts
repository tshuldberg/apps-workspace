// Web-safe UI barrel for @mylife/budget.
//
// This file re-exports ONLY design tokens and typography (pure values, no
// React Native imports). The full RN component surface lives in
// `./index.native.ts` — Metro picks that variant automatically on
// iOS/Android, while web bundlers (Turbopack/webpack) ignore `.native.ts`
// and read this file, so the web app never walks `@expo/vector-icons`
// `.ttf` assets or any other RN-only code.
//
// When you add a new RN component, export it ONLY from `./index.native.ts`.
// When you add a new token or pure helper, export it from BOTH files (or
// only from here — `./index.native.ts` ends by re-exporting this file so
// mobile still sees everything).

export {
  BG_FONTS,
  BG_FONT_REGULAR,
  BG_FONT_MEDIUM,
  BG_FONT_SEMIBOLD,
  BG_FONT_BOLD,
  BG_FONT_EXTRABOLD,
} from './typography';
export type { BudgetFontWeight } from './typography';

export {
  BG_ACCENT,
  BG_ACCENT_LIGHT,
  BG_ACCENT_DARK,
  BG_MONEY,
  BG_MONEY_LIGHT,
  BG_TEXT,
  BG_TEXT_SECONDARY,
  BG_TEXT_TERTIARY,
  BG_TEXT_MUTED,
  BG_WHITE,
  BG_DANGER,
  BG_TRANSFER,
  BG_ON_ACCENT,
  BG_TX_TYPES,
  BG_ENVELOPE_STATUS,
  BG_ACCOUNT_TYPES,
  BG_GOAL_STATUS,
  BG_SURFACES,
  BG_GLASS,
  BG_GLASS_NAV,
  BG_CTA_GRADIENT,
  BG_CARD_RADIUS,
  BG_PILL_RADIUS,
  BG_SHADOW,
  BG_TYPOGRAPHY,
  getBudgetEnvelopeStatusColor,
  getBudgetGoalStatusColor,
} from './tokens';
export type {
  BudgetTransactionTone,
  BudgetEnvelopeStatusTone,
  BudgetAccountTone,
  BudgetGoalStatusTone,
  BudgetTypographyKey,
} from './tokens';
