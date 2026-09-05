import type { CSSProperties } from 'react';
import {
  NU_ACCENT,
  NU_ACCENT_LIGHT,
  NU_CALORIE,
  NU_GOAL_STATUS,
  NU_MACROS,
  NU_SOURCE_BADGES,
  NU_SURFACES,
  NU_TEXT,
  NU_TEXT_SECONDARY,
  NU_TEXT_TERTIARY,
  NU_WATER,
} from '@mylife/nutrition';
import { fontStacks } from '@mylife/ui/src/tokens/typography';

export const NUTRITION_CHROME = {
  accent: NU_ACCENT,
  accentLight: NU_ACCENT_LIGHT,
  calorie: NU_CALORIE,
  protein: NU_MACROS.protein,
  carbs: NU_MACROS.carbs,
  fat: NU_MACROS.fat,
  fiber: NU_MACROS.fiber,
  water: NU_WATER,
  success: NU_GOAL_STATUS.met,
  warning: NU_GOAL_STATUS.close,
  danger: NU_GOAL_STATUS.over,
  muted: NU_GOAL_STATUS.under,
  text: NU_TEXT,
  textMuted: 'rgba(228, 225, 233, 0.72)',
  textDim: NU_TEXT_TERTIARY,
  line: 'rgba(255, 255, 255, 0.08)',
  lineStrong: 'rgba(255, 255, 255, 0.14)',
  surfaceDepth: NU_SURFACES.lowest,
  surfaceBase: NU_SURFACES.base,
  surfaceLift: NU_SURFACES.low,
  surfaceFocus: NU_SURFACES.mid,
  surfaceHigh: NU_SURFACES.high,
  surfaceHighest: NU_SURFACES.highest,
  glass: 'rgba(255, 255, 255, 0.04)',
  glassStrong: 'rgba(255, 255, 255, 0.08)',
  glassBorder: 'rgba(255, 255, 255, 0.12)',
  warmShadow: '0 28px 80px rgba(0, 0, 0, 0.44)',
} as const;

export const NUTRITION_FONT = fontStacks.display;
export const NUTRITION_SIDEBAR_WIDTH = 272;

export type NutritionNavItem = {
  href: string;
  label: string;
  title: string;
  icon: string;
};

export const NUTRITION_PRIMARY_NAV: NutritionNavItem[] = [
  { href: '/nutrition', label: 'Home', title: 'Daily Mission Control', icon: 'home' },
  { href: '/nutrition/diary', label: 'Diary', title: 'Food Diary', icon: 'menu_book' },
  { href: '/nutrition/search', label: 'Search', title: 'Food Search', icon: 'search' },
  { href: '/nutrition/trends', label: 'Trends', title: 'Trend Studio', icon: 'trending_up' },
  { href: '/nutrition/community', label: 'Community', title: 'Community Hub', icon: 'groups' },
  { href: '/nutrition/settings', label: 'Settings', title: 'Nutrition Settings', icon: 'settings' },
] as const;

export const NUTRITION_SECONDARY_NAV: NutritionNavItem[] = [
  { href: '/nutrition/dashboard', label: 'Dashboard', title: 'Micronutrient Dashboard', icon: 'dashboard' },
  { href: '/nutrition/goals', label: 'Goals', title: 'Goals & TDEE', icon: 'flag' },
  { href: '/nutrition/log', label: 'Log Food', title: 'Log Food', icon: 'add_circle' },
  { href: '/nutrition/water', label: 'Hydration', title: 'Hydration Log', icon: 'water_drop' },
  { href: '/nutrition/restaurants', label: 'Restaurants', title: 'Restaurant Menus', icon: 'restaurant' },
  { href: '/nutrition/notes', label: 'Notes', title: 'Daily Notes', icon: 'note_stack' },
  { href: '/nutrition/export', label: 'Export', title: 'Export Data', icon: 'download' },
] as const;

export const NUTRITION_MEALS = [
  { key: 'breakfast', label: 'Breakfast', icon: 'wb_sunny' },
  { key: 'lunch', label: 'Lunch', icon: 'lunch_dining' },
  { key: 'dinner', label: 'Dinner', icon: 'dinner_dining' },
  { key: 'snack', label: 'Snacks', icon: 'nutrition' },
] as const;

export function alpha(hex: string, opacity: number): string {
  const normalized = hex.replace('#', '');
  const value = normalized.length === 3
    ? normalized.split('').map((part) => `${part}${part}`).join('')
    : normalized;
  const red = Number.parseInt(value.slice(0, 2), 16);
  const green = Number.parseInt(value.slice(2, 4), 16);
  const blue = Number.parseInt(value.slice(4, 6), 16);
  return `rgba(${red}, ${green}, ${blue}, ${opacity})`;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function formatNutritionDate(
  value?: string | null,
  options?: Intl.DateTimeFormatOptions,
): string {
  if (!value) return 'No date';
  const normalized = value.includes('T') ? value : `${value}T12:00:00`;
  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString('en-US', options ?? {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function formatNutritionShortDate(value?: string | null): string {
  return formatNutritionDate(value, { month: 'short', day: 'numeric' });
}

export function formatNutritionTime(value?: string | null): string {
  if (!value) return 'Unknown';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function formatNutritionNumber(value: number, digits = 0): string {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
}

export function humanizeNutritionValue(value: string): string {
  return value.replace(/_/g, ' ').replace(/\b\w/g, (segment) => segment.toUpperCase());
}

export function getSourceBadge(source?: string | null) {
  const key = source === 'off'
    ? 'off'
    : source === 'open_food_facts'
      ? 'open_food_facts'
      : source === 'fatsecret'
        ? 'fatsecret'
        : source === 'ai_photo'
          ? 'ai_photo'
          : source === 'usda'
            ? 'usda'
            : 'custom';
  return NU_SOURCE_BADGES[key];
}

export function getInsightTone(severity: string): { color: string; background: string } {
  if (severity === 'actionable') {
    return { color: NUTRITION_CHROME.calorie, background: alpha(NUTRITION_CHROME.calorie, 0.14) };
  }
  if (severity === 'notable') {
    return { color: NUTRITION_CHROME.warning, background: alpha(NUTRITION_CHROME.warning, 0.16) };
  }
  return { color: NUTRITION_CHROME.water, background: alpha(NUTRITION_CHROME.water, 0.16) };
}

export function buildNutritionThemeStyle(): CSSProperties {
  return {
    '--nu-bg': NUTRITION_CHROME.surfaceDepth,
    '--nu-surface': NUTRITION_CHROME.surfaceBase,
    '--nu-surface-lift': NUTRITION_CHROME.surfaceLift,
    '--nu-surface-focus': NUTRITION_CHROME.surfaceFocus,
    '--nu-surface-high': NUTRITION_CHROME.surfaceHigh,
    '--nu-surface-highest': NUTRITION_CHROME.surfaceHighest,
    '--nu-text': NUTRITION_CHROME.text,
    '--nu-text-secondary': NU_TEXT_SECONDARY,
    '--nu-text-tertiary': NUTRITION_CHROME.textDim,
    '--nu-line': NUTRITION_CHROME.line,
    '--nu-glass': NUTRITION_CHROME.glass,
    '--nu-glass-strong': NUTRITION_CHROME.glassStrong,
    '--nu-accent': NUTRITION_CHROME.accent,
    '--nu-accent-light': NUTRITION_CHROME.accentLight,
    '--nu-calorie': NUTRITION_CHROME.calorie,
  } as CSSProperties;
}
