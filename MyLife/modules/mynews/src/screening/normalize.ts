/**
 * Text normalization and de-obfuscation for pre-publication screening
 * (plan 48 WP8).
 *
 * Three views of the same text are produced, because evasion lives in the gap
 * between them:
 *   normalized: NFKC, lowercased, whitespace collapsed. What a human reads.
 *   folded:     homoglyphs and leet substitutions mapped to ASCII, runs of a
 *               repeated letter collapsed. Catches "sp4m" and "sloooow".
 *   squeezed:   folded with every non-alphanumeric removed. Catches "s.l.u.r"
 *               and zero-width-separated terms.
 *
 * A term that matches only in `folded` or `squeezed` is an obfuscated match and
 * scores higher than the plain one, because deliberate evasion is aggravating.
 * `squeezed` also destroys word boundaries, so the engine only trusts it for
 * long terms and only when the raw text carries independent evasion evidence
 * (see SQUEEZED_MIN_TERM_CHARS and NormalizedText.evasionEvidence).
 */

import type { ScreeningSignal } from './types';

/**
 * Zero-width and other invisible formatting characters used to split words.
 * Soft hyphen, the zero-width/directional-mark block, word joiner, BOM, and
 * the Mongolian vowel separator.
 */
const INVISIBLE_RE = /[­​-‏⁠﻿᠎]/g;

/** Bidi controls. LRE/RLE/PDF/LRO/RLO and the isolates reorder displayed text. */
const BIDI_RE = /[‪-‮⁦-⁩]/g;

/** Combining marks, used in "zalgo" text to bury terms under diacritics. */
const COMBINING_RE = /[̀-ͯ᪰-᫿᷀-᷿⃐-⃰︠-︯]/g;

const CYRILLIC_RE = /[Ѐ-ӿ]/;
const GREEK_RE = /[Ͱ-Ͽ]/;
const LATIN_RE = /[a-z]/;

/**
 * Homoglyph and leet folding map. Data-driven on purpose: adding a new
 * confusable is a data edit, not a code change. Keys are single characters
 * after NFKC + lowercase.
 */
export const HOMOGLYPH_MAP: Readonly<Record<string, string>> = Object.freeze({
  // Cyrillic lookalikes.
  а: 'a', в: 'b', с: 'c', е: 'e', н: 'h', к: 'k', м: 'm', о: 'o', р: 'p',
  ѕ: 's', т: 't', у: 'y', х: 'x', і: 'i', ј: 'j', ԁ: 'd', ո: 'n',
  // Greek lookalikes.
  α: 'a', β: 'b', ε: 'e', ι: 'i', κ: 'k', ν: 'v', ο: 'o', ρ: 'p', τ: 't',
  υ: 'u', χ: 'x', γ: 'y',
  // Digit and symbol leet.
  '0': 'o', '1': 'l', '3': 'e', '4': 'a', '5': 's', '7': 't', '8': 'b',
  '@': 'a', $: 's', '!': 'i', '|': 'l', '£': 'e', '€': 'e', '¢': 'c',
  // Fullwidth forms survive NFKC, but a few decorative forms do not.
  ᴀ: 'a', ʙ: 'b', ᴄ: 'c', ᴅ: 'd', ᴇ: 'e', ɢ: 'g', ʜ: 'h', ɪ: 'i', ᴊ: 'j',
  ᴋ: 'k', ʟ: 'l', ᴍ: 'm', ɴ: 'n', ᴏ: 'o', ᴘ: 'p', ʀ: 'r', ɱ: 'm', ɑ: 'a', ᴛ: 't',
  ᴜ: 'u', ᴠ: 'v', ᴡ: 'w', ʏ: 'y', ᴢ: 'z',
});

/**
 * Minimum squeezed length before a term may match in the squeezed view.
 * Squeezing removes word boundaries, so short terms would match inside
 * unrelated words ("ass" inside "class ic" once the space is gone).
 */
