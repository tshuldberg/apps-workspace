// Web-safe UI barrel for @mylife/workouts.
//
// Re-exports ONLY design tokens and typography (pure values, no RN imports).
// Full component surface lives in `./index.native.ts`; Metro picks that on
// iOS/Android while web bundlers ignore `.native.ts` and read this file.
// See modules/budget/src/ui/index.ts for the documented pattern.

export {
  WK_FONTS,
  WK_FONT_REGULAR,
  WK_FONT_MEDIUM,
  WK_FONT_SEMIBOLD,
  WK_FONT_BOLD,
  WK_FONT_EXTRABOLD,
} from './typography';
export type { WorkoutFontWeight } from './typography';

export {
  WK_CATEGORY_COLORS,
  WK_ACCENT,
  WK_ACCENT_LIGHT,
  WK_ACCENT_DARK,
  WK_ON_ACCENT,
  WK_SURFACES,
  WK_GLASS,
  WK_GLASS_NAV,
  WK_NO_BORDER,
  WK_CTA_GRADIENT,
  WK_TYPOGRAPHY,
  getWorkoutCategoryColor,
} from './tokens';
export type {
  WorkoutCategoryColorKey,
  WorkoutTypographyKey,
} from './tokens';
