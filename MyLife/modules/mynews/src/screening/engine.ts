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

import { matchLexicons } from './matcher';
import { advisoryMarkerCount, normalizeForScreening, structureSignals } from './normalize';
import { buildSignature, countFloodMatches } from './signature';
import { analyzeUrls } from './urls';
import {
  ADVISORY_MARKER_FLOOR,
  ADVISORY_MITIGATION,
  DEFAULT_SCREENING_CONFIG,
  EVASION_MULTIPLIER,
  SCREENING_CLASSES,
  SCREENING_ENGINE_VERSION,
  emptyClassScores,
  type ScreeningClass,
  type ScreeningConfig,
  type ScreeningInput,
  type ScreeningSignal,
  type ScreeningVerdict,
} from './types';

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
