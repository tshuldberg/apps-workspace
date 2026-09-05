/**
 * Language detection and multi-language transcription engine.
 * Handles BCP 47 validation, segment merging, language profiles, and breakdown analysis.
 */

export interface RawLanguageSegment {
  language: string;
  startSeconds: number;
  endSeconds: number;
  text: string;
  confidence: number;
}

/** BCP 47 regex: language code (2-3 chars) optionally followed by region code. */
const BCP47_REGEX = /^[a-z]{2,3}(-[A-Z]{2})?$/;

/** Max languages per profile. */
export const MAX_PROFILE_LANGUAGES = 5;

/** Color palette for language badges on Cool Obsidian backgrounds. */
export const LANGUAGE_COLORS: Record<string, string> = {
  en: '#60A5FA', // blue
  es: '#F97316', // orange
  zh: '#EF4444', // red
  fr: '#818CF8', // indigo
  de: '#FBBF24', // amber
  ja: '#F472B6', // pink
  ko: '#2DD4BF', // teal
  pt: '#34D399', // emerald
  hi: '#A78BFA', // violet
  ar: '#FB923C', // light orange
  it: '#4ADE80', // green
  ru: '#38BDF8', // sky
};

/** Supported languages at launch. */
export const SUPPORTED_LANGUAGES = [
  { code: 'en-US', name: 'English (US)', region: 'Global' },
  { code: 'en-GB', name: 'English (UK)', region: 'Global' },
  { code: 'es-US', name: 'Spanish (US)', region: 'Americas' },
  { code: 'es-ES', name: 'Spanish (Spain)', region: 'Europe' },
  { code: 'es-MX', name: 'Spanish (Mexico)', region: 'Americas' },
  { code: 'zh-CN', name: 'Mandarin (Simplified)', region: 'Asia' },
  { code: 'zh-TW', name: 'Mandarin (Traditional)', region: 'Asia' },
  { code: 'fr-FR', name: 'French (France)', region: 'Europe' },
  { code: 'fr-CA', name: 'French (Canada)', region: 'Americas' },
  { code: 'de-DE', name: 'German', region: 'Europe' },
  { code: 'ja-JP', name: 'Japanese', region: 'Asia' },
  { code: 'ko-KR', name: 'Korean', region: 'Asia' },
  { code: 'pt-BR', name: 'Portuguese (Brazil)', region: 'Americas' },
  { code: 'pt-PT', name: 'Portuguese (Portugal)', region: 'Europe' },
  { code: 'hi-IN', name: 'Hindi', region: 'Asia' },
  { code: 'ar-SA', name: 'Arabic', region: 'Middle East' },
  { code: 'it-IT', name: 'Italian', region: 'Europe' },
  { code: 'ru-RU', name: 'Russian', region: 'Europe' },
] as const;

/**
 * Validate a BCP 47 language code.
 */
export function isValidBcp47(code: string): boolean {
  return BCP47_REGEX.test(code);
}

/**
 * Extract the base language from a BCP 47 code (e.g., "en-US" -> "en").
 */
export function getBaseLanguage(code: string): string {
  return code.split('-')[0].toLowerCase();
}

/**
 * Get the display color for a language code.
 */
export function getLanguageColor(code: string): string {
  const base = getBaseLanguage(code);
  return LANGUAGE_COLORS[base] ?? '#9CA3AF'; // gray fallback
}

/**
 * Merge adjacent segments that share the same language.
 */
export function mergeAdjacentLanguageSegments(
  segments: RawLanguageSegment[],
): RawLanguageSegment[] {
  if (segments.length <= 1) return segments;

  const sorted = [...segments].sort((a, b) => a.startSeconds - b.startSeconds);
  const merged: RawLanguageSegment[] = [];

  for (const seg of sorted) {
    const last = merged[merged.length - 1];

    if (last && getBaseLanguage(last.language) === getBaseLanguage(seg.language)) {
      last.endSeconds = Math.max(last.endSeconds, seg.endSeconds);
      last.text = last.text + ' ' + seg.text;
      last.confidence = Math.min(last.confidence, seg.confidence);
    } else {
      merged.push({ ...seg });
    }
  }

  return merged;
}

/**
 * Calculate language breakdown percentages for a set of segments.
 */
export function calculateLanguageBreakdown(
  segments: RawLanguageSegment[],
): Array<{ language: string; percentage: number; totalSeconds: number }> {
  if (segments.length === 0) return [];

  const totals = new Map<string, number>();
  let grandTotal = 0;

  for (const seg of segments) {
    const duration = seg.endSeconds - seg.startSeconds;
    const base = getBaseLanguage(seg.language);
    totals.set(base, (totals.get(base) ?? 0) + duration);
    grandTotal += duration;
  }

  if (grandTotal === 0) return [];

  return [...totals.entries()]
    .map(([language, totalSeconds]) => ({
      language,
      totalSeconds,
      percentage: Math.round((totalSeconds / grandTotal) * 100),
    }))
    .sort((a, b) => b.percentage - a.percentage);
}

/**
 * Determine if a set of segments represents a multi-language transcription.
 */
export function isMultiLanguage(segments: RawLanguageSegment[]): boolean {
  const languages = new Set(segments.map((s) => getBaseLanguage(s.language)));
  return languages.size > 1;
}

/**
 * Validate a language profile's language list.
 * Returns an error message or null if valid.
 */
export function validateProfileLanguages(languages: string[]): string | null {
  if (languages.length === 0) return 'At least one language is required';
  if (languages.length > MAX_PROFILE_LANGUAGES) {
    return `Maximum ${MAX_PROFILE_LANGUAGES} languages per profile`;
  }
  for (const code of languages) {
    if (!isValidBcp47(code)) {
      return `Invalid language code: ${code}`;
    }
  }
  return null;
}

/**
 * Process raw language detection output into finalized segments.
 */
export function processLanguageDetection(
  rawSegments: RawLanguageSegment[],
): RawLanguageSegment[] {
  if (rawSegments.length === 0) return [];
  return mergeAdjacentLanguageSegments(rawSegments);
}
