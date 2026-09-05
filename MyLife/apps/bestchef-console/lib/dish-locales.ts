/**
 * Editorial dish-translation locales (plan 33 Phase 2.3).
 *
 * Mirrors the consumer app's 21 catalogs minus 'en': bc_dishes canonical
 * rows ARE the English surface, so an 'en' translation row would shadow
 * them for no benefit. Stored locale tags are lowercase-only (DB check
 * constraint bc_dish_translations_locale_shape).
 */

export const DISH_TRANSLATION_LOCALES = [
  'ar',
  'de',
  'es',
  'fr',
  'he',
  'hi',
  'id',
  'it',
  'ja',
  'ko',
  'nl',
  'pl',
  'pt-br',
  'pt-pt',
  'sv',
  'th',
  'tr',
  'vi',
  'zh-hans',
  'zh-hant',
] as const;

export type DishTranslationLocale = (typeof DISH_TRANSLATION_LOCALES)[number];

export function normalizeDishLocale(raw: string | null | undefined): DishTranslationLocale | null {
  if (!raw) return null;
  const lowered = raw.trim().toLowerCase();
  return (DISH_TRANSLATION_LOCALES as readonly string[]).includes(lowered)
    ? (lowered as DishTranslationLocale)
    : null;
}

export const TRANSLATION_STATUSES = ['pending', 'approved', 'rejected'] as const;

export function isTranslationStatus(raw: string): raw is (typeof TRANSLATION_STATUSES)[number] {
  return (TRANSLATION_STATUSES as readonly string[]).includes(raw);
}
