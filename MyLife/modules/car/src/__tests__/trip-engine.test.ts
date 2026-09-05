import { describe, it, expect } from 'vitest';
import type { Trip } from '../types';
import {
  calculateTripDistance,
  getTripSummaryByPurpose,
  estimateIrsDeduction,
  getTripsByDateRange,
} from '../engines/trip-engine';

// ---------------------------------------------------------------------------
// Test data helpers
// ---------------------------------------------------------------------------

function makeTrip(overrides: Partial<Trip> = {}): Trip {
  return {
    id: 't1',
    vehicleId: 'v1',
    purpose: 'personal',
    routeName: null,
    startOdometer: 10000,
    endOdometer: 10050,
    distance: 50,
    startedAt: '2025-06-15T08:00:00Z',
    endedAt: '2025-06-15T09:00:00Z',
    notes: null,
    createdAt: '2025-06-15T08:00:00Z',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// calculateTripDistance
// ---------------------------------------------------------------------------

describe('calculateTripDistance', () => {
  it('returns the difference between end and start odometer', () => {
    expect(calculateTripDistance(10000, 10050)).toBe(50);
  });

  it('returns 0 when start and end are equal', () => {
    expect(calculateTripDistance(5000, 5000)).toBe(0);
  });

  it('throws when end odometer is less than start', () => {
    expect(() => calculateTripDistance(10000, 9000)).toThrow(
      'End odometer (9000) cannot be less than start odometer (10000)',
    );
  });
});

// ---------------------------------------------------------------------------
// getTripSummaryByPurpose
// ---------------------------------------------------------------------------

describe('getTripSummaryByPurpose', () => {
  const trips: Trip[] = [
    makeTrip({ id: 't1', purpose: 'business', distance: 30, startedAt: '2025-06-01T08:00:00Z' }),
    makeTrip({ id: 't2', purpose: 'business', distance: 45, startedAt: '2025-06-10T08:00:00Z' }),
    makeTrip({ id: 't3', purpose: 'personal', distance: 12, startedAt: '2025-06-15T08:00:00Z' }),
    makeTrip({ id: 't4', purpose: 'medical', distance: 20, startedAt: '2025-07-01T08:00:00Z' }),
    makeTrip({ id: 't5', purpose: 'commute', distance: 25, startedAt: '2025-07-05T08:00:00Z' }),
  ];

  it('aggregates trips by purpose', () => {
    const summary = getTripSummaryByPurpose(trips);
    expect(summary.business).toEqual({ count: 2, totalMiles: 75 });
    expect(summary.personal).toEqual({ count: 1, totalMiles: 12 });
    expect(summary.medical).toEqual({ count: 1, totalMiles: 20 });
    expect(summary.commute).toEqual({ count: 1, totalMiles: 25 });
  });

  it('returns empty record for empty trip array', () => {
    const summary = getTripSummaryByPurpose([]);
    expect(Object.keys(summary)).toHaveLength(0);
  });

  it('filters by date range when provided', () => {
    const summary = getTripSummaryByPurpose(trips, {
      start: '2025-06-01',
      end: '2025-06-30',
    });
    expect(summary.business).toEqual({ count: 2, totalMiles: 75 });
    expect(summary.personal).toEqual({ count: 1, totalMiles: 12 });
    expect(summary.medical).toBeUndefined();
    expect(summary.commute).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// estimateIrsDeduction
// ---------------------------------------------------------------------------

describe('estimateIrsDeduction', () => {
  it('calculates deduction at 2025 IRS rate ($0.70/mile)', () => {
    // 1000 miles * 70 cents = 70000 cents
    expect(estimateIrsDeduction(1000, 2025)).toBe(70000);
  });

  it('uses 2025 rate by default when no year is specified', () => {
    expect(estimateIrsDeduction(500)).toBe(35000);
  });

  it('uses 2024 rate when specified', () => {
    // 1000 miles * 67 cents = 67000 cents
    expect(estimateIrsDeduction(1000, 2024)).toBe(67000);
  });

  it('falls back to 2025 rate for unknown year', () => {
    expect(estimateIrsDeduction(100, 2020)).toBe(7000);
  });

  it('returns 0 for 0 miles', () => {
    expect(estimateIrsDeduction(0)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// getTripsByDateRange
// ---------------------------------------------------------------------------

describe('getTripsByDateRange', () => {
  const trips: Trip[] = [
    makeTrip({ id: 't1', startedAt: '2025-05-01T10:00:00Z' }),
    makeTrip({ id: 't2', startedAt: '2025-06-15T08:00:00Z' }),
    makeTrip({ id: 't3', startedAt: '2025-07-01T12:00:00Z' }),
    makeTrip({ id: 't4', startedAt: '2025-08-20T09:00:00Z' }),
  ];

  it('filters trips within date range (inclusive)', () => {
    const result = getTripsByDateRange(trips, '2025-06-01', '2025-07-31');
    expect(result).toHaveLength(2);
    expect(result.map((t) => t.id)).toEqual(['t2', 't3']);
  });

  it('returns empty array when no trips match range', () => {
    const result = getTripsByDateRange(trips, '2024-01-01', '2024-12-31');
    expect(result).toHaveLength(0);
  });

  it('includes trips on boundary dates', () => {
    const result = getTripsByDateRange(trips, '2025-05-01', '2025-05-01');
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('t1');
  });
});
