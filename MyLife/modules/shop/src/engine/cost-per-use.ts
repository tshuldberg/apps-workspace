/**
 * Cost-per-use engine. Pure functions, no DB or side effects.
 *
 * Prices are expressed in cents throughout the module. Cost-per-use is
 * returned in cents as well so callers can format consistently.
 */

export type WorthItStatus = 'worth-it' | 'approaching' | 'not-yet';

/**
 * Default "worth it" threshold: $5.00 per use, expressed in cents.
 */
export const DEFAULT_WORTH_IT_THRESHOLD_CENTS = 500;

/**
 * Calculate cost-per-use in cents. Returns 0 when `useCount` is 0 or `price`
 * is non-positive (defensive guard for divide-by-zero and seed/demo data).
 */
export function calculateCostPerUse(
  priceCents: number,
  useCount: number,
): number {
  if (useCount <= 0) return 0;
  if (priceCents <= 0) return 0;
  if (!Number.isFinite(priceCents) || !Number.isFinite(useCount)) return 0;
  return priceCents / useCount;
}

/**
 * Bucket a cost-per-use against a threshold.
 *
 * - `worth-it`: costPerUse has dropped to or below the threshold
 * - `approaching`: costPerUse is within 50 percent above the threshold (i.e.
 *   between threshold and 1.5x threshold)
 * - `not-yet`: costPerUse is more than 50 percent above the threshold
 *
 * A non-positive costPerUse (no uses logged yet) always returns `not-yet`.
 */
export function getWorthItStatus(
  costPerUseCents: number,
  thresholdCents: number = DEFAULT_WORTH_IT_THRESHOLD_CENTS,
): WorthItStatus {
  if (costPerUseCents <= 0) return 'not-yet';
  if (thresholdCents <= 0) return 'worth-it';
  if (costPerUseCents <= thresholdCents) return 'worth-it';
  if (costPerUseCents <= thresholdCents * 1.5) return 'approaching';
  return 'not-yet';
}

/**
 * Projected number of additional uses needed to reach `targetCostPerUseCents`.
 * Returns the delta between uses-needed-total and the current `useCount`,
 * floored at 0. Returns 0 when the target is already met or when inputs are
 * non-sensical.
 */
export function projectBreakEven(
  priceCents: number,
  useCount: number,
  targetCostPerUseCents: number,
): number {
  if (priceCents <= 0) return 0;
  if (targetCostPerUseCents <= 0) return 0;
  if (!Number.isFinite(priceCents) || !Number.isFinite(useCount)) return 0;
  if (!Number.isFinite(targetCostPerUseCents)) return 0;

  const current = calculateCostPerUse(priceCents, useCount);
  if (current > 0 && current <= targetCostPerUseCents) return 0;

  const usesNeededTotal = Math.ceil(priceCents / targetCostPerUseCents);
  const delta = usesNeededTotal - Math.max(0, useCount);
  return delta > 0 ? delta : 0;
}
