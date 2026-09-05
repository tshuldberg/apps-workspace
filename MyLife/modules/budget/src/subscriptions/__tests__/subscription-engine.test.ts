/**
 * Tests for subscription engine modules: renewal, cost normalization, and
 * status state machine.
 *
 * Ported from standalone MyBudget subscription tests, adapted for the hub's
 * BillingCycle type (includes 'semi_annual' and 'custom') and
 * envelope-based cost summary (byEnvelope, not byCategory).
 */

import { describe, it, expect } from 'vitest';
import {
  calculateNextRenewal,
  advanceRenewalDate,
  getUpcomingRenewals,
} from '../renewal';
import {
  normalizeToMonthly,
  normalizeToAnnual,
  normalizeToDaily,
  calculateSubscriptionSummary,
} from '../cost';
import { validateTransition, getValidTransitions } from '../status';
import type { BudgetSubscription } from '../../types';

// ---------------------------------------------------------------------------
// renewal.ts — calculateNextRenewal
// ---------------------------------------------------------------------------

describe('calculateNextRenewal', () => {
  it('monthly: advances past today', () => {
    const next = calculateNextRenewal('2025-12-01', 'monthly', null, '2026-02-15');
    expect(next).toBe('2026-03-01');
  });

  it('weekly: advances past today', () => {
    const next = calculateNextRenewal('2026-01-01', 'weekly', null, '2026-01-20');
    expect(next).toBe('2026-01-22');
  });

  it('annual: one year from start when start is in the future', () => {
    const next = calculateNextRenewal('2026-06-15', 'annual', null, '2026-01-01');
    expect(next).toBe('2026-06-15');
  });

  it('quarterly: advances by 3-month blocks', () => {
    const next = calculateNextRenewal('2025-01-15', 'quarterly', null, '2026-02-20');
    expect(next).toBe('2026-04-15');
  });

  it('semi_annual: advances by 6-month blocks', () => {
    const next = calculateNextRenewal('2025-06-01', 'semi_annual', null, '2026-02-15');
    expect(next).toBe('2026-06-01');
  });

  it('custom: advances by custom day count', () => {
    const next = calculateNextRenewal('2026-01-01', 'custom', 45, '2026-02-20');
    // Jan 1 + 45 = Feb 15 (past), Feb 15 + 45 = Apr 1 (future)
    expect(next).toBe('2026-04-01');
  });

  it('monthly: handles end-of-month clamping', () => {
    // Jan 31 -> Feb 28 -> Mar 31
    const next = calculateNextRenewal('2026-01-31', 'monthly', null, '2026-01-31');
    expect(next).toBe('2026-02-28');
  });

  it('monthly: handles leap year Feb 29', () => {
    const next = calculateNextRenewal('2024-01-31', 'monthly', null, '2024-01-31');
    expect(next).toBe('2024-02-29');
  });
});

// ---------------------------------------------------------------------------
// renewal.ts — advanceRenewalDate
// ---------------------------------------------------------------------------

describe('advanceRenewalDate', () => {
  it('monthly: advances 1 month', () => {
    expect(advanceRenewalDate('2026-01-15', 'monthly')).toBe('2026-02-15');
  });

  it('weekly: advances 7 days', () => {
    expect(advanceRenewalDate('2026-01-15', 'weekly')).toBe('2026-01-22');
  });

  it('quarterly: advances 3 months', () => {
    expect(advanceRenewalDate('2026-01-15', 'quarterly')).toBe('2026-04-15');
  });

  it('annual: advances 12 months', () => {
    expect(advanceRenewalDate('2026-01-15', 'annual')).toBe('2027-01-15');
  });

  it('semi_annual: advances 6 months', () => {
    expect(advanceRenewalDate('2026-01-15', 'semi_annual')).toBe('2026-07-15');
  });

  it('custom: advances by custom days', () => {
    expect(advanceRenewalDate('2026-01-15', 'custom', 90)).toBe('2026-04-15');
  });

  it('preserves anchor day through short months', () => {
    // Start Jan 31, advance monthly: Feb 28, but anchor 31 means Mar should try 31
    expect(advanceRenewalDate('2026-01-31', 'monthly', null, 31)).toBe('2026-02-28');
  });
});