export const SQUEEZED_MIN_TERM_CHARS = 6;

export interface NormalizedText {
  /** NFKC, lowercased, whitespace-collapsed. */
  normalized: string;
  /** normalized + homoglyph/leet folding + repeat collapsing. */
  folded: string;
  /**
   * folded with SEPARATED RUNS collapsed and nothing else touched: "c.h.i.n.k"
   * and "k i k e" become one word while every other word boundary survives.
   * This is what catches short separated terms, which the boundary-free
   * squeezed view cannot be trusted with.
   */
  deseparated: string;
  /** folded with every non-alphanumeric character removed. */
  squeezed: string;
  /** Count of invisible formatting characters removed. */
  invisibleCount: number;
  /** Count of bidi control characters removed. */
  bidiCount: number;
  /** Count of combining marks removed. */
  combiningCount: number;
  /** Count of characters changed by the homoglyph/leet map. */
  homoglyphCount: number;
  /** Words that mix Latin with Cyrillic or Greek letters. */
  mixedScriptWords: number;
  /** True when the raw text carries independent evidence of evasion. */
  evasionEvidence: boolean;
  /** Whitespace-separated tokens of `normalized`. */
  tokens: readonly string[];
  /** Uppercase letter share of the raw text, 0..1. */
  upperRatio: number;
  /** Character count of the raw text before truncation. */
  rawLength: number;
  /** True when the input exceeded maxScanChars and was truncated. */
  truncated: boolean;
}

function collapseRepeats(text: string): string {
  // Three or more of the same character collapse to two, so "sloooow" and
  // "slooooooow" fold to the same string while "book" is untouched.
  return text.replace(/(.)\1{2,}/g, '$1$1');
}

function foldChars(text: string): { folded: string; changed: number } {
  let changed = 0;
  let out = '';
  for (const char of text) {
    const mapped = HOMOGLYPH_MAP[char];
    if (mapped !== undefined && mapped !== char) {
      changed++;
      out += mapped;
    } else {
      out += char;
    }
  }
  return { folded: out, changed };
}

function countMatches(text: string, re: RegExp): number {
  const matches = text.match(re);
  return matches ? matches.length : 0;
}

function countMixedScriptWords(text: string): number {
  let count = 0;
  for (const word of text.split(/\s+/)) {
    if (word.length < 2) continue;
    const hasLatin = LATIN_RE.test(word);
    if (!hasLatin) continue;
    if (CYRILLIC_RE.test(word) || GREEK_RE.test(word)) count++;
  }
  return count;
}

/**
 * A word broken up by separator characters between single letters, the classic
 * "f.r.e.e m.o.n.e.y" pattern. Two or more letter-separator pairs before the
 * final letter means at least three separated letters, which is already well
 * past accidental punctuation ("U.S." has one pair).
 */
const PUNCT_SEPARATED_RUN_RE = /(?:[a-z0-9][^a-z0-9\s]){2,}[a-z0-9]/g;

/**
 * The same evasion using spaces: "k i k e". Three or more single characters in a
 * row separated by single spaces. Ordinary prose does not do this; letter lists
 * and initials are the rare false positive, and collapsing them only affects the
 * de-separated view, never what a reader sees or what the plain pass matches.
 */
const SPACE_SEPARATED_RUN_RE = /(?:\b[a-z0-9] ){2,}[a-z0-9]\b/g;

function countSeparatedRuns(text: string): number {
  return countMatches(text, PUNCT_SEPARATED_RUN_RE) + countMatches(text, SPACE_SEPARATED_RUN_RE);
}

/**
 * Collapse only the separated runs, leaving every other boundary alone. This is
 * the targeted counterpart to the squeezed view: it recovers short terms like a
 * five-letter slur without letting terms match across unrelated word
 * boundaries.
 */
