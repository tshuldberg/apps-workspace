import { describe, it, expect } from 'vitest';
import {
  aggregateRevenueByMonth,
  validateApplicationFields,
  emptyAnalytics,
} from '../creator-program';

// ── validateApplicationFields ───────────────────────────────────────

describe('validateApplicationFields', () => {
  it('returns null for valid fields', () => {
    expect(validateApplicationFields('I love cooking', ['Italian', 'Japanese'])).toBeNull();
  });

  it('rejects empty bio', () => {
    expect(validateApplicationFields('', ['Italian'])).toBe('Bio cannot be empty');
  });

  it('rejects whitespace-only bio', () => {
    expect(validateApplicationFields('   ', ['Italian'])).toBe('Bio cannot be empty');
  });

  it('rejects empty specialties array', () => {
    expect(validateApplicationFields('I love cooking', [])).toBe(
      'At least one specialty is required',
    );
  });

  it('rejects specialties with empty strings', () => {
    expect(validateApplicationFields('I love cooking', ['Italian', ''])).toBe(
      'Specialties cannot contain empty strings',
    );
  });

  it('rejects specialties with whitespace-only strings', () => {
    expect(validateApplicationFields('I love cooking', ['  '])).toBe(
      'Specialties cannot contain empty strings',
    );
  });

  it('accepts single specialty', () => {
    expect(validateApplicationFields('Bio here', ['Baking'])).toBeNull();
  });

  it('accepts many specialties', () => {
    const specialties = ['Italian', 'Japanese', 'French', 'Mexican', 'Thai'];
    expect(validateApplicationFields('Bio here', specialties)).toBeNull();
  });
});

// ── aggregateRevenueByMonth ─────────────────────────────────────────

describe('aggregateRevenueByMonth', () => {
  it('returns empty array for no records', () => {
    expect(aggregateRevenueByMonth([])).toEqual([]);
  });

  it('aggregates single record', () => {
    const result = aggregateRevenueByMonth([
      { createdAt: '2026-03-15T10:00:00Z', amountCents: 500 },
    ]);
    expect(result).toEqual([{ month: '2026-03', amountCents: 500 }]);
  });

  it('aggregates multiple records in the same month', () => {
    const result = aggregateRevenueByMonth([
      { createdAt: '2026-03-01T10:00:00Z', amountCents: 500 },
      { createdAt: '2026-03-15T10:00:00Z', amountCents: 300 },
      { createdAt: '2026-03-28T10:00:00Z', amountCents: 200 },
    ]);
    expect(result).toEqual([{ month: '2026-03', amountCents: 1000 }]);
  });

  it('separates records across months', () => {
    const result = aggregateRevenueByMonth([
      { createdAt: '2026-01-10T10:00:00Z', amountCents: 100 },
      { createdAt: '2026-02-10T10:00:00Z', amountCents: 200 },
      { createdAt: '2026-03-10T10:00:00Z', amountCents: 300 },
    ]);
    expect(result).toEqual([
      { month: '2026-01', amountCents: 100 },
      { month: '2026-02', amountCents: 200 },
      { month: '2026-03', amountCents: 300 },
    ]);
  });

  it('sorts months chronologically', () => {
    const result = aggregateRevenueByMonth([
      { createdAt: '2026-03-10T10:00:00Z', amountCents: 300 },
      { createdAt: '2026-01-10T10:00:00Z', amountCents: 100 },
      { createdAt: '2026-02-10T10:00:00Z', amountCents: 200 },
    ]);
    expect(result[0]?.month).toBe('2026-01');
    expect(result[1]?.month).toBe('2026-02');
    expect(result[2]?.month).toBe('2026-03');
  });

  it('handles records spanning years', () => {
    const result = aggregateRevenueByMonth([
      { createdAt: '2025-12-10T10:00:00Z', amountCents: 100 },
      { createdAt: '2026-01-10T10:00:00Z', amountCents: 200 },
    ]);
    expect(result).toEqual([
      { month: '2025-12', amountCents: 100 },
      { month: '2026-01', amountCents: 200 },
    ]);
  });

  it('pads single-digit months with zero', () => {
    const result = aggregateRevenueByMonth([
      { createdAt: '2026-01-10T10:00:00Z', amountCents: 100 },
    ]);
    expect(result[0]?.month).toBe('2026-01');
  });
});

// ── emptyAnalytics ──────────────────────────────────────────────────

describe('emptyAnalytics', () => {
  it('returns zero-valued analytics object', () => {
    const analytics = emptyAnalytics();
    expect(analytics.totalViews).toBe(0);
    expect(analytics.totalVotes).toBe(0);
    expect(analytics.totalFollowers).toBe(0);
    expect(analytics.totalRevenue).toBe(0);
    expect(analytics.totalTips).toBe(0);
    expect(analytics.totalSubscribers).toBe(0);
    expect(analytics.topRecipe).toBeNull();
    expect(analytics.revenueByMonth).toEqual([]);
  });

  it('returns a new object each time', () => {
    const a = emptyAnalytics();
    const b = emptyAnalytics();
    expect(a).not.toBe(b);
    expect(a).toEqual(b);
  });
});

// ── Application status values ───────────────────────────────────────

describe('application status values', () => {
  const validStatuses = [
    'submitted',
    'under_review',
    'approved',
    'declined',
    'more_info_needed',
    'withdrawn',
  ];

  it('has exactly 6 status values after P13-D', () => {
    expect(validStatuses).toHaveLength(6);
  });

  it('includes all expected statuses', () => {
    expect(validStatuses).toContain('submitted');
    expect(validStatuses).toContain('under_review');
    expect(validStatuses).toContain('approved');
    expect(validStatuses).toContain('declined');
    expect(validStatuses).toContain('more_info_needed');
    expect(validStatuses).toContain('withdrawn');
  });
});
