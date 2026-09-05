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