function deseparateRuns(text: string): string {
  return text
    .replace(PUNCT_SEPARATED_RUN_RE, (run) => run.replace(/[^a-z0-9]/g, ''))
    .replace(SPACE_SEPARATED_RUN_RE, (run) => run.replace(/ /g, ''));
}

/**
 * Warning-context markers. Fraud and spam vocabulary appears in two opposite
 * situations on a news platform: someone running the scam, and someone reporting
 * on it. These phrases only occur in the second. Negated forms ("not a scam")
 * are excluded on purpose, because that is what the first group writes.
 */
export const ADVISORY_MARKERS: readonly string[] = Object.freeze([
  'do not send',
  'do not click',
  'do not reply',
  'never asks',
  'never ask you',
  'will never ask',
  'beware of',
  'be aware of',
  'is a scam',
  'was a scam',
  'this scam',
  'the scam',
  'scam warning',
  'phishing',
  'fraudulent',
  'report it to',
  'reported it to',
  'attorney general',
  'consumer protection',
  'security researchers',
  'security advisory',
  'if you receive',
  'claiming to be from',
  'purporting to be',
  'lost money',
  'lost 400',
  'victims',
]);

const ADVISORY_NEGATION_RE = /(?:not|isn'?t|no)\s+(?:a\s+)?scam/;

// A subset of ADVISORY_MARKERS that a live scam post would not carry, because
// each one self-identifies the text AS a warning and undercuts the pitch. The
// discount (WP12 finding A3) now requires at least one of these in addition to
// the count floor, so appending only generic vocabulary ("beware of phishing")
// to a real scam no longer buys the fraud/spam halving: the attacker would have
// to label their own scam "is a scam" or "report it to the attorney general".
const ADVISORY_STRONG_MARKERS: readonly string[] = Object.freeze([
  'is a scam',
  'was a scam',
  'this scam',
  'the scam',
  'scam warning',
  'report it to',
  'reported it to',
  'attorney general',
  'consumer protection',
  'security researchers',
  'security advisory',
  'lost money',
  'lost 400',
  'victims',
]);

/**
 * How many distinct warning markers the text carries. Two or more is treated as
 * advisory framing; one is not, so a single stray word cannot buy a discount.
 */
export function advisoryMarkerCount(normalized: string): number {
  if (ADVISORY_NEGATION_RE.test(normalized)) return 0;
  // A3: generic warning vocabulary alone cannot buy the discount. A genuine
  // advisory carries at least one self-identifying marker; a scam post
  // appending "beware of phishing" does not.
  if (!ADVISORY_STRONG_MARKERS.some((marker) => normalized.includes(marker))) return 0;
  let count = 0;
  for (const marker of ADVISORY_MARKERS) {
    if (normalized.includes(marker)) count++;
  }
  return count;
}

/**
 * Build the three views plus the structural counters. Pure and deterministic.
 * `maxScanChars` bounds work on hostile input; the caller's field bounds
 * already cap length, so truncation is a defence-in-depth backstop that is
 * reported rather than hidden.
 */
export function normalizeForScreening(raw: string, maxScanChars: number): NormalizedText {
  const rawLength = raw.length;
  const truncated = rawLength > maxScanChars;
  const source = truncated ? raw.slice(0, maxScanChars) : raw;

  const invisibleCount = countMatches(source, INVISIBLE_RE);
  const bidiCount = countMatches(source, BIDI_RE);

  const stripped = source.replace(INVISIBLE_RE, '').replace(BIDI_RE, '');
  const nfkc = stripped.normalize('NFKC');
  const combiningCount = countMatches(nfkc, COMBINING_RE);
  const deaccented = nfkc.replace(COMBINING_RE, '');

  const lowered = deaccented.toLowerCase();
  const normalized = lowered.replace(/\s+/g, ' ').trim();

  const { folded: mapped, changed: homoglyphCount } = foldChars(normalized);
  const folded = collapseRepeats(mapped);
  const deseparated = deseparateRuns(folded);
  const squeezed = folded.replace(/[^a-z0-9]/g, '');

  const mixedScriptWords = countMixedScriptWords(lowered);
  const letterSeparatedRuns = countSeparatedRuns(folded);

  const letters = source.replace(/[^a-zA-Z]/g, '');
  const uppercase = source.replace(/[^A-Z]/g, '');
  const upperRatio = letters.length === 0 ? 0 : uppercase.length / letters.length;

  return {
    normalized,
    folded,
    deseparated,
    squeezed,
    invisibleCount,
    bidiCount,
    combiningCount,
    homoglyphCount,
    mixedScriptWords,
    evasionEvidence:
      invisibleCount > 0 ||
      bidiCount > 0 ||
      combiningCount > 2 ||
      mixedScriptWords > 0 ||
      letterSeparatedRuns > 0,
    tokens: normalized === '' ? [] : normalized.split(' '),
    upperRatio,
    rawLength,
    truncated,
  };
}

/** Highest single-token frequency share of the text, 0..1. */
export function topTokenShare(tokens: readonly string[]): number {
  if (tokens.length === 0) return 0;
  const counts = new Map<string, number>();
  for (const token of tokens) counts.set(token, (counts.get(token) ?? 0) + 1);
  let top = 0;
  for (const count of counts.values()) if (count > top) top = count;
  return top / tokens.length;
}

/**
 * Structure anomaly signals. These are spam evidence in their own right and,
 * separately, the evidence that justifies trusting the de-obfuscated views.
 * Weights are deliberately small: structure alone should rarely quarantine.
 */
export function structureSignals(text: NormalizedText): ScreeningSignal[] {
  const signals: ScreeningSignal[] = [];

  if (text.invisibleCount > 0) {
    signals.push({
      signalClass: 'structure',
      code: 'structure.invisible-characters',
      weight: Math.min(0.3, 0.1 + 0.02 * text.invisibleCount),
      explain: `Contains ${text.invisibleCount} invisible formatting characters, which are commonly used to split words and evade filters.`,
    });
  }

  if (text.bidiCount > 0) {
    signals.push({
      signalClass: 'structure',
      code: 'structure.bidi-override',
      weight: 0.3,
      explain: `Contains ${text.bidiCount} bidirectional override characters, which can make displayed text differ from stored text.`,
    });
  }

  if (text.combiningCount > 20) {
    signals.push({
      signalClass: 'structure',
      code: 'structure.combining-mark-flood',
      weight: 0.2,
      explain: `Contains ${text.combiningCount} combining marks, far more than normal accented text.`,
    });
  }

  if (text.mixedScriptWords > 0) {
    signals.push({
      signalClass: 'structure',
      code: 'structure.mixed-script-words',
      weight: Math.min(0.3, 0.08 * text.mixedScriptWords),
      explain: `${text.mixedScriptWords} words mix Latin letters with Cyrillic or Greek lookalikes.`,
    });
  }

  if (text.tokens.length >= 20) {
    const share = topTokenShare(text.tokens);
    if (share >= 0.35) {
      signals.push({
        signalClass: 'structure',
        code: 'structure.word-repetition',
        weight: Math.min(0.4, share),
        explain: `One word makes up ${Math.round(share * 100)} percent of the text.`,
      });
    }
  }

  if (text.rawLength >= 40 && text.upperRatio >= 0.7) {
    signals.push({
      signalClass: 'structure',
      code: 'structure.all-caps',
      weight: 0.15,
      explain: `${Math.round(text.upperRatio * 100)} percent of the letters are uppercase.`,
    });
  }

  if (text.truncated) {
    signals.push({
      signalClass: 'structure',
      code: 'structure.scan-truncated',
      weight: 0.05,
      explain: `Only the first ${text.normalized.length} normalized characters were scanned; the submission is longer than the scan ceiling.`,
    });
  }

  return signals;
}
