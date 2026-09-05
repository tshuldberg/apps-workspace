import type { LanguageCode } from '../languages';
import { EN } from './en';
import { ES } from './es';
import { FR } from './fr';
import { DE } from './de';
import { IT } from './it';
import { PT_BR } from './pt-BR';
import { PT_PT } from './pt-PT';
import { NL } from './nl';
import { SV } from './sv';
import { PL } from './pl';
import { TR } from './tr';
import { ID } from './id';
import { VI } from './vi';
import { HI } from './hi';
import { BN } from './bn';
import { TA } from './ta';
import { TE } from './te';
import { TH } from './th';
import { JA } from './ja';
import { KO } from './ko';
import { ZH_HANS } from './zh-Hans';
import { ZH_HANT } from './zh-Hant';
import { AR } from './ar';
import { HE } from './he';
import { COMPLIANCE_CRITICAL_KEYS } from '../compliance-keys';

export type TranslationKey = keyof typeof EN;
export type Catalog = Partial<Record<TranslationKey, string>>;

export const TRANSLATIONS: Record<LanguageCode, Catalog> = {
  en: EN,
  es: ES,
  fr: FR,
  de: DE,
  it: IT,
  'pt-BR': PT_BR,
  'pt-PT': PT_PT,
  nl: NL,
  sv: SV,
  pl: PL,
  tr: TR,
  id: ID,
  vi: VI,
  hi: HI,
  bn: BN,
  ta: TA,
  te: TE,
  th: TH,
  ja: JA,
  ko: KO,
  'zh-Hans': ZH_HANS,
  'zh-Hant': ZH_HANT,
  ar: AR,
  he: HE,
};

const EN_KEYS = Object.keys(EN) as TranslationKey[];
const TOTAL_KEYS = EN_KEYS.length;

function countTranslated(catalog: Catalog): number {
  let n = 0;
  for (const key of EN_KEYS) {
    const value = catalog[key];
    if (value && value !== EN[key]) n += 1;
  }
  return n;
}

export const LANGUAGE_COMPLETENESS: Record<LanguageCode, number> = (() => {
  const out = {} as Record<LanguageCode, number>;
  for (const code of Object.keys(TRANSLATIONS) as LanguageCode[]) {
    if (code === 'en') {
      out[code] = 1;
    } else {
      out[code] = TOTAL_KEYS === 0 ? 0 : countTranslated(TRANSLATIONS[code]) / TOTAL_KEYS;
    }
  }
  return out;
})();

/**
 * Fraction of SAFETY-surface keys (reporting, appeals, blocking, age gate,
 * account deletion, legal links) actually translated. A locale below 1 here
 * must never be presented as complete, whatever its overall percentage:
 * "complete" with English safety notices is a lie (plan 33 Phase 3.7).
 */
// Correct translations that happen to be identical to the English source
// (reviewed by hand; the value-differs heuristic would miscount them).
const REVIEWED_IDENTICAL: Partial<Record<LanguageCode, readonly string[]>> = {
  es: ['No'],
  it: ['No'],
  fr: ['Violence'],
};

export const LANGUAGE_COMPLIANCE_COMPLETENESS: Record<LanguageCode, number> = (() => {
  const keys = COMPLIANCE_CRITICAL_KEYS as readonly TranslationKey[];
  const out = {} as Record<LanguageCode, number>;
  for (const code of Object.keys(TRANSLATIONS) as LanguageCode[]) {
    if (code === 'en' || keys.length === 0) {
      out[code] = 1;
      continue;
    }
    const catalog = TRANSLATIONS[code];
    const reviewed = REVIEWED_IDENTICAL[code] ?? [];
    let n = 0;
    for (const key of keys) {
      const value = catalog[key];
      if (value && (value !== EN[key] || reviewed.includes(key))) n += 1;
    }
    out[code] = n / keys.length;
  }
  return out;
})();

export const TOTAL_KEY_COUNT = TOTAL_KEYS;

export { EN };
