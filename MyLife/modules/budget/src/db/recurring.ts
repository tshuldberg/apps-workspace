/**
 * Recurring template CRUD operations.
 *
 * Recurring templates auto-generate transactions on a schedule.
 * Linked to subscriptions via subscription_id when created through
 * the budget bridge.
 */

import type { DatabaseAdapter } from '@mylife/db';
import type {
  RecurringTemplate,
  RecurringTemplateInsert,
  RecurringTemplateUpdate,
} from '../types';

const RECURRING_TEMPLATE_COLUMNS = new Set([
  'account_id', 'envelope_id', 'payee', 'amount', 'frequency',
  'start_date', 'next_date', 'end_date', 'is_active', 'subscription_id',
]);

export function createRecurringTemplate(
  db: DatabaseAdapter,
  id: string,
  input: RecurringTemplateInsert,
): RecurringTemplate {
  const now = new Date().toISOString();
  const template: RecurringTemplate = {
    id,
    account_id: input.account_id,
    envelope_id: input.envelope_id ?? null,
    payee: input.payee,
    amount: input.amount,
    frequency: input.frequency,
    start_date: input.start_date,
    next_date: input.next_date,
    end_date: input.end_date ?? null,
    is_active: input.is_active ?? 1,
    subscription_id: input.subscription_id ?? null,
    created_at: now,
    updated_at: now,
  };

  db.execute(
    `INSERT INTO bg_recurring_templates
     (id, account_id, envelope_id, payee, amount, frequency, start_date, next_date, end_date, is_active, subscription_id, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      template.id, template.account_id, template.envelope_id,
      template.payee, template.amount, template.frequency,
      template.start_date, template.next_date, template.end_date,
      template.is_active, template.subscription_id,
      template.created_at, template.updated_at,
    ],
  );

  return template;
}

export function getRecurringTemplateById(
  db: DatabaseAdapter,
  id: string,
): RecurringTemplate | null {
  const rows = db.query<RecurringTemplate>(
    `SELECT * FROM bg_recurring_templates WHERE id = ?`,
    [id],
  );
  return rows[0] ?? null;
}

export function getRecurringTemplateBySubscriptionId(
  db: DatabaseAdapter,
  subscriptionId: string,
): RecurringTemplate | null {
  const rows = db.query<RecurringTemplate>(
    `SELECT * FROM bg_recurring_templates WHERE subscription_id = ?`,
    [subscriptionId],
  );
  return rows[0] ?? null;
}

export function getActiveTemplates(
  db: DatabaseAdapter,
): RecurringTemplate[] {
  return db.query<RecurringTemplate>(
    `SELECT * FROM bg_recurring_templates WHERE is_active = 1 ORDER BY next_date ASC`,
  );
}

export function updateRecurringTemplate(
  db: DatabaseAdapter,
  id: string,
  updates: RecurringTemplateUpdate,
): void {
  const fields: string[] = [];
  const values: unknown[] = [];

  for (const [key, value] of Object.entries(updates)) {
    if (value !== undefined && RECURRING_TEMPLATE_COLUMNS.has(key)) {
      fields.push(`${key} = ?`);
      values.push(value);
    }
  }

  if (fields.length === 0) return;

  fields.push('updated_at = ?');
  values.push(new Date().toISOString());
  values.push(id);

  db.execute(
    `UPDATE bg_recurring_templates SET ${fields.join(', ')} WHERE id = ?`,
    values,
  );
}

/**
 * Generate pending transactions from active templates whose next_date <= asOfDate.
 * Returns the list of template IDs that generated a transaction.
 */
export function getDueTemplates(
  db: DatabaseAdapter,
  asOfDate: string,
): RecurringTemplate[] {
  return db.query<RecurringTemplate>(
    `SELECT * FROM bg_recurring_templates
     WHERE is_active = 1 AND next_date <= ?
     ORDER BY next_date ASC`,
    [asOfDate],
  );
}
