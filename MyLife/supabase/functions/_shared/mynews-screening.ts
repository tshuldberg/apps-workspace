// GENERATED FILE. Do not edit.
//
// Deno twin of the MyNews screening engine in
// modules/mynews/src/screening/, produced by
// scripts/gen-mynews-screening-twin.mjs. The edge functions cannot import from
// modules/, so the engine is inlined here as one scope: same source, same
// scoring, same lexicons, no hand-copied drift.
//
// Regenerate with:  node scripts/gen-mynews-screening-twin.mjs
// The byte-for-byte check lives in
// modules/mynews/src/screening/__tests__/edge-twin.test.ts.

// ==================== screening/types.ts ====================

/**
 * Pre-publication screening contract (plan 48 WP8, findings H01/H02).
 *
 * The engine is a pure function of its input plus an explicit config: no
 * clocks, no randomness, no I/O. The only "seeded" part is the shingle
 * signature used for near-duplicate flood detection, and its seed is a config
 * value so two runs over the same bytes always produce the same verdict.
 *
 * Layering: normalize -> per-class lexicon passes -> URL reputation ->
 * structure anomalies -> per-class scores -> per-class thresholds -> decision.
 * Every contributing signal carries a stable machine code and a human explain
 * string, so a moderator sees WHY something was held and an author gets an
 * honest reason.
 */

/** Risk classes. Twin: the reason taxonomy in data/report.ts and the SQL rank. */
export const SCREENING_CLASSES = [
  'child-safety',
  'self-harm',
  'threats',
  'hate',
  'doxxing-privacy',
  'fraud-scam',
  'spam',
] as const;
export type ScreeningClass = (typeof SCREENING_CLASSES)[number];

/** Content shapes the edges screen. */
export const SCREENING_CONTENT_KINDS = [
  'article',
  'revision',
  'suggestion',
  'comment',
] as const;
export type ScreeningContentKind = (typeof SCREENING_CONTENT_KINDS)[number];

/**
 * A signal's origin class. 'structure' signals are not a risk class of their
 * own: they feed spam and act as an evasion aggravator on the risk classes.
 */
export type ScreeningSignalClass = ScreeningClass | 'structure';

export interface ScreeningSignal {
  signalClass: ScreeningSignalClass;
  /** Stable machine code, safe to persist and aggregate on. */
  code: string;
  /** Contribution to the class score, 0..1. */
  weight: number;
  /** Human sentence for the console and, where safe, the author. */
  explain: string;
  /**
   * True when the match only appeared after de-obfuscation (invisible
   * characters, homoglyphs, letter separators). Evasion is aggravating.
   */
  obfuscated?: boolean;
}

/**
 * Verdict decisions:
 * - `allow`: publishable. `recorded` marks a below-threshold flag worth
 *   persisting for false-negative measurement.
 * - `quarantine`: content is stored non-public and awaits human review.
 * - `human-review`: quarantine PLUS a hard rule that nothing automated may
 *   clear it. child-safety and self-harm always land here.
 */
export type ScreeningDecision = 'allow' | 'quarantine' | 'human-review';

export interface ScreeningVerdict {
  engineVersion: string;
  /** 'local', or 'local+<vendor>' when an external provider also ran. */
  provider: string;
  decision: ScreeningDecision;
  /** Highest class score, 0..1. */
  score: number;
  classScores: Readonly<Record<ScreeningClass, number>>;
  topClass: ScreeningClass | null;
  /** Machine description of the threshold that fired, e.g. 'hate>=0.55'. */
  thresholdHit: string | null;
  /** True when no automated path may clear this verdict. */
  requiresHumanReview: boolean;
  /** True when the verdict should be persisted even though it is an allow. */
  recorded: boolean;
  signals: readonly ScreeningSignal[];
  explanations: readonly string[];
  /** Shingle signature of the screened text, for flood detection on later posts. */
  signature: ScreeningSignature;
}

/** Serializable near-duplicate signature. Stored alongside the decision row. */
export interface ScreeningSignature {
  version: number;
  seed: number;
  /** Minhash slots. Fixed length per version so comparison is slot-wise. */
  slots: readonly number[];
}

export interface ScreeningInput {
  kind: ScreeningContentKind;
  /** Primary prose: article body, comment body, or a suggestion's added text. */
  text: string;
  /** Short secondary prose: headline, dek, or rationale. Screened identically. */
  title?: string;
  /** Author-declared links (citations). Screened on top of links found in text. */
  links?: readonly string[];
  /** Signatures of this author's recent content, for flood detection. */
  recentSignatures?: readonly ScreeningSignature[];
}

/** Per-class threshold and escalation policy. */
export interface ClassPolicy {
  /** Class score at or above which content is quarantined. */
  quarantineAt: number;
  /**
   * True when a hit in this class must be dispositioned by a human and can
   * never be auto-cleared, by this engine or by an external vendor.
   */
  humanOnly: boolean;
}

/**
 * Thresholds are per class because the classes are not comparable: an
 * unambiguous child-safety indicator must hold content at a much lower score
 * than the amount of promotional noise it takes to call something spam.
 * Child-safety and self-harm are humanOnly: automation may only ever route
 * them to a person.
 */
export const CLASS_POLICY: Readonly<Record<ScreeningClass, ClassPolicy>> = Object.freeze({
  'child-safety': { quarantineAt: 0.25, humanOnly: true },
  'self-harm': { quarantineAt: 0.4, humanOnly: true },
  threats: { quarantineAt: 0.55, humanOnly: false },
  hate: { quarantineAt: 0.55, humanOnly: false },
  'doxxing-privacy': { quarantineAt: 0.6, humanOnly: false },
  'fraud-scam': { quarantineAt: 0.65, humanOnly: false },
  spam: { quarantineAt: 0.75, humanOnly: false },
});

/**
 * Below-threshold score at which an allow is still written to
 * nw_screening_decisions. Without this row a false negative is invisible, so
 * the false-positive/false-negative measurement would only ever see holds.
 */
export const SCREENING_RECORD_THRESHOLD = 0.35;

/**
 * Evasion multiplier applied to the strongest risk class when the text carries
 * de-obfuscation evidence (invisible characters, bidi overrides, homoglyphs,
 * letter separators) AND a lexicon term only matched after folding. Obfuscated
 * abuse is more deliberate than plain abuse, not less.
 */
export const EVASION_MULTIPLIER = 1.3;

/**
 * Warning markers required before advisory framing is credited. One stray word
 * buys nothing; two independent warning constructions are what a scam warning
 * actually looks like.
 */
export const ADVISORY_MARKER_FLOOR = 2;

/**
 * Multiplier applied to fraud-scam and spam under advisory framing. Only those
 * two: there is no reporting context in which a child-safety, self-harm, threat,
 * hate, or doxxing indicator should publish without a person looking at it.
 */
export const ADVISORY_MITIGATION = 0.5;

export interface ScreeningConfig {
  /** Seed for the shingle signature. Config, never random. */
  signatureSeed: number;
  /** Word shingle width for the signature. */
  shingleWidth: number;
  /** Minhash slot count. */
  signatureSlots: number;
  /** Similarity at or above which two signatures count as the same content. */
  floodSimilarity: number;
  /** Matching recent signatures needed before flooding is a signal. */
  floodMinMatches: number;
  /** Per-class thresholds. Overridable so ops can tighten without a code change. */
  classPolicy: Readonly<Record<ScreeningClass, ClassPolicy>>;
  /** Score at or above which an allow is still recorded. */
  recordThreshold: number;
  /** Hard ceiling on characters scanned per field. Inputs are already bounded. */
  maxScanChars: number;
}

export const DEFAULT_SCREENING_CONFIG: ScreeningConfig = Object.freeze({
  signatureSeed: 0x5eed_1234,
  shingleWidth: 5,
  signatureSlots: 32,
  floodSimilarity: 0.9,
  floodMinMatches: 2,
  classPolicy: CLASS_POLICY,
  recordThreshold: SCREENING_RECORD_THRESHOLD,
  maxScanChars: 400_000,
});

