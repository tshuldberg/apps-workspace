/**
 * 30-day rule engine. Pure functions over wait-list items (no DB, no platform).
 *
 * The "30-day rule" forces a wait period before buying non-essential items.
 * After the threshold passes, the user decides to buy or skip. These helpers
 * power countdown UI and conversion stats.
 */

import type { ThirtyDayRuleItem } from '../models/schemas';

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const DEFAULT_THRESHOLD_DAYS = 30;

function nowMs(): number {
  return Date.now();
}

/**
 * Whole days elapsed since the item was added to the wait list.
 */
export function getDaysWaiting(
  item: { added_at?: number; addedAt?: number },
  now: number = nowMs(),
): number {
  const added = item.added_at ?? item.addedAt ?? 0;
  if (!added) return 0;
  const diff = now - added;
  if (diff <= 0) return 0;
  return Math.floor(diff / MS_PER_DAY);
}

/**
 * Days remaining until the item hits the wait threshold. Clamped to >= 0.
 */
export function getDaysRemaining(
  item: { added_at?: number; addedAt?: number },
  now: number = nowMs(),
  threshold: number = DEFAULT_THRESHOLD_DAYS,
): number {
  const waited = getDaysWaiting(item, now);
  const remaining = threshold - waited;
  return remaining > 0 ? remaining : 0;
}

/**
 * True when the item is still waiting AND its threshold has elapsed.
 */
export function isReadyForDecision(
  item: {
    added_at?: number;
    addedAt?: number;
    decision: string;
  },
  now: number = nowMs(),
  threshold: number = DEFAULT_THRESHOLD_DAYS,
): boolean {
  if (item.decision !== 'waiting') return false;
  return getDaysRemaining(item, now, threshold) <= 0;
}

export interface ConversionRate {
  decided: number;
  bought: number;
  skipped: number;
  conversionRate: number;
  skipRate: number;
}

/**
 * Of items that have been decided (bought or skipped), what fraction
 * converted to purchase vs were skipped. Items still waiting are excluded.
 */
export function getConversionRate(items: ThirtyDayRuleItem[]): ConversionRate {
  let bought = 0;
  let skipped = 0;
  for (const item of items) {
    if (item.decision === 'bought') bought += 1;
    else if (item.decision === 'skipped') skipped += 1;
  }
  const decided = bought + skipped;
  const conversionRate = decided > 0 ? bought / decided : 0;
  const skipRate = decided > 0 ? skipped / decided : 0;
  return { decided, bought, skipped, conversionRate, skipRate };
}

/**
 * Total cents the user "saved" by deciding to skip wait-listed items.
 * Sum of price_cents for decision='skipped'.
 */
export function getTotalSavedBySkipping(items: ThirtyDayRuleItem[]): number {
  let total = 0;
  for (const item of items) {
    if (item.decision === 'skipped') total += item.priceCents;
  }
  return total;
}
