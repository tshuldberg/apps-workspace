/**
 * Renewal date calculation engine for subscriptions.
 *
 * Handles all billing cycles including month-end edge cases:
 * - Jan 31 monthly -> Feb 28, then Mar 31 (anchors to original day-of-month)
 * - Leap year handling for Feb 29
 */

import type { BillingCycle, BudgetSubscription } from '../types';

/**
 * Calculate the next renewal date from a given start date and billing cycle.
 * Advances from startDate by one billing period at a time until the result
 * is strictly after `today`.
 */
export function calculateNextRenewal(
  startDate: string,
  billingCycle: BillingCycle,
  customDays?: number | null,
  today?: string,
): string {
  const todayDate = today ? parseDate(today) : stripTime(new Date());
  let renewal = parseDate(startDate);
  const anchorDay = renewal.getDate();

  while (renewal <= todayDate) {
    renewal = advanceDateByOneCycle(renewal, billingCycle, anchorDay, customDays);
  }

  return formatDate(renewal);
}

/**
 * Advance a renewal date by one billing cycle period.
 */
export function advanceRenewalDate(
  currentRenewal: string,
  billingCycle: BillingCycle,
  customDays?: number | null,
  anchorDay?: number,
): string {
  const date = parseDate(currentRenewal);
  const anchor = anchorDay ?? date.getDate();
  const advanced = advanceDateByOneCycle(date, billingCycle, anchor, customDays);
  return formatDate(advanced);
}

/**
 * Get all subscriptions with renewals within the next N days.
 */
export function getUpcomingRenewals(
  subscriptions: BudgetSubscription[],
  daysAhead = 30,
  today?: string,
): BudgetSubscription[] {
  const todayDate = today ? parseDate(today) : stripTime(new Date());
  const cutoff = new Date(todayDate);
  cutoff.setDate(cutoff.getDate() + daysAhead);

  return subscriptions
    .filter((sub) => {
      if (sub.status === 'cancelled' || sub.status === 'paused') return false;
      const renewal = parseDate(sub.next_renewal);
      return renewal >= todayDate && renewal <= cutoff;
    })
    .sort((a, b) => a.next_renewal.localeCompare(b.next_renewal));
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function advanceDateByOneCycle(
  date: Date,
  billingCycle: BillingCycle,
  anchorDay: number,
  customDays?: number | null,
): Date {
  const result = new Date(date);

  switch (billingCycle) {
    case 'weekly':
      result.setDate(result.getDate() + 7);
      break;
    case 'monthly':
      advanceMonths(result, 1, anchorDay);
      break;
    case 'quarterly':
      advanceMonths(result, 3, anchorDay);
      break;
    case 'semi_annual':
      advanceMonths(result, 6, anchorDay);
      break;
    case 'annual':
      advanceMonths(result, 12, anchorDay);
      break;
    case 'custom': {
      if (!customDays || customDays < 1) {
        throw new Error('custom billing cycle requires customDays >= 1');
      }
      result.setDate(result.getDate() + customDays);
      break;
    }
  }

  return result;
}

function advanceMonths(date: Date, months: number, anchorDay: number): void {
  const newMonth = date.getMonth() + months;
  date.setMonth(newMonth);
  const expectedMonth = newMonth % 12;
  if (date.getMonth() !== expectedMonth) {
    date.setDate(0);
  } else {
    const daysInMonth = getDaysInMonth(date.getFullYear(), date.getMonth());
    date.setDate(Math.min(anchorDay, daysInMonth));
  }
}

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function parseDate(isoDate: string): Date {
  const [y, m, d] = isoDate.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function stripTime(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function formatDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
