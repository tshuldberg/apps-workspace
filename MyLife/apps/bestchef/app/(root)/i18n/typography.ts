/**
 * Per-script font chains for non-Latin locales (audit L4).
 *
 * `_layout.tsx` only registers Plus Jakarta Sans (Latin). Screens that render
 * ja/zh/ko/hi/th/ar/he text fall back to whatever the OS picks with no
 * explicit intent. iOS ships first-class system faces for every script we
 * support, so this maps each locale to an ordered `fontFamily` chain built
 * from those system faces (no bundling needed) with Plus Jakarta Sans as the
 * trailing fallback for any Latin characters mixed into the string (numerals,
 * brand names, etc).
 *
 * This is the single chokepoint for locale-aware font resolution. Wire new
 * screens through `resolveFontFamily` / `scriptTypeStyle` rather than
 * referencing JAKARTA_FONTS.* directly.
 */
import { JAKARTA_FONTS, type JakartaWeight } from '@mylife/bestchef';
import type { LanguageCode } from './languages';

export type ScriptId =
  | 'latin'
  | 'ja'
  | 'zh-Hans'
  | 'zh-Hant'
  | 'ko'
  | 'hi'
  | 'bn'
  | 'ta'
  | 'te'
  | 'th'
  | 'ar'
  | 'he';

/**
 * iOS system faces per weight. Values are the exact PostScript/family names
 * iOS resolves via UIFont for the given script; RN's fontFamily/fontWeight
 * combination maps to these through the system font matcher.
 */
interface ScriptFontFace {
  regular: string;
  medium: string;
  semiBold: string;
  bold: string;
  extraBold: string;
}

const LATIN_CHAIN: ScriptFontFace = {
  regular: JAKARTA_FONTS.regular,
  medium: JAKARTA_FONTS.medium,
  semiBold: JAKARTA_FONTS.semiBold,
  bold: JAKARTA_FONTS.bold,
  extraBold: JAKARTA_FONTS.extraBold,
};

// iOS system faces below only expose a handful of real weights (most are
// regular/medium/semibold/bold); "extraBold" maps to the face's heaviest
// available weight so callers keep semantic continuity with the Latin ramp.
const SCRIPT_FONT_FACES: Record<Exclude<ScriptId, 'latin'>, ScriptFontFace> = {
  ja: {
    regular: 'HiraginoSans-W3',
    medium: 'HiraginoSans-W5',
    semiBold: 'HiraginoSans-W6',
    bold: 'HiraginoSans-W6',
    extraBold: 'HiraginoSans-W8',
  },
  'zh-Hans': {
    regular: 'PingFangSC-Regular',
    medium: 'PingFangSC-Medium',
    semiBold: 'PingFangSC-Semibold',
    bold: 'PingFangSC-Semibold',
    extraBold: 'PingFangSC-Semibold',
  },
  'zh-Hant': {
    regular: 'PingFangTC-Regular',
    medium: 'PingFangTC-Medium',
    semiBold: 'PingFangTC-Semibold',
    bold: 'PingFangTC-Semibold',
    extraBold: 'PingFangTC-Semibold',
  },
  ko: {
    regular: 'AppleSDGothicNeo-Regular',
    medium: 'AppleSDGothicNeo-Medium',
    semiBold: 'AppleSDGothicNeo-SemiBold',
    bold: 'AppleSDGothicNeo-Bold',
    extraBold: 'AppleSDGothicNeo-ExtraBold',
  },
  hi: {
    regular: 'KohinoorDevanagari-Regular',
    medium: 'KohinoorDevanagari-Medium',
    semiBold: 'KohinoorDevanagari-Semibold',
    bold: 'KohinoorDevanagari-Semibold',
    extraBold: 'KohinoorDevanagari-Semibold',
  },
  bn: {
    // iOS ships Kohinoor Bangla (regular/medium/semibold) as the system
    // Bengali face; heavier weights map to Semibold like the Devanagari ramp.
    regular: 'KohinoorBangla-Regular',
    medium: 'KohinoorBangla-Medium',
    semiBold: 'KohinoorBangla-Semibold',
    bold: 'KohinoorBangla-Semibold',
    extraBold: 'KohinoorBangla-Semibold',
  },
  ta: {
    // Tamil Sangam MN is the iOS system Tamil face; it exposes only
    // regular and bold, so medium/semibold hold regular and bold carries weight.
    regular: 'TamilSangamMN',
    medium: 'TamilSangamMN',
    semiBold: 'TamilSangamMN-Bold',
    bold: 'TamilSangamMN-Bold',
    extraBold: 'TamilSangamMN-Bold',
  },
  te: {
    // iOS ships Kohinoor Telugu (regular/medium/semibold) for Telugu;
    // heavier weights map to Semibold, mirroring the Devanagari ramp.
    regular: 'KohinoorTelugu-Regular',
    medium: 'KohinoorTelugu-Medium',
    semiBold: 'KohinoorTelugu-Semibold',
    bold: 'KohinoorTelugu-Semibold',
    extraBold: 'KohinoorTelugu-Semibold',
  },
  th: {
    regular: 'Thonburi',
    medium: 'Thonburi',
    semiBold: 'Thonburi-Bold',
    bold: 'Thonburi-Bold',
    extraBold: 'Thonburi-Bold',
  },
  ar: {
    // SF Arabic ships as the system default under the "Geeza Pro" legacy
    // family name on iOS; -GeezaPro is the reliable cross-iOS-version alias.
    regular: 'GeezaPro',
    medium: 'GeezaPro',
    semiBold: 'GeezaPro-Bold',
    bold: 'GeezaPro-Bold',
    extraBold: 'GeezaPro-Bold',
  },
  he: {
    regular: 'ArialHebrew',
    medium: 'ArialHebrew',
    semiBold: 'ArialHebrew-Bold',
    bold: 'ArialHebrew-Bold',
    extraBold: 'ArialHebrew-Bold',
  },
};

