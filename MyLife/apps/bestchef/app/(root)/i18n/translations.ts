import type { LanguageCode } from './languages';
import {
  EN,
  TRANSLATIONS,
  LANGUAGE_COMPLETENESS,
  TOTAL_KEY_COUNT,
  type Catalog,
  type TranslationKey,
} from './catalogs';

export type { Catalog, TranslationKey };
export { TRANSLATIONS, LANGUAGE_COMPLETENESS, TOTAL_KEY_COUNT };

type TranslationValues = Record<string, string | number>;

function interpolate(template: string, values?: TranslationValues): string {
  if (!values) return template;
  return Object.entries(values).reduce(
    (text, [name, value]) => text.replaceAll(`{${name}}`, String(value)),
    template,
  );
}

export function translateText(
  language: LanguageCode,
  key: TranslationKey | string,
  values?: TranslationValues,
): string {
  const catalog = TRANSLATIONS[language];
  const translated = catalog?.[key as TranslationKey];
  const fallback = (EN as Record<string, string>)[key as string];
  const template = translated ?? fallback ?? (key as string);
  return interpolate(template, values);
}

export function translatePluralized(
  language: LanguageCode,
  count: number,
  singularKey: TranslationKey | string,
  pluralKey: TranslationKey | string,
  values?: TranslationValues,
): string {
  let rule: Intl.LDMLPluralRule = 'other';
  try {
    rule = new Intl.PluralRules(language).select(count);
  } catch {
    rule = count === 1 ? 'one' : 'other';
  }
  if (rule === 'one') {
    return translateText(language, singularKey, { count, ...values });
  }
  // Full CLDR categories (plan 33 Phase 3.5): catalogs may carry
  // '<pluralKey>#zero|#two|#few|#many' variants (Arabic dual/paucal,
  // Hebrew dual, Polish few/many). The base plural key is the 'other'
  // form and the fallback for any missing variant.
  if (rule !== 'other') {
    const variantKey = `${pluralKey}#${rule}`;
    const catalog = TRANSLATIONS[language];
    const hasVariant =
      catalog?.[variantKey as TranslationKey] !== undefined ||
      (EN as Record<string, string>)[variantKey] !== undefined;
    if (hasVariant) {
      return translateText(language, variantKey, { count, ...values });
    }
  }
  return translateText(language, pluralKey, { count, ...values });
}

export function formatNumberForLanguage(language: LanguageCode, value: number): string {
  try {
    return new Intl.NumberFormat(language).format(value);
  } catch {
    return String(value);
  }
}

const RELATIVE_UNIT_COMPACT: Partial<Record<Intl.RelativeTimeFormatUnit, string>> = {
  second: 's',
  seconds: 's',
  minute: 'm',
  minutes: 'm',
  hour: 'h',
  hours: 'h',
  day: 'd',
  days: 'd',
  week: 'w',
  weeks: 'w',
  month: 'mo',
  months: 'mo',
  year: 'y',
  years: 'y',
};

export function formatRelativeTimeForLanguage(
  language: LanguageCode,
  value: number,
  unit: Intl.RelativeTimeFormatUnit,
): string {
  if (!Number.isFinite(value)) return '';
  try {
    return new Intl.RelativeTimeFormat(language, { numeric: 'auto' }).format(value, unit);
  } catch {
    // Intl.RelativeTimeFormat may be absent on Hermes: fall back to the
    // compact English style the pre-3.3 UI used ("2h", "3d").
    const magnitude = Math.abs(Math.round(value));
    const compact = RELATIVE_UNIT_COMPACT[unit];
    return compact ? `${magnitude}${compact}` : `${magnitude} ${unit}`;
  }
}
