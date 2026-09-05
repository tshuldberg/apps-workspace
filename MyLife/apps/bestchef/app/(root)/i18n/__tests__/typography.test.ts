import { describe, expect, it, vi } from 'vitest';

vi.mock('expo-localization', () => ({
  getLocales: () => [{ languageTag: 'en-US', languageCode: 'en' }],
}));

import { JAKARTA_FONTS } from '@mylife/bestchef';
import { getScriptForLanguage, resolveFontFamily, scriptTypeStyle } from '../typography';
import { LANGUAGE_OPTIONS } from '../languages';

describe('per-script font chains (audit L4)', () => {
  it('maps every supported language to a script id', () => {
    for (const option of LANGUAGE_OPTIONS) {
      expect(getScriptForLanguage(option.code)).toBeTruthy();
    }
  });

  it('routes Latin locales to Plus Jakarta Sans', () => {
    expect(getScriptForLanguage('en')).toBe('latin');
    expect(getScriptForLanguage('es')).toBe('latin');
    expect(resolveFontFamily('en', 'bold')).toBe(JAKARTA_FONTS.bold);
  });

  it('routes CJK locales to their respective iOS system faces', () => {
    expect(getScriptForLanguage('ja')).toBe('ja');
    expect(resolveFontFamily('ja', 'regular')).toBe('HiraginoSans-W3');

    expect(getScriptForLanguage('zh-Hans')).toBe('zh-Hans');
    expect(resolveFontFamily('zh-Hans', 'regular')).toBe('PingFangSC-Regular');

    expect(getScriptForLanguage('zh-Hant')).toBe('zh-Hant');
    expect(resolveFontFamily('zh-Hant', 'regular')).toBe('PingFangTC-Regular');

    expect(getScriptForLanguage('ko')).toBe('ko');
    expect(resolveFontFamily('ko', 'regular')).toBe('AppleSDGothicNeo-Regular');
  });

  it('routes Hindi and Thai to their iOS system faces', () => {
    expect(resolveFontFamily('hi', 'regular')).toBe('KohinoorDevanagari-Regular');
    expect(resolveFontFamily('th', 'regular')).toBe('Thonburi');
  });

  it('routes the Indic scripts (Bengali, Tamil, Telugu) to their iOS system faces', () => {
    expect(getScriptForLanguage('bn')).toBe('bn');
    expect(resolveFontFamily('bn', 'regular')).toBe('KohinoorBangla-Regular');
    expect(resolveFontFamily('bn', 'semiBold')).toBe('KohinoorBangla-Semibold');

    expect(getScriptForLanguage('ta')).toBe('ta');
    expect(resolveFontFamily('ta', 'regular')).toBe('TamilSangamMN');
    expect(resolveFontFamily('ta', 'bold')).toBe('TamilSangamMN-Bold');

    expect(getScriptForLanguage('te')).toBe('te');
    expect(resolveFontFamily('te', 'regular')).toBe('KohinoorTelugu-Regular');
    expect(resolveFontFamily('te', 'semiBold')).toBe('KohinoorTelugu-Semibold');
  });

  it('routes RTL locales (Arabic, Hebrew) to their iOS system faces', () => {
    expect(getScriptForLanguage('ar')).toBe('ar');
    expect(resolveFontFamily('ar', 'regular')).toBe('GeezaPro');
    expect(resolveFontFamily('ar', 'bold')).toBe('GeezaPro-Bold');

    expect(getScriptForLanguage('he')).toBe('he');
    expect(resolveFontFamily('he', 'regular')).toBe('ArialHebrew');
    expect(resolveFontFamily('he', 'bold')).toBe('ArialHebrew-Bold');
  });

  it('preserves bold/medium weight semantics per face (no weight collapses to regular)', () => {
    for (const language of ['ja', 'zh-Hans', 'zh-Hant', 'ko', 'hi', 'bn', 'ta', 'te', 'th', 'ar', 'he'] as const) {
      const regular = resolveFontFamily(language, 'regular');
      const bold = resolveFontFamily(language, 'bold');
      expect(bold).not.toBe(regular);
    }
  });

  it('scriptTypeStyle returns a style object with only fontFamily set', () => {
    expect(scriptTypeStyle('ar', 'semiBold')).toEqual({ fontFamily: 'GeezaPro-Bold' });
    expect(scriptTypeStyle('en', 'semiBold')).toEqual({ fontFamily: JAKARTA_FONTS.semiBold });
  });
});
