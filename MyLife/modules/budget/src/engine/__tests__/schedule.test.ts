/**
 * Tests for the schedule calculator (recurring date computation).
 *
 * Adapted from standalone MyBudget schedule tests to match the hub's
 * Frequency type (no 'semi_annually') and generateOccurrences behavior
 * (excludes start date, generates N future dates).
 */

import { describe, it, expect } from 'vitest';
import { calculateNextDate, generateOccurrences } from '../schedule';

// ---------------------------------------------------------------------------
// calculateNextDate
// ---------------------------------------------------------------------------

describe('calculateNextDate', () => {
  it('weekly: advances 7 days', () => {
    expect(calculateNextDate('2026-01-05', 'weekly')).toBe('2026-01-12');
  });

  it('biweekly: advances 14 days', () => {
    expect(calculateNextDate('2026-01-05', 'biweekly')).toBe('2026-01-19');
  });

  it('monthly: advances 1 month', () => {
    expect(calculateNextDate('2026-01-15', 'monthly')).toBe('2026-02-15');
  });

  it('monthly: clamps to end of shorter month', () => {
    expect(calculateNextDate('2026-01-31', 'monthly')).toBe('2026-02-28');
  });

  it('monthly: February leap year', () => {
    expect(calculateNextDate('2024-01-31', 'monthly')).toBe('2024-02-29');
  });

  it('quarterly: advances 3 months', () => {
    expect(calculateNextDate('2026-01-15', 'quarterly')).toBe('2026-04-15');
  });

  it('quarterly: clamps end-of-month', () => {
    expect(calculateNextDate('2026-01-31', 'quarterly')).toBe('2026-04-30');
  });

  it('annually: advances 1 year', () => {
    expect(calculateNextDate('2026-01-15', 'annually')).toBe('2027-01-15');
  });

  it('annually: leap day wraps to Feb 28 in non-leap year', () => {
    expect(calculateNextDate('2024-02-29', 'annually')).toBe('2025-02-28');
  });

  it('monthly: year boundary', () => {
    expect(calculateNextDate('2026-12-15', 'monthly')).toBe('2027-01-15');
  });
});

// ---------------------------------------------------------------------------
// generateOccurrences
// ---------------------------------------------------------------------------

describe('generateOccurrences', () => {
  it('generates N weekly occurrences (excludes start date)', () => {
    const dates = generateOccurrences('2026-01-05', 'weekly', 4);
    expect(dates).toEqual([
      '2026-01-12',
      '2026-01-19',
      '2026-01-26',
      '2026-02-02',
    ]);
  });

  it('generates monthly occurrences across year boundary', () => {
    const dates = generateOccurrences('2026-11-15', 'monthly', 3);
    expect(dates).toEqual([
      '2026-12-15',
      '2027-01-15',
      '2027-02-15',
    ]);
  });

  it('returns single next date when count is 1', () => {
    const dates = generateOccurrences('2026-03-01', 'annually', 1);
    expect(dates).toEqual(['2027-03-01']);
  });

  it('returns empty array when count is 0', () => {
    const dates = generateOccurrences('2026-01-01', 'monthly', 0);
    expect(dates).toEqual([]);
  });

  it('monthly occurrences clamp correctly through short months', () => {
    const dates = generateOccurrences('2026-01-31', 'monthly', 3);
    expect(dates).toEqual([
      '2026-02-28',
      '2026-03-28',
      '2026-04-28',
    ]);
  });
});
