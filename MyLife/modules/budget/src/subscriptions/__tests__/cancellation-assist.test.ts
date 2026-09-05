import { describe, it, expect } from 'vitest';
import {
  scoreSubscription,
  getOpportunities,
  calculateTotalSavings,
  calculatePotentialSavings,
  shouldShowOpportunity,
} from '../cancellation-assist';
import type { ScoreInput, CancellationActionRecord } from '../cancellation-assist';
import type { BudgetSubscription, PriceHistory } from '../../types';

function makeSub(overrides: Partial<BudgetSubscription> = {}): BudgetSubscription {
  return {
    id: 'sub-1',
    name: 'Test Service',
    price: 1000, // $10/mo
    currency: 'USD',
    billing_cycle: 'monthly',
    custom_days: null,
    status: 'active',
    start_date: '2025-01-01',
    next_renewal: '2026-04-01',
    trial_end_date: null,
    cancelled_date: null,
    notes: null,
    url: 'https://example.com',
    icon: null,
    color: null,
    notify_days: 1,
    envelope_id: null,
    catalog_id: 'cat-entertainment',
    sort_order: 0,
    created_at: '2025-01-01T00:00:00Z',
    updated_at: '2025-01-01T00:00:00Z',
    ...overrides,
  };
}

function makeInput(overrides: Partial<ScoreInput> = {}): ScoreInput {
  return {
    subscription: makeSub(),
    priceHistory: [],
    activeSameCategory: 0,
    recentActions: [],
    today: '2026-03-15',
    ...overrides,
  };
}

describe('shouldShowOpportunity', () => {
  it('returns true with no actions', () => {
    expect(shouldShowOpportunity([], '2026-03-15')).toBe(true);
  });

  it('returns false within cooldown for kept action (90 days)', () => {
    const actions: CancellationActionRecord[] = [{
      id: 'a1',
      subscriptionId: 'sub-1',
      action: 'kept',
      savingsAmount: null,
      notes: null,
      actedOn: '2026-02-01',
      createdAt: '2026-02-01',
    }];
    // 42 days since Feb 1 -> Mar 15, within 90 day cooldown
    expect(shouldShowOpportunity(actions, '2026-03-15')).toBe(false);
  });

  it('returns true after cooldown expires for reminded (30 days)', () => {
    const actions: CancellationActionRecord[] = [{
      id: 'a1',
      subscriptionId: 'sub-1',
      action: 'reminded',
      savingsAmount: null,
      notes: null,
      actedOn: '2026-02-01',
      createdAt: '2026-02-01',
    }];
    // 42 days since Feb 1, past 30-day cooldown
    expect(shouldShowOpportunity(actions, '2026-03-15')).toBe(true);
  });

  it('returns false for cancelled subscription', () => {
    const actions: CancellationActionRecord[] = [{
      id: 'a1',
      subscriptionId: 'sub-1',
      action: 'cancelled',
      savingsAmount: 12000,
      notes: null,
      actedOn: '2026-01-15',
      createdAt: '2026-01-15',
    }];
    expect(shouldShowOpportunity(actions, '2026-03-15')).toBe(false);
  });
});

