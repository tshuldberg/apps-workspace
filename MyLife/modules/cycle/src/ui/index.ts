// Web-safe UI barrel for @mylife/cycle.
//
// Re-exports ONLY design tokens and typography (pure values, no RN imports).
// Full component surface lives in `./index.native.ts`; Metro picks that on
// iOS/Android while web bundlers ignore `.native.ts` and read this file.
// See modules/budget/src/ui/index.ts for the documented pattern.

// Typography
export {
  CYCLE_FONTS,
  CYCLE_FONT_REGULAR,
  CYCLE_FONT_MEDIUM,
  CYCLE_FONT_SEMIBOLD,
  CYCLE_FONT_BOLD,
  CYCLE_FONT_EXTRABOLD,
} from './typography';
export type { CycleFontWeight } from './typography';

// Tokens
export {
  CYCLE_PHASE_COLORS,
  CYCLE_ACCENT,
  CYCLE_ACCENT_LIGHT,
  CYCLE_ON_ACCENT,
  CYCLE_SURFACES,
  CYCLE_GLASS,
  CYCLE_NO_BORDER,
  CYCLE_CTA_GRADIENT,
  CYCLE_TYPOGRAPHY,
  getPhaseColor,
} from './tokens';
export type { CyclePhaseKey, CycleTypographyKey } from './tokens';
