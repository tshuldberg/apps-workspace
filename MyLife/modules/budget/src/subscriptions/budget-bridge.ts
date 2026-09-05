/**
 * Bridge between the subscription engine and the budget system.
 *
 * Manages the lifecycle of recurring_templates linked to subscriptions:
 * - Creates a template when a subscription is added
 * - Syncs template fields when the subscription is updated
 * - Deactivates the template when the subscription is paused/cancelled
 * - Generates renewal transactions via the template system
 *
 * In the hub, "category" maps to "envelope".
 */

import type { DatabaseAdapter } from '@mylife/db';
import type { BudgetSubscription, RecurringFrequency } from '../types';
import { calculateNextRenewal } from './renewal';

// ---------------------------------------------------------------------------
// Recurring template helpers (inline to avoid circular deps with CRUD)
// ---------------------------------------------------------------------------

interface RecurringTemplateRow {
  id: string;
  account_id: string;
  envelope_id: string | null;
  payee: string;
  amount: number;
  frequency: string;
  start_date: string;
  next_date: string;
  end_date: string | null;
  is_active: number;
  subscription_id: string | null;
  created_at: string;
  updated_at: string;
}

function getTemplateBySubscriptionId(
  db: DatabaseAdapter,
  subscriptionId: string,
): RecurringTemplateRow | null {
  const rows = db.query<RecurringTemplateRow>(
    `SELECT * FROM bg_recurring_templates WHERE subscription_id = ?`,
    [subscriptionId],
  );
  return rows[0] ?? null;
}

function updateTemplateFields(
  db: DatabaseAdapter,
  templateId: string,
  fields: Record<string, unknown>,
): void {
  const keys = Object.keys(fields);
  if (keys.length === 0) return;

  const setClauses = keys.map((k) => `${k} = ?`);
  const values = keys.map((k) => fields[k]);
  values.push(new Date().toISOString()); // updated_at
  values.push(templateId);

  db.execute(
    `UPDATE bg_recurring_templates SET ${setClauses.join(', ')}, updated_at = ? WHERE id = ?`,
    values,
  );
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Map subscription billing cycle to recurring template frequency.
 */
export function mapBillingCycleToFrequency(
  billingCycle: BudgetSubscription['billing_cycle'],
): RecurringFrequency {
  switch (billingCycle) {
    case 'weekly': return 'weekly';
    case 'monthly': return 'monthly';
    case 'quarterly': return 'quarterly';
    case 'semi_annual': return 'quarterly'; // approximation
    case 'annual': return 'annually';
    case 'custom': return 'monthly'; // fallback
  }
}

/**
 * Create a recurring template linked to a subscription.
 */
export function createSubscriptionTemplate(
  db: DatabaseAdapter,
  templateId: string,
  subscription: BudgetSubscription,
  accountId: string,
): void {
  const frequency = mapBillingCycleToFrequency(subscription.billing_cycle);
  const amount = -Math.abs(subscription.price); // outflow is negative
  const now = new Date().toISOString();

  db.execute(
    `INSERT INTO bg_recurring_templates
     (id, account_id, envelope_id, payee, amount, frequency, start_date, next_date, end_date, is_active, subscription_id, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      templateId, accountId, subscription.envelope_id, subscription.name,
      amount, frequency, subscription.start_date, subscription.next_renewal,
      null, 1, subscription.id, now, now,
    ],
  );
}

/**
 * Sync a subscription's fields to its linked recurring template.
 * Call this after updating subscription name, price, category, etc.
 */
export function syncSubscriptionToTemplate(
  db: DatabaseAdapter,
  subscription: BudgetSubscription,
): void {
  const template = getTemplateBySubscriptionId(db, subscription.id);
  if (!template) return;

  const frequency = mapBillingCycleToFrequency(subscription.billing_cycle);
  const amount = -Math.abs(subscription.price);
  const isActive = subscription.status === 'active' || subscription.status === 'trial';

  updateTemplateFields(db, template.id, {
    payee: subscription.name,
    amount,
    frequency,
    envelope_id: subscription.envelope_id,
    next_date: subscription.next_renewal,
    is_active: isActive ? 1 : 0,
  });
}

/**
 * Process a subscription renewal: advance the next_renewal date
 * and sync the template.
 */
export function processRenewal(
  db: DatabaseAdapter,
  subscription: BudgetSubscription,
  today?: string,
): string {
  const newRenewal = calculateNextRenewal(
    subscription.start_date,
    subscription.billing_cycle,
    subscription.custom_days,
    today,
  );

  const now = new Date().toISOString();
  db.execute(
    'UPDATE bg_subscriptions SET next_renewal = ?, updated_at = ? WHERE id = ?',
    [newRenewal, now, subscription.id],
  );

  const template = getTemplateBySubscriptionId(db, subscription.id);
  if (template) {
    updateTemplateFields(db, template.id, { next_date: newRenewal });
  }

  return newRenewal;
}

/**
 * Deactivate the recurring template linked to a subscription.
 * Called when a subscription is paused or cancelled.
 */
export function deactivateSubscriptionTemplate(
  db: DatabaseAdapter,
  subscriptionId: string,
): void {
  const template = getTemplateBySubscriptionId(db, subscriptionId);
  if (!template) return;
  updateTemplateFields(db, template.id, { is_active: 0 });
}

/**
 * Reactivate the recurring template linked to a subscription.
 * Called when a paused subscription is resumed.
 */
export function reactivateSubscriptionTemplate(
  db: DatabaseAdapter,
  subscriptionId: string,
  nextRenewal: string,
): void {
  const template = getTemplateBySubscriptionId(db, subscriptionId);
  if (!template) return;
  updateTemplateFields(db, template.id, { is_active: 1, next_date: nextRenewal });
}
