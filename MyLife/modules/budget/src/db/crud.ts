/**
 * Budget CRUD operations.
 *
 * All currency amounts are integer cents.
 * Booleans are stored as INTEGER (0/1) in SQLite.
 */

import type { DatabaseAdapter } from '@mylife/db';
import type {
  Account,
  AccountInsert,
  AccountUpdate,
  BudgetGoal,
  BudgetGoalInsert,
  BudgetGoalUpdate,
  BudgetSubscription,
  BudgetSubscriptionFilter,
  BudgetSubscriptionInsert,
  BudgetSubscriptionUpdate,
  BudgetTransaction,
  BudgetTransactionFilter,
  BudgetTransactionInsert,
  BudgetTransactionUpdate,
  Envelope,
  EnvelopeInsert,
  EnvelopeUpdate,
} from '../types';

// ---------------------------------------------------------------------------
// Column whitelists — prevent dynamic SQL injection via Object.entries
// ---------------------------------------------------------------------------

const ENVELOPE_COLUMNS = new Set([
  'name', 'icon', 'color', 'monthly_budget', 'rollover_enabled', 'archived', 'sort_order',
]);
const ACCOUNT_COLUMNS = new Set([
  'name', 'type', 'current_balance', 'currency', 'archived', 'sort_order',
]);
const TRANSACTION_COLUMNS = new Set([
  'envelope_id', 'account_id', 'amount', 'direction', 'merchant', 'note', 'occurred_on',
]);
const GOAL_COLUMNS = new Set([
  'name', 'target_amount', 'target_date', 'completed_amount', 'is_completed',
]);
const SUBSCRIPTION_COLUMNS = new Set([
  'name', 'price', 'currency', 'billing_cycle', 'custom_days', 'status',
  'start_date', 'next_renewal', 'trial_end_date', 'cancelled_date',
  'notes', 'url', 'icon', 'color', 'notify_days', 'envelope_id', 'catalog_id', 'sort_order',
]);

/** Default max rows for unbounded transaction queries. */
const DEFAULT_TRANSACTION_LIMIT = 500;

function buildUpdateFields(
  updates: Record<string, unknown>,
  allowedColumns: Set<string>,
): { fields: string[]; values: unknown[] } {
  const fields: string[] = [];
  const values: unknown[] = [];
  for (const [key, value] of Object.entries(updates)) {
    if (value !== undefined && allowedColumns.has(key)) {
      fields.push(`${key} = ?`);
      values.push(value);
    }
  }
  return { fields, values };
}

// ---------------------------------------------------------------------------
// Envelopes
// ---------------------------------------------------------------------------