// ---------------------------------------------------------------------------
// renewal.ts — getUpcomingRenewals
// ---------------------------------------------------------------------------

describe('getUpcomingRenewals', () => {
  function makeSub(
    overrides: Partial<BudgetSubscription>,
  ): BudgetSubscription {
    return {
      id: 'sub-1',
      name: 'Test',
      price: 999,
      currency: 'USD',
      billing_cycle: 'monthly',
      custom_days: null,
      status: 'active',
      start_date: '2025-01-01',
      next_renewal: '2026-03-01',
      trial_end_date: null,
      cancelled_date: null,
      notes: null,
      url: null,
      icon: null,
      color: null,
      notify_days: 3,
      envelope_id: null,
      catalog_id: null,
      sort_order: 0,
      created_at: '2025-01-01T00:00:00Z',
      updated_at: '2025-01-01T00:00:00Z',
      ...overrides,
    };
  }

  it('returns active subs with renewal in range', () => {
    const subs = [
      makeSub({ id: 's1', next_renewal: '2026-03-05' }),
      makeSub({ id: 's2', next_renewal: '2026-03-20' }),
      makeSub({ id: 's3', next_renewal: '2026-05-01' }), // beyond 30 days
    ];
    const upcoming = getUpcomingRenewals(subs, 30, '2026-03-01');
    expect(upcoming).toHaveLength(2);
    expect(upcoming[0]!.id).toBe('s1');
    expect(upcoming[1]!.id).toBe('s2');
  });

  it('excludes cancelled and paused subscriptions', () => {
    const subs = [
      makeSub({ id: 's1', status: 'cancelled', next_renewal: '2026-03-05' }),
      makeSub({ id: 's2', status: 'paused', next_renewal: '2026-03-10' }),
      makeSub({ id: 's3', status: 'active', next_renewal: '2026-03-15' }),
    ];
    const upcoming = getUpcomingRenewals(subs, 30, '2026-03-01');
    expect(upcoming).toHaveLength(1);
    expect(upcoming[0]!.id).toBe('s3');
  });

  it('returns empty array when no renewals in range', () => {
    const subs = [
      makeSub({ id: 's1', next_renewal: '2026-06-01' }),
    ];
    const upcoming = getUpcomingRenewals(subs, 30, '2026-03-01');
    expect(upcoming).toHaveLength(0);
  });

  it('includes trial subscriptions', () => {
    const subs = [
      makeSub({ id: 's1', status: 'trial', next_renewal: '2026-03-10' }),
    ];
    const upcoming = getUpcomingRenewals(subs, 30, '2026-03-01');
    expect(upcoming).toHaveLength(1);
  });

  it('sorts by next_renewal ascending', () => {
    const subs = [
      makeSub({ id: 's1', next_renewal: '2026-03-20' }),
      makeSub({ id: 's2', next_renewal: '2026-03-05' }),
      makeSub({ id: 's3', next_renewal: '2026-03-12' }),
    ];
    const upcoming = getUpcomingRenewals(subs, 30, '2026-03-01');
    expect(upcoming.map((s) => s.id)).toEqual(['s2', 's3', 's1']);
  });
});

// ---------------------------------------------------------------------------
// cost.ts — normalizeToMonthly
// ---------------------------------------------------------------------------

describe('normalizeToMonthly', () => {
  it('monthly: returns price unchanged', () => {
    expect(normalizeToMonthly(999, 'monthly')).toBe(999);
  });

  it('weekly: 52 weeks / 12 months', () => {
    expect(normalizeToMonthly(100, 'weekly')).toBe(Math.round((100 * 52) / 12));
  });

  it('quarterly: divides by 3', () => {
    expect(normalizeToMonthly(3000, 'quarterly')).toBe(1000);
  });

  it('semi_annual: divides by 6', () => {
    expect(normalizeToMonthly(6000, 'semi_annual')).toBe(1000);
  });

  it('annual: divides by 12', () => {
    expect(normalizeToMonthly(12000, 'annual')).toBe(1000);
  });

  it('custom: converts via daily rate', () => {
    // 3000 cents every 90 days -> (3000 * 365/90) / 12
    const expected = Math.round((3000 * (365 / 90)) / 12);
    expect(normalizeToMonthly(3000, 'custom', 90)).toBe(expected);
  });

  it('custom: throws without customDays', () => {
    expect(() => normalizeToMonthly(1000, 'custom')).toThrow();
  });
});

