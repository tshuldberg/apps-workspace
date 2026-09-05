import { describe, expect, it } from 'vitest';

import {
  DISH_TRANSLATION_LOCALES,
  isTranslationStatus,
  normalizeDishLocale,
} from '../dish-locales';

describe('DISH_TRANSLATION_LOCALES', () => {
  it('is the consumer catalog set minus en, all lowercase (DB constraint)', () => {
    expect(DISH_TRANSLATION_LOCALES).toHaveLength(20);
    expect(DISH_TRANSLATION_LOCALES).not.toContain('en');
    for (const locale of DISH_TRANSLATION_LOCALES) {
      expect(locale).toBe(locale.toLowerCase());
      expect(locale).toMatch(/^[a-z]{2}(-[a-z0-9]{2,8})?$/);
    }
  });
});

describe('normalizeDishLocale', () => {
  it('lowercases and validates against the registry', () => {
    expect(normalizeDishLocale('DE')).toBe('de');
    expect(normalizeDishLocale('pt-BR')).toBe('pt-br');
    expect(normalizeDishLocale('zh-Hans')).toBe('zh-hans');
  });

  it('rejects unknown and empty locales (fail closed)', () => {
    expect(normalizeDishLocale('en')).toBeNull();
    expect(normalizeDishLocale('xx')).toBeNull();
    expect(normalizeDishLocale('')).toBeNull();
    expect(normalizeDishLocale(null)).toBeNull();
  });
});

describe('isTranslationStatus', () => {
  it('accepts only the three moderation states', () => {
    expect(isTranslationStatus('approved')).toBe(true);
    expect(isTranslationStatus('pending')).toBe(true);
    expect(isTranslationStatus('rejected')).toBe(true);
    expect(isTranslationStatus('live')).toBe(false);
  });
});
