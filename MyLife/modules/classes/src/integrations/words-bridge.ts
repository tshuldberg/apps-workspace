/**
 * Words bridge (P9-F): pure helper that lets MyWords offer a "Connect to class"
 * shortcut for language courses. Best-effort language detection from class
 * name/code.
 */

import type { ClassRow } from '../models/schemas';

export interface LanguageCourseLink {
  classId: string;
  className: string;
  languageHint: string | null;
}

const PREFIX_TO_LANGUAGE: Record<string, string> = {
  span: 'spanish',
  fren: 'french',
  germ: 'german',
  ital: 'italian',
  port: 'portuguese',
  russ: 'russian',
  chin: 'chinese',
  japn: 'japanese',
  jpn: 'japanese',
  kor: 'korean',
  arab: 'arabic',
  lat: 'latin',
  grk: 'greek',
  hin: 'hindi',
  heb: 'hebrew',
};

const NAME_KEYWORDS: Record<string, string> = {
  spanish: 'spanish',
  french: 'french',
  german: 'german',
  italian: 'italian',
  portuguese: 'portuguese',
  russian: 'russian',
  mandarin: 'chinese',
  cantonese: 'chinese',
  chinese: 'chinese',
  japanese: 'japanese',
  korean: 'korean',
  arabic: 'arabic',
  latin: 'latin',
  greek: 'greek',
  hindi: 'hindi',
  hebrew: 'hebrew',
};

function detectLanguage(name: string, code: string | null): string | null {
  const lowerName = name.toLowerCase();
  for (const [keyword, lang] of Object.entries(NAME_KEYWORDS)) {
    if (lowerName.includes(keyword)) return lang;
  }
  if (code) {
    const trimmed = code.trim().toLowerCase();
    for (const [prefix, lang] of Object.entries(PREFIX_TO_LANGUAGE)) {
      if (trimmed.startsWith(prefix)) return lang;
    }
  }
  return null;
}

/**
 * Build a MyWords link payload for a class. Returns `languageHint = null` when
 * no language can be inferred from name or code, leaving the consumer free to
 * prompt the user.
 */
export function buildLanguageCourseLink(
  cls: Pick<ClassRow, 'id' | 'name' | 'code'>,
): LanguageCourseLink {
  return {
    classId: cls.id,
    className: cls.name,
    languageHint: detectLanguage(cls.name, cls.code),
  };
}
