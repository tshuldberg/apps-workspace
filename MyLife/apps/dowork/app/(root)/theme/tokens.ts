// DoWork "gritty gym" brand tokens.
//
// Built on top of @mylife/workouts/ui WK_* tokens (typography scale, glass
// gradients, category colors). DoWork overrides the accent and surface
// palette for a darker, more iron/industrial feel than the warm orange-red
// the hub uses for the workouts module.
//
// Surfaces: matte black base, charcoal tiers.
// Accent: iron orange #FF6B00 — high-contrast against the dark stack,
// distinct from BestChef green and from the hub workouts red.
//
// Re-exports WK_TYPOGRAPHY, WK_FONTS, and WK_CATEGORY_COLORS unchanged so
// DoWork screens reading those from @mylife/workouts directly stay in sync.

import {
  WK_CATEGORY_COLORS,
  WK_CTA_GRADIENT,
  WK_FONTS,
  WK_TYPOGRAPHY,
  getWorkoutCategoryColor,
} from '@mylife/workouts';

export const DW_ACCENT = '#FF6B00';
export const DW_ACCENT_LIGHT = '#FF8B33';
export const DW_ACCENT_DARK = '#B34A00';
export const DW_ON_ACCENT = '#0B0B0E';

export const DW_SURFACES = {
  lowest: '#06060A',
  base: '#0B0B0E',
  low: '#15151A',
  mid: '#1F1F25',
  high: '#2A2A30',
  highest: '#35343A',
} as const;

export const DW_TEXT = {
  primary: '#F5F4F8',
  secondary: 'rgba(245, 244, 248, 0.72)',
  tertiary: 'rgba(245, 244, 248, 0.48)',
  disabled: 'rgba(245, 244, 248, 0.32)',
  onAccent: DW_ON_ACCENT,
} as const;

export const DW_BORDER = {
  subtle: 'rgba(255, 255, 255, 0.06)',
  default: 'rgba(255, 255, 255, 0.10)',
  strong: 'rgba(255, 255, 255, 0.16)',
} as const;

export const DW_GLASS = {
  backgroundColor: 'rgba(255, 255, 255, 0.04)',
  blur: 40,
  backdropFilter: 'blur(40px)',
} as const;

export const DW_GLASS_NAV = {
  backgroundColor: 'rgba(11, 11, 14, 0.82)',
  blur: 20,
  backdropFilter: 'blur(20px)',
} as const;

export const DW_CTA_GRADIENT = {
  from: DW_ACCENT_LIGHT,
  to: DW_ACCENT,
  angle: 135,
} as const;

export const DW_FEEDBACK = {
  success: '#30D158',
  warning: '#FFB877',
  danger: '#FF6B6B',
  info: '#8BCFF0',
} as const;

export type DoWorkSurfaceKey = keyof typeof DW_SURFACES;
export type DoWorkTextKey = keyof typeof DW_TEXT;
export type DoWorkBorderKey = keyof typeof DW_BORDER;

// Pass-through re-exports so screens can import display tokens from one place.
export {
  WK_FONTS,
  WK_TYPOGRAPHY,
  WK_CATEGORY_COLORS,
  WK_CTA_GRADIENT,
  getWorkoutCategoryColor,
};
