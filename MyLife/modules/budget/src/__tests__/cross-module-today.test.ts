import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { DatabaseAdapter } from '@mylife/db';
import { createModuleTestDatabase } from '@mylife/db';
import { BUDGET_MODULE } from '../definition';
import { budgetCrossModule, getTodayCards } from '../cross-module';
import {
  createEnvelope,
  createTransaction,
  createSubscription,
} from '../db';

const NOW = new Date('2026-04-15T12:00:00Z');

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

describe('budget getTodayCards', () => {
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

  it('returns [] for a fresh database (only seed envelopes, no transactions)', () => {
    const cards = getTodayCards(adapter, { now: NOW });
    expect(cards).toEqual([]);
  });

  it('surfaces an envelope progress card when spent / target >= 0.9', () => {
    createEnvelope(adapter, 'env-test-food', {
      name: 'Test Food',
      monthly_budget: 10000, // $100
    });
    // Spend $95 this month -> 95% of target
    createTransaction(adapter, 'tx1', {
      envelope_id: 'env-test-food',
      amount: 9500,
      direction: 'outflow',
      merchant: 'Trader Joes',
      occurred_on: isoDate(NOW),
    });

    const cards = getTodayCards(adapter, { now: NOW });
    const progress = cards.find((c) => c.kind === 'progress');
    expect(progress).toBeDefined();
    expect(progress!.priority).toBe(50);
    expect(progress!.title).toContain('Test Food');
    expect(progress!.title).toContain('95%');
    expect(progress!.moduleId).toBe('budget');
  });

  it('does not surface an envelope card under 90% threshold', () => {
    createEnvelope(adapter, 'env-test', {
      name: 'Test',
      monthly_budget: 10000,
    });
    createTransaction(adapter, 'tx1', {
      envelope_id: 'env-test',
      amount: 5000,
      direction: 'outflow',
      merchant: 'X',
      occurred_on: isoDate(NOW),
    });

    const cards = getTodayCards(adapter, { now: NOW });
    expect(cards.find((c) => c.kind === 'progress')).toBeUndefined();
  });

  it('surfaces an upcoming subscription renewal within 3 days', () => {
    const renewal = new Date(NOW.getTime() + 2 * 86400000);
    createSubscription(adapter, 'sub1', {
      name: 'Netflix',
      price: 1599,
      currency: 'USD',
      billing_cycle: 'monthly',
      status: 'active',
      start_date: '2025-01-01',
      next_renewal: isoDate(renewal),
    });

    const cards = getTodayCards(adapter, { now: NOW });
    const reminder = cards.find((c) => c.kind === 'reminder');
    expect(reminder).toBeDefined();
    expect(reminder!.priority).toBe(60);
    expect(reminder!.title).toContain('Netflix');
    expect(reminder!.moduleId).toBe('budget');
  });

  it('does not surface subscriptions renewing more than 3 days out', () => {
    const renewal = new Date(NOW.getTime() + 7 * 86400000);
    createSubscription(adapter, 'sub1', {
      name: 'Spotify',
      price: 999,
      currency: 'USD',
      billing_cycle: 'monthly',
      status: 'active',
      start_date: '2025-01-01',
      next_renewal: isoDate(renewal),
    });

    const cards = getTodayCards(adapter, { now: NOW });
    expect(cards.find((c) => c.kind === 'reminder')).toBeUndefined();
  });

  it('surfaces an uncategorized transaction action card', () => {
    createTransaction(adapter, 'tx-uncat', {
      amount: 4299,
      direction: 'outflow',
      merchant: 'Mystery Charge',
      occurred_on: isoDate(NOW),
    });

    const cards = getTodayCards(adapter, { now: NOW });
    const action = cards.find((c) => c.kind === 'action');
    expect(action).toBeDefined();
    expect(action!.title).toContain('Mystery Charge');
    expect(action!.cta?.label).toBe('Categorize');
    expect(action!.cta?.route).toBe('/budget/transactions/tx-uncat');
  });

  it('does not surface a categorized transaction', () => {
    createEnvelope(adapter, 'env-x', { name: 'X', monthly_budget: 1000 });
    createTransaction(adapter, 'tx-cat', {
      envelope_id: 'env-x',
      amount: 100,
      direction: 'outflow',
      merchant: 'Categorized',
      occurred_on: isoDate(NOW),
    });

    const cards = getTodayCards(adapter, { now: NOW });
    expect(cards.find((c) => c.kind === 'action')).toBeUndefined();
  });

  it('caps at 3 cards, all priorities <= 100, sorted descending', () => {
    // Envelope > 90%
    createEnvelope(adapter, 'env-food', { name: 'Food', monthly_budget: 10000 });
    createTransaction(adapter, 'tx-spend', {
      envelope_id: 'env-food',
      amount: 9500,
      direction: 'outflow',
      merchant: 'Grocer',
      occurred_on: isoDate(NOW),
    });
    // Subscription renewal in 1 day
    createSubscription(adapter, 'sub1', {
      name: 'Netflix',
      price: 1599,
      currency: 'USD',
      billing_cycle: 'monthly',
      status: 'active',
      start_date: '2025-01-01',
      next_renewal: isoDate(new Date(NOW.getTime() + 86400000)),
    });
    // Uncategorized transaction
    createTransaction(adapter, 'tx-uncat', {
      amount: 1234,
      direction: 'outflow',
      merchant: 'Unknown',
      occurred_on: isoDate(NOW),
    });

    const cards = getTodayCards(adapter, { now: NOW });
    expect(cards.length).toBeLessThanOrEqual(3);
    for (const c of cards) {
      expect(c.priority).toBeLessThanOrEqual(100);
      expect(c.priority).toBeGreaterThanOrEqual(0);
    }
    for (let i = 1; i < cards.length; i++) {
      expect(cards[i - 1].priority).toBeGreaterThanOrEqual(cards[i].priority);
    }
  });

  describe('budgetCrossModule integration', () => {
    it('exposes getTodayCards alongside the existing methods', () => {
      expect(budgetCrossModule.getTodayCards).toBeTypeOf('function');
      expect(budgetCrossModule.getSearchableContent).toBeTypeOf('function');
      expect(budgetCrossModule.getDataSummary).toBeTypeOf('function');
      expect(budgetCrossModule.getActivityFeed).toBeTypeOf('function');
      expect(budgetCrossModule.getCorrelationData).toBeTypeOf('function');
    });

    it('is wired through BUDGET_MODULE.crossModule', () => {
      expect(BUDGET_MODULE.crossModule!.getTodayCards).toBeTypeOf('function');
      const result = BUDGET_MODULE.crossModule!.getTodayCards!(adapter, { now: NOW });
      expect(Array.isArray(result)).toBe(true);
    });
  });
});
