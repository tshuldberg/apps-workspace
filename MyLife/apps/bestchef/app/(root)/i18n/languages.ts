import { getLocales } from 'expo-localization';

export type TextDirection = 'ltr' | 'rtl';

export const LANGUAGE_OPTIONS = [
  { code: 'en', nativeName: 'English', englishName: 'English', region: 'Global', textDirection: 'ltr' },
  { code: 'es', nativeName: 'Español', englishName: 'Spanish', region: 'Global', textDirection: 'ltr' },
  { code: 'fr', nativeName: 'Français', englishName: 'French', region: 'Global', textDirection: 'ltr' },
  { code: 'de', nativeName: 'Deutsch', englishName: 'German', region: 'Global', textDirection: 'ltr' },
  { code: 'it', nativeName: 'Italiano', englishName: 'Italian', region: 'Global', textDirection: 'ltr' },
  { code: 'pt-BR', nativeName: 'Português (Brasil)', englishName: 'Portuguese (Brazil)', region: 'Brazil', textDirection: 'ltr' },
  { code: 'pt-PT', nativeName: 'Português (Portugal)', englishName: 'Portuguese (Portugal)', region: 'Portugal', textDirection: 'ltr' },
  { code: 'nl', nativeName: 'Nederlands', englishName: 'Dutch', region: 'Global', textDirection: 'ltr' },
  { code: 'sv', nativeName: 'Svenska', englishName: 'Swedish', region: 'Global', textDirection: 'ltr' },
  { code: 'pl', nativeName: 'Polski', englishName: 'Polish', region: 'Global', textDirection: 'ltr' },
  { code: 'tr', nativeName: 'Türkçe', englishName: 'Turkish', region: 'Global', textDirection: 'ltr' },
  { code: 'id', nativeName: 'Bahasa Indonesia', englishName: 'Indonesian', region: 'Indonesia', textDirection: 'ltr' },
  { code: 'vi', nativeName: 'Tiếng Việt', englishName: 'Vietnamese', region: 'Vietnam', textDirection: 'ltr' },
  { code: 'hi', nativeName: 'हिन्दी', englishName: 'Hindi', region: 'India', textDirection: 'ltr' },
  { code: 'bn', nativeName: 'বাংলা', englishName: 'Bengali', region: 'India / Bangladesh', textDirection: 'ltr' },
  { code: 'ta', nativeName: 'தமிழ்', englishName: 'Tamil', region: 'India / Sri Lanka', textDirection: 'ltr' },
  { code: 'te', nativeName: 'తెలుగు', englishName: 'Telugu', region: 'India', textDirection: 'ltr' },
  { code: 'th', nativeName: 'ไทย', englishName: 'Thai', region: 'Thailand', textDirection: 'ltr' },
  { code: 'ja', nativeName: '日本語', englishName: 'Japanese', region: 'Japan', textDirection: 'ltr' },
  { code: 'ko', nativeName: '한국어', englishName: 'Korean', region: 'Korea', textDirection: 'ltr' },
  { code: 'zh-Hans', nativeName: '简体中文', englishName: 'Chinese (Simplified)', region: 'Mainland China', textDirection: 'ltr' },
  { code: 'zh-Hant', nativeName: '繁體中文', englishName: 'Chinese (Traditional)', region: 'Taiwan / Hong Kong', textDirection: 'ltr' },
  { code: 'ar', nativeName: 'العربية', englishName: 'Arabic', region: 'Global', textDirection: 'rtl' },
  { code: 'he', nativeName: 'עברית', englishName: 'Hebrew', region: 'Global', textDirection: 'rtl' },
] as const;

export type LanguageCode = (typeof LANGUAGE_OPTIONS)[number]['code'];
export type LanguageOption = (typeof LANGUAGE_OPTIONS)[number];

const LANGUAGE_OPTION_BY_CODE = new Map<LanguageCode, LanguageOption>(
  LANGUAGE_OPTIONS.map((language) => [language.code, language]),
);

export const DEFAULT_LANGUAGE: LanguageCode = 'en';

export const SUPPORTED_LOCALE_TAGS: LanguageCode[] = LANGUAGE_OPTIONS.map(
  (language) => language.code,
);

export function isLanguageCode(value: string): value is LanguageCode {
  return LANGUAGE_OPTION_BY_CODE.has(value as LanguageCode);
}

export function getLanguageOption(code: LanguageCode): LanguageOption {
  return LANGUAGE_OPTION_BY_CODE.get(code) ?? LANGUAGE_OPTION_BY_CODE.get(DEFAULT_LANGUAGE)!;
}

export function normalizeLanguageCode(localeTag: string | null | undefined): LanguageCode {
  if (!localeTag) return DEFAULT_LANGUAGE;

  const normalized = localeTag.replace('_', '-');
  if (isLanguageCode(normalized)) return normalized;

  const lower = normalized.toLowerCase();
  if (lower.startsWith('pt-br')) return 'pt-BR';
  if (lower.startsWith('pt')) return 'pt-PT';
  if (lower.startsWith('zh-hant') || lower.includes('-tw') || lower.includes('-hk')) return 'zh-Hant';
  if (lower.startsWith('zh')) return 'zh-Hans';

  const baseLanguage = lower.split('-')[0];
  const match = LANGUAGE_OPTIONS.find((language) => language.code.toLowerCase() === baseLanguage);
  return match?.code ?? DEFAULT_LANGUAGE;
}

export function getDeviceLanguage(): LanguageCode {
  try {
    const [locale] = getLocales();
    return normalizeLanguageCode(locale?.languageTag ?? locale?.languageCode);
  } catch {
    return DEFAULT_LANGUAGE;
  }
}

export function getDeviceLocaleTag(): string {
  try {
    return getLocales()[0]?.languageTag ?? DEFAULT_LANGUAGE;
  } catch {
    return DEFAULT_LANGUAGE;
  }
}
