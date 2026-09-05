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

import { LOCAL_PROVIDER, screenContent } from './engine';
import {
  DEFAULT_SCREENING_CONFIG,
  SCREENING_CLASSES,
  emptyClassScores,
  type ScreeningClass,
  type ScreeningConfig,
  type ScreeningInput,
  type ScreeningSignal,
  type ScreeningVerdict,
} from './types';

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
