import { describe, it, expect } from 'vitest';
import { classifyUsage, scoreSubscriptionROI, getROIReport } from '../subscriptions/roi';
import type { ROIInput } from '../subscriptions/roi';
import type { BudgetSubscription } from '../types';

const makeSubscription = (overrides: Partial<BudgetSubscription> = {}): BudgetSubscription => ({
  id: 'sub-1',
  name: 'Netflix',
  price: 1599,
  currency: 'USD',
  billing_cycle: 'monthly',
  custom_days: null,
  status: 'active',
  start_date: '2025-01-01',
  next_renewal: '2026-04-01',
  trial_end_date: null,
  cancelled_date: null,
  icon: null,
  url: null,
  color: null,
  notify_days: 3,
  envelope_id: null,
  catalog_id: null,
  sort_order: 0,
  notes: null,
  created_at: '2025-01-01T00:00:00Z',
  updated_at: '2025-01-01T00:00:00Z',
  ...overrides,
});

describe('classifyUsage', () => {
  it('returns active for recent activity', () => {
    expect(classifyUsage(5)).toBe('active');
    expect(classifyUsage(30)).toBe('active');
  });

  it('returns underused for 31-60 day gap', () => {
    expect(classifyUsage(31)).toBe('underused');
    expect(classifyUsage(60)).toBe('underused');
  });

  it('returns unused for 60+ days or null', () => {
    expect(classifyUsage(61)).toBe('unused');
    expect(classifyUsage(null)).toBe('unused');
  });
});

describe('scoreSubscriptionROI', () => {
  it('scores active subscription correctly', () => {
    const result = scoreSubscriptionROI({
      subscription: makeSubscription(),
      relatedTransactionDates: ['2026-03-20'],
      today: '2026-03-24',
    });

    expect(result.usageStatus).toBe('active');
    expect(result.daysSinceLastActivity).toBe(4);
    expect(result.monthlyCostCents).toBe(1599);
    expect(result.summary).toContain('$15.99/mo');
    expect(result.summary).toContain('4 days ago');
  });

  it('scores unused subscription with warning', () => {
    const result = scoreSubscriptionROI({
      subscription: makeSubscription({ name: 'Hulu' }),
      relatedTransactionDates: ['2026-01-01'],
      today: '2026-03-24',
    });

    expect(result.usageStatus).toBe('unused');
    expect(result.summary).toContain('consider canceling');
  });

  it('handles subscription with no activity', () => {
    const result = scoreSubscriptionROI({
      subscription: makeSubscription(),
      relatedTransactionDates: [],
      today: '2026-03-24',
    });

    expect(result.usageStatus).toBe('unused');
    expect(result.daysSinceLastActivity).toBeNull();
    expect(result.summary).toContain('no activity detected');
  });
});

describe('getROIReport', () => {
  it('sorts by urgency (unused first)', () => {
    const inputs: ROIInput[] = [
      {
        subscription: makeSubscription({ id: 'a', name: 'Active Sub' }),
        relatedTransactionDates: ['2026-03-23'],
        today: '2026-03-24',
      },
      {
        subscription: makeSubscription({ id: 'b', name: 'Unused Sub' }),
        relatedTransactionDates: [],
        today: '2026-03-24',
      },
    ];

    const result = getROIReport(inputs);
    expect(result.subscriptions[0].subscriptionName).toBe('Unused Sub');
    expect(result.unusedCount).toBe(1);
    expect(result.activeCount).toBe(1);
  });

  it('skips cancelled subscriptions', () => {
    const inputs: ROIInput[] = [
      {
        subscription: makeSubscription({ status: 'cancelled' }),
        relatedTransactionDates: [],
        today: '2026-03-24',
      },
    ];

    const result = getROIReport(inputs);
    expect(result.subscriptions).toHaveLength(0);
  });

  it('calculates unused cost totals', () => {
    const inputs: ROIInput[] = [
      {
        subscription: makeSubscription({ id: 'a', name: 'Unused 1', price: 1000 }),
        relatedTransactionDates: [],
        today: '2026-03-24',
      },
      {
        subscription: makeSubscription({ id: 'b', name: 'Unused 2', price: 2000 }),
        relatedTransactionDates: [],
        today: '2026-03-24',
      },
    ];

    const result = getROIReport(inputs);
    expect(result.unusedMonthlyCostCents).toBe(3000);
    expect(result.unusedAnnualCostCents).toBe(36000);
  });
});
