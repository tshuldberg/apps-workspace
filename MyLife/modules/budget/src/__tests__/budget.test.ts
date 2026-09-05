import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { DatabaseAdapter } from '@mylife/db';
import { createModuleTestDatabase } from '@mylife/db';
import { BUDGET_MODULE } from '../definition';
import {
  createEnvelope,
  getEnvelopeById,
  getEnvelopes,
  updateEnvelope,
  deleteEnvelope,
  countEnvelopes,
  createAccount,
  getAccountById,
  getAccounts,
  updateAccount,
  deleteAccount,
  createTransaction,
  getTransactionById,
  getTransactions,
  deleteTransaction,
  countTransactions,
  createGoal,
  getGoalById,
  getGoals,
  updateGoal,
  deleteGoal,
  getSetting,
  setSetting,
  createSubscription,
  getSubscriptionById,
  getSubscriptions,
  updateSubscription,
  deleteSubscription,
  pauseSubscription,
  cancelSubscription,
  resumeSubscription,
} from '../db/crud';

describe('@mylife/budget', () => {
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

  describe('BUDGET_MODULE definition', () => {
    it('has correct metadata', () => {
      expect(BUDGET_MODULE.id).toBe('budget');
      expect(BUDGET_MODULE.tier).toBe('premium');
      expect(BUDGET_MODULE.storageType).toBe('sqlite');
      expect(BUDGET_MODULE.tablePrefix).toBe('bg_');
      expect(BUDGET_MODULE.schemaVersion).toBe(6);
      expect(BUDGET_MODULE.migrations).toHaveLength(6);
    });

    it('has 5 navigation tabs', () => {
      expect(BUDGET_MODULE.navigation.tabs).toHaveLength(5);
    });
  });

  describe('seeded data', () => {
    it('has default settings from seed', () => {
      expect(getSetting(adapter, 'currency')).toBe('USD');
    });

    it('creates bank sync scaffolding tables', () => {
      const rows = adapter.query<{ name: string }>(
        `SELECT name FROM sqlite_master
         WHERE type = 'table'
           AND name IN ('bg_bank_connections', 'bg_bank_accounts', 'bg_bank_transactions_raw', 'bg_bank_sync_state', 'bg_bank_webhook_events')`,
      );
      expect(rows).toHaveLength(5);
    });
  });

  describe('seeded envelopes and accounts', () => {
    it('seeds 4 default envelopes', () => {
      expect(countEnvelopes(adapter)).toBe(4);
      const envs = getEnvelopes(adapter, true);
      const names = envs.map((e) => e.name);
      expect(names).toContain('Rent');
      expect(names).toContain('Groceries');
    });

    it('seeds 2 default accounts', () => {
      const accts = getAccounts(adapter, true);
      expect(accts).toHaveLength(2);
      expect(accts.map((a) => a.name)).toContain('Checking');
    });
  });

  describe('envelopes', () => {
    it('creates and retrieves an envelope', () => {
      const e = createEnvelope(adapter, 'e1', { name: 'Dining Out', monthly_budget: 50000 });
      expect(e.name).toBe('Dining Out');
      expect(e.monthly_budget).toBe(50000);
      const found = getEnvelopeById(adapter, 'e1');
      expect(found).not.toBeNull();
      expect(found!.name).toBe('Dining Out');
    });

    it('lists envelopes excluding archived', () => {
      const beforeCount = getEnvelopes(adapter).length;
      createEnvelope(adapter, 'e1', { name: 'Active Test' });
      createEnvelope(adapter, 'e2', { name: 'Archived Test', archived: 1 });
      expect(getEnvelopes(adapter)).toHaveLength(beforeCount + 1);
      expect(getEnvelopes(adapter, true)).toHaveLength(beforeCount + 2);
    });

    it('updates an envelope', () => {
      createEnvelope(adapter, 'e1', { name: 'Old Name' });
      updateEnvelope(adapter, 'e1', { name: 'New Name' });
      expect(getEnvelopeById(adapter, 'e1')!.name).toBe('New Name');
    });

    it('deletes an envelope', () => {
      createEnvelope(adapter, 'e1', { name: 'Delete Me' });
      const before = countEnvelopes(adapter);
      deleteEnvelope(adapter, 'e1');
      expect(countEnvelopes(adapter)).toBe(before - 1);
    });
  });

  describe('accounts', () => {
    it('creates and retrieves an account', () => {
      const a = createAccount(adapter, 'a1', { name: 'Savings Account' });
      expect(a.type).toBe('checking');
      expect(a.currency).toBe('USD');
      expect(getAccountById(adapter, 'a1')).not.toBeNull();
    });

    it('lists accounts excluding archived', () => {
      const beforeCount = getAccounts(adapter).length;
      createAccount(adapter, 'a1', { name: 'Active Test' });
      createAccount(adapter, 'a2', { name: 'Old Test', archived: 1 });
      expect(getAccounts(adapter)).toHaveLength(beforeCount + 1);
      expect(getAccounts(adapter, true)).toHaveLength(beforeCount + 2);
    });

    it('updates an account', () => {
      createAccount(adapter, 'a1', { name: 'Old' });
      updateAccount(adapter, 'a1', { name: 'New' });
      expect(getAccountById(adapter, 'a1')!.name).toBe('New');
    });

    it('deletes an account', () => {
      createAccount(adapter, 'a1', { name: 'Test' });
      deleteAccount(adapter, 'a1');
      expect(getAccountById(adapter, 'a1')).toBeNull();
    });
  });

  describe('transactions', () => {
    it('creates and retrieves a transaction', () => {
      const tx = createTransaction(adapter, 't1', {
        amount: 5000, direction: 'outflow', occurred_on: '2026-01-15',
      });
      expect(tx.amount).toBe(5000);
      expect(getTransactionById(adapter, 't1')).not.toBeNull();
    });

    it('filters by direction', () => {
      createTransaction(adapter, 't1', { amount: 100, direction: 'outflow', occurred_on: '2026-01-01' });
      createTransaction(adapter, 't2', { amount: 200, direction: 'inflow', occurred_on: '2026-01-02' });
      expect(getTransactions(adapter, { direction: 'outflow' })).toHaveLength(1);
    });

    it('filters by date range', () => {
      createTransaction(adapter, 't1', { amount: 100, direction: 'outflow', occurred_on: '2026-01-01' });
      createTransaction(adapter, 't2', { amount: 200, direction: 'outflow', occurred_on: '2026-02-01' });
      const results = getTransactions(adapter, { from_date: '2026-01-15', to_date: '2026-02-15' });
      expect(results).toHaveLength(1);
      expect(results[0].id).toBe('t2');
    });

    it('deletes a transaction', () => {
      createTransaction(adapter, 't1', { amount: 100, direction: 'outflow', occurred_on: '2026-01-01' });
      deleteTransaction(adapter, 't1');
      expect(countTransactions(adapter)).toBe(0);
    });
  });

  describe('goals', () => {
    it('creates and retrieves a goal', () => {
      createEnvelope(adapter, 'e1', { name: 'Savings Goal Env' });
      const g = createGoal(adapter, 'g1', { envelope_id: 'e1', name: 'Vacation', target_amount: 100000 });
      expect(g.target_amount).toBe(100000);
      expect(getGoalById(adapter, 'g1')).not.toBeNull();
    });

    it('filters goals by envelope', () => {
      createEnvelope(adapter, 'e1', { name: 'Goal Env A' });
      createEnvelope(adapter, 'e2', { name: 'Goal Env B' });
      createGoal(adapter, 'g1', { envelope_id: 'e1', name: 'G1', target_amount: 1000 });
      createGoal(adapter, 'g2', { envelope_id: 'e2', name: 'G2', target_amount: 2000 });
      expect(getGoals(adapter, 'e1')).toHaveLength(1);
      expect(getGoals(adapter)).toHaveLength(2);
    });

    it('updates a goal', () => {
      createEnvelope(adapter, 'e1', { name: 'Update Goal Env' });
      createGoal(adapter, 'g1', { envelope_id: 'e1', name: 'Old', target_amount: 1000 });
      updateGoal(adapter, 'g1', { name: 'New' });
      expect(getGoalById(adapter, 'g1')!.name).toBe('New');
    });

    it('deletes a goal', () => {
      createEnvelope(adapter, 'e1', { name: 'Delete Goal Env' });
      createGoal(adapter, 'g1', { envelope_id: 'e1', name: 'G', target_amount: 1000 });
      deleteGoal(adapter, 'g1');
      expect(getGoalById(adapter, 'g1')).toBeNull();
    });
  });

  describe('settings', () => {
    it('updates a setting', () => {
      setSetting(adapter, 'currency', 'EUR');
      expect(getSetting(adapter, 'currency')).toBe('EUR');
    });
  });

  describe('subscriptions', () => {
    it('creates and retrieves a subscription', () => {
      const sub = createSubscription(adapter, 's1', {
        name: 'Netflix',
        price: 1599,
        billing_cycle: 'monthly',
        status: 'active',
        start_date: '2026-01-01',
        next_renewal: '2026-02-01',
      });
      expect(sub.name).toBe('Netflix');
      expect(sub.price).toBe(1599);
      expect(sub.billing_cycle).toBe('monthly');
      expect(sub.status).toBe('active');

      const found = getSubscriptionById(adapter, 's1');
      expect(found).not.toBeNull();
      expect(found!.name).toBe('Netflix');
    });

    it('lists subscriptions with optional status filter', () => {
      createSubscription(adapter, 's1', {
        name: 'Netflix', price: 1599, billing_cycle: 'monthly',
        status: 'active', start_date: '2026-01-01', next_renewal: '2026-02-01',
      });
      createSubscription(adapter, 's2', {
        name: 'Old Service', price: 999, billing_cycle: 'monthly',
        status: 'cancelled', start_date: '2025-01-01', next_renewal: '2025-02-01',
      });

      expect(getSubscriptions(adapter)).toHaveLength(2);
      expect(getSubscriptions(adapter, { status: 'active' })).toHaveLength(1);
      expect(getSubscriptions(adapter, { status: 'cancelled' })).toHaveLength(1);
    });

    it('updates a subscription', () => {
      createSubscription(adapter, 's1', {
        name: 'Netflix', price: 1599, billing_cycle: 'monthly',
        status: 'active', start_date: '2026-01-01', next_renewal: '2026-02-01',
      });
      updateSubscription(adapter, 's1', { price: 2299 });
      expect(getSubscriptionById(adapter, 's1')!.price).toBe(2299);
    });

    it('pauses an active subscription', () => {
      createSubscription(adapter, 's1', {
        name: 'Netflix', price: 1599, billing_cycle: 'monthly',
        status: 'active', start_date: '2026-01-01', next_renewal: '2026-02-01',
      });
      pauseSubscription(adapter, 's1');
      expect(getSubscriptionById(adapter, 's1')!.status).toBe('paused');
    });

    it('resumes a paused subscription', () => {
      createSubscription(adapter, 's1', {
        name: 'Netflix', price: 1599, billing_cycle: 'monthly',
        status: 'paused', start_date: '2026-01-01', next_renewal: '2026-02-01',
      });
      resumeSubscription(adapter, 's1');
      expect(getSubscriptionById(adapter, 's1')!.status).toBe('active');
    });

    it('cancels a subscription', () => {
      createSubscription(adapter, 's1', {
        name: 'Netflix', price: 1599, billing_cycle: 'monthly',
        status: 'active', start_date: '2026-01-01', next_renewal: '2026-02-01',
      });
      cancelSubscription(adapter, 's1');
      const sub = getSubscriptionById(adapter, 's1')!;
      expect(sub.status).toBe('cancelled');
      expect(sub.cancelled_date).not.toBeNull();
    });

    it('deletes a subscription', () => {
      createSubscription(adapter, 's1', {
        name: 'Netflix', price: 1599, billing_cycle: 'monthly',
        status: 'active', start_date: '2026-01-01', next_renewal: '2026-02-01',
      });
      deleteSubscription(adapter, 's1');
      expect(getSubscriptionById(adapter, 's1')).toBeNull();
    });

    it('creates subscription table and indexes via V3 migration', () => {
      const tables = adapter.query<{ name: string }>(
        `SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'bg_subscriptions'`,
      );
      expect(tables).toHaveLength(1);

      const indexes = adapter.query<{ name: string }>(
        `SELECT name FROM sqlite_master WHERE type = 'index' AND name LIKE 'bg_subscriptions_%'`,
      );
      expect(indexes.length).toBeGreaterThanOrEqual(3);
    });
  });
});