// ---------------------------------------------------------------------------
// cost.ts — normalizeToAnnual
// ---------------------------------------------------------------------------

describe('normalizeToAnnual', () => {
  it('annual: returns price unchanged', () => {
    expect(normalizeToAnnual(12000, 'annual')).toBe(12000);
  });

  it('monthly: multiplies by 12', () => {
    expect(normalizeToAnnual(1000, 'monthly')).toBe(12000);
  });

  it('weekly: multiplies by 52', () => {
    expect(normalizeToAnnual(100, 'weekly')).toBe(5200);
  });

  it('quarterly: multiplies by 4', () => {
    expect(normalizeToAnnual(3000, 'quarterly')).toBe(12000);
  });

  it('semi_annual: multiplies by 2', () => {
    expect(normalizeToAnnual(6000, 'semi_annual')).toBe(12000);
  });
});

// ---------------------------------------------------------------------------
// cost.ts — normalizeToDaily
// ---------------------------------------------------------------------------

describe('normalizeToDaily', () => {
  it('annual to daily: divides by 365', () => {
    expect(normalizeToDaily(36500, 'annual')).toBe(100);
  });

  it('monthly to daily: annual / 365', () => {
    const monthly = 3000;
    const annual = Math.round(monthly * 12);
    expect(normalizeToDaily(monthly, 'monthly')).toBe(Math.round(annual / 365));
  });
});

// ---------------------------------------------------------------------------
// cost.ts — calculateSubscriptionSummary
// ---------------------------------------------------------------------------

describe('calculateSubscriptionSummary', () => {
  function makeSub(
    overrides: Partial<BudgetSubscription>,
  ): BudgetSubscription {
    return {
      id: 'sub-1',
      name: 'Test',
      price: 999,
      currency: 'USD',
      billing_cycle: 'monthly',
      custom_days: null,
      status: 'active',
      start_date: '2025-01-01',
      next_renewal: '2026-03-01',
      trial_end_date: null,
      cancelled_date: null,
      notes: null,
      url: null,
      icon: null,
      color: null,
      notify_days: 3,
      envelope_id: null,
      catalog_id: null,
      sort_order: 0,
      created_at: '2025-01-01T00:00:00Z',
      updated_at: '2025-01-01T00:00:00Z',
      ...overrides,
    };
  }

  it('sums monthly costs for active subscriptions', () => {
    const subs = [
      makeSub({ id: 's1', price: 1000, billing_cycle: 'monthly' }),
      makeSub({ id: 's2', price: 2000, billing_cycle: 'monthly' }),
    ];
    const summary = calculateSubscriptionSummary(subs);
    expect(summary.monthlyTotal).toBe(3000);
    expect(summary.annualTotal).toBe(36000);
    expect(summary.activeCount).toBe(2);
    expect(summary.totalCount).toBe(2);
  });

  it('excludes cancelled and paused from cost totals', () => {
    const subs = [
      makeSub({ id: 's1', price: 1000, status: 'active' }),
      makeSub({ id: 's2', price: 2000, status: 'cancelled' }),
      makeSub({ id: 's3', price: 3000, status: 'paused' }),
    ];
    const summary = calculateSubscriptionSummary(subs);
    expect(summary.monthlyTotal).toBe(1000);
    expect(summary.activeCount).toBe(1);
    expect(summary.totalCount).toBe(3);
  });

  it('includes trial subscriptions in cost totals', () => {
    const subs = [
      makeSub({ id: 's1', price: 1000, status: 'trial' }),
    ];
    const summary = calculateSubscriptionSummary(subs);
    expect(summary.monthlyTotal).toBe(1000);
    expect(summary.activeCount).toBe(1);
  });

  it('groups costs by envelope (byEnvelope)', () => {
    const subs = [
      makeSub({ id: 's1', price: 1000, envelope_id: 'env-1' }),
      makeSub({ id: 's2', price: 2000, envelope_id: 'env-1' }),
      makeSub({ id: 's3', price: 500, envelope_id: 'env-2' }),
      makeSub({ id: 's4', price: 300, envelope_id: null }),
    ];
    const summary = calculateSubscriptionSummary(subs);

    expect(summary.byEnvelope).toHaveLength(3);
    // Sorted by monthlyCost descending
    expect(summary.byEnvelope[0]!.envelopeId).toBe('env-1');
    expect(summary.byEnvelope[0]!.monthlyCost).toBe(3000);
    expect(summary.byEnvelope[0]!.count).toBe(2);

    expect(summary.byEnvelope[1]!.envelopeId).toBe('env-2');
    expect(summary.byEnvelope[1]!.monthlyCost).toBe(500);

    expect(summary.byEnvelope[2]!.envelopeId).toBeNull();
    expect(summary.byEnvelope[2]!.monthlyCost).toBe(300);
  });

  it('returns zeros for empty list', () => {
    const summary = calculateSubscriptionSummary([]);
    expect(summary.monthlyTotal).toBe(0);
    expect(summary.annualTotal).toBe(0);
    expect(summary.dailyCost).toBe(0);
    expect(summary.activeCount).toBe(0);
    expect(summary.totalCount).toBe(0);
    expect(summary.byEnvelope).toEqual([]);
  });

  it('normalizes different billing cycles', () => {
    const subs = [
      makeSub({ id: 's1', price: 1200, billing_cycle: 'annual' }),
      makeSub({ id: 's2', price: 999, billing_cycle: 'monthly' }),
    ];
    const summary = calculateSubscriptionSummary(subs);
    // annual $12 -> $1/mo = 100 cents/mo
    // monthly $9.99 -> 999 cents/mo
    expect(summary.monthlyTotal).toBe(100 + 999);
  });
});