/** Version stamp persisted with every decision row. Bump on any scoring change. */
export const SCREENING_ENGINE_VERSION = '2026-07-30.1';

export const SCREENING_SIGNATURE_VERSION = 1;

/** Zeroed class score map. */
export function emptyClassScores(): Record<ScreeningClass, number> {
  return {
    'child-safety': 0,
    'self-harm': 0,
    threats: 0,
    hate: 0,
    'doxxing-privacy': 0,
    'fraud-scam': 0,
    spam: 0,
  };
}

/** True when the verdict holds content back from publication. */
export function isQuarantined(verdict: ScreeningVerdict): boolean {
  return verdict.decision === 'quarantine' || verdict.decision === 'human-review';
}

// ==================== screening/normalize.ts ====================

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

// ==================== screening/lexicons.ts ====================

/**
 * Screening lexicons (plan 48 WP8). Data, not code: every class is a list of
 * entries, and expanding coverage is a data edit that needs no engine change.
 *
 * Two entry shapes:
 *   terms         any listed term or pattern firing is evidence on its own.
 *   cooccurrence  evidence only when BOTH groups fire, for classes where a
 *                 single word is meaningless in isolation. A minor-age word is
 *                 not a signal; a minor-age word next to sexual solicitation
 *                 is. Same for a phone number versus a phone number attached
 *                 to "everyone go visit him".
 *
 * A small number of hate-class terms are stored base64 so this source file is
 * not itself a readable slur list. `encoded: true` marks them; the compiler
 * decodes once at module load. This is presentation only: the decoded terms are
 * matched exactly like the plaintext ones.
 *
 * Operational note: this is a starting corpus sized for correctness of the
 * mechanism, and `ScreeningConfig` carries no lexicon override on purpose so
 * additions land here, reviewed, with a fixture. Lexicon expansion is a
 * standing moderation-ops task, not a code-shape change.
 */


export interface LexiconTermEntry {
  type: 'terms';
  code: string;
  weight: number;
  explain: string;
  /** Lowercase phrases, matched on word boundaries. */
  terms: readonly string[];
  /** Raw regex sources, matched against the normalized and folded views. */
  patterns?: readonly string[];
  /** True when `terms` are base64-encoded in this file. */
  encoded?: boolean;
}

export interface LexiconCooccurrenceEntry {
  type: 'cooccurrence';
  code: string;
  weight: number;
  explain: string;
  groupA: readonly string[];
  groupB: readonly string[];
  patternsA?: readonly string[];
  patternsB?: readonly string[];
  encodedA?: boolean;
  encodedB?: boolean;
}

export type LexiconEntry = LexiconTermEntry | LexiconCooccurrenceEntry;

/**
 * base64 of the encoded entries below, decoded at compile time. Node, Deno,
 * Hermes, and browsers all provide atob; Buffer is used when it does not exist.
 */
export function decodeTerm(encoded: string): string {
  if (typeof atob === 'function') return atob(encoded);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const nodeBuffer = (globalThis as any).Buffer;
  if (nodeBuffer) return nodeBuffer.from(encoded, 'base64').toString('utf8');
  throw new Error('mynews screening: no base64 decoder available');
}

const SPAM: readonly LexiconEntry[] = [
  {
    type: 'terms',
    code: 'spam.promotional-pitch',
    weight: 0.25,
    explain: 'Uses common bulk-promotional phrasing.',
    terms: [
      'buy now',
      'act now',
      'limited time offer',
      'click here now',
      'order today',
      'best prices',
      'cheap price',
      'discount code',
      'promo code',
      'special promotion',
      'free trial',
      'risk free',
      'no obligation',
      'satisfaction guaranteed',
      'money back guarantee',
      'call now',
      'subscribe now',
      'visit my website',
      'check out my profile',
      'dm me for',
      'whatsapp me',
      'telegram me',
    ],
  },
  {
    type: 'terms',
    code: 'spam.earnings-claim',
    weight: 0.35,
    explain: 'Makes an unsolicited earnings or income claim.',
    terms: [
      'work from home',
      'make money fast',
      'earn money online',
      'passive income',
      'financial freedom',
      'be your own boss',
      'extra cash',
      'get rich',
      'double your money',
    ],
    patterns: [
      // "earn $500 a day", "make 2000 usd per week"
      '(?:earn|make|makes|making)\\s+(?:up to\\s+)?[$€£]?\\s?\\d{2,6}(?:[.,]\\d{3})*\\s*(?:usd|eur|gbp|dollars?|euros?)?\\s*(?:a|per|each|every)\\s*(?:day|week|month|hour)',
    ],
  },
  {
    type: 'terms',
    code: 'spam.seo-boilerplate',
    weight: 0.3,
    explain: 'Contains link-farm and SEO boilerplate phrasing.',
    terms: [
      'guest post',
      'backlinks',
      'seo services',
      'increase your traffic',
      'rank higher on google',
      'buy followers',
      'boost your followers',
      'cheap essay',
      'write my essay',
      'homework help service',
    ],
  },
  {
    type: 'terms',
    code: 'spam.adult-solicitation',
    weight: 0.35,
    explain: 'Solicits paid adult content or contact.',
    terms: [
      'onlyfans',
      'camgirl',
      'live cams',
      'hot singles',
      'sexy singles in your area',
      'adult dating site',
      'escort service',
    ],
  },
];

const FRAUD_SCAM: readonly LexiconEntry[] = [
  {
    type: 'terms',
    code: 'fraud.credential-harvest',
    weight: 0.7,
    explain: 'Asks for wallet recovery phrases, private keys, or account credentials.',
    terms: [
      'seed phrase',
      'recovery phrase',
      'private key',
      'wallet passphrase',
      'send your password',
      'verify your password',
      'confirm your password',
      'enter your credentials',
      'your account will be suspended',
      'unusual sign in activity',
      'verify your identity to unlock',
      'two factor code',
      'send the code you received',
      'one time code',
    ],
  },
  {
    type: 'terms',
    code: 'fraud.advance-fee',
    weight: 0.6,
    explain: 'Advance-fee and inheritance-scam phrasing.',
    terms: [
      'unclaimed inheritance',
      'next of kin',
      'transfer of funds',
      'processing fee required',
      'release your funds',
      'nigerian prince',
      'lottery winner notification',
      'you have won',
      'claim your prize',
      'wire transfer immediately',
      'western union payment',
      'gift card payment',
      'pay with gift cards',
      'bitcoin payment only',
    ],
  },
  {
    type: 'terms',
    code: 'fraud.investment-guarantee',
    weight: 0.5,
    explain: 'Guarantees investment returns, which no legitimate offer does.',
    terms: [
      'guaranteed returns',
      'guaranteed profit',
      'risk free investment',
      'double your bitcoin',
      'crypto giveaway',
      'airdrop claim',
      'send 1 eth receive',
      'signal group profits',
      'binary options',
      'forex signals',
      'pump and dump',
      'insider tip',
    ],
    patterns: [
      // "500% returns", "10x guaranteed"
      '\\d{2,4}\\s?%\\s?(?:roi|returns?|profits?|gains?)',
      '\\d{1,3}\\s?x\\s?(?:guaranteed|returns?|profits?)',
    ],
  },
  {
    type: 'terms',
    code: 'fraud.impersonated-support',
    weight: 0.5,
    explain: 'Impersonates a support or security team to create urgency.',
    terms: [
      'official support team',
      'account security team',
      'contact our support agent',
      'live support agent whatsapp',
      'recovery expert',
      'recover your lost funds',
      'refund department',
    ],
  },
];

