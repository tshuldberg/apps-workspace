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

import {
  LEXICONS,
  decodeTerm,
  type LexiconEntry,
} from './lexicons';
import { SQUEEZED_MIN_TERM_CHARS, type NormalizedText } from './normalize';
import { CLASS_POLICY, type ScreeningClass, type ScreeningSignal } from './types';

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
