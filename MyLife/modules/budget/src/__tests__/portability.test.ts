import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { DatabaseAdapter } from '@mylife/db';
import { createModuleTestDatabase } from '@mylife/db';
import { createAccount, createEnvelope, createGoal, createTransaction, getAccounts, getEnvelopes, getGoals, getSetting, getTransactions } from '../db/crud';
import { BUDGET_MODULE } from '../definition';
import { buildBudgetExportBundle, exportBudgetTransactionsCsv, resetBudgetData, serializeBudgetExportJson } from '../portability';

describe('@mylife/budget portability', () => {
  let adapter: DatabaseAdapter;
  let closeDb: () => void;

  beforeEach(() => {
    const testDb = createModuleTestDatabase('budget', BUDGET_MODULE.migrations!);
    adapter = testDb.adapter;
    closeDb = testDb.close;
  });

  afterEach(() => {
    closeDb();
  });

  it('exports a structured budget bundle with budget table data', () => {
    createEnvelope(adapter, 'env-test', { name: 'Travel', monthly_budget: 50000 });
    createAccount(adapter, 'acct-test', { name: 'Travel Card', type: 'credit' });
    createGoal(adapter, 'goal-test', { envelope_id: 'env-test', name: 'Summer Trip', target_amount: 250000 });
    createTransaction(adapter, 'txn-test', {
      account_id: 'acct-test',
      envelope_id: 'env-test',
      amount: 12500,
      direction: 'outflow',
      merchant: 'Airline',
      occurred_on: '2026-03-09',
    });

    const bundle = buildBudgetExportBundle(adapter);
    const json = JSON.parse(serializeBudgetExportJson(adapter));

    expect(bundle.tableNames).toContain('bg_transactions');
    expect(bundle.counts.bg_transactions).toBe(1);
    expect(bundle.tables.bg_envelopes.some((row) => row.id === 'env-test')).toBe(true);
    expect(json).toMatchObject({
      schemaVersion: 1,
      counts: expect.objectContaining({
        bg_transactions: 1,
      }),
    });
  });

  it('exports transactions as csv', () => {
    createTransaction(adapter, 'txn-test', {
      amount: 4200,
      direction: 'outflow',
      merchant: 'Coffee Shop',
      occurred_on: '2026-03-09',
    });

    const csv = exportBudgetTransactionsCsv(adapter);

    expect(csv).toContain('id,envelope_id,account_id,amount,direction,merchant,note,occurred_on,created_at,updated_at');
    expect(csv).toContain('txn-test');
    expect(csv).toContain('Coffee Shop');
  });

  it('resets budget data and restores defaults', () => {
    createEnvelope(adapter, 'env-test', { name: 'Travel', monthly_budget: 50000 });
    createAccount(adapter, 'acct-test', { name: 'Travel Card', type: 'credit' });
    createGoal(adapter, 'goal-test', { envelope_id: 'env-test', name: 'Summer Trip', target_amount: 250000 });
    createTransaction(adapter, 'txn-test', {
      account_id: 'acct-test',
      envelope_id: 'env-test',
      amount: 12500,
      direction: 'outflow',
      occurred_on: '2026-03-09',
    });

    const result = resetBudgetData(adapter);

    expect(result.rowsDeleted).toBeGreaterThan(0);
    expect(result.defaultsRestored).toBe(true);
    expect(getSetting(adapter, 'currency')).toBe('USD');
    expect(getTransactions(adapter)).toHaveLength(0);
    expect(getGoals(adapter)).toHaveLength(0);
    expect(getAccounts(adapter, true).map((row) => row.name)).toEqual(['Checking', 'Cash']);
    expect(getEnvelopes(adapter, true).map((row) => row.name)).toEqual(['Rent', 'Groceries', 'Transport', 'Fun']);
  });
});
