/**
 * Budget alerts and alert history CRUD operations.
 *
 * Alerts configure per-envelope spending thresholds (e.g., notify at 80%).
 * Alert history tracks when alerts have fired to prevent duplicates.
 * All amounts in integer cents.
 */

import type { DatabaseAdapter } from '@mylife/db';
import type {
  BudgetAlert,
  BudgetAlertInsert,
  AlertHistory,
} from '../types';

const ALERT_COLUMNS = new Set(['threshold_pct', 'is_enabled']);

export interface AlertHistoryInsert {
  alert_id: string;
  envelope_id: string;
  month: string;
  threshold_pct: number;
  spent_pct: number;
  amount_spent: number;
  target_amount: number;
}

// ---------------------------------------------------------------------------
// Alert CRUD
// ---------------------------------------------------------------------------

export function createBudgetAlert(
  db: DatabaseAdapter,
  id: string,
  input: BudgetAlertInsert,
): BudgetAlert {
  const now = new Date().toISOString();
  const alert: BudgetAlert = {
    id,
    envelope_id: input.envelope_id,
    threshold_pct: input.threshold_pct ?? 80,
    is_enabled: input.is_enabled ?? 1,
    created_at: now,
    updated_at: now,
  };

  db.execute(
    `INSERT INTO bg_budget_alerts (id, envelope_id, threshold_pct, is_enabled, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [alert.id, alert.envelope_id, alert.threshold_pct, alert.is_enabled, alert.created_at, alert.updated_at],
  );

  return alert;
}

export function getBudgetAlertById(
  db: DatabaseAdapter,
  id: string,
): BudgetAlert | null {
  const rows = db.query<BudgetAlert>(
    `SELECT * FROM bg_budget_alerts WHERE id = ?`,
    [id],
  );
  return rows[0] ?? null;
}

export function getBudgetAlerts(
  db: DatabaseAdapter,
): BudgetAlert[] {
  return db.query<BudgetAlert>(
    `SELECT * FROM bg_budget_alerts ORDER BY created_at DESC`,
  );
}

export function getAlertsByEnvelope(
  db: DatabaseAdapter,
  envelopeId: string,
): BudgetAlert[] {
  return db.query<BudgetAlert>(
    `SELECT * FROM bg_budget_alerts WHERE envelope_id = ? ORDER BY threshold_pct`,
    [envelopeId],
  );
}

export function updateBudgetAlert(
  db: DatabaseAdapter,
  id: string,
  updates: Partial<Pick<BudgetAlert, 'threshold_pct' | 'is_enabled'>>,
): void {
  const fields: string[] = [];
  const values: unknown[] = [];

  for (const [key, value] of Object.entries(updates)) {
    if (value !== undefined && ALERT_COLUMNS.has(key)) {
      fields.push(`${key} = ?`);
      values.push(value);
    }
  }

  if (fields.length === 0) return;

  fields.push('updated_at = ?');
  values.push(new Date().toISOString());
  values.push(id);

  db.execute(
    `UPDATE bg_budget_alerts SET ${fields.join(', ')} WHERE id = ?`,
    values,
  );
}

export function deleteBudgetAlert(
  db: DatabaseAdapter,
  id: string,
): void {
  db.execute(`DELETE FROM bg_budget_alerts WHERE id = ?`, [id]);
}

// ---------------------------------------------------------------------------
// Alert History
// ---------------------------------------------------------------------------

export function createAlertHistory(
  db: DatabaseAdapter,
  id: string,
  input: AlertHistoryInsert,
): AlertHistory {
  const now = new Date().toISOString();
  const entry: AlertHistory = {
    id,
    alert_id: input.alert_id,
    envelope_id: input.envelope_id,
    month: input.month,
    threshold_pct: input.threshold_pct,
    spent_pct: input.spent_pct,
    amount_spent: input.amount_spent,
    target_amount: input.target_amount,
    notified_at: now,
  };

  db.execute(
    `INSERT INTO bg_alert_history (id, alert_id, envelope_id, month, threshold_pct, spent_pct, amount_spent, target_amount, notified_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [entry.id, entry.alert_id, entry.envelope_id, entry.month, entry.threshold_pct, entry.spent_pct, entry.amount_spent, entry.target_amount, entry.notified_at],
  );

  return entry;
}

export function getAlertHistoryByAlert(
  db: DatabaseAdapter,
  alertId: string,
): AlertHistory[] {
  return db.query<AlertHistory>(
    `SELECT * FROM bg_alert_history WHERE alert_id = ? ORDER BY notified_at DESC`,
    [alertId],
  );
}

export function getAlertHistoryByMonth(
  db: DatabaseAdapter,
  month: string,
): AlertHistory[] {
  return db.query<AlertHistory>(
    `SELECT * FROM bg_alert_history WHERE month = ? ORDER BY notified_at DESC`,
    [month],
  );
}

export function deleteAlertHistory(
  db: DatabaseAdapter,
  id: string,
): void {
  db.execute(`DELETE FROM bg_alert_history WHERE id = ?`, [id]);
}
