/**
 * Notification scheduling for subscriptions.
 *
 * Determines which notifications should fire and logs them in the
 * bg_notification_log table for deduplication. The actual scheduling
 * of native push notifications happens in the mobile app layer
 * (expo-notifications) -- this module provides the logic layer.
 *
 * Notification types:
 * 1. Renewal reminder (N days before next_renewal)
 * 2. Trial expiration alerts (3 days, 1 day before trial_end_date)
 * 3. Monthly summary on the 1st of each month
 */

import type { DatabaseAdapter } from '@mylife/db';
import type { BudgetSubscription, NotificationLog } from '../types';

export interface PendingNotification {
  subscription_id: string;
  type: 'renewal' | 'trial_expiry' | 'monthly_summary';
  scheduled_for: string; // YYYY-MM-DD
  title: string;
  body: string;
}

/**
 * Get pending renewal notifications for a subscription.
 */
export function getRenewalNotifications(
  db: DatabaseAdapter,
  subscription: BudgetSubscription,
  today?: string,
): PendingNotification[] {
  if (subscription.status !== 'active' && subscription.status !== 'trial') return [];
  if (subscription.notify_days <= 0) return [];

  const todayStr = today ?? new Date().toISOString().slice(0, 10);
  const notifyDate = subtractDays(subscription.next_renewal, subscription.notify_days);

  if (notifyDate < todayStr) return [];
  if (isAlreadyLogged(db, subscription.id, 'renewal', notifyDate)) return [];

  return [{
    subscription_id: subscription.id,
    type: 'renewal',
    scheduled_for: notifyDate,
    title: `${subscription.name} renewing soon`,
    body: subscription.notify_days === 1
      ? `${subscription.name} renews tomorrow.`
      : `${subscription.name} renews in ${subscription.notify_days} days.`,
  }];
}

/**
 * Get pending trial expiration notifications for a subscription.
 */
export function getTrialExpirationAlerts(
  db: DatabaseAdapter,
  subscription: BudgetSubscription,
  today?: string,
): PendingNotification[] {
  if (subscription.status !== 'trial' || !subscription.trial_end_date) return [];

  const todayStr = today ?? new Date().toISOString().slice(0, 10);
  const results: PendingNotification[] = [];

  for (const daysBefore of [3, 1]) {
    const alertDate = subtractDays(subscription.trial_end_date, daysBefore);
    if (alertDate < todayStr) continue;
    if (isAlreadyLogged(db, subscription.id, 'trial_expiry', alertDate)) continue;

    results.push({
      subscription_id: subscription.id,
      type: 'trial_expiry',
      scheduled_for: alertDate,
      title: `${subscription.name} trial ending`,
      body: daysBefore === 1
        ? `Your ${subscription.name} trial ends tomorrow.`
        : `Your ${subscription.name} trial ends in ${daysBefore} days.`,
    });
  }

  return results;
}

/**
 * Get a monthly summary notification for the 1st of a given month.
 */
export function getMonthlySummaryNotification(
  db: DatabaseAdapter,
  month: string,
  monthlyTotalCents: number,
): PendingNotification | null {
  const scheduledFor = `${month}-01`;
  const summaryId = 'monthly-summary';

  if (isAlreadyLogged(db, summaryId, 'monthly_summary', scheduledFor)) return null;

  const dollars = (monthlyTotalCents / 100).toFixed(2);
  return {
    subscription_id: summaryId,
    type: 'monthly_summary',
    scheduled_for: scheduledFor,
    title: 'Monthly subscription summary',
    body: `Your subscriptions this month: $${dollars}`,
  };
}

/**
 * Mark a notification as scheduled by logging it.
 */
export function logNotification(
  db: DatabaseAdapter,
  id: string,
  notification: PendingNotification,
): void {
  const now = new Date().toISOString();
  db.execute(
    `INSERT OR IGNORE INTO bg_notification_log (id, subscription_id, type, scheduled_for, sent_at)
     VALUES (?, ?, ?, ?, ?)`,
    [id, notification.subscription_id, notification.type, notification.scheduled_for, now],
  );
}

/**
 * Cancel all pending (unsent) notifications for a subscription.
 */
export function cancelNotifications(
  db: DatabaseAdapter,
  subscriptionId: string,
): void {
  db.execute(
    `DELETE FROM bg_notification_log WHERE subscription_id = ? AND sent_at IS NULL`,
    [subscriptionId],
  );
}

/**
 * Get all notification log entries for a subscription.
 */
export function getNotificationLog(
  db: DatabaseAdapter,
  subscriptionId: string,
): NotificationLog[] {
  const rows = db.query<Record<string, unknown>>(
    `SELECT * FROM bg_notification_log WHERE subscription_id = ? ORDER BY scheduled_for DESC`,
    [subscriptionId],
  );
  return rows.map(rowToNotificationLog);
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function isAlreadyLogged(
  db: DatabaseAdapter,
  subscriptionId: string,
  type: string,
  scheduledFor: string,
): boolean {
  const rows = db.query<Record<string, unknown>>(
    `SELECT 1 FROM bg_notification_log
     WHERE subscription_id = ? AND type = ? AND scheduled_for = ?`,
    [subscriptionId, type, scheduledFor],
  );
  return rows.length > 0;
}

function subtractDays(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  date.setDate(date.getDate() - days);
  const ry = date.getFullYear();
  const rm = String(date.getMonth() + 1).padStart(2, '0');
  const rd = String(date.getDate()).padStart(2, '0');
  return `${ry}-${rm}-${rd}`;
}

function rowToNotificationLog(row: Record<string, unknown>): NotificationLog {
  return {
    id: row.id as string,
    subscription_id: row.subscription_id as string,
    type: row.type as NotificationLog['type'],
    scheduled_for: row.scheduled_for as string,
    sent_at: (row.sent_at as string | null) ?? null,
  };
}