const LANGUAGE_TO_SCRIPT: Record<LanguageCode, ScriptId> = {
  en: 'latin',
  es: 'latin',
  fr: 'latin',
  de: 'latin',
  it: 'latin',
  'pt-BR': 'latin',
  'pt-PT': 'latin',
  nl: 'latin',
  sv: 'latin',
  pl: 'latin',
  tr: 'latin',
  id: 'latin',
  vi: 'latin',
  hi: 'hi',
  bn: 'bn',
  ta: 'ta',
  te: 'te',
  th: 'th',
  ja: 'ja',
  ko: 'ko',
  'zh-Hans': 'zh-Hans',
  'zh-Hant': 'zh-Hant',
  ar: 'ar',
  he: 'he',
};

export function getScriptForLanguage(language: LanguageCode): ScriptId {
  return LANGUAGE_TO_SCRIPT[language] ?? 'latin';
}

/**
 * Resolve the fontFamily for a given locale + weight. Non-Latin scripts
 * render entirely in their system face (no Latin fallback chain needed on
 * iOS: the system font matcher already substitutes Latin glyphs from the
 * script face's companion Latin table for mixed-script strings).
 */
export function resolveFontFamily(language: LanguageCode, weight: JakartaWeight): string {
  const script = getScriptForLanguage(language);
  if (script === 'latin') return LATIN_CHAIN[weight];
  return SCRIPT_FONT_FACES[script][weight];
}

/**
 * Convenience style helper mirroring RECIPES_TYPOGRAPHY entries but resolved
 * for the active locale. Spread over the base token so fontSize/lineHeight/
 * letterSpacing are preserved and only fontFamily is swapped:
 *
 *   <Text style={[RECIPES_TYPOGRAPHY.headlineMd, scriptTypeStyle(language, 'bold')]} />
 */
export function scriptTypeStyle(language: LanguageCode, weight: JakartaWeight): { fontFamily: string } {
  return { fontFamily: resolveFontFamily(language, weight) };
}
