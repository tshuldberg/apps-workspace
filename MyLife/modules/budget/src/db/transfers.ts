/**
 * Account transfer operations.
 *
 * A transfer creates a linked pair of transactions: an outflow from
 * one account and an inflow to another. Both reference each other
 * via transfer_id and are marked with direction = 'transfer'.
 */

import type { DatabaseAdapter } from '@mylife/db';
import type { BudgetTransaction } from '../types';

/**
 * Create a transfer between two accounts.
 * Generates two linked transactions (outflow + inflow).
 */
export function createTransfer(
  db: DatabaseAdapter,
  outflowId: string,
  inflowId: string,
  fromAccountId: string,
  toAccountId: string,
  amount: number,
  date: string,
  memo?: string,
): { outflow: BudgetTransaction; inflow: BudgetTransaction } {
  const now = new Date().toISOString();

  const outflow: BudgetTransaction = {
    id: outflowId,
    envelope_id: null,
    account_id: fromAccountId,
    amount: -Math.abs(amount),
    direction: 'transfer',
    merchant: `Transfer to account`,
    note: memo ?? null,
    occurred_on: date,
    created_at: now,
    updated_at: now,
  };

  const inflow: BudgetTransaction = {
    id: inflowId,
    envelope_id: null,
    account_id: toAccountId,
    amount: Math.abs(amount),
    direction: 'transfer',
    merchant: `Transfer from account`,
    note: memo ?? null,
    occurred_on: date,
    created_at: now,
    updated_at: now,
  };

  db.transaction(() => {
    db.execute(
      `INSERT INTO bg_transactions
       (id, envelope_id, account_id, amount, direction, merchant, note, occurred_on, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [outflow.id, outflow.envelope_id, outflow.account_id, outflow.amount, outflow.direction, outflow.merchant, outflow.note, outflow.occurred_on, outflow.created_at, outflow.updated_at],
    );

    db.execute(
      `INSERT INTO bg_transactions
       (id, envelope_id, account_id, amount, direction, merchant, note, occurred_on, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [inflow.id, inflow.envelope_id, inflow.account_id, inflow.amount, inflow.direction, inflow.merchant, inflow.note, inflow.occurred_on, inflow.created_at, inflow.updated_at],
    );
  });

  return { outflow, inflow };
}

/**
 * Find the paired transaction for a transfer.
 */
export function getTransferPair(
  db: DatabaseAdapter,
  transactionId: string,
): BudgetTransaction | null {
  // A transfer pair shares the same occurred_on, direction='transfer',
  // and opposite amounts. We find the other transaction with matching date
  // and opposite amount.
  const tx = db.query<BudgetTransaction>(
    `SELECT * FROM bg_transactions WHERE id = ?`,
    [transactionId],
  );
  if (!tx[0] || tx[0].direction !== 'transfer') return null;

  const rows = db.query<BudgetTransaction>(
    `SELECT * FROM bg_transactions
     WHERE id != ? AND direction = 'transfer' AND occurred_on = ? AND amount = ?`,
    [transactionId, tx[0].occurred_on, -tx[0].amount],
  );
  return rows[0] ?? null;
}