const HATE: readonly LexiconEntry[] = [
  {
    type: 'terms',
    code: 'hate.slur',
    weight: 0.65,
    explain: 'Contains a term used as an ethnic, racial, religious, or anti-LGBTQ slur.',
    encoded: true,
    terms: [
      // Stored base64 so this file is not a readable slur list. The decoded
      // strings are ordinary lowercase terms matched on word boundaries.
      'a2lrZQ==',
      'c3Bpaw==',
      'Y2hpbms=',
      'Z29vaw==',
      'd2V0YmFjaw==',
      'YmVhbmVy',
      'Y29vbg==',
      'ZmFnZ290',
      'dHJhbm55',
      'cmFnaGVhZA==',
      'c2hlbWFsZQ==',
      'aGFsZiBicmVlZA==',
    ],
  },
  {
    type: 'terms',
    code: 'hate.slur-contested',
    weight: 0.4,
    explain:
      'Contains a term that is a slur in most uses but is also reclaimed by some communities and routinely quoted in reporting. Scored lower so a news report about the word is not treated like an attack.',
    encoded: true,
    terms: [
      'ZHlrZQ==',
      'Z3lwc3k=',
      'cmV0YXJk',
      'cmV0YXJkZWQ=',
      'cXVlZXI=',
    ],
  },
  {
    type: 'cooccurrence',
    code: 'hate.dehumanizing-generalization',
    weight: 0.6,
    explain:
      'Applies a dehumanizing predicate to a protected group rather than to an individual or an argument.',
    groupA: [
      'muslims',
      'jews',
      'christians',
      'hindus',
      'immigrants',
      'migrants',
      'refugees',
      'blacks',
      'asians',
      'arabs',
      'latinos',
      'mexicans',
      'gays',
      'lesbians',
      'trans people',
      'transgender people',
      'women',
      'men',
      'disabled people',
    ],
    groupB: [
      'are vermin',
      'are animals',
      'are subhuman',
      'are parasites',
      'are a disease',
      'are cockroaches',
      'should be exterminated',
      'should be wiped out',
      'do not deserve to live',
      'need to be removed',
      'are all criminals',
      'are all rapists',
      'should be deported',
      'should be banned from existing',
    ],
  },
  {
    type: 'terms',
    code: 'hate.extremist-endorsement',
    weight: 0.5,
    explain: 'Endorses genocidal or extremist violence.',
    terms: [
      'gas the',
      'heil hitler',
      'white power',
      'race war now',
      'ethnic cleansing is',
      'day of the rope',
      'the great replacement',
      'blood and soil',
    ],
  },
];

const THREATS: readonly LexiconEntry[] = [
  {
    type: 'terms',
    code: 'threats.explicit-violence',
    weight: 0.65,
    explain: 'Contains an explicit statement of intent to harm a person.',
    terms: [
      'i will kill you',
      'i am going to kill you',
      'i will find you and',
      'i will hurt you',
      'i will beat you',
      'you are a dead man',
      'you will not survive',
      'i know where you live',
      'i know where you sleep',
      'watch your back',
      'i will burn your house',
      'i hope you get shot',
      'someone should shoot',
      'you deserve to be beaten',
    ],
    patterns: [
      'i (?:will|am going to|gonna) (?:kill|shoot|stab|strangle|beat|rape|hurt|maim) (?:you|him|her|them|your)',
    ],
  },
  {
    type: 'cooccurrence',
    code: 'threats.targeted-incitement',
    weight: 0.6,
    explain: 'Incites others to violence against a named target.',
    groupA: [
      'go get him',
      'go get her',
      'go get them',
      'lets pay him a visit',
      'lets pay her a visit',
      'someone needs to teach',
      'handle this yourself',
      'do something about him',
      'do something about her',
    ],
    groupB: [
      'with a bat',
      'with a gun',
      'with a knife',
      'break his legs',
      'break her legs',
      'make him bleed',
      'make her bleed',
      'burn it down',
      'end him',
      'end her',
    ],
  },
  {
    type: 'terms',
    code: 'threats.mass-violence',
    weight: 0.7,
    explain: 'References planning or celebrating mass violence.',
    terms: [
      'shoot up the school',
      'shoot up the office',
      'bomb the building',
      'plant a bomb',
      'blow up the',
      'body count will be',
      'my manifesto',
    ],
  },
];

const SELF_HARM: readonly LexiconEntry[] = [
  {
    type: 'terms',
    code: 'self-harm.encouragement',
    weight: 0.6,
    explain: 'Encourages another person to end their life or harm themselves.',
    terms: [
      'kill yourself',
      'kys',
      'go die',
      'you should end it',
      'end your life',
      'nobody would miss you',
      'do the world a favor and die',
      'hang yourself',
      'drink bleach',
      'slit your wrists',
    ],
  },
  {
    type: 'terms',
    code: 'self-harm.method-instruction',
    weight: 0.6,
    explain: 'Describes methods or dosages for suicide or self-injury.',
    terms: [
      'painless way to die',
      'how much to overdose',
      'lethal dose of',
      'best way to kill myself',
      'how to hang myself',
      'exit bag',
      'suicide method',
      'pro ana',
      'thinspo',
      'how to hide cutting',
    ],
  },
  {
    type: 'terms',
    code: 'self-harm.first-person-crisis',
    weight: 0.45,
    explain:
      'Reads as a first-person crisis disclosure. Routed to a person so support resources can be offered rather than an automated refusal.',
    terms: [
      'i want to kill myself',
      'i am going to kill myself',
      'i want to die',
      'i am going to end it tonight',
      'i have a plan to die',
      'i cannot go on anymore',
      'goodbye cruel world',
      'this is my last post',
    ],
  },
];

const DOXXING_PRIVACY: readonly LexiconEntry[] = [
  {
    type: 'cooccurrence',
    code: 'doxxing.personal-details-with-targeting',
    weight: 0.65,
    explain:
      'Publishes personal contact or location details alongside phrasing that directs attention at that person.',
    groupA: [
      'here is his address',
      'here is her address',
      'here is their address',
      'his home address',
      'her home address',
      'their home address',
      'his phone number',
      'her phone number',
      'his real name is',
      'her real name is',
      'he works at',
      'she works at',
      'his employer is',
      'her employer is',
      'his kids go to',
      'her kids go to',
    ],
    patternsA: [
      // US-style street address, generic street suffixes.
      '\\b\\d{1,5}\\s+(?:[a-z]+\\s){1,3}(?:street|st|avenue|ave|road|rd|drive|dr|lane|ln|boulevard|blvd|court|ct|way)\\b',
      // Phone-shaped runs, international and US forms.
      '\\+?\\d{1,3}[\\s.-]?\\(?\\d{3}\\)?[\\s.-]?\\d{3}[\\s.-]?\\d{4}\\b',
    ],
    groupB: [
      'go say hi',
      'pay him a visit',
      'pay her a visit',
      'let him know what you think',
      'let her know what you think',
      'everyone should call',
      'everyone should email',
      'flood his inbox',
      'flood her inbox',
      'you know what to do',
      'do not let him sleep',
      'do not let her sleep',
    ],
  },
  {
    type: 'terms',
    code: 'doxxing.sensitive-identifier',
    weight: 0.6,
    explain: 'Contains what looks like a government or financial identifier for a private person.',
    terms: ['social security number', 'passport number', 'drivers license number', 'bank account number'],
    patterns: [
      // SSN shape, not validated: presence of the shape is the signal.
      '\\b\\d{3}-\\d{2}-\\d{4}\\b',
      // 13-19 digit card-shaped run.
      '\\b(?:\\d[ -]?){13,19}\\b',
    ],
  },
  {
    type: 'terms',
    code: 'doxxing.intimate-media-threat',
    weight: 0.65,
    explain: 'Threatens to publish intimate images of a person.',
    terms: [
      'i will leak your nudes',
      'i will post your nudes',
      'send nudes or i will',
      'revenge porn',
      'i have your nudes',
    ],
  },
];