export function createEnvelope(
  db: DatabaseAdapter,
  id: string,
  input: EnvelopeInsert,
): Envelope {
  const now = new Date().toISOString();
  const envelope: Envelope = {
    id,
    name: input.name,
    icon: input.icon ?? null,
    color: input.color ?? null,
    monthly_budget: input.monthly_budget ?? 0,
    rollover_enabled: input.rollover_enabled ?? 1,
    archived: input.archived ?? 0,
    sort_order: input.sort_order ?? 0,
    created_at: now,
    updated_at: now,
  };

  db.execute(
    `INSERT INTO bg_envelopes
      (id, name, icon, color, monthly_budget, rollover_enabled, archived, sort_order, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      envelope.id,
      envelope.name,
      envelope.icon,
      envelope.color,
      envelope.monthly_budget,
      envelope.rollover_enabled,
      envelope.archived,
      envelope.sort_order,
      envelope.created_at,
      envelope.updated_at,
    ],
  );

  return envelope;
}

export function getEnvelopeById(db: DatabaseAdapter, id: string): Envelope | null {
  const rows = db.query<Envelope>(
    `SELECT * FROM bg_envelopes WHERE id = ?`,
    [id],
  );
  return rows[0] ?? null;
}

/** @deprecated Use getEnvelopeById */
export const getEnvelope = getEnvelopeById;

export function getEnvelopes(
  db: DatabaseAdapter,
  includeArchived = false,
): Envelope[] {
  const rows = includeArchived
    ? db.query<Envelope>(
        `SELECT * FROM bg_envelopes ORDER BY archived ASC, sort_order ASC, name ASC`,
      )
    : db.query<Envelope>(
        `SELECT * FROM bg_envelopes WHERE archived = 0 ORDER BY sort_order ASC, name ASC`,
      );
  return rows;
}

/** @deprecated Use getEnvelopes */
export const listEnvelopes = getEnvelopes;

export function updateEnvelope(
  db: DatabaseAdapter,
  id: string,
  updates: EnvelopeUpdate,
): void {
  const { fields, values } = buildUpdateFields(updates as Record<string, unknown>, ENVELOPE_COLUMNS);
  if (fields.length === 0) return;

  fields.push('updated_at = ?');
  values.push(new Date().toISOString());
  values.push(id);

  db.execute(`UPDATE bg_envelopes SET ${fields.join(', ')} WHERE id = ?`, values);
}

export function deleteEnvelope(db: DatabaseAdapter, id: string): void {
  db.execute(`DELETE FROM bg_envelopes WHERE id = ?`, [id]);
}

export function countEnvelopes(db: DatabaseAdapter): number {
  const rows = db.query<{ count: number }>(
    'SELECT COUNT(*) as count FROM bg_envelopes',
  );
  return rows[0]?.count ?? 0;
}

// ---------------------------------------------------------------------------
// Accounts
// ---------------------------------------------------------------------------

export function createAccount(
  db: DatabaseAdapter,
  id: string,
  input: AccountInsert,
): Account {
  const now = new Date().toISOString();
  const account: Account = {
    id,
    name: input.name,
    type: input.type ?? 'checking',
    current_balance: input.current_balance ?? 0,
    currency: input.currency ?? 'USD',
    archived: input.archived ?? 0,
    sort_order: input.sort_order ?? 0,
    created_at: now,
    updated_at: now,
  };

  db.execute(
    `INSERT INTO bg_accounts
      (id, name, type, current_balance, currency, archived, sort_order, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      account.id,
      account.name,
      account.type,
      account.current_balance,
      account.currency,
      account.archived,
      account.sort_order,
      account.created_at,
      account.updated_at,
    ],
  );

  return account;
}

export function getAccountById(db: DatabaseAdapter, id: string): Account | null {
  const rows = db.query<Account>(
    `SELECT * FROM bg_accounts WHERE id = ?`,
    [id],
  );
  return rows[0] ?? null;
}

/** @deprecated Use getAccountById */
export const getAccount = getAccountById;

export function getAccounts(
  db: DatabaseAdapter,
  includeArchived = false,
): Account[] {
  return includeArchived
    ? db.query<Account>(
        `SELECT * FROM bg_accounts ORDER BY archived ASC, sort_order ASC, name ASC`,
      )
    : db.query<Account>(
        `SELECT * FROM bg_accounts WHERE archived = 0 ORDER BY sort_order ASC, name ASC`,
      );
}

/** @deprecated Use getAccounts */
export const listAccounts = getAccounts;

export function updateAccount(
  db: DatabaseAdapter,
  id: string,
  updates: AccountUpdate,
): void {
  const { fields, values } = buildUpdateFields(updates as Record<string, unknown>, ACCOUNT_COLUMNS);
  if (fields.length === 0) return;

  fields.push('updated_at = ?');
  values.push(new Date().toISOString());
  values.push(id);

  db.execute(`UPDATE bg_accounts SET ${fields.join(', ')} WHERE id = ?`, values);
}

export function deleteAccount(db: DatabaseAdapter, id: string): void {
  db.execute(`DELETE FROM bg_accounts WHERE id = ?`, [id]);
}

// ---------------------------------------------------------------------------
// Transactions
// ---------------------------------------------------------------------------

