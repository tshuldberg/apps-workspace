/**
 * CRUD operations for Cancellation Actions.
 * Table: bg_cancellation_actions
 */

import type { DatabaseAdapter } from '@mylife/db';
import type { CancellationAction, CancellationActionInsert } from '../types';

function generateId(): string {
  return `ca_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Log a cancellation action.
 */
export function createCancellationAction(
  db: DatabaseAdapter,
  data: CancellationActionInsert,
): CancellationAction | null {
  const id = generateId();
  const actedOn = data.acted_on ?? new Date().toISOString();
  db.execute(
    `INSERT INTO bg_cancellation_actions (id, subscription_id, action, savings_amount, notes, acted_on)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [id, data.subscription_id, data.action, data.savings_amount ?? null, data.notes ?? null, actedOn],
  );
  return getCancellationActionById(db, id);
}

/**
 * Get a cancellation action by ID.
 */
export function getCancellationActionById(
  db: DatabaseAdapter,
  id: string,
): CancellationAction | null {
  const rows = db.query<CancellationAction>(
    `SELECT * FROM bg_cancellation_actions WHERE id = ?`,
    [id],
  );
  return rows[0] ?? null;
}

/**
 * Get all cancellation actions for a subscription, ordered by acted_on descending.
 */
export function getCancellationActionsBySubscription(
  db: DatabaseAdapter,
  subscriptionId: string,
): CancellationAction[] {
  return db.query<CancellationAction>(
    `SELECT * FROM bg_cancellation_actions WHERE subscription_id = ? ORDER BY acted_on DESC`,
    [subscriptionId],
  );
}

/**
 * Get all cancellation actions within a year (for savings calculation).
 */
export function getCancellationActionsByYear(
  db: DatabaseAdapter,
  year: number,
): CancellationAction[] {
  const startDate = `${year}-01-01`;
  const endDate = `${year}-12-31`;
  return db.query<CancellationAction>(
    `SELECT * FROM bg_cancellation_actions WHERE acted_on >= ? AND acted_on <= ? ORDER BY acted_on DESC`,
    [startDate, endDate + 'T23:59:59'],
  );
}

/**
 * Get all cancellation actions (all time).
 */
export function getAllCancellationActions(db: DatabaseAdapter): CancellationAction[] {
  return db.query<CancellationAction>(
    `SELECT * FROM bg_cancellation_actions ORDER BY acted_on DESC`,
  );
}

/**
 * Delete a cancellation action by ID.
 */
export function deleteCancellationAction(db: DatabaseAdapter, id: string): void {
  db.execute(`DELETE FROM bg_cancellation_actions WHERE id = ?`, [id]);
}
