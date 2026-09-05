/**
 * Return deadline utilities. Pure functions — no DB or side effects.
 */

import type { Purchase } from '../models/schemas';

/**
 * Calculate an ISO return deadline (YYYY-MM-DD) by adding `policyDays` to
 * `purchaseDate`. Accepts an ISO date or datetime string and returns the
 * date-only portion.
 */
export function calculateReturnDeadline(
  purchaseDate: string,
  policyDays: number,
): string {
  if (!Number.isFinite(policyDays) || policyDays < 0) {
    throw new Error('policyDays must be a non-negative finite number');
  }
  const base = new Date(purchaseDate);
  if (isNaN(base.getTime())) {
    throw new Error(`Invalid purchaseDate: ${purchaseDate}`);
  }
  // Work in UTC to avoid timezone drift across day boundaries.
  const y = base.getUTCFullYear();
  const m = base.getUTCMonth();
  const d = base.getUTCDate();
  const deadline = new Date(Date.UTC(y, m, d + policyDays));
  return deadline.toISOString().slice(0, 10);
}

/**
 * Return purchases whose `return_deadline` falls within
 * [referenceDate, referenceDate + daysAhead] and which have not been returned.
 */
export function getExpiringReturns(
  purchases: Purchase[],
  daysAhead: number,
  referenceDate: string | Date = new Date(),
): Purchase[] {
  if (daysAhead < 0) return [];
  const ref = typeof referenceDate === 'string'
    ? new Date(referenceDate)
    : referenceDate;
  if (isNaN(ref.getTime())) return [];
  const refDay = Date.UTC(
    ref.getUTCFullYear(),
    ref.getUTCMonth(),
    ref.getUTCDate(),
  );
  const cutoff = refDay + daysAhead * 86_400_000;

  return purchases.filter((p) => {
    if (p.returned) return false;
    if (!p.returnDeadline) return false;
    const deadline = new Date(p.returnDeadline);
    if (isNaN(deadline.getTime())) return false;
    const deadlineDay = Date.UTC(
      deadline.getUTCFullYear(),
      deadline.getUTCMonth(),
      deadline.getUTCDate(),
    );
    return deadlineDay >= refDay && deadlineDay <= cutoff;
  });
}
