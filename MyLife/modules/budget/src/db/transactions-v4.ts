/**
 * Enhanced transaction operations with split support.
 *
 * Splits allow a single transaction to span multiple envelopes.
 * Split amounts must sum to the transaction amount.
 * Also includes budget-engine helpers: getActivityByEnvelope, getTotalIncome.
 */

import type { DatabaseAdapter } from '@mylife/db';
import type {
  BudgetTransaction,
  TransactionSplit,
  TransactionSplitInsert,
} from '../types';

// ---------------------------------------------------------------------------
// Transaction Splits
// ---------------------------------------------------------------------------

export interface TransactionWithSplits {
  transaction: BudgetTransaction;
  splits: TransactionSplit[];
}

export function createTransactionSplits(
  db: DatabaseAdapter,
  splits: Array<{ id: string } & TransactionSplitInsert>,
): TransactionSplit[] {
  const result: TransactionSplit[] = [];
  for (const split of splits) {
    db.execute(
      `INSERT INTO bg_transaction_splits (id, transaction_id, envelope_id, amount, memo)
       VALUES (?, ?, ?, ?, ?)`,
      [split.id, split.transaction_id, split.envelope_id ?? null, split.amount, split.memo ?? null],
    );
    result.push({
      id: split.id,
      transaction_id: split.transaction_id,
      envelope_id: split.envelope_id ?? null,
      amount: split.amount,
      memo: split.memo ?? null,
    });
  }
  return result;
}

export function getSplitsByTransaction(
  db: DatabaseAdapter,
  transactionId: string,
): TransactionSplit[] {
  return db.query<TransactionSplit>(
    `SELECT * FROM bg_transaction_splits WHERE transaction_id = ?`,
    [transactionId],
  );
}

export function replaceSplits(
  db: DatabaseAdapter,
  transactionId: string,
  splits: Array<{ id: string } & TransactionSplitInsert>,
): TransactionSplit[] {
  db.execute(`DELETE FROM bg_transaction_splits WHERE transaction_id = ?`, [transactionId]);
  return createTransactionSplits(db, splits);
}

export function deleteSplitsByTransaction(
  db: DatabaseAdapter,
  transactionId: string,
): void {
  db.execute(`DELETE FROM bg_transaction_splits WHERE transaction_id = ?`, [transactionId]);
}

// ---------------------------------------------------------------------------
// Budget engine helpers
// ---------------------------------------------------------------------------

/**
 * Get activity (sum of split amounts) per envelope for a month.
 * Used by the budget engine's calculateMonthBudget.
 */
export function getActivityByEnvelope(
  db: DatabaseAdapter,
  month: string,
): Map<string, number> {
  const rows = db.query<{ envelope_id: string; total: number }>(
    `SELECT ts.envelope_id, SUM(ts.amount) as total
     FROM bg_transaction_splits ts
     JOIN bg_transactions t ON t.id = ts.transaction_id
     WHERE t.occurred_on >= ? AND t.occurred_on < ?
       AND ts.envelope_id IS NOT NULL
     GROUP BY ts.envelope_id`,
    [`${month}-01`, nextMonth(month) + '-01'],
  );
  const result = new Map<string, number>();
  for (const row of rows) {
    result.set(row.envelope_id, row.total);
  }
  return result;
}

/**
 * Get total income (inflows) for a month.
 */
export function getTotalIncome(
  db: DatabaseAdapter,
  month: string,
): number {
  const rows = db.query<{ total: number | null }>(
    `SELECT COALESCE(SUM(amount), 0) as total
     FROM bg_transactions
     WHERE occurred_on >= ? AND occurred_on < ? AND direction = 'inflow'`,
    [`${month}-01`, nextMonth(month) + '-01'],
  );
  return rows[0]?.total ?? 0;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function nextMonth(month: string): string {
  const [y, m] = month.split('-').map(Number);
  if (m === 12) return `${y + 1}-01`;
  return `${y}-${String(m + 1).padStart(2, '0')}`;
}