export function createTransaction(
  db: DatabaseAdapter,
  id: string,
  input: BudgetTransactionInsert,
): BudgetTransaction {
  const now = new Date().toISOString();
  const tx: BudgetTransaction = {
    id,
    envelope_id: input.envelope_id ?? null,
    account_id: input.account_id ?? null,
    amount: input.amount,
    direction: input.direction,
    merchant: input.merchant ?? null,
    note: input.note ?? null,
    occurred_on: input.occurred_on,
    created_at: now,
    updated_at: now,
  };

  db.execute(
    `INSERT INTO bg_transactions
      (id, envelope_id, account_id, amount, direction, merchant, note, occurred_on, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      tx.id,
      tx.envelope_id,
      tx.account_id,
      tx.amount,
      tx.direction,
      tx.merchant,
      tx.note,
      tx.occurred_on,
      tx.created_at,
      tx.updated_at,
    ],
  );

  return tx;
}

/**
 * Bulk-insert multiple transactions in a single SQLite transaction.
 *
 * Dramatically faster than calling createTransaction() in a loop — SQLite
 * auto-commits each execute() individually without an explicit transaction,
 * so N inserts = N disk syncs. This wraps them all in one BEGIN/COMMIT.
 *
 * Use this for CSV imports and any batch operation involving >1 row.
 *
 * @param db - Database adapter
 * @param rows - Array of { id, input } pairs to insert
 * @returns Array of inserted BudgetTransaction objects (same order as input)
 */
export function bulkCreateTransactions(
  db: DatabaseAdapter,
  rows: Array<{ id: string; input: BudgetTransactionInsert }>,
): BudgetTransaction[] {
  if (rows.length === 0) return [];
  const now = new Date().toISOString();
  const results: BudgetTransaction[] = [];

  db.transaction(() => {
    for (const { id, input } of rows) {
      const tx: BudgetTransaction = {
        id,
        envelope_id: input.envelope_id ?? null,
        account_id: input.account_id ?? null,
        amount: input.amount,
        direction: input.direction,
        merchant: input.merchant ?? null,
        note: input.note ?? null,
        occurred_on: input.occurred_on,
        created_at: now,
        updated_at: now,
      };

      db.execute(
        `INSERT INTO bg_transactions
          (id, envelope_id, account_id, amount, direction, merchant, note, occurred_on, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          tx.id,
          tx.envelope_id,
          tx.account_id,
          tx.amount,
          tx.direction,
          tx.merchant,
          tx.note,
          tx.occurred_on,
          tx.created_at,
          tx.updated_at,
        ],
      );

      results.push(tx);
    }
  });

  return results;
}

export function getTransactionById(
  db: DatabaseAdapter,
  id: string,
): BudgetTransaction | null {
  const rows = db.query<BudgetTransaction>(
    `SELECT * FROM bg_transactions WHERE id = ?`,
    [id],
  );
  return rows[0] ?? null;
}

/** @deprecated Use getTransactionById */
export const getTransaction = getTransactionById;

export function getTransactions(
  db: DatabaseAdapter,
  filters: BudgetTransactionFilter = {},
): BudgetTransaction[] {
  const where: string[] = [];
  const params: unknown[] = [];

  if (filters.envelope_id) {
    where.push('envelope_id = ?');
    params.push(filters.envelope_id);
  }
  if (filters.account_id) {
    where.push('account_id = ?');
    params.push(filters.account_id);
  }
  if (filters.direction) {
    where.push('direction = ?');
    params.push(filters.direction);
  }
  if (filters.from_date) {
    where.push('occurred_on >= ?');
    params.push(filters.from_date);
  }
  if (filters.to_date) {
    where.push('occurred_on <= ?');
    params.push(filters.to_date);
  }

  let sql = 'SELECT * FROM bg_transactions';
  if (where.length > 0) {
    sql += ` WHERE ${where.join(' AND ')}`;
  }
  sql += ' ORDER BY occurred_on DESC, created_at DESC';

  const limit = filters.limit ?? DEFAULT_TRANSACTION_LIMIT;
  sql += ' LIMIT ?';
  params.push(limit);
  if (filters.offset) {
    sql += ' OFFSET ?';
    params.push(filters.offset);
  }

  return db.query<BudgetTransaction>(sql, params);
}

/** @deprecated Use getTransactions */
export const listTransactions = getTransactions;

