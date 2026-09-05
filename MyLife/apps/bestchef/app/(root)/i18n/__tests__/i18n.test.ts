import { describe, expect, it, vi } from 'vitest';

vi.mock('expo-localization', () => ({
  getLocales: () => [{ languageTag: 'es-MX', languageCode: 'es' }],
}));

import { normalizeLanguageCode } from '../languages';
import { translatePluralized, translateText } from '../translations';
import { LANGUAGE_COMPLIANCE_COMPLETENESS, TRANSLATIONS } from '../catalogs';
import { COMPLIANCE_CRITICAL_KEYS } from '../compliance-keys';

describe('BestChef i18n', () => {
  it('normalizes common locale variants to supported language codes', () => {
    expect(normalizeLanguageCode('es-MX')).toBe('es');
    expect(normalizeLanguageCode('pt-BR')).toBe('pt-BR');
    expect(normalizeLanguageCode('pt-AO')).toBe('pt-PT');
    expect(normalizeLanguageCode('zh-TW')).toBe('zh-Hant');
    expect(normalizeLanguageCode('zh-CN')).toBe('zh-Hans');
    expect(normalizeLanguageCode('zz-ZZ')).toBe('en');
  });

  it('translates known keys and falls back to source text for missing keys', () => {
    expect(translateText('es', 'Settings')).toBe('Ajustes');
    expect(translateText('es', 'Untranslated source')).toBe('Untranslated source');
  });

  it('interpolates values in translated strings', () => {
    expect(
      translateText('en', 'Your recipe "{title}" for {dishName} has been saved.', {
        title: 'Pad Thai',
        dishName: 'Noodles',
      }),
    ).toBe('Your recipe "Pad Thai" for Noodles has been saved.');
  });
});

describe('CLDR plural categories (plan 33 Phase 3.5)', () => {
  it('Arabic selects dual, paucal, and accusative-many forms', () => {
    expect(translatePluralized('ar', 1, 'dish', 'dishes')).toBe('طبق');
    expect(translatePluralized('ar', 2, 'dish', 'dishes')).toBe('أطباق');
    expect(translatePluralized('ar', 5, 'dish', 'dishes')).toBe('أطباق');
    expect(translatePluralized('ar', 15, 'dish', 'dishes')).toBe('طبقًا');
    expect(translatePluralized('ar', 100, 'dish', 'dishes')).toBe('أطباق');
  });

  it('Arabic dual day strings drop the redundant numeral', () => {
    expect(
      translatePluralized('ar', 2, 'Expired ({count} day ago)', 'Expired ({count} days ago)', { count: 2 }),
    ).toBe('منتهي الصلاحية (قبل يومين)');
  });

  it('Polish declines nouns for few vs many', () => {
    expect(translatePluralized('pl', 2, 'photo', 'photos')).toBe('zdjęcia');
    expect(translatePluralized('pl', 5, 'photo', 'photos')).toBe('zdjęć');
    expect(translatePluralized('pl', 22, 'photo', 'photos')).toBe('zdjęcia');
    expect(translatePluralized('pl', 25, 'photo', 'photos')).toBe('zdjęć');
  });

  it('Polish rank copy uses few for 2-4', () => {
    expect(
      translatePluralized('pl', 3, 'Up {delta} rank this week', 'Up {delta} ranks this week', { delta: 3 }),
    ).toBe('W górę o 3 miejsca w tym tygodniu');
    expect(
      translatePluralized('pl', 7, 'Up {delta} rank this week', 'Up {delta} ranks this week', { delta: 7 }),
    ).toBe('W górę o 7 miejsc w tym tygodniu');
  });

  it('Hebrew selects the dual', () => {
    expect(translatePluralized('he', 2, 'recipe', 'recipes')).toBe('מתכונים');
    expect(translatePluralized('he', 3, 'recipe', 'recipes')).toBe('מתכונים');
  });

  it('one/other languages fall through to the base plural', () => {
    expect(translatePluralized('de', 2, 'dish', 'dishes')).toBe('Gerichte');
    expect(translatePluralized('en', 0, 'dish', 'dishes')).toBe('dishes');
    expect(translatePluralized('ja', 1, 'dish', 'dishes')).toBe(translateText('ja', 'dishes'));
  });

  it('pantry photo counts decline in Polish and Arabic', () => {
    expect(translatePluralized('pl', 3, '1 photo', '{count} photos', { count: 3 })).toBe('3 zdjęcia');
    expect(translatePluralized('pl', 7, '1 photo', '{count} photos', { count: 7 })).toBe('7 zdjęć');
    expect(translatePluralized('ar', 2, '1 photo', '{count} photos', { count: 2 })).toBe('صورتان');
    expect(translatePluralized('en', 1, '1 photo', '{count} photos', { count: 1 })).toBe('1 photo');
  });

  it('French treats zero as singular per CLDR', () => {
    expect(translatePluralized('fr', 0, 'dish', 'dishes')).toBe(translateText('fr', 'dish'));
  });
});

describe('compliance-critical completeness (plan 33 Phase 3.7)', () => {
  it('has a non-empty generated safety key list', () => {
    expect(COMPLIANCE_CRITICAL_KEYS.length).toBeGreaterThan(30);
  });

  it('every locale has the full safety surface translated', () => {
    for (const code of Object.keys(TRANSLATIONS)) {
      expect(
        { code, value: LANGUAGE_COMPLIANCE_COMPLETENESS[code as keyof typeof LANGUAGE_COMPLIANCE_COMPLETENESS] },
      ).toEqual({ code, value: 1 });
    }
  });
});