const CHILD_SAFETY: readonly LexiconEntry[] = [
  {
    type: 'cooccurrence',
    code: 'child-safety.minor-sexualization',
    weight: 0.5,
    explain:
      'A minor-age reference appears together with sexual or solicitation language. Held for human review; never auto-cleared and never auto-reported.',
    groupA: [
      'preteen',
      'pre teen',
      'underage',
      'under age',
      'minor girl',
      'minor boy',
      'little girl',
      'little boy',
      'middle schooler',
      'elementary schooler',
      'my daughter is',
      'my son is',
    ],
    patternsA: ['\\b(?:0?[3-9]|1[0-7])\\s?(?:yo|y o|yr|yrs|year old|years old)\\b'],
    groupB: [
      'nudes',
      'naked',
      'sexy',
      'sexual',
      'send pics',
      'send pictures',
      'dm me',
      'private chat',
      'meet up alone',
      'do not tell your parents',
      'keep this between us',
      'our little secret',
      'looking for young',
    ],
  },
  {
    type: 'terms',
    code: 'child-safety.exploitation-market',
    weight: 0.6,
    explain:
      'Uses trade vocabulary associated with child sexual abuse material. Held for human review; escalation to NCMEC is an operator decision, never automatic.',
    encoded: true,
    terms: [
      'Y3NhbQ==',
      'Y3AgdHJhZGU=',
      'bG9saQ==',
      'c2hvdGE=',
      'aGVicGhpbGU=',
      'anMgbW9kZWxz',
      'cGl6emEgdHJhZGU=',
      'Y2hpbGQgbW9kZWwgbnVkZQ==',
      'anVpY3kgamFpbGJhaXQ=',
      'amFpbGJhaXQ=',
    ],
  },
  {
    type: 'cooccurrence',
    code: 'child-safety.grooming-pattern',
    weight: 0.45,
    explain:
      'Reads as grooming: age-gap framing plus secrecy or isolation instructions. Held for human review.',
    groupA: [
      'how old are you',
      'are your parents home',
      'are you home alone',
      'do you have a boyfriend',
      'do you have a girlfriend',
      'you seem mature for your age',
    ],
    groupB: [
      'do not tell anyone',
      'do not tell your parents',
      'delete these messages',
      'move to another app',
      'switch to telegram',
      'switch to signal',
      'send me a picture of you',
      'turn on your camera',
      'i can buy you',
    ],
  },
];

export const LEXICONS: Readonly<Record<ScreeningClass, readonly LexiconEntry[]>> = Object.freeze({
  'child-safety': CHILD_SAFETY,
  'self-harm': SELF_HARM,
  threats: THREATS,
  hate: HATE,
  'doxxing-privacy': DOXXING_PRIVACY,
  'fraud-scam': FRAUD_SCAM,
  spam: SPAM,
});

// ==================== screening/matcher.ts ====================

/**
 * Lexicon compilation and matching (plan 48 WP8).
 *
 * Compilation happens once at module load: terms are decoded (when stored
 * base64), escaped, and turned into boundary-anchored regexes; declared regex
 * patterns are compiled as written. Matching then runs over the three
 * normalization views in escalating order and stops at the first view that
 * hits, so an entry contributes at most once per field.
 *
 * Two mitigations keep the false-positive rate honest on a journalism product:
 *   quoted context   a term inside quotation marks, or immediately after a
 *                    reporting verb, is very often the story rather than the
 *                    attack. Its weight is halved.
 *   squeezed floor   the boundary-free squeezed view is only consulted for long
 *                    terms and only when the text carries evasion evidence.
 */


/** Weight multiplier applied when a match sits in a quotation or attribution. */
export const QUOTED_CONTEXT_MULTIPLIER = 0.5;

/** Extra weight multiplier applied when a match only survives de-obfuscation. */
export const OBFUSCATED_MATCH_MULTIPLIER = 1.15;

