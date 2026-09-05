import { describe, it, expect } from 'vitest';
import { calculateWarmupSets } from '../warmup';

describe('calculateWarmupSets', () => {
  it('returns just a bar-only set when working weight <= bar weight', () => {
    const sets = calculateWarmupSets(45, 45);
    expect(sets).toHaveLength(1);
    expect(sets[0]).toEqual({ weight: 45, reps: 10, percentage: 0 });
  });

  it('returns just a bar-only set when working weight < bar weight', () => {
    const sets = calculateWarmupSets(30, 45);
    expect(sets).toHaveLength(1);
    expect(sets[0]).toEqual({ weight: 45, reps: 10, percentage: 0 });
  });

  it('produces standard warmup progression for 225 lb working weight', () => {
    const sets = calculateWarmupSets(225, 45);

    // Bar only
    expect(sets[0]).toEqual({ weight: 45, reps: 10, percentage: 0 });

    // 50% of 225 = 112.5, rounded to nearest 5 = 115
    expect(sets).toContainEqual({ weight: 115, reps: 8, percentage: 50 });

    // 70% of 225 = 157.5, rounded to nearest 5 = 160
    expect(sets).toContainEqual({ weight: 160, reps: 5, percentage: 70 });

    // 85% of 225 = 191.25, rounded to nearest 5 = 190
    expect(sets).toContainEqual({ weight: 190, reps: 3, percentage: 85 });
  });

  it('skips percentage steps that round to bar weight', () => {
    // Working weight = 95. 50% = 47.5 -> rounded = 50 (above bar, keep).
    // But with very low working weight, e.g. 50: 50% = 25 -> rounded = 25, <= 45 -> skip
    const sets = calculateWarmupSets(50, 45);
    // 50% of 50 = 25, rounds to 25, <= bar -> skip
    // 70% of 50 = 35, rounds to 35, <= bar -> skip
    // 85% of 50 = 42.5, rounds to 45, <= bar -> skip
    // Only bar-only remains
    expect(sets).toHaveLength(1);
    expect(sets[0]).toEqual({ weight: 45, reps: 10, percentage: 0 });
  });

  it('skips percentage steps that round to or above working weight', () => {
    // Working weight = 55. 85% = 46.75, rounded = 45, <= bar -> skip
    // 70% = 38.5, rounded = 40, <= bar -> skip
    // 50% = 27.5, rounded = 30, <= bar -> skip
    const sets = calculateWarmupSets(55, 45);
    expect(sets).toHaveLength(1);
  });

  it('rounds to nearest 5', () => {
    // Working weight = 185
    // 50% = 92.5 -> round to 95
    // 70% = 129.5 -> round to 130
    // 85% = 157.25 -> round to 155
    const sets = calculateWarmupSets(185, 45);
    const weights = sets.map((s) => s.weight);

    // All non-bar weights should be divisible by 5
    for (const w of weights) {
      expect(w % 5).toBe(0);
    }
  });

  it('always starts with bar-only as first set', () => {
    const sets = calculateWarmupSets(315, 45);
    expect(sets[0]).toEqual({ weight: 45, reps: 10, percentage: 0 });
  });
});
