/**
 * Debt payoff plans and debts CRUD operations.
 *
 * Plans define a repayment strategy (snowball/avalanche) with an
 * extra monthly payment amount. Each plan contains debts with
 * balances, interest rates, and minimum payments.
 *
 * Interest rates in basis points (1800 = 18.00% APR).
 * All currency amounts in integer cents.
 */

import type { DatabaseAdapter } from '@mylife/db';
import type {
  DebtPayoffPlan,
  DebtPayoffPlanInsert,
  DebtPayoffDebt,
  DebtPayoffDebtInsert,
} from '../types';

const DEBT_PLAN_COLUMNS = new Set(['name', 'strategy', 'extra_payment', 'is_active']);
const DEBT_COLUMNS = new Set([
  'account_id', 'name', 'balance', 'interest_rate', 'minimum_payment', 'compounding', 'sort_order',
]);

// ---------------------------------------------------------------------------
// Plans
// ---------------------------------------------------------------------------

export function createDebtPayoffPlan(
  db: DatabaseAdapter,
  id: string,
  input: DebtPayoffPlanInsert,
): DebtPayoffPlan {
  const now = new Date().toISOString();
  const plan: DebtPayoffPlan = {
    id,
    name: input.name,
    strategy: input.strategy,
    extra_payment: input.extra_payment ?? 0,
    is_active: input.is_active ?? 1,
    created_at: now,
    updated_at: now,
  };

  db.execute(
    `INSERT INTO bg_debt_payoff_plans (id, name, strategy, extra_payment, is_active, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [plan.id, plan.name, plan.strategy, plan.extra_payment, plan.is_active, plan.created_at, plan.updated_at],
  );

  return plan;
}

export function getDebtPayoffPlanById(
  db: DatabaseAdapter,
  id: string,
): DebtPayoffPlan | null {
  const rows = db.query<DebtPayoffPlan>(
    `SELECT * FROM bg_debt_payoff_plans WHERE id = ?`,
    [id],
  );
  return rows[0] ?? null;
}

export function getDebtPayoffPlans(
  db: DatabaseAdapter,
): DebtPayoffPlan[] {
  return db.query<DebtPayoffPlan>(
    `SELECT * FROM bg_debt_payoff_plans ORDER BY created_at DESC`,
  );
}

export function getActiveDebtPayoffPlans(
  db: DatabaseAdapter,
): DebtPayoffPlan[] {
  return db.query<DebtPayoffPlan>(
    `SELECT * FROM bg_debt_payoff_plans WHERE is_active = 1 ORDER BY created_at DESC`,
  );
}

export function updateDebtPayoffPlan(
  db: DatabaseAdapter,
  id: string,
  updates: Partial<Pick<DebtPayoffPlan, 'name' | 'strategy' | 'extra_payment' | 'is_active'>>,
): void {
  const fields: string[] = [];
  const values: unknown[] = [];

  for (const [key, value] of Object.entries(updates)) {
    if (value !== undefined && DEBT_PLAN_COLUMNS.has(key)) {
      fields.push(`${key} = ?`);
      values.push(value);
    }
  }

  if (fields.length === 0) return;

  fields.push('updated_at = ?');
  values.push(new Date().toISOString());
  values.push(id);

  db.execute(
    `UPDATE bg_debt_payoff_plans SET ${fields.join(', ')} WHERE id = ?`,
    values,
  );
}

export function deleteDebtPayoffPlan(
  db: DatabaseAdapter,
  id: string,
): void {
  db.execute(`DELETE FROM bg_debt_payoff_plans WHERE id = ?`, [id]);
}

// ---------------------------------------------------------------------------
// Debts
// ---------------------------------------------------------------------------

export function createDebtPayoffDebt(
  db: DatabaseAdapter,
  id: string,
  input: DebtPayoffDebtInsert,
): DebtPayoffDebt {
  const debt: DebtPayoffDebt = {
    id,
    plan_id: input.plan_id,
    account_id: input.account_id ?? null,
    name: input.name,
    balance: input.balance,
    interest_rate: input.interest_rate ?? 0,
    minimum_payment: input.minimum_payment ?? 0,
    compounding: input.compounding ?? 'monthly',
    sort_order: input.sort_order ?? 0,
  };

  db.execute(
    `INSERT INTO bg_debt_payoff_debts (id, plan_id, account_id, name, balance, interest_rate, minimum_payment, compounding, sort_order)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [debt.id, debt.plan_id, debt.account_id, debt.name, debt.balance, debt.interest_rate, debt.minimum_payment, debt.compounding, debt.sort_order],
  );

  return debt;
}

export function getDebtPayoffDebtById(
  db: DatabaseAdapter,
  id: string,
): DebtPayoffDebt | null {
  const rows = db.query<DebtPayoffDebt>(
    `SELECT * FROM bg_debt_payoff_debts WHERE id = ?`,
    [id],
  );
  return rows[0] ?? null;
}

export function getDebtsByPlan(
  db: DatabaseAdapter,
  planId: string,
): DebtPayoffDebt[] {
  return db.query<DebtPayoffDebt>(
    `SELECT * FROM bg_debt_payoff_debts WHERE plan_id = ? ORDER BY sort_order ASC`,
    [planId],
  );
}

export function updateDebtPayoffDebt(
  db: DatabaseAdapter,
  id: string,
  updates: Partial<Pick<DebtPayoffDebt, 'account_id' | 'name' | 'balance' | 'interest_rate' | 'minimum_payment' | 'compounding' | 'sort_order'>>,
): void {
  const fields: string[] = [];
  const values: unknown[] = [];

  for (const [key, value] of Object.entries(updates)) {
    if (value !== undefined && DEBT_COLUMNS.has(key)) {
      fields.push(`${key} = ?`);
      values.push(value);
    }
  }

  if (fields.length === 0) return;
  values.push(id);

  db.execute(
    `UPDATE bg_debt_payoff_debts SET ${fields.join(', ')} WHERE id = ?`,
    values,
  );
}

export function deleteDebtPayoffDebt(
  db: DatabaseAdapter,
  id: string,
): void {
  db.execute(`DELETE FROM bg_debt_payoff_debts WHERE id = ?`, [id]);
}