export function updateTransaction(
  db: DatabaseAdapter,
  id: string,
  updates: BudgetTransactionUpdate,
): void {
  const { fields, values } = buildUpdateFields(updates as Record<string, unknown>, TRANSACTION_COLUMNS);
  if (fields.length === 0) return;

  fields.push('updated_at = ?');
  values.push(new Date().toISOString());
  values.push(id);

  db.execute(
    `UPDATE bg_transactions SET ${fields.join(', ')} WHERE id = ?`,
    values,
  );
}

export function deleteTransaction(db: DatabaseAdapter, id: string): void {
  db.execute(`DELETE FROM bg_transactions WHERE id = ?`, [id]);
}

export function countTransactions(db: DatabaseAdapter): number {
  const rows = db.query<{ count: number }>(
    'SELECT COUNT(*) as count FROM bg_transactions',
  );
  return rows[0]?.count ?? 0;
}

// ---------------------------------------------------------------------------
// Goals
// ---------------------------------------------------------------------------

export function createGoal(
  db: DatabaseAdapter,
  id: string,
  input: BudgetGoalInsert,
): BudgetGoal {
  const now = new Date().toISOString();
  const goal: BudgetGoal = {
    id,
    envelope_id: input.envelope_id,
    name: input.name,
    target_amount: input.target_amount,
    target_date: input.target_date ?? null,
    completed_amount: input.completed_amount ?? 0,
    is_completed: input.is_completed ?? 0,
    created_at: now,
    updated_at: now,
  };

  db.execute(
    `INSERT INTO bg_goals
      (id, envelope_id, name, target_amount, target_date, completed_amount, is_completed, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      goal.id,
      goal.envelope_id,
      goal.name,
      goal.target_amount,
      goal.target_date,
      goal.completed_amount,
      goal.is_completed,
      goal.created_at,
      goal.updated_at,
    ],
  );

  return goal;
}

export function getGoalById(db: DatabaseAdapter, id: string): BudgetGoal | null {
  const rows = db.query<BudgetGoal>(
    `SELECT * FROM bg_goals WHERE id = ?`,
    [id],
  );
  return rows[0] ?? null;
}

export function getGoals(
  db: DatabaseAdapter,
  envelopeId?: string,
): BudgetGoal[] {
  if (envelopeId) {
    return db.query<BudgetGoal>(
      `SELECT * FROM bg_goals WHERE envelope_id = ? ORDER BY created_at DESC`,
      [envelopeId],
    );
  }
  return db.query<BudgetGoal>(
    `SELECT * FROM bg_goals ORDER BY created_at DESC`,
  );
}

export function updateGoal(
  db: DatabaseAdapter,
  id: string,
  updates: BudgetGoalUpdate,
): void {
  const { fields, values } = buildUpdateFields(updates as Record<string, unknown>, GOAL_COLUMNS);
  if (fields.length === 0) return;

  fields.push('updated_at = ?');
  values.push(new Date().toISOString());
  values.push(id);

  db.execute(`UPDATE bg_goals SET ${fields.join(', ')} WHERE id = ?`, values);
}

export function deleteGoal(db: DatabaseAdapter, id: string): void {
  db.execute(`DELETE FROM bg_goals WHERE id = ?`, [id]);
}

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

export function getSetting(db: DatabaseAdapter, key: string): string | null {
  const rows = db.query<{ value: string }>(
    `SELECT value FROM bg_settings WHERE key = ?`,
    [key],
  );
  return rows[0]?.value ?? null;
}

export function setSetting(db: DatabaseAdapter, key: string, value: string): void {
  db.execute(
    `INSERT OR REPLACE INTO bg_settings (key, value) VALUES (?, ?)`,
    [key, value],
  );
}

// ---------------------------------------------------------------------------
// Subscriptions
// ---------------------------------------------------------------------------

export function createSubscription(
  db: DatabaseAdapter,
  id: string,
  input: BudgetSubscriptionInsert,
): BudgetSubscription {
  const now = new Date().toISOString();
  const sub: BudgetSubscription = {
    id,
    name: input.name,
    price: input.price,
    currency: input.currency ?? 'USD',
    billing_cycle: input.billing_cycle,
    custom_days: input.custom_days ?? null,
    status: input.status,
    start_date: input.start_date,
    next_renewal: input.next_renewal,
    trial_end_date: input.trial_end_date ?? null,
    cancelled_date: input.cancelled_date ?? null,
    notes: input.notes ?? null,
    url: input.url ?? null,
    icon: input.icon ?? null,
    color: input.color ?? null,
    notify_days: input.notify_days ?? 1,
    envelope_id: input.envelope_id ?? null,
    catalog_id: input.catalog_id ?? null,
    sort_order: input.sort_order ?? 0,
    created_at: now,
    updated_at: now,
  };

  db.execute(
    `INSERT INTO bg_subscriptions
      (id, name, price, currency, billing_cycle, custom_days, status,
       start_date, next_renewal, trial_end_date, cancelled_date,
       notes, url, icon, color, notify_days, envelope_id, catalog_id, sort_order,
       created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      sub.id, sub.name, sub.price, sub.currency, sub.billing_cycle,
      sub.custom_days, sub.status, sub.start_date, sub.next_renewal,
      sub.trial_end_date, sub.cancelled_date, sub.notes, sub.url,
      sub.icon, sub.color, sub.notify_days, sub.envelope_id, sub.catalog_id,
      sub.sort_order, sub.created_at, sub.updated_at,
    ],
  );

  return sub;
}

