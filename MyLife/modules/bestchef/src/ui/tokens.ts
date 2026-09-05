import { JAKARTA_FONTS } from './typography';

/**
 * MyRecipes typography overrides using Plus Jakarta Sans.
 * fontSize values are provided as defaults; consumers should
 * compute letterSpacing and lineHeight relative to their actual fontSize.
 */
export const RECIPES_TYPOGRAPHY = {
  displayLg: {
    fontFamily: JAKARTA_FONTS.extraBold,
    fontSize: 32,
    lineHeight: 40,
    letterSpacing: -0.02 * 32,
  },
  headlineMd: {
    fontFamily: JAKARTA_FONTS.bold,
    fontSize: 20,
    lineHeight: 26,
  },
  bodyMd: {
    fontFamily: JAKARTA_FONTS.regular,
    fontSize: 16,
    lineHeight: 1.6 * 16,
  },
  labelUpper: {
    fontFamily: JAKARTA_FONTS.semiBold,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 0.1 * 12,
    textTransform: 'uppercase' as const,
  },
} as const;

/** MyRecipes primary accent (culinary green) */
export const RECIPES_ACCENT = '#22C55E';

/** MyRecipes lighter accent for hover states and highlights */
export const RECIPES_ACCENT_LIGHT = '#4ADE80';

/** MyRecipes secondary (warm gold for primary CTAs and nav chrome) */
export const RECIPES_SECONDARY = '#C9894D';

/** MyRecipes tertiary (info blue for status tags) */
export const RECIPES_TERTIARY = '#8BCFF0';

/** MyRecipes danger (expired items, destructive actions) */
export const RECIPES_DANGER = '#EF4444';

/**
 * 5-tier surface system for MyRecipes Obsidian Noir.
 * Use surface color shifts instead of 1px borders (see RECIPES_NO_BORDER).
 */
export const RECIPES_SURFACES = {
  depth: '#0E0E13',
  base: '#131318',
  lift: '#1B1B20',
  focus: '#2A292F',
  highest: '#35343A',
} as const;

/**
 * Glass morphism preset for floating navigation in MyRecipes.
 * Mobile: use expo-blur BlurView with these fill values.
 * Web: apply backdropFilter directly.
 */
export const RECIPES_GLASS = {
  backgroundColor: 'rgba(19, 19, 24, 0.7)',
  backdropFilter: 'blur(20px)',
} as const;

/**
 * Strict mandate: MyRecipes screens must use surface color shifts
 * instead of 1px solid borders for visual boundaries.
 */
export const RECIPES_NO_BORDER = true;

/**
 * Primary CTA gradient for MyRecipes action buttons.
 * Uses the hub warm gold for navigation chrome and CTAs.
 */
export const RECIPES_CTA_GRADIENT = {
  from: '#FFB877',
  to: '#C9894D',
  angle: 135,
} as const;

/**
 * are-blaze BestChef hero gradient (terracotta to saffron).
 * Use HERO_GRADIENT in light surfaces, HERO_GRADIENT_DARK in deep dark surfaces
 * to maintain contrast.
 */
export const HERO_GRADIENT = {
  from: '#F26A3A',
  to: '#F2A93A',
  angle: 135,
} as const;

export const HERO_GRADIENT_DARK = {
  from: '#C7522E',
  to: '#C77B25',
  angle: 135,
} as const;

/**
 * Champion / podium gold gradient for top-rank surfaces (medals, hero crown,
 * ranking badges). Pure gold-to-saffron.
 */
export const GOLD_GRADIENT = {
  from: '#FFD159',
  to: '#EB9A2E',
  angle: 135,
} as const;

/** Medal colors for podium and ranking surfaces (1st, 2nd, 3rd). */
export const MEDAL_GOLD = '#FFD159';
export const MEDAL_SILVER = '#B8B8BD';
export const MEDAL_BRONZE = '#CC8C57';

export type GradientToken = {
  readonly from: string;
  readonly to: string;
  readonly angle: number;
};

/**
 * Freshness badge colors for pantry items.
 * Fresh = iOS green, Expiring Soon = hub gold, Expired = red.
 */
export const RECIPES_FRESHNESS_COLORS = {
  fresh: '#30D158',
  expiringSoon: '#FFB877',
  expired: '#EF4444',
} as const;

/**
 * Category color accents for shopping and pantry items.
 * Used as left-border accents and category tint backgrounds.
 */
export const RECIPES_CATEGORY_COLORS = {
  produce: '#30D158',
  dairy: '#60A5FA',
  meat: '#EF4444',
  pantry: '#C9894D',
  bakery: '#FFB877',
  frozen: '#8BCFF0',
} as const;

export type RecipesFreshness = keyof typeof RECIPES_FRESHNESS_COLORS;
export type RecipesCategory = keyof typeof RECIPES_CATEGORY_COLORS;