// ---------------------------------------------------------------------------
// status.ts — validateTransition
// ---------------------------------------------------------------------------

describe('validateTransition', () => {
  it('trial -> active is valid', () => {
    expect(validateTransition('trial', 'active')).toBe(true);
  });

  it('trial -> cancelled is valid', () => {
    expect(validateTransition('trial', 'cancelled')).toBe(true);
  });

  it('active -> paused is valid', () => {
    expect(validateTransition('active', 'paused')).toBe(true);
  });

  it('active -> cancelled is valid', () => {
    expect(validateTransition('active', 'cancelled')).toBe(true);
  });

  it('paused -> active is valid', () => {
    expect(validateTransition('paused', 'active')).toBe(true);
  });

  it('paused -> cancelled is valid', () => {
    expect(validateTransition('paused', 'cancelled')).toBe(true);
  });

  it('cancelled -> anything is invalid (terminal state)', () => {
    expect(validateTransition('cancelled', 'active')).toBe(false);
    expect(validateTransition('cancelled', 'paused')).toBe(false);
    expect(validateTransition('cancelled', 'trial')).toBe(false);
  });

  it('trial -> paused is invalid', () => {
    expect(validateTransition('trial', 'paused')).toBe(false);
  });

  it('active -> trial is invalid', () => {
    expect(validateTransition('active', 'trial')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// status.ts — getValidTransitions
// ---------------------------------------------------------------------------

describe('getValidTransitions', () => {
  it('trial has 2 valid transitions', () => {
    expect(getValidTransitions('trial')).toEqual(['active', 'cancelled']);
  });

  it('active has 2 valid transitions', () => {
    expect(getValidTransitions('active')).toEqual(['paused', 'cancelled']);
  });

  it('paused has 2 valid transitions', () => {
    expect(getValidTransitions('paused')).toEqual(['active', 'cancelled']);
  });

  it('cancelled has no valid transitions', () => {
    expect(getValidTransitions('cancelled')).toEqual([]);
  });

  it('returns a copy (not the original array)', () => {
    const transitions = getValidTransitions('active');
    transitions.push('trial');
    expect(getValidTransitions('active')).toEqual(['paused', 'cancelled']);
  });
});