export function getSubscriptionById(
  db: DatabaseAdapter,
  id: string,
): BudgetSubscription | null {
  const rows = db.query<BudgetSubscription>(
    `SELECT * FROM bg_subscriptions WHERE id = ?`,
    [id],
  );
  return rows[0] ?? null;
}

export function getSubscriptions(
  db: DatabaseAdapter,
  filters?: BudgetSubscriptionFilter,
): BudgetSubscription[] {
  const where: string[] = [];
  const params: unknown[] = [];

  if (filters?.status) {
    where.push('status = ?');
    params.push(filters.status);
  }
  if (filters?.billing_cycle) {
    where.push('billing_cycle = ?');
    params.push(filters.billing_cycle);
  }

  let sql = 'SELECT * FROM bg_subscriptions';
  if (where.length > 0) {
    sql += ` WHERE ${where.join(' AND ')}`;
  }
  sql += ' ORDER BY sort_order ASC, name ASC';

  return db.query<BudgetSubscription>(sql, params);
}

export function updateSubscription(
  db: DatabaseAdapter,
  id: string,
  updates: BudgetSubscriptionUpdate,
): void {
  const { fields, values } = buildUpdateFields(updates as Record<string, unknown>, SUBSCRIPTION_COLUMNS);
  if (fields.length === 0) return;

  fields.push('updated_at = ?');
  values.push(new Date().toISOString());
  values.push(id);

  db.execute(
    `UPDATE bg_subscriptions SET ${fields.join(', ')} WHERE id = ?`,
    values,
  );
}

export function deleteSubscription(db: DatabaseAdapter, id: string): void {
  db.execute(`DELETE FROM bg_subscriptions WHERE id = ?`, [id]);
}

export function pauseSubscription(db: DatabaseAdapter, id: string): void {
  const now = new Date().toISOString();
  db.execute(
    `UPDATE bg_subscriptions SET status = 'paused', updated_at = ? WHERE id = ? AND status = 'active'`,
    [now, id],
  );
}

export function cancelSubscription(db: DatabaseAdapter, id: string): void {
  const now = new Date().toISOString();
  const today = now.slice(0, 10);
  db.execute(
    `UPDATE bg_subscriptions SET status = 'cancelled', cancelled_date = ?, updated_at = ? WHERE id = ? AND status != 'cancelled'`,
    [today, now, id],
  );
}

export function resumeSubscription(db: DatabaseAdapter, id: string): void {
  const now = new Date().toISOString();
  db.execute(
    `UPDATE bg_subscriptions SET status = 'active', updated_at = ? WHERE id = ? AND status = 'paused'`,
    [now, id],
  );
}
