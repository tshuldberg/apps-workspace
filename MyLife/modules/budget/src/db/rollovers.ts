/**
 * Budget rollover CRUD operations.
 *
 * Rollover records track the carry-forward amount for each envelope
 * transitioning from one month to the next.
 * All amounts in integer cents.
 */

import type { DatabaseAdapter } from '@mylife/db';
import type { BudgetRollover } from '../types';

export interface BudgetRolloverInsert {
  envelope_id: string;
  from_month: string;
  to_month: string;
  amount: number;
}

export function createRollover(
  db: DatabaseAdapter,
  id: string,
  input: BudgetRolloverInsert,
): BudgetRollover {
  const now = new Date().toISOString();
  const rollover: BudgetRollover = {
    id,
    envelope_id: input.envelope_id,
    from_month: input.from_month,
    to_month: input.to_month,
    amount: input.amount,
    created_at: now,
  };

  db.execute(
    `INSERT INTO bg_budget_rollovers (id, envelope_id, from_month, to_month, amount, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [rollover.id, rollover.envelope_id, rollover.from_month, rollover.to_month, rollover.amount, rollover.created_at],
  );

  return rollover;
}

export function getRolloverById(
  db: DatabaseAdapter,
  id: string,
): BudgetRollover | null {
  const rows = db.query<BudgetRollover>(
    `SELECT * FROM bg_budget_rollovers WHERE id = ?`,
    [id],
  );
  return rows[0] ?? null;
}

export function getRollovers(
  db: DatabaseAdapter,
): BudgetRollover[] {
  return db.query<BudgetRollover>(
    `SELECT * FROM bg_budget_rollovers ORDER BY created_at DESC`,
  );
}

export function getRolloversByMonth(
  db: DatabaseAdapter,
  toMonth: string,
): BudgetRollover[] {
  return db.query<BudgetRollover>(
    `SELECT * FROM bg_budget_rollovers WHERE to_month = ? ORDER BY envelope_id`,
    [toMonth],
  );
}

export function getRolloversByEnvelope(
  db: DatabaseAdapter,
  envelopeId: string,
): BudgetRollover[] {
  return db.query<BudgetRollover>(
    `SELECT * FROM bg_budget_rollovers WHERE envelope_id = ? ORDER BY from_month DESC`,
    [envelopeId],
  );
}

export function deleteRollover(
  db: DatabaseAdapter,
  id: string,
): void {
  db.execute(`DELETE FROM bg_budget_rollovers WHERE id = ?`, [id]);
}

export function deleteRolloversByMonth(
  db: DatabaseAdapter,
  fromMonth: string,
): void {
  db.execute(`DELETE FROM bg_budget_rollovers WHERE from_month = ?`, [fromMonth]);
}
