/**
 * Satisfaction tracking — pure functions for scheduling 30/90 day reviews.
 * The CRUD layer persists the rating; this module only computes what is due.
 */

import type { Purchase } from '../models/schemas';

export type ReviewPeriod = '30day' | '90day';

export interface DueReview {
  purchaseId: string;
  period: ReviewPeriod;
}

export interface ReminderSchedule {
  purchaseId: string;
  period: ReviewPeriod;
  /** Date (YYYY-MM-DD) when the reminder becomes due. */
  dueDate: string;
  title: string;
  body: string;
}

const WINDOWS: Record<ReviewPeriod, number> = {
  '30day': 30,
  '90day': 90,
};

function addDaysISO(isoDate: string, days: number): string {
  const d = new Date(isoDate);
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth();
  const day = d.getUTCDate();
  return new Date(Date.UTC(y, m, day + days)).toISOString().slice(0, 10);
}

function daysBetween(fromISO: string, toISO: string): number {
  const from = new Date(fromISO);
  const to = new Date(toISO);
  const fromDay = Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate());
  const toDay = Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), to.getUTCDate());
  return Math.floor((toDay - fromDay) / 86_400_000);
}

/**
 * Calculate which satisfaction reviews are now due for the given purchases.
 * A review for `period` is due when:
 *   - the corresponding rating is still null, and
 *   - at least N days have elapsed since `purchase_date`, and
 *   - the purchase has not been returned.
 */
export function calculateDueReviews(
  purchases: Purchase[],
  referenceDate: string | Date = new Date(),
): DueReview[] {
  const refISO = typeof referenceDate === 'string'
    ? referenceDate
    : referenceDate.toISOString();
  const out: DueReview[] = [];

  for (const p of purchases) {
    if (p.returned) continue;
    const elapsed = daysBetween(p.purchaseDate, refISO);
    if (elapsed < 0) continue;

    if (p.satisfaction30day == null && elapsed >= WINDOWS['30day']) {
      out.push({ purchaseId: p.id, period: '30day' });
    }
    if (p.satisfaction90day == null && elapsed >= WINDOWS['90day']) {
      out.push({ purchaseId: p.id, period: '90day' });
    }
  }

  return out;
}

/**
 * Build a reminder schedule descriptor for a pending review. Pure — does not
 * register a notification. The caller is responsible for wiring the schedule
 * into whatever notification surface is appropriate.
 */
export function scheduleReviewReminder(
  purchase: Pick<Purchase, 'id' | 'name' | 'purchaseDate'>,
  period: ReviewPeriod,
): ReminderSchedule {
  const dueDate = addDaysISO(purchase.purchaseDate, WINDOWS[period]);
  const label = period === '30day' ? '30 days' : '90 days';
  return {
    purchaseId: purchase.id,
    period,
    dueDate,
    title: `How do you feel about ${purchase.name}?`,
    body: `It's been ${label}. Tap to rate your satisfaction so MyShop gets smarter.`,
  };
}
