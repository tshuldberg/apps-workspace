/**
 * Warranty reminder engine. Pure functions — no DB or platform calls.
 * Date inputs are epoch millisecond timestamps; `now` defaults to Date.now().
 */

import type { Purchase, Warranty } from '../models/schemas';

const DAY_MS = 86_400_000;

/** Whole days between two epoch-ms values (expiry - now). Negative if expired. */
export function getDaysUntilExpiry(
  expiryDate: number,
  now: number = Date.now(),
): number {
  if (!Number.isFinite(expiryDate) || !Number.isFinite(now)) return 0;
  return Math.ceil((expiryDate - now) / DAY_MS);
}

/**
 * Warranties whose expiry falls within (now, now + daysAhead * day]. Expired
 * warranties are excluded, and same-instant expiry is treated as not-yet-expired
 * (included when within the window).
 */
export function getUpcomingExpiries(
  warranties: Warranty[],
  daysAhead: number,
  now: number = Date.now(),
): Warranty[] {
  if (!Number.isFinite(daysAhead) || daysAhead < 0) return [];
  const cutoff = now + Math.floor(daysAhead) * DAY_MS;
  return warranties
    .filter((w) => w.expiryDate >= now && w.expiryDate <= cutoff)
    .slice()
    .sort((a, b) => a.expiryDate - b.expiryDate);
}

/**
 * Whether a warranty should trigger a reminder at `now` based on its
 * reminder_days_before lead time. Returns false once expired or once a claim
 * has been filed.
 */
export function shouldRemindForWarranty(
  w: Warranty,
  now: number = Date.now(),
): boolean {
  if (w.claimFiled) return false;
  if (w.expiryDate < now) return false;
  const reminderStart = w.expiryDate - w.reminderDaysBefore * DAY_MS;
  return now >= reminderStart;
}

/**
 * Purchases whose `return_deadline` is within `daysAhead` days of `now` (default 3).
 * Purchase.returnDeadline is an ISO date string; comparisons use UTC day math.
 */
export function getExpiringReturns(
  purchases: Purchase[],
  daysAhead: number = 3,
  now: number = Date.now(),
): Purchase[] {
  if (!Number.isFinite(daysAhead) || daysAhead < 0) return [];
  const nowDate = new Date(now);
  const todayUtc = Date.UTC(
    nowDate.getUTCFullYear(),
    nowDate.getUTCMonth(),
    nowDate.getUTCDate(),
  );
  const cutoff = todayUtc + Math.floor(daysAhead) * DAY_MS;

  return purchases
    .filter((p) => {
      if (p.returned) return false;
      if (!p.returnDeadline) return false;
      const d = new Date(p.returnDeadline);
      if (isNaN(d.getTime())) return false;
      const deadlineUtc = Date.UTC(
        d.getUTCFullYear(),
        d.getUTCMonth(),
        d.getUTCDate(),
      );
      return deadlineUtc >= todayUtc && deadlineUtc <= cutoff;
    })
    .slice()
    .sort((a, b) => {
      const ad = new Date(a.returnDeadline ?? 0).getTime();
      const bd = new Date(b.returnDeadline ?? 0).getTime();
      return ad - bd;
    });
}

export type WarrantyStatus =
  | 'active'
  | 'expiring-soon'
  | 'expired'
  | 'claimed';

/** Status bucket for a warranty. Expiring-soon = active and within 30 days. */
export function getWarrantyStatus(
  w: Warranty,
  now: number = Date.now(),
): WarrantyStatus {
  if (w.claimFiled) return 'claimed';
  if (w.expiryDate < now) return 'expired';
  const thirtyDaysFromNow = now + 30 * DAY_MS;
  if (w.expiryDate <= thirtyDaysFromNow) return 'expiring-soon';
  return 'active';
}