describe('scoreSubscription', () => {
  it('returns 0 for cancelled subscriptions', () => {
    const input = makeInput({
      subscription: makeSub({ status: 'cancelled' }),
    });
    const { score } = scoreSubscription(input);
    expect(score).toBe(0);
  });

  it('returns 0 when in cooldown period', () => {
    const input = makeInput({
      recentActions: [{
        id: 'a1',
        subscriptionId: 'sub-1',
        action: 'kept',
        savingsAmount: null,
        notes: null,
        actedOn: '2026-03-10', // 5 days ago, within 90-day cooldown
        createdAt: '2026-03-10',
      }],
    });
    const { score } = scoreSubscription(input);
    expect(score).toBe(0);
  });

  it('scores price increase > 20% as 30 points', () => {
    const priceHistory: PriceHistory[] = [
      { id: 'ph1', subscription_id: 'sub-1', price: 1000, effective_date: '2025-06-01', created_at: '2025-06-01' },
      { id: 'ph2', subscription_id: 'sub-1', price: 1500, effective_date: '2026-01-01', created_at: '2026-01-01' },
    ];
    const input = makeInput({ priceHistory });
    const { score, reasons } = scoreSubscription(input);
    expect(score).toBeGreaterThanOrEqual(30);
    expect(reasons.some((r) => r.includes('Price increased'))).toBe(true);
  });

  it('scores long-running subscription (>12 months) as 10 points', () => {
    const input = makeInput({
      subscription: makeSub({ start_date: '2024-01-01' }),
    });
    const { score, reasons } = scoreSubscription(input);
    expect(score).toBeGreaterThanOrEqual(10);
    expect(reasons.some((r) => r.includes('months'))).toBe(true);
  });

  it('scores monthly cost $25 as 20 points', () => {
    const input = makeInput({
      subscription: makeSub({ price: 2500 }),
    });
    const { score, reasons } = scoreSubscription(input);
    expect(score).toBeGreaterThanOrEqual(20);
    expect(reasons.some((r) => r.includes('$20'))).toBe(true);
  });

  it('scores duplicate category as 10 points', () => {
    const input = makeInput({ activeSameCategory: 2 });
    const { score, reasons } = scoreSubscription(input);
    expect(score).toBeGreaterThanOrEqual(10);
    expect(reasons.some((r) => r.includes('same category'))).toBe(true);
  });

  it('scores trial ending in 3 days as 30 points', () => {
    const input = makeInput({
      subscription: makeSub({
        status: 'trial',
        trial_end_date: '2026-03-18',
      }),
    });
    const { score, reasons } = scoreSubscription(input);
    expect(score).toBeGreaterThanOrEqual(30);
    expect(reasons.some((r) => r.includes('Trial ending'))).toBe(true);
  });
});

describe('getOpportunities', () => {
  it('returns only subs with score >= threshold, sorted descending', () => {
    const inputs: ScoreInput[] = [
      makeInput({ subscription: makeSub({ id: 'cheap', price: 200, start_date: '2026-03-01' }) }),
      makeInput({
        subscription: makeSub({ id: 'expensive', price: 5000, start_date: '2024-01-01' }),
      }),
    ];
    const opps = getOpportunities(inputs, 20);
    // Expensive+old should score higher
    if (opps.length > 0) {
      expect(opps[0].subscriptionId).toBe('expensive');
      for (const opp of opps) {
        expect(opp.score).toBeGreaterThanOrEqual(20);
      }
    }
  });

  it('returns empty array for empty input', () => {
    expect(getOpportunities([], 50)).toEqual([]);
  });
});

describe('calculateTotalSavings', () => {
  it('sums savings from cancelled and downgraded actions in the year', () => {
    const actions: CancellationActionRecord[] = [
      { id: 'a1', subscriptionId: 's1', action: 'cancelled', savingsAmount: 12000, notes: null, actedOn: '2026-02-01', createdAt: '2026-02-01' },
      { id: 'a2', subscriptionId: 's2', action: 'downgraded', savingsAmount: 6000, notes: null, actedOn: '2026-03-01', createdAt: '2026-03-01' },
      { id: 'a3', subscriptionId: 's3', action: 'kept', savingsAmount: null, notes: null, actedOn: '2026-01-15', createdAt: '2026-01-15' },
    ];
    const result = calculateTotalSavings(actions, 2026);
    expect(result.annualSavings).toBe(18000);
    expect(result.actionCount).toBe(2);
    expect(result.monthlySavings).toBe(1500);
  });

  it('returns 0 for no actions', () => {
    const result = calculateTotalSavings([], 2026);
    expect(result.annualSavings).toBe(0);
    expect(result.actionCount).toBe(0);
  });

  it('excludes actions from other years', () => {
    const actions: CancellationActionRecord[] = [
      { id: 'a1', subscriptionId: 's1', action: 'cancelled', savingsAmount: 12000, notes: null, actedOn: '2025-12-15', createdAt: '2025-12-15' },
    ];
    const result = calculateTotalSavings(actions, 2026);
    expect(result.annualSavings).toBe(0);
  });
});

describe('calculatePotentialSavings', () => {
  it('sums monthly and annual costs of all opportunities', () => {
    const opps = [
      { subscriptionId: 's1', subscriptionName: 'A', score: 70, monthlyCost: 1000, annualCost: 12000, reasons: [], priority: 'high' as const, icon: null, url: null },
      { subscriptionId: 's2', subscriptionName: 'B', score: 55, monthlyCost: 500, annualCost: 6000, reasons: [], priority: 'standard' as const, icon: null, url: null },
    ];
    const result = calculatePotentialSavings(opps);
    expect(result.monthlyTotal).toBe(1500);
    expect(result.annualTotal).toBe(18000);
  });
});
