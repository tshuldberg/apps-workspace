import { describe, expect, it } from 'vitest';
import {
  selectDailyAffirmation,
  calculateAffirmationStreak,
  validateAffirmationText,
} from '../selection';
import type { Affirmation } from '../types';

function makeAffirmation(overrides: Partial<Affirmation> = {}): Affirmation {
  return {
    id: 'aff-1',
    text: 'I am enough',
    category: 'self_worth',
    isBuiltin: true,
    isFavorite: false,
    isDismissed: false,
    timesShown: 0,
    timesAffirmed: 0,
    lastShownDate: null,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

describe('selectDailyAffirmation', () => {
  it('selects least-recently-shown affirmation', () => {
    const pool = [
      makeAffirmation({ id: 'a1', lastShownDate: '2026-03-20' }),
      makeAffirmation({ id: 'a2', lastShownDate: null }),
      makeAffirmation({ id: 'a3', lastShownDate: '2026-03-21' }),
    ];
    const result = selectDailyAffirmation(pool, '2026-03-22');
    expect(result?.id).toBe('a2'); // null = never shown = highest priority
  });

  it('excludes dismissed affirmations', () => {
    const pool = [
      makeAffirmation({ id: 'a1', isDismissed: true, lastShownDate: null }),
      makeAffirmation({ id: 'a2', isDismissed: false, lastShownDate: '2026-03-20' }),
    ];
    const result = selectDailyAffirmation(pool, '2026-03-22');
    expect(result?.id).toBe('a2');
  });

  it('returns null when all dismissed', () => {
    const pool = [
      makeAffirmation({ id: 'a1', isDismissed: true }),
    ];
    expect(selectDailyAffirmation(pool, '2026-03-22')).toBeNull();
  });

  it('returns already-shown-today affirmation for stability', () => {
    const pool = [
      makeAffirmation({ id: 'a1', lastShownDate: '2026-03-22' }),
      makeAffirmation({ id: 'a2', lastShownDate: null }),
    ];
    const result = selectDailyAffirmation(pool, '2026-03-22');
    expect(result?.id).toBe('a1');
  });

  it('handles single affirmation in pool', () => {
    const pool = [makeAffirmation({ id: 'a1' })];
    const result = selectDailyAffirmation(pool, '2026-03-22');
    expect(result?.id).toBe('a1');
  });
});

describe('calculateAffirmationStreak', () => {
  it('returns 0 for empty dates', () => {
    expect(calculateAffirmationStreak([], '2026-03-22')).toEqual({
      currentStreak: 0, longestStreak: 0,
    });
  });

  it('counts consecutive affirmed days', () => {
    const dates = ['2026-03-20', '2026-03-21', '2026-03-22'];
    const result = calculateAffirmationStreak(dates, '2026-03-22');
    expect(result.currentStreak).toBe(3);
    expect(result.longestStreak).toBe(3);
  });

  it('applies 1-day grace period', () => {
    const dates = ['2026-03-19', '2026-03-20', '2026-03-21'];
    const result = calculateAffirmationStreak(dates, '2026-03-22');
    expect(result.currentStreak).toBe(3); // grace: yesterday (21) is in set
  });

  it('breaks streak after 2-day gap', () => {
    const dates = ['2026-03-18', '2026-03-19', '2026-03-20'];
    const result = calculateAffirmationStreak(dates, '2026-03-22');
    expect(result.currentStreak).toBe(0); // neither today nor yesterday is in set
    expect(result.longestStreak).toBe(3);
  });

  it('tracks longest streak separately', () => {
    const dates = ['2026-03-10', '2026-03-11', '2026-03-12', '2026-03-13', '2026-03-21', '2026-03-22'];
    const result = calculateAffirmationStreak(dates, '2026-03-22');
    expect(result.currentStreak).toBe(2);
    expect(result.longestStreak).toBe(4);
  });
});

describe('validateAffirmationText', () => {
  it('returns null for valid text', () => {
    expect(validateAffirmationText('I am worthy')).toBeNull();
  });

  it('rejects empty text', () => {
    expect(validateAffirmationText('')).toBe('Affirmation text cannot be empty');
    expect(validateAffirmationText('   ')).toBe('Affirmation text cannot be empty');
  });

  it('rejects text over 200 characters', () => {
    const long = 'x'.repeat(201);
    expect(validateAffirmationText(long)).toBe('Affirmation text cannot exceed 200 characters');
  });

  it('accepts exactly 200 characters', () => {
    const exact = 'x'.repeat(200);
    expect(validateAffirmationText(exact)).toBeNull();
  });
});
