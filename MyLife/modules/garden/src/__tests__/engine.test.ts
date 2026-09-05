import { describe, it, expect } from 'vitest';
import {
  calculateNextWaterDate,
  isDaysOverdue,
  getSeason,
  adjustFrequencyForSeason,
  calculateSurvivalRate,
  calculateGDD,
} from '../engine/watering';

describe('calculateNextWaterDate', () => {
  it('adds frequency days to last watered date', () => {
    expect(calculateNextWaterDate('2026-03-01', 7)).toBe('2026-03-08');
  });

  it('handles month boundaries', () => {
    expect(calculateNextWaterDate('2026-03-28', 5)).toBe('2026-04-02');
  });

  it('handles daily watering', () => {
    expect(calculateNextWaterDate('2026-03-08', 1)).toBe('2026-03-09');
  });
});

describe('isDaysOverdue', () => {
  it('returns 0 when not overdue', () => {
    expect(isDaysOverdue('2026-03-06', 7, '2026-03-08')).toBe(0);
  });

  it('returns positive days when overdue', () => {
    expect(isDaysOverdue('2026-03-01', 3, '2026-03-08')).toBe(4);
  });

  it('returns frequency when never watered', () => {
    expect(isDaysOverdue(null, 7, '2026-03-08')).toBe(7);
  });

  it('returns 0 on exact due date', () => {
    expect(isDaysOverdue('2026-03-01', 7, '2026-03-08')).toBe(0);
  });
});

describe('getSeason', () => {
  it('maps months to seasons correctly', () => {
    expect(getSeason(0)).toBe('winter');   // January
    expect(getSeason(1)).toBe('winter');   // February
    expect(getSeason(2)).toBe('spring');   // March
    expect(getSeason(5)).toBe('summer');   // June
    expect(getSeason(8)).toBe('fall');     // September
    expect(getSeason(11)).toBe('winter');  // December
  });
});

describe('adjustFrequencyForSeason', () => {
  it('increases frequency in summer (shorter interval)', () => {
    const adjusted = adjustFrequencyForSeason(7, 'summer');
    expect(adjusted).toBe(5); // 7 * 0.67 = 4.69 -> round to 5
  });

  it('decreases frequency in winter (longer interval)', () => {
    const adjusted = adjustFrequencyForSeason(7, 'winter');
    expect(adjusted).toBe(14); // 7 * 2.0
  });

  it('keeps fall unchanged', () => {
    expect(adjustFrequencyForSeason(7, 'fall')).toBe(7);
  });

  it('slightly increases spring frequency', () => {
    expect(adjustFrequencyForSeason(7, 'spring')).toBe(6); // 7 * 0.85 = 5.95 -> 6
  });

  it('never goes below 1 day', () => {
    expect(adjustFrequencyForSeason(1, 'summer')).toBe(1);
  });
});

describe('calculateSurvivalRate', () => {
  it('returns 100% for no plants', () => {
    expect(calculateSurvivalRate(0, 0)).toBe(100);
  });

  it('returns 100% when no dead plants', () => {
    expect(calculateSurvivalRate(10, 0)).toBe(100);
  });

  it('calculates correctly with dead plants', () => {
    expect(calculateSurvivalRate(10, 3)).toBe(70);
  });

  it('returns 0% when all plants dead', () => {
    expect(calculateSurvivalRate(5, 5)).toBe(0);
  });
});

describe('calculateGDD', () => {
  it('calculates growing degree days', () => {
    expect(calculateGDD(25, 15)).toBe(10); // (25+15)/2 - 10 = 10
  });

  it('returns 0 when below base temp', () => {
    expect(calculateGDD(8, 2)).toBe(0); // (8+2)/2 - 10 = -5 -> 0
  });

  it('uses custom base temperature', () => {
    expect(calculateGDD(20, 10, 5)).toBe(10); // (20+10)/2 - 5 = 10
  });
});
