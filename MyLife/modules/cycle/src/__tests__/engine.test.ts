import { describe, it, expect } from 'vitest';
import {
  calculateAverageCycleLength,
  calculateAveragePeriodLength,
  predictNextPeriod,
  getCurrentPhase,
  isLateByDays,
} from '../engine/prediction';

describe('calculateAverageCycleLength', () => {
  it('returns null with fewer than 2 cycle lengths', () => {
    expect(calculateAverageCycleLength([])).toBeNull();
    expect(calculateAverageCycleLength([28])).toBeNull();
  });

  it('computes weighted average for uniform cycles', () => {
    const result = calculateAverageCycleLength([28, 28, 28]);
    expect(result).toBe(28);
  });

  it('weights recent cycles more heavily', () => {
    // Most recent (30) gets weight 2, older (26) gets weight 1
    // Weighted avg = (30*2 + 26*1) / 3 = 86/3 = 28.7
    const result = calculateAverageCycleLength([30, 26]);
    expect(result).toBe(28.7);
  });

  it('limits to last 6 cycles', () => {
    const lengths = [28, 29, 27, 30, 26, 28, 32, 33, 35];
    const result = calculateAverageCycleLength(lengths);
    expect(result).not.toBeNull();
    // Only first 6 values used
    expect(result).toBeGreaterThan(25);
    expect(result).toBeLessThan(35);
  });

  it('filters out tracking gaps (>90 days)', () => {
    const result = calculateAverageCycleLength([28, 120, 28]);
    // 120 is filtered, leaving [28, 28]
    expect(result).toBe(28);
  });

  it('returns null when filtering leaves fewer than 2 cycles', () => {
    expect(calculateAverageCycleLength([120, 95])).toBeNull();
  });
});

describe('calculateAveragePeriodLength', () => {
  it('returns null with no data', () => {
    expect(calculateAveragePeriodLength([])).toBeNull();
  });

  it('computes weighted average period', () => {
    const result = calculateAveragePeriodLength([5, 4, 6]);
    expect(result).not.toBeNull();
    // weight: 5*3 + 4*2 + 6*1 = 15+8+6 = 29, /6 = 4.8
    expect(result).toBe(4.8);
  });

  it('handles single data point', () => {
    expect(calculateAveragePeriodLength([5])).toBe(5);
  });
});

describe('predictNextPeriod', () => {
  it('returns null with fewer than 2 cycles', () => {
    const result = predictNextPeriod('2026-03-01', [28], [5], '2026-03-15');
    expect(result).toBeNull();
  });

  it('predicts next period with regular cycles', () => {
    const result = predictNextPeriod(
      '2026-03-01', // last cycle start
      [28, 28, 28], // cycle lengths
      [5, 5, 5], // period lengths
      '2026-03-15', // today
    );
    expect(result).not.toBeNull();
    expect(result!.predictedStartDate).toBe('2026-03-29');
    expect(result!.predictedEndDate).toBe('2026-04-02');
    expect(result!.daysUntilNextPeriod).toBe(14);
    expect(result!.confidence).toBeGreaterThan(0.9);
    expect(result!.fertileWindowStart).toBeTruthy();
    expect(result!.fertileWindowEnd).toBeTruthy();
  });

  it('provides fertile window estimate', () => {
    const result = predictNextPeriod(
      '2026-03-01',
      [28, 28],
      [5],
      '2026-03-10',
    );
    expect(result).not.toBeNull();
    // Ovulation around day 14 (March 15)
    // Fertile window: March 12 to March 16
    expect(result!.fertileWindowStart).toBe('2026-03-12');
    expect(result!.fertileWindowEnd).toBe('2026-03-16');
  });

  it('handles negative days until (past predicted start)', () => {
    const result = predictNextPeriod(
      '2026-02-01',
      [28, 28],
      [5],
      '2026-03-15', // past the predicted March 1 start
    );
    expect(result).not.toBeNull();
    expect(result!.daysUntilNextPeriod).toBeLessThan(0);
  });

  it('has lower confidence for irregular cycles', () => {
    const result = predictNextPeriod(
      '2026-03-01',
      [35, 22, 40, 25, 30], // irregular
      [5, 4, 6, 5, 5],
      '2026-03-15',
    );
    expect(result).not.toBeNull();
    expect(result!.confidence).toBeLessThan(0.9);
  });

  it('defaults period length to 5 when no data available', () => {
    const result = predictNextPeriod(
      '2026-03-01',
      [28, 28],
      [], // no period data
      '2026-03-15',
    );
    expect(result).not.toBeNull();
    // predicted end = start + 4 (5 day period, last day inclusive)
    expect(result!.predictedEndDate).toBe('2026-04-02');
  });
});

describe('getCurrentPhase', () => {
  it('returns menstrual on day 1', () => {
    expect(getCurrentPhase('2026-03-01', '2026-03-01')).toBe('menstrual');
  });

  it('returns menstrual during first ~5 days of 28-day cycle', () => {
    // 28 * 0.18 = 5.04, rounds to 5
    expect(getCurrentPhase('2026-03-01', '2026-03-05')).toBe('menstrual');
  });

  it('returns follicular after menstrual phase', () => {
    expect(getCurrentPhase('2026-03-01', '2026-03-06')).toBe('follicular');
  });

  it('returns ovulation around mid-cycle', () => {
    // 28 * 0.46 = 12.88 rounds to 13, so day 14 is ovulation
    expect(getCurrentPhase('2026-03-01', '2026-03-14')).toBe('ovulation');
  });

  it('returns luteal in the second half', () => {
    // 28 * 0.57 = 15.96 rounds to 16, so day 17+ is luteal
    expect(getCurrentPhase('2026-03-01', '2026-03-17')).toBe('luteal');
  });

  it('scales phases to longer cycles', () => {
    // 35-day cycle: menstrual ends at round(35*0.18) = 6
    expect(getCurrentPhase('2026-03-01', '2026-03-06', 35)).toBe('menstrual');
    expect(getCurrentPhase('2026-03-01', '2026-03-07', 35)).toBe('follicular');
  });

  it('returns menstrual for future start date', () => {
    // Today is before cycle start
    expect(getCurrentPhase('2026-03-15', '2026-03-10')).toBe('menstrual');
  });
});

describe('isLateByDays', () => {
  it('returns 0 when period is on time', () => {
    expect(isLateByDays('2026-03-01', 28, '2026-03-29')).toBe(0);
  });

  it('returns 0 when period is early', () => {
    expect(isLateByDays('2026-03-01', 28, '2026-03-20')).toBe(0);
  });

  it('returns positive days when late', () => {
    // Expected start: March 29. Today is April 2 = 4 days late
    expect(isLateByDays('2026-03-01', 28, '2026-04-02')).toBe(4);
  });

  it('returns 1 when one day late', () => {
    expect(isLateByDays('2026-03-01', 28, '2026-03-30')).toBe(1);
  });
});
