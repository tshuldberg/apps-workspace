import { NU_FONTS } from './typography';

export const NU_ACCENT = '#C9894D';
export const NU_ACCENT_LIGHT = '#FFB877';
export const NU_ACCENT_DARK = '#4A2600';
export const NU_ON_ACCENT = NU_ACCENT_DARK;
export const NU_TEXT = '#E4E1E9';
export const NU_TEXT_SECONDARY = '#D6C3B5';
export const NU_TEXT_TERTIARY = '#9F8E81';
export const NU_BORDER = 'rgba(255, 255, 255, 0.06)';

export const NU_CALORIE = '#F97316';
export const NU_CALORIE_LIGHT = '#FB923C';
export const NU_WATER = '#38BDF8';

export const NU_MACROS = {
  protein: '#FFB877',
  carbs: '#8BCFF0',
  fat: '#E6BFA0',
  fiber: '#84CC16',
} as const;

export const NU_NUTRIENT_CATEGORIES = {
  vitamin: '#FFB877',
  mineral: '#8BCFF0',
  macro: '#F97316',
} as const;

export const NU_GOAL_STATUS = {
  met: '#30D158',
  close: '#FFB877',
  over: '#FFB4AB',
  under: '#9F8E81',
} as const;

export const NU_SURFACES = {
  lowest: '#0E0E13',
  base: '#131318',
  low: '#1B1B20',
  mid: '#1F1F25',
  high: '#2A292F',
  highest: '#35343A',
} as const;

export const NU_GLASS = {
  backgroundColor: 'rgba(255, 255, 255, 0.04)',
  blur: 20,
  backdropFilter: 'blur(20px)',
} as const;

export const NU_GLASS_NAV = {
  backgroundColor: 'rgba(19, 19, 24, 0.7)',
  blur: 32,
  backdropFilter: 'blur(32px)',
} as const;

export const NU_TYPOGRAPHY = {
  displayLg: {
    fontFamily: NU_FONTS.extraBold,
    fontSize: 60,
    letterSpacing: -0.02 * 60,
    lineHeight: 1.05 * 60,
  },
  headlineMd: {
    fontFamily: NU_FONTS.bold,
    fontSize: 20,
    letterSpacing: -0.01 * 20,
    lineHeight: 1.25 * 20,
  },
  titleMd: {
    fontFamily: NU_FONTS.semiBold,
    fontSize: 16,
    lineHeight: 1.35 * 16,
  },
  bodyMd: {
    fontFamily: NU_FONTS.regular,
    fontSize: 14,
    lineHeight: 1.6 * 14,
  },
  bodySm: {
    fontFamily: NU_FONTS.regular,
    fontSize: 12,
    lineHeight: 1.6 * 12,
  },
  labelUpper: {
    fontFamily: NU_FONTS.medium,
    fontSize: 10,
    letterSpacing: 0.15 * 10,
    lineHeight: 1.2 * 10,
    textTransform: 'uppercase' as const,
  },
} as const;

export const NU_SOURCE_BADGES = {
  usda: {
    label: 'USDA',
    color: NU_GOAL_STATUS.met,
    icon: 'eco',
  },
  off: {
    label: 'OFF',
    color: NU_WATER,
    icon: 'science',
  },
  open_food_facts: {
    label: 'OFF',
    color: NU_WATER,
    icon: 'science',
  },
  fatsecret: {
    label: 'FatSecret',
    color: NU_CALORIE,
    icon: 'local_dining',
  },
  custom: {
    label: 'Custom',
    color: NU_ACCENT_LIGHT,
    icon: 'edit',
  },
  ai_photo: {
    label: 'AI',
    color: NU_ACCENT,
    icon: 'photo_camera',
  },
} as const;

export type NutritionTypographyKey = keyof typeof NU_TYPOGRAPHY;
export type NutritionMacroKey = keyof typeof NU_MACROS;
export type NutritionSourceBadgeKey = keyof typeof NU_SOURCE_BADGES;
