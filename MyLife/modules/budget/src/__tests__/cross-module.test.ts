import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { DatabaseAdapter } from '@mylife/db';
import { createModuleTestDatabase } from '@mylife/db';
import { BUDGET_MODULE } from '../definition';
import { createEnvelope, createTransaction, createGoal, createBudgetAlert, createAlertHistory } from '../db';
import { updatePayeeCache } from '../db';
import { budgetCrossModule } from '../cross-module';

describe('budget crossModule interface', () => {
  let adapter: DatabaseAdapter;
  let closeDb: () => void;

  // Seed migrations create default envelopes: env-rent (Rent), env-groceries (Groceries),
  // env-transport (Transport), env-fun (Fun). Use different names to avoid UNIQUE conflicts.
  const TEST_ENV_FOOD = 'env-cm-food';
  const TEST_ENV_DINING = 'env-cm-dining';

  beforeEach(() => {
    const testDb = createModuleTestDatabase('budget', BUDGET_MODULE.migrations!);
    adapter = testDb.adapter;
    closeDb = testDb.close;
  });

  afterEach(() => {
    closeDb();
  });

  function seedBasicData() {
    createEnvelope(adapter, TEST_ENV_FOOD, {
      name: 'Food & Supplies',
      monthly_budget: 50000, // $500
    });
    createEnvelope(adapter, TEST_ENV_DINING, {
      name: 'Dining Out',
      monthly_budget: 20000, // $200
    });

    const today = new Date().toISOString().slice(0, 10);
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);

    createTransaction(adapter, 'tx1', {
      envelope_id: TEST_ENV_FOOD,
      amount: 4299,
      direction: 'outflow',
      merchant: 'Trader Joes',
      note: 'Weekly groceries run',
      occurred_on: today,
    });
    createTransaction(adapter, 'tx2', {
      envelope_id: TEST_ENV_DINING,
      amount: 2150,
      direction: 'outflow',
      merchant: 'Chipotle',
      occurred_on: today,
    });
    createTransaction(adapter, 'tx3', {
      amount: 500000,
      direction: 'inflow',
      merchant: 'Employer Inc',
      note: 'Paycheck',
      occurred_on: yesterday,
    });
  }

  describe('getSearchableContent', () => {
    it('returns transactions with merchant names and notes', () => {
      seedBasicData();
      const items = budgetCrossModule.getSearchableContent!(adapter);

      const txItems = items.filter((i) => i.type === 'transaction');
      expect(txItems.length).toBe(3);

      const traderJoes = txItems.find((i) => i.title === 'Trader Joes');
      expect(traderJoes).toBeDefined();
      expect(traderJoes!.body).toBe('Weekly groceries run');
      expect(traderJoes!.tags).toContain('Food & Supplies');
      expect(traderJoes!.moduleId).toBe('budget');
    });

    it('returns envelope names as searchable items', () => {
      seedBasicData();
      const items = budgetCrossModule.getSearchableContent!(adapter);

      const envItems = items.filter((i) => i.type === 'envelope');
      // 4 seed defaults + 2 test envelopes = 6
      expect(envItems.length).toBe(6);
      const names = envItems.map((i) => i.title);
      expect(names).toContain('Food & Supplies');
      expect(names).toContain('Dining Out');
    });

    it('returns payee cache entries', () => {
      seedBasicData();
      updatePayeeCache(adapter, 'Trader Joes', TEST_ENV_FOOD);

      const items = budgetCrossModule.getSearchableContent!(adapter);
      const payeeItems = items.filter((i) => i.type === 'payee');
      expect(payeeItems.length).toBe(1);
      expect(payeeItems[0].title).toBe('Trader Joes');
    });

    it('returns items with no test data (seed defaults only)', () => {
      const items = budgetCrossModule.getSearchableContent!(adapter);
      expect(Array.isArray(items)).toBe(true);
      // Seed envelopes exist
      const envItems = items.filter((i) => i.type === 'envelope');
      expect(envItems.length).toBe(4);
    });
  });

  describe('getDataSummary', () => {
    it('returns correct budget stats', () => {
      seedBasicData();
      const summary = budgetCrossModule.getDataSummary!(adapter);

      expect(summary.moduleId).toBe('budget');
      expect(summary.totalItems).toBe(3); // 3 transactions
      // 4 seed envelopes (budget=0) + 2 test envelopes (50000+20000)
      expect(summary.stats.envelopeCount).toBe(6);
      expect(summary.stats.totalBudgetCents).toBe(70000);
      expect(summary.stats.spentTodayCents).toBe(4299 + 2150); // today's outflows
      expect(summary.stats.totalGoals).toBe(0);
      expect(summary.lastActivity).toBeDefined();
    });

    it('includes goal progress stats', () => {
      seedBasicData();
      createGoal(adapter, 'goal1', {
        envelope_id: TEST_ENV_FOOD,
        name: 'Emergency Fund',
        target_amount: 100000,
        completed_amount: 25000,
      });
      createGoal(adapter, 'goal2', {
        envelope_id: TEST_ENV_DINING,
        name: 'Vacation Fund',
        target_amount: 200000,
        completed_amount: 200000,
        is_completed: 1,
      });

      const summary = budgetCrossModule.getDataSummary!(adapter);
      expect(summary.stats.totalGoals).toBe(2);
      expect(summary.stats.completedGoals).toBe(1);
      expect(summary.stats.goalTargetCents).toBe(300000);
      expect(summary.stats.goalSavedCents).toBe(225000);
    });

    it('handles empty database (seed defaults only)', () => {
      const summary = budgetCrossModule.getDataSummary!(adapter);
      expect(summary.moduleId).toBe('budget');
      expect(summary.totalItems).toBe(0);
      expect(summary.stats.spentTodayCents).toBe(0);
    });
  });

  describe('getActivityFeed', () => {
    it('returns recent transactions as activity items', () => {
      seedBasicData();
      const since = new Date(Date.now() - 7 * 86400000); // 7 days ago
      const items = budgetCrossModule.getActivityFeed!(adapter, since);

      const txItems = items.filter((i) => i.itemType === 'transaction');
      expect(txItems.length).toBe(3);

      const spend = txItems.find((i) => i.action === 'spent' && i.description.includes('Trader Joes'));
      expect(spend).toBeDefined();
      expect(spend!.description).toContain('$42.99');

      const income = txItems.find((i) => i.action === 'received');
      expect(income).toBeDefined();
      expect(income!.description).toContain('$5000.00');
    });

    it('returns completed goal milestones', () => {
      seedBasicData();
      createGoal(adapter, 'goal1', {
        envelope_id: TEST_ENV_FOOD,
        name: 'Emergency Fund',
        target_amount: 100000,
        is_completed: 1,
      });

      const since = new Date(Date.now() - 7 * 86400000);
      const items = budgetCrossModule.getActivityFeed!(adapter, since);

      const goalItems = items.filter((i) => i.itemType === 'goal');
      expect(goalItems.length).toBe(1);
      expect(goalItems[0].action).toBe('completed');
      expect(goalItems[0].description).toContain('Emergency Fund');
      expect(goalItems[0].description).toContain('$1000.00');
    });

    it('returns alert history items', () => {
      seedBasicData();
      createBudgetAlert(adapter, 'alert1', { envelope_id: TEST_ENV_FOOD, threshold_pct: 80 });
      createAlertHistory(adapter, 'ah1', {
        alert_id: 'alert1',
        envelope_id: TEST_ENV_FOOD,
        month: '2026-03',
        threshold_pct: 80,
        spent_pct: 85,
        amount_spent: 42500,
        target_amount: 50000,
      });

      const since = new Date(Date.now() - 7 * 86400000);
      const items = budgetCrossModule.getActivityFeed!(adapter, since);

      const alertItems = items.filter((i) => i.itemType === 'alert');
      expect(alertItems.length).toBe(1);
      expect(alertItems[0].description).toContain('Food & Supplies');
      expect(alertItems[0].description).toContain('85%');
    });

    it('filters by since date', () => {
      seedBasicData();
      const future = new Date(Date.now() + 86400000); // tomorrow
      const items = budgetCrossModule.getActivityFeed!(adapter, future);
      expect(items.length).toBe(0);
    });

    it('sorts items by timestamp descending', () => {
      seedBasicData();
      const since = new Date(Date.now() - 7 * 86400000);
      const items = budgetCrossModule.getActivityFeed!(adapter, since);

      for (let i = 1; i < items.length; i++) {
        expect(items[i - 1].timestamp >= items[i].timestamp).toBe(true);
      }
    });
  });

  describe('getCorrelationData', () => {
    it('returns daily spending and income series', () => {
      seedBasicData();
      const dataset = budgetCrossModule.getCorrelationData!(adapter);

      expect(dataset.moduleId).toBe('budget');
      expect(dataset.series).toHaveLength(2);

      const spendingSeries = dataset.series.find((s) => s.metric === 'daily_spending');
      expect(spendingSeries).toBeDefined();
      expect(spendingSeries!.label).toBe('Daily Spending');
      expect(spendingSeries!.unit).toBe('cents');
      expect(spendingSeries!.data.length).toBeGreaterThan(0);

      const incomeSeries = dataset.series.find((s) => s.metric === 'daily_income');
      expect(incomeSeries).toBeDefined();
      expect(incomeSeries!.data.length).toBeGreaterThan(0);
    });

    it('aggregates spending by day', () => {
      seedBasicData();
      const dataset = budgetCrossModule.getCorrelationData!(adapter);
      const spendingSeries = dataset.series.find((s) => s.metric === 'daily_spending')!;

      // Today has two outflow transactions: 4299 + 2150 = 6449
      const today = new Date().toISOString().slice(0, 10);
      const todayPoint = spendingSeries.data.find((d) => d.date === today);
      expect(todayPoint).toBeDefined();
      expect(todayPoint!.value).toBe(6449);
    });

    it('returns empty series with no transactions', () => {
      const dataset = budgetCrossModule.getCorrelationData!(adapter);
      expect(dataset.series[0].data).toHaveLength(0);
      expect(dataset.series[1].data).toHaveLength(0);
    });
  });

  describe('BUDGET_MODULE.crossModule', () => {
    it('is wired into the module definition', () => {
      expect(BUDGET_MODULE.crossModule).toBeDefined();
      expect(BUDGET_MODULE.crossModule!.getSearchableContent).toBeTypeOf('function');
      expect(BUDGET_MODULE.crossModule!.getDataSummary).toBeTypeOf('function');
      expect(BUDGET_MODULE.crossModule!.getActivityFeed).toBeTypeOf('function');
      expect(BUDGET_MODULE.crossModule!.getCorrelationData).toBeTypeOf('function');
    });
  });
});