function escapeRegex(literal: string): string {
  return literal.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Word-boundary matcher for a literal phrase. `\b` is wrong here: many terms
 * end in punctuation-adjacent positions and the normalized view has collapsed
 * whitespace, so an explicit "not alphanumeric" guard is used on both sides.
 *
 * Elongation-tolerant (WP12 finding A1): every character is compiled as
 * one-or-more (`k+i+l+l+`). collapseRepeats only folds runs of three or more to
 * two, so a SINGLE doubled letter ("kkill", "sschool") survived normalization as
 * a fixed point and evaded the exact literal, flipping quarantine to allow with
 * one legible character. Elongation tolerance requires at least the original
 * letters, so "ass" compiles to `a+s+s+` and can never match "as": it catches
 * added letters without inventing matches for dropped ones.
 */
function literalRegex(term: string): RegExp {
  const body = [...term]
    .map((char) => (char === ' ' ? ' ' : `${escapeRegex(char)}+`))
    .join('');
  return new RegExp(`(?:^|[^a-z0-9])${body}(?:[^a-z0-9]|$)`);
}

interface CompiledGroup {
  /** Boundary-anchored literal regexes over the normalized/folded views. */
  literals: readonly RegExp[];
  /** Squeezed forms of terms long enough to be safe without boundaries. */
  squeezed: readonly string[];
  /** Declared regex patterns, compiled as written. */
  patterns: readonly RegExp[];
}

export interface CompiledEntry {
  signalClass: ScreeningClass;
  code: string;
  weight: number;
  explain: string;
  kind: 'terms' | 'cooccurrence';
  primary: CompiledGroup;
  /** Present only for cooccurrence entries. */
  secondary?: CompiledGroup;
}

function compileGroup(
  terms: readonly string[],
  patterns: readonly string[] | undefined,
  encoded: boolean | undefined,
): CompiledGroup {
  const decoded = encoded ? terms.map(decodeTerm) : terms.slice();
  const squeezed = decoded
    .map((term) => term.replace(/[^a-z0-9]/g, ''))
    .filter((term) => term.length >= SQUEEZED_MIN_TERM_CHARS);
  return {
    literals: decoded.map(literalRegex),
    squeezed,
    patterns: (patterns ?? []).map((source) => new RegExp(source)),
  };
}

function compileEntry(signalClass: ScreeningClass, entry: LexiconEntry): CompiledEntry {
  if (entry.type === 'terms') {
    return {
      signalClass,
      code: entry.code,
      weight: entry.weight,
      explain: entry.explain,
      kind: 'terms',
      primary: compileGroup(entry.terms, entry.patterns, entry.encoded),
    };
  }
  return {
    signalClass,
    code: entry.code,
    weight: entry.weight,
    explain: entry.explain,
    kind: 'cooccurrence',
    primary: compileGroup(entry.groupA, entry.patternsA, entry.encodedA),
    secondary: compileGroup(entry.groupB, entry.patternsB, entry.encodedB),
  };
}

/** Compiled once per process. Lexicons are frozen data, so this is safe. */
export const COMPILED_LEXICONS: readonly CompiledEntry[] = Object.freeze(
  (Object.keys(LEXICONS) as ScreeningClass[]).flatMap((signalClass) =>
    LEXICONS[signalClass].map((entry) => compileEntry(signalClass, entry)),
  ),
);

type MatchView = 'normalized' | 'folded' | 'deseparated' | 'squeezed';

interface GroupMatch {
  view: MatchView;
  /** Index of the match in the matched view, for quoted-context checks. */
  index: number;
  /** The matched source: a term literal, a squeezed term, or a pattern source. */
  source: string;
}

function firstIn(view: string, group: CompiledGroup, viewName: MatchView): GroupMatch | null {
  for (const literal of group.literals) {
    const match = literal.exec(view);
    if (match) return { view: viewName, index: match.index, source: literal.source };
  }
  for (const pattern of group.patterns) {
    const match = pattern.exec(view);
    if (match) return { view: viewName, index: match.index, source: pattern.source };
  }
  return null;
}

function firstSqueezed(view: string, group: CompiledGroup): GroupMatch | null {
  for (const term of group.squeezed) {
    const index = view.indexOf(term);
    if (index >= 0) return { view: 'squeezed', index, source: term };
  }
  return null;
}

/**
 * First match for a group across the escalating views. The last two views are
 * gated on evasion evidence, because both of them relax boundaries:
 * `deseparated` only where a separated run was detected (safe for short terms),
 * `squeezed` everywhere (so it is restricted to long terms as well).
 */
function matchGroup(text: NormalizedText, group: CompiledGroup): GroupMatch | null {
  const plain = firstIn(text.normalized, group, 'normalized');
  if (plain) return plain;
  const folded = firstIn(text.folded, group, 'folded');
  if (folded) return folded;
  if (!text.evasionEvidence) return null;
  if (text.deseparated !== text.folded) {
    const deseparated = firstIn(text.deseparated, group, 'deseparated');
    if (deseparated) return deseparated;
  }
  return firstSqueezed(text.squeezed, group);
}

const REPORTING_ATTRIBUTION_RE =
  /(?:called (?:him|her|them|me|us|it)|used the (?:word|term|slur)|the (?:word|term|slur)|referred to (?:him|her|them|us) as|described as|allegedly said|reportedly said|wrote that|posted that|quoted as saying|according to the (?:complaint|filing|transcript|indictment))\s*[:,-]?\s*["“']?$/;

/**
 * How far from a match a quotation delimiter may sit and still count. A real
 * pull-quote is a sentence or two; this bounds it so no single delimiter can
 * re-classify the rest of a document.
 */
const QUOTED_WINDOW = 160;

/**
 * True when the match sits inside a BOUNDED, CLOSED quotation, or directly after
 * a reporting attribution. Journalism quotes the words it reports on; the engine
 * must not treat coverage of abuse as abuse.
 *
 * WP12 finding A2 (two rounds): the original counted quote parity from the start
 * of the whole field, so a single unmatched delimiter re-classified every later
 * match as quoted. Round one narrowed the character class (killing the accidental
 * apostrophe trigger); this closes the deliberate one. Odd-parity-from-start is
 * the wrong predicate: a lone leading `"`, or wrapping the entire submission in
 * one pair, bought the 0.5 discount for one character. Credit a quotation only
 * when an opening delimiter sits within QUOTED_WINDOW chars BEFORE the match AND
 * a closing one within QUOTED_WINDOW AFTER it. A lone leading quote has no close
 * after; a whole-document wrap has its delimiters too far from a mid-document
 * match; a genuine short quote has both nearby.
 */
export function isQuotedContext(view: string, index: number): boolean {
  const before = view.slice(0, index + 1);
  if (REPORTING_ATTRIBUTION_RE.test(before.slice(-120))) return true;
  // Include the char AT the index: a boundary-anchored literal match starts on
  // the non-alphanumeric char before the term, which is exactly where an opening
  // quote sits, so it must be inside the "before" window.
  const windowBefore = view.slice(Math.max(0, index - QUOTED_WINDOW), index + 1);
  if (!/["“]/.test(windowBefore)) return false;
  const windowAfter = view.slice(index, index + QUOTED_WINDOW);
  return /["”]/.test(windowAfter);
}

export interface LexiconMatchResult {
  signals: ScreeningSignal[];
}

/**
 * Run every compiled entry against one normalized field. Each entry produces at
 * most one signal, weighted by view (obfuscated matches score higher) and by
 * quoted context (quotations score lower).
 */
export function matchLexicons(text: NormalizedText): LexiconMatchResult {
  const signals: ScreeningSignal[] = [];
  for (const entry of COMPILED_LEXICONS) {
    const primary = matchGroup(text, entry.primary);
    if (!primary) continue;
    let secondary: GroupMatch | null = null;
    if (entry.kind === 'cooccurrence') {
      secondary = matchGroup(text, entry.secondary!);
      if (!secondary) continue;
    }

    const obfuscated = primary.view !== 'normalized' || secondary?.view === 'squeezed';
    const viewText =
      primary.view === 'normalized'
        ? text.normalized
        : primary.view === 'folded'
          ? text.folded
          : primary.view === 'deseparated'
            ? text.deseparated
            : text.squeezed;
    // The quoted-context discount never applies to a humanOnly class. There is
    // no reporting context in which a quoted child-safety or self-harm indicator
    // should publish without a person looking (the same reasoning the advisory
    // mitigation uses). This is defense in depth behind the bounded-window fix:
    // even a genuinely quoted severe indicator stays at full weight.
    const quoted =
      primary.view !== 'squeezed' &&
      !CLASS_POLICY[entry.signalClass].humanOnly &&
      isQuotedContext(viewText, primary.index);

    let weight = entry.weight;
    if (obfuscated) weight *= OBFUSCATED_MATCH_MULTIPLIER;
    if (quoted) weight *= QUOTED_CONTEXT_MULTIPLIER;

    const detail = quoted
      ? ' The match appears inside a quotation or an attribution, so it is scored lower.'
      : '';
    const evasion = obfuscated
      ? ' The match only appears after de-obfuscation, which is treated as aggravating.'
      : '';

    signals.push({
      signalClass: entry.signalClass,
      code: entry.code,
      weight: Math.min(1, weight),
      explain: `${entry.explain}${evasion}${detail}`,
      ...(obfuscated ? { obfuscated: true } : {}),
    });
  }
  return { signals };
}

// ==================== screening/urls.ts ====================

/**
 * URL reputation heuristics for pre-publication screening (plan 48 WP8).
 *
 * No network calls and no vendor feed: these are structural heuristics over the
 * URL itself, which is the only thing that can be judged deterministically and
 * offline. Every list is exported data so ops can extend coverage without
 * touching the logic.
 *
 * A link is never quarantine-worthy on its own. The strongest single finding
 * here scores below every class threshold, so a URL heuristic can tip content
 * that already looks like fraud or spam over the line, but a single shortened
 * link in an otherwise clean article cannot.
 */


/** Link shorteners hide the destination, which defeats reader-side judgement. */
export const URL_SHORTENER_HOSTS: readonly string[] = Object.freeze([
  'bit.ly',
  'tinyurl.com',
  'goo.gl',
  't.co',
  'ow.ly',
  'is.gd',
  'buff.ly',
  'adf.ly',
  'shorte.st',
  'cutt.ly',
  'rebrand.ly',
  'bl.ink',
  'rb.gy',
  'tiny.cc',
  'shorturl.at',
  'linktr.ee',
  's.id',
  'v.gd',
  'clck.ru',
  'trib.al',
  'lnkd.in',
  'qr.ae',
  'soo.gd',
  'gg.gg',
  'urlz.fr',
]);

/**
 * TLDs with a persistently high abuse share in public registrar reporting and
 * near-zero legitimate use in cited journalism. Heuristic, not a blocklist: the
 * weight is small and additive.
 */
export const HIGH_ABUSE_TLDS: readonly string[] = Object.freeze([
  'tk',
  'ml',
  'ga',
  'cf',
  'gq',
  'top',
  'work',
  'click',
  'link',
  'loan',
  'bid',
  'stream',
  'download',
  'zip',
  'mov',
  'quest',
  'cam',
  'sbs',
  'rest',
  'cyou',
]);

/**
 * Hosts a scam page most often impersonates in this product's own space. A URL
 * whose host merely CONTAINS one of these strings while not being the canonical
 * domain is a lookalike.
 */
export const IMPERSONATION_BRAND_TOKENS: readonly string[] = Object.freeze([
  'mynews',
  'mylife',
  'paypal',
  'stripe',
  'coinbase',
  'binance',
  'metamask',
  'ledger',
  'apple',
  'google',
  'microsoft',
  'supabase',
]);

/** Canonical hosts that legitimately carry the tokens above. */
export const CANONICAL_HOSTS: readonly string[] = Object.freeze([
  'mynews.app',
  'mylife.app',
  'paypal.com',
  'stripe.com',
  'coinbase.com',
  'binance.com',
  'metamask.io',
  'ledger.com',
  'apple.com',
  'google.com',
  'microsoft.com',
  'supabase.com',
  'supabase.co',
]);

const URL_IN_TEXT_RE = /\b(?:https?:\/\/|www\.)[^\s<>"')\]]+/gi;
const IPV4_HOST_RE = /^\d{1,3}(?:\.\d{1,3}){3}$/;
const NON_ASCII_RE = /[^\x00-\x7F]/;
const CYRILLIC_OR_GREEK_RE = /[Ͱ-ϿЀ-ӿ]/;

export interface ParsedLink {
  raw: string;
  /** Lowercase host, empty when the URL could not be parsed. */
  host: string;
  /** Effective TLD label, lowercase. */
  tld: string;
  scheme: string;
  hasCredentials: boolean;
  parsed: boolean;
}

/** Every http(s) or www-prefixed link in the text, in order of appearance. */
export function extractUrls(text: string): string[] {
  const found = text.match(URL_IN_TEXT_RE);
  return found ? found.map((url) => url.replace(/[.,;:]+$/, '')) : [];
}

export function parseLink(raw: string): ParsedLink {
  const withScheme = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  try {
    const url = new URL(withScheme);
    const host = url.hostname.toLowerCase();
    const labels = host.split('.');
    return {
      raw,
      host,
      tld: labels.length > 1 ? labels[labels.length - 1]! : '',
      scheme: url.protocol.replace(':', '').toLowerCase(),
      hasCredentials: url.username !== '' || url.password !== '',
      parsed: true,
    };
  } catch {
    return { raw, host: '', tld: '', scheme: '', hasCredentials: false, parsed: false };
  }
}

function isCanonical(host: string): boolean {
  return CANONICAL_HOSTS.some((canonical) => host === canonical || host.endsWith(`.${canonical}`));
}

function registrableRoot(host: string): string {
  const labels = host.split('.');
  return labels.length >= 2 ? labels.slice(-2).join('.') : host;
}

export interface UrlAnalysis {
  links: readonly ParsedLink[];
  signals: readonly ScreeningSignal[];
  /** Distinct registrable roots across every link. */
  distinctRoots: number;
}

function signal(
  signalClass: ScreeningClass,
  code: string,
  weight: number,
  explain: string,
): ScreeningSignal {
  return { signalClass, code, weight, explain };
}

/**
 * Structural link reputation. `declared` are author-supplied citation URLs;
 * they are judged the same way as links found in prose, because a citation
 * field is exactly where a scam link wants to live.
 */
export function analyzeUrls(
  text: string,
  declared: readonly string[] = [],
  tokenCount = 0,
): UrlAnalysis {
  const rawLinks = [...extractUrls(text), ...declared];
  const links = rawLinks.map(parseLink);
  const signals: ScreeningSignal[] = [];
  if (links.length === 0) return { links, signals, distinctRoots: 0 };

  const roots = new Set(links.filter((link) => link.host !== '').map((link) => registrableRoot(link.host)));

  const shorteners = links.filter((link) => URL_SHORTENER_HOSTS.includes(link.host));
  if (shorteners.length > 0) {
    signals.push(
      signal(
        'spam',
        'url.shortener',
        Math.min(0.35, 0.15 + 0.1 * (shorteners.length - 1)),
        `${shorteners.length} link${shorteners.length === 1 ? '' : 's'} use a URL shortener, which hides the destination from readers.`,
      ),
    );
  }

  const rawIps = links.filter((link) => IPV4_HOST_RE.test(link.host) || link.host.includes(':'));
  if (rawIps.length > 0) {
    signals.push(
      signal(
        'fraud-scam',
        'url.raw-ip-host',
        0.3,
        `${rawIps.length} link${rawIps.length === 1 ? '' : 's'} point at a bare IP address instead of a domain name.`,
      ),
    );
  }

  const punycode = links.filter((link) => link.host.includes('xn--'));
  const nonAscii = links.filter(
    (link) => NON_ASCII_RE.test(link.raw) && CYRILLIC_OR_GREEK_RE.test(link.raw),
  );
  if (punycode.length > 0 || nonAscii.length > 0) {
    signals.push(
      signal(
        'fraud-scam',
        'url.homoglyph-host',
        0.35,
        'A link host uses punycode or non-Latin lookalike characters, the standard technique for a domain that reads like a familiar one.',
      ),
    );
  }

  const abuseTlds = links.filter((link) => link.tld !== '' && HIGH_ABUSE_TLDS.includes(link.tld));
  if (abuseTlds.length > 0) {
    signals.push(
      signal(
        'spam',
        'url.high-abuse-tld',
        Math.min(0.3, 0.12 * abuseTlds.length),
        `${abuseTlds.length} link${abuseTlds.length === 1 ? '' : 's'} sit on a top-level domain with a persistently high abuse rate.`,
      ),
    );
  }

  const credentialed = links.filter((link) => link.hasCredentials);
  if (credentialed.length > 0) {
    signals.push(
      signal(
        'fraud-scam',
        'url.embedded-credentials',
        0.4,
        'A link embeds credentials before the host, which is used to make a hostile domain look like a trusted one.',
      ),
    );
  }

  const lookalikes = links.filter(
    (link) =>
      link.host !== '' &&
      !isCanonical(link.host) &&
      IMPERSONATION_BRAND_TOKENS.some((token) => link.host.includes(token)),
  );
  if (lookalikes.length > 0) {
    signals.push(
      signal(
        'fraud-scam',
        'url.brand-lookalike',
        0.45,
        `A link host contains a well-known brand or product name but is not that brand's domain (${lookalikes[0]!.host}).`,
      ),
    );
  }

  const insecure = links.filter((link) => link.scheme === 'http');
  if (insecure.length > 0) {
    signals.push(
      signal(
        'spam',
        'url.insecure-scheme',
        0.1,
        `${insecure.length} link${insecure.length === 1 ? '' : 's'} use plain http.`,
      ),
    );
  }

  const unparsed = links.filter((link) => !link.parsed);
  if (unparsed.length > 0) {
    signals.push(
      signal(
        'spam',
        'url.unparseable',
        0.15,
        `${unparsed.length} link${unparsed.length === 1 ? '' : 's'} could not be parsed as a URL.`,
      ),
    );
  }

  if (links.length >= 10) {
    signals.push(
      signal(
        'spam',
        'url.link-count',
        Math.min(0.3, 0.1 + 0.02 * (links.length - 10)),
        `Contains ${links.length} links.`,
      ),
    );
  }

  // Link density: many links relative to how little prose there is. A citation
  // list on a long article is normal; ten links in twenty words is not.
  if (tokenCount > 0 && links.length >= 3 && links.length / tokenCount >= 0.2) {
    signals.push(
      signal(
        'spam',
        'url.link-density',
        0.3,
        `Links make up an unusually large share of the text (${links.length} links across ${tokenCount} words).`,
      ),
    );
  }

  return { links, signals, distinctRoots: roots.size };
}

// ==================== screening/signature.ts ====================

/**
 * Near-duplicate signatures for flood detection (plan 48 WP8).
 *
 * engines/dupes.ts already collapses near-duplicate EDIT SUGGESTIONS against
 * the open suggestions on one article, comparing structured diffs. That is a
 * different question from the one screening asks: is this author posting the
 * same prose over and over across different articles, comments, and threads.
 * So this module works on plain text and produces a small, storable signature
 * that later submissions are compared against without re-reading old bodies.
 *
 * The hash is seeded from config, never from a clock or a random source, so the
 * same bytes and the same seed always produce the same signature.
 */


/** Deterministic 32-bit mix. FNV-1a with a seeded basis. */
export function seededHash(text: string, seed: number): number {
  let h = (0x811c9dc5 ^ seed) >>> 0;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/** Word shingles of the given width. Fewer words than the width yields one shingle. */
export function shingles(tokens: readonly string[], width: number): string[] {
  if (tokens.length === 0) return [];
  if (tokens.length <= width) return [tokens.join(' ')];
  const out: string[] = [];
  for (let i = 0; i + width <= tokens.length; i++) {
    out.push(tokens.slice(i, i + width).join(' '));
  }
  return out;
}

/**
 * Minhash signature: for each slot, the minimum hash of every shingle under
 * that slot's derived seed. Empty text yields an all-zero signature, which
 * compares as identical to other empty text and is never a flood signal on its
 * own (the caller requires floodMinMatches distinct prior posts).
 */
export function buildSignature(
  tokens: readonly string[],
  options: { seed: number; shingleWidth: number; slots: number },
): ScreeningSignature {
  const grams = shingles(tokens, options.shingleWidth);
  const slots: number[] = [];
  for (let slot = 0; slot < options.slots; slot++) {
    const slotSeed = (options.seed + Math.imul(slot, 0x9e3779b1)) >>> 0;
    let min = 0xffffffff;
    for (const gram of grams) {
      const hashed = seededHash(gram, slotSeed);
      if (hashed < min) min = hashed;
    }
    slots.push(grams.length === 0 ? 0 : min);
  }
  return { version: SCREENING_SIGNATURE_VERSION, seed: options.seed, slots };
}

/**
 * Slot-wise agreement, an estimate of Jaccard similarity over the shingle
 * sets. Signatures built with a different version or seed are not comparable
 * and return 0 rather than a misleading number.
 */
export function signatureSimilarity(a: ScreeningSignature, b: ScreeningSignature): number {
  if (a.version !== b.version || a.seed !== b.seed) return 0;
  if (a.slots.length === 0 || a.slots.length !== b.slots.length) return 0;
  let equal = 0;
  for (let i = 0; i < a.slots.length; i++) if (a.slots[i] === b.slots[i]) equal++;
  return equal / a.slots.length;
}

/** Recent signatures at or above the similarity threshold. */
export function countFloodMatches(
  candidate: ScreeningSignature,
  recent: readonly ScreeningSignature[],
  threshold: number,
): number {
  let matches = 0;
  for (const prior of recent) {
    if (signatureSimilarity(candidate, prior) >= threshold) matches++;
  }
  return matches;
}

// ==================== screening/engine.ts ====================

/**
 * Pre-publication screening engine (plan 48 WP8, findings H01/H02).
 *
 * Pure and deterministic: same input plus same config yields the same verdict,
 * byte for byte. No clock, no randomness, no I/O.
 *
 * Pipeline:
 *   1. normalize the primary text and the short title/rationale field
 *   2. run every compiled lexicon entry over both fields
 *   3. run URL reputation over the raw text plus declared links
 *   4. run structure anomaly checks
 *   5. compare the content signature against the author's recent signatures
 *   6. sum per class, apply the evasion aggravator, apply per class thresholds
 *
 * Class scores saturate at 1. A quarantine needs a class to reach its own
 * threshold; there is no global score that can quarantine on its own, because
 * "a lot of small spam signals" and "one unambiguous child-safety signal" are
 * not the same decision.
 */


/** The provider name recorded when only the local engine ran. */
export const LOCAL_PROVIDER = 'local';

function sumByClass(signals: readonly ScreeningSignal[]): Record<ScreeningClass, number> {
  const scores = emptyClassScores();
  for (const signal of signals) {
    if (signal.signalClass === 'structure') {
      // Structure anomalies are spam evidence. Their aggravating role on the
      // risk classes is applied separately, as a multiplier, not as a score.
      scores.spam += signal.weight;
      continue;
    }
    scores[signal.signalClass] += signal.weight;
  }
  for (const cls of SCREENING_CLASSES) scores[cls] = Math.min(1, scores[cls]);
  return scores;
}

/**
 * Deterministic signal ordering for the persisted row and the console: by
 * descending weight, then by code. Two runs must produce the same array.
 */
function orderSignals(signals: ScreeningSignal[]): ScreeningSignal[] {
  return [...signals].sort((a, b) => (b.weight - a.weight) || a.code.localeCompare(b.code));
}

export function screenContent(
  input: ScreeningInput,
  config: ScreeningConfig = DEFAULT_SCREENING_CONFIG,
): ScreeningVerdict {
  const body = normalizeForScreening(input.text ?? '', config.maxScanChars);
  const title = normalizeForScreening(input.title ?? '', config.maxScanChars);

  const signals: ScreeningSignal[] = [
    ...matchLexicons(body).signals,
    ...matchLexicons(title).signals,
    ...structureSignals(body),
  ];

  const urls = analyzeUrls(
    `${input.text ?? ''}\n${input.title ?? ''}`,
    input.links ?? [],
    body.tokens.length + title.tokens.length,
  );
  signals.push(...urls.signals);

  const signature = buildSignature(body.tokens, {
    seed: config.signatureSeed,
    shingleWidth: config.shingleWidth,
    slots: config.signatureSlots,
  });

  const floodMatches = countFloodMatches(
    signature,
    input.recentSignatures ?? [],
    config.floodSimilarity,
  );
  if (body.tokens.length > 0 && floodMatches >= config.floodMinMatches) {
    signals.push({
      signalClass: 'spam',
      code: 'flood.near-duplicate-repost',
      weight: Math.min(0.5, 0.2 + 0.1 * (floodMatches - config.floodMinMatches)),
      explain: `Matches ${floodMatches} of this author's recent submissions at or above ${Math.round(config.floodSimilarity * 100)} percent similarity.`,
    });
  }

  const classScores = sumByClass(signals);

  // Advisory-context mitigation. Fraud and spam vocabulary reads identically
  // whether someone is running a scam or warning readers about one, and a news
  // platform that cannot publish "do not send them the code" is broken. Two or
  // more warning markers halve those two classes. It is deliberately narrow:
  // only fraud-scam and spam, only with two independent markers, and negated
  // forms such as "this is not a scam" count for nothing. The severe classes are
  // never mitigated, because there is no reporting context in which a
  // child-safety or self-harm indicator should publish without a person looking.
  const advisoryMarkers = advisoryMarkerCount(`${body.normalized} ${title.normalized}`);
  const advisory = advisoryMarkers >= ADVISORY_MARKER_FLOOR;
  if (advisory) {
    classScores['fraud-scam'] *= ADVISORY_MITIGATION;
    classScores.spam *= ADVISORY_MITIGATION;
    signals.push({
      signalClass: 'structure',
      code: 'context.advisory-framing',
      weight: 0,
      explain: `Carries ${advisoryMarkers} warning markers, so fraud and spam scores are halved: this reads as coverage of a scam rather than a scam.`,
    });
  }

  // Evasion aggravator: when a lexicon term only survived de-obfuscation, the
  // strongest risk class is amplified. Spam is excluded because the structure
  // signals already scored the obfuscation itself, and double counting there
  // would let formatting noise alone quarantine an article.
  const obfuscatedRiskHit = signals.some(
    (signal) => signal.obfuscated === true && signal.signalClass !== 'spam',
  );
  if (obfuscatedRiskHit) {
    for (const cls of SCREENING_CLASSES) {
      if (cls === 'spam') continue;
      if (classScores[cls] > 0) classScores[cls] = Math.min(1, classScores[cls] * EVASION_MULTIPLIER);
    }
  }

  let topClass: ScreeningClass | null = null;
  let score = 0;
  for (const cls of SCREENING_CLASSES) {
    if (classScores[cls] > score) {
      score = classScores[cls];
      topClass = cls;
    }
  }

  // Threshold pass. Deterministic order: SCREENING_CLASSES is severity-first,
  // so the first class over its own threshold is also the most severe one.
  let thresholdHit: string | null = null;
  let hitClass: ScreeningClass | null = null;
  let requiresHumanReview = false;
  for (const cls of SCREENING_CLASSES) {
    const policy = config.classPolicy[cls];
    if (classScores[cls] < policy.quarantineAt) continue;
    if (thresholdHit === null) {
      thresholdHit = `${cls}>=${policy.quarantineAt}`;
      hitClass = cls;
    }
    if (policy.humanOnly) requiresHumanReview = true;
  }

  const decision = thresholdHit === null ? 'allow' : requiresHumanReview ? 'human-review' : 'quarantine';
  const ordered = orderSignals(signals);
  const explanations = ordered.map((signal) => signal.explain);

  return {
    engineVersion: SCREENING_ENGINE_VERSION,
    provider: LOCAL_PROVIDER,
    decision,
    // The reported score is the class that drove the decision when one fired,
    // so a persisted row's score always matches its thresholdHit.
    score: hitClass ? classScores[hitClass] : score,
    classScores,
    topClass: hitClass ?? topClass,
    thresholdHit,
    requiresHumanReview,
    recorded: thresholdHit !== null || score >= config.recordThreshold,
    signals: ordered,
    explanations,
    signature,
  };
}

// ==================== screening/provider.ts ====================

/**
 * Optional external screening vendor (plan 48 WP8).
 *
 * No vendor is onboarded (founder-ops). The seam exists so onboarding one is a
 * configuration change, and it is built so an absent, broken, slow, or hostile
 * vendor can never weaken the outcome:
 *
 *   the local engine always runs and its verdict is the floor
 *   an unconfigured vendor is an explicit 'unconfigured' state, never a verdict
 *   a vendor error or timeout is recorded and the local verdict stands
 *   a vendor may only ESCALATE: per class scores merge by maximum
 *   a humanOnly class (child-safety, self-harm) can never be cleared by a vendor
 *
 * There is no code path that fabricates a vendor verdict. `providerState` on the
 * result says exactly what happened so the console never implies a vendor
 * reviewed something it did not see.
 */


/** What a vendor is allowed to return. Scores only; no decision authority. */
export interface ExternalScreeningResult {
  /** Per class scores, 0..1. Missing classes count as 0. */
  classScores: Partial<Record<ScreeningClass, number>>;
  /** Optional vendor explanations, surfaced verbatim in the console. */
  explanations?: readonly string[];
}

export interface ScreeningProvider {
  /** Stable vendor name, recorded on the decision row. */
  name: string;
  /**
   * Resolve to scores, or null when the vendor declined to score. Throwing is
   * treated exactly like null: the local verdict stands.
   */
  screen(input: ScreeningInput): Promise<ExternalScreeningResult | null>;
}

export type ProviderState =
  | 'unconfigured'
  | 'scored'
  | 'declined'
  | 'failed'
  | 'timed-out';

export interface ScreenedResult {
  verdict: ScreeningVerdict;
  providerState: ProviderState;
  /** Vendor name when one was configured, else null. */
  providerName: string | null;
  /** Human sentence about the vendor leg, always safe to show a moderator. */
  providerNote: string;
}

export interface ProviderOptions {
  provider?: ScreeningProvider | null;
  /** Wall-clock budget for the vendor call. */
  timeoutMs?: number;
  config?: ScreeningConfig;
  /** Injected for tests; defaults to a real timer. */
  setTimeoutImpl?: typeof setTimeout;
}

const DEFAULT_TIMEOUT_MS = 4000;

function withTimeout<T>(
  work: Promise<T>,
  timeoutMs: number,
  setTimeoutImpl: typeof setTimeout,
): Promise<{ ok: true; value: T } | { ok: false; reason: 'timed-out' | 'failed'; error?: unknown }> {
  return new Promise((resolve) => {
    let settled = false;
    const timer = setTimeoutImpl(() => {
      if (settled) return;
      settled = true;
      resolve({ ok: false, reason: 'timed-out' });
    }, timeoutMs);
    work.then(
      (value) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer as ReturnType<typeof setTimeout>);
        resolve({ ok: true, value });
      },
      (error: unknown) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer as ReturnType<typeof setTimeout>);
        resolve({ ok: false, reason: 'failed', error });
      },
    );
  });
}

/** Clamp a vendor-supplied number into 0..1, treating junk as 0. */
function clampScore(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 0;
  if (value <= 0) return 0;
  return value > 1 ? 1 : value;
}

/**
 * Merge a vendor result into a local verdict by taking the per class maximum,
 * then re-running the threshold pass. The vendor can raise a class over its
 * threshold; it can never lower one, and it never sees the humanOnly rule.
 */
export function mergeVendorScores(
  local: ScreeningVerdict,
  vendor: ExternalScreeningResult,
  vendorName: string,
  config: ScreeningConfig,
): ScreeningVerdict {
  const merged = emptyClassScores();
  for (const cls of SCREENING_CLASSES) {
    merged[cls] = Math.max(local.classScores[cls], clampScore(vendor.classScores[cls]));
  }

  const vendorSignals: ScreeningSignal[] = SCREENING_CLASSES.filter(
    (cls) => clampScore(vendor.classScores[cls]) > local.classScores[cls],
  ).map((cls) => ({
    signalClass: cls,
    code: `vendor.${vendorName}.${cls}`,
    weight: clampScore(vendor.classScores[cls]),
    explain: `External screening vendor ${vendorName} scored ${cls} at ${clampScore(vendor.classScores[cls]).toFixed(2)}, above the local engine.`,
  }));

  let thresholdHit: string | null = null;
  let hitClass: ScreeningClass | null = null;
  let requiresHumanReview = false;
  for (const cls of SCREENING_CLASSES) {
    const policy = config.classPolicy[cls];
    if (merged[cls] < policy.quarantineAt) continue;
    if (thresholdHit === null) {
      thresholdHit = `${cls}>=${policy.quarantineAt}`;
      hitClass = cls;
    }
    if (policy.humanOnly) requiresHumanReview = true;
  }
  // A humanOnly hit found locally survives the merge unconditionally.
  if (local.requiresHumanReview) requiresHumanReview = true;

  let topClass: ScreeningClass | null = null;
  let top = 0;
  for (const cls of SCREENING_CLASSES) {
    if (merged[cls] > top) {
      top = merged[cls];
      topClass = cls;
    }
  }

  const signals = [...local.signals, ...vendorSignals];
  return {
    ...local,
    provider: `${LOCAL_PROVIDER}+${vendorName}`,
    // requiresHumanReview is checked FIRST, not after the threshold: a local
    // human-review verdict survives the merge unconditionally, so no merging rule
    // (now or later) can turn it into an allow.
    decision: requiresHumanReview ? 'human-review' : thresholdHit === null ? 'allow' : 'quarantine',
    score: hitClass ? merged[hitClass] : top,
    classScores: merged,
    topClass: hitClass ?? topClass,
    thresholdHit: thresholdHit ?? local.thresholdHit,
    requiresHumanReview,
    recorded: local.recorded || thresholdHit !== null || top >= config.recordThreshold,
    signals,
    explanations: [...signals.map((s) => s.explain), ...(vendor.explanations ?? [])],
  };
}

/**
 * Screen with the local engine, then optionally with a configured vendor.
 * Fails closed to the local verdict in every failure mode.
 */
export async function screenWithProvider(
  input: ScreeningInput,
  options: ProviderOptions = {},
): Promise<ScreenedResult> {
  const config = options.config ?? DEFAULT_SCREENING_CONFIG;
  const local = screenContent(input, config);

  const provider = options.provider ?? null;
  if (!provider) {
    return {
      verdict: local,
      providerState: 'unconfigured',
      providerName: null,
      providerNote:
        'No external screening vendor is configured, so this verdict is from the local engine only.',
    };
  }

  const outcome = await withTimeout(
    Promise.resolve().then(() => provider.screen(input)),
    options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    options.setTimeoutImpl ?? setTimeout,
  );

  if (!outcome.ok) {
    return {
      verdict: local,
      providerState: outcome.reason,
      providerName: provider.name,
      providerNote:
        outcome.reason === 'timed-out'
          ? `External screening vendor ${provider.name} did not answer in time. The local engine verdict stands.`
          : `External screening vendor ${provider.name} failed. The local engine verdict stands.`,
    };
  }

  if (outcome.value === null) {
    return {
      verdict: local,
      providerState: 'declined',
      providerName: provider.name,
      providerNote: `External screening vendor ${provider.name} returned no score. The local engine verdict stands.`,
    };
  }

  return {
    verdict: mergeVendorScores(local, outcome.value, provider.name, config),
    providerState: 'scored',
    providerName: provider.name,
    providerNote: `External screening vendor ${provider.name} scored this submission. Vendor scores can only raise a class, never clear one.`,
  };
}

