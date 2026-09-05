import { describe, it, expect } from 'vitest';
import {
  calculateStreaks,
  scoreToPixelColor,
  pearsonCorrelation,
  isSignificantCorrelation,
  generateWeeklyReport,
} from '../engine/streak';
import type { WeeklyReportEntry } from '../engine/streak';
import {
  getBreathingCycleSteps,
  getCycleDuration,
  getCyclesForDuration,
} from '../engine/breathing';

describe('Streak Calculator', () => {
  it('returns zero streaks for empty dates', () => {
    const result = calculateStreaks([], '2026-03-08');
    expect(result.currentStreak).toBe(0);
    expect(result.longestStreak).toBe(0);
    expect(result.lastLogDate).toBeNull();
  });

  it('counts consecutive days from reference date', () => {
    const dates = ['2026-03-08', '2026-03-07', '2026-03-06'];
    const result = calculateStreaks(dates, '2026-03-08');
    expect(result.currentStreak).toBe(3);
    expect(result.longestStreak).toBe(3);
  });

  it('breaks streak on gap', () => {
    const dates = ['2026-03-08', '2026-03-07', '2026-03-05', '2026-03-04'];
    const result = calculateStreaks(dates, '2026-03-08');
    expect(result.currentStreak).toBe(2);
    expect(result.longestStreak).toBe(2);
  });

  it('finds longest streak separate from current', () => {
    const dates = [
      '2026-03-08',
      // gap on 2026-03-07
      '2026-03-05', '2026-03-04', '2026-03-03', '2026-03-02',
    ];
    const result = calculateStreaks(dates, '2026-03-08');
    expect(result.currentStreak).toBe(1);
    expect(result.longestStreak).toBe(4);
  });

  it('tracks lastLogDate', () => {
    const result = calculateStreaks(['2026-03-06'], '2026-03-08');
    expect(result.lastLogDate).toBe('2026-03-06');
  });
});

describe('Score to Pixel Color', () => {
  it('maps score 1 to red', () => {
    expect(scoreToPixelColor(1)).toBe('#EF4444');
  });

  it('maps score 10 to light blue', () => {
    expect(scoreToPixelColor(10)).toBe('#60A5FA');
  });

  it('maps score 5 to yellow', () => {
    expect(scoreToPixelColor(5)).toBe('#EAB308');
  });

  it('clamps out-of-range scores', () => {
    expect(scoreToPixelColor(0)).toBe('#EF4444');
    expect(scoreToPixelColor(11)).toBe('#60A5FA');
  });

  it('rounds fractional scores', () => {
    expect(scoreToPixelColor(7.4)).toBe('#22C55E');
    expect(scoreToPixelColor(7.6)).toBe('#4ADE80');
  });
});

describe('Pearson Correlation', () => {
  it('returns null for fewer than 5 data points', () => {
    expect(pearsonCorrelation([1, 2, 3], [4, 5, 6])).toBeNull();
  });

  it('returns 1.0 for perfectly correlated data', () => {
    const x = [1, 2, 3, 4, 5];
    const y = [2, 4, 6, 8, 10];
    expect(pearsonCorrelation(x, y)).toBe(1);
  });

  it('returns -1.0 for perfectly inverse data', () => {
    const x = [1, 2, 3, 4, 5];
    const y = [10, 8, 6, 4, 2];
    expect(pearsonCorrelation(x, y)).toBe(-1);
  });

  it('returns null for zero variance', () => {
    expect(pearsonCorrelation([5, 5, 5, 5, 5], [1, 2, 3, 4, 5])).toBeNull();
  });

  it('computes moderate correlation', () => {
    const x = [1, 2, 3, 4, 5, 6, 7];
    const y = [2, 3, 2, 5, 4, 7, 6];
    const r = pearsonCorrelation(x, y);
    expect(r).not.toBeNull();
    expect(r!).toBeGreaterThan(0.5);
    expect(r!).toBeLessThan(1);
  });
});

describe('isSignificantCorrelation', () => {
  it('returns false for null', () => {
    expect(isSignificantCorrelation(null)).toBe(false);
  });

  it('returns false for weak correlation', () => {
    expect(isSignificantCorrelation(0.2)).toBe(false);
    expect(isSignificantCorrelation(-0.1)).toBe(false);
  });

  it('returns true for |r| >= 0.3', () => {
    expect(isSignificantCorrelation(0.3)).toBe(true);
    expect(isSignificantCorrelation(-0.5)).toBe(true);
    expect(isSignificantCorrelation(0.9)).toBe(true);
  });
});

describe('Breathing Engine', () => {
  it('generates box breathing cycle steps', () => {
    const steps = getBreathingCycleSteps('box');
    expect(steps).toHaveLength(4);
    expect(steps[0]).toEqual({ phase: 'inhale', durationSeconds: 4 });
    expect(steps[1]).toEqual({ phase: 'hold', durationSeconds: 4 });
    expect(steps[2]).toEqual({ phase: 'exhale', durationSeconds: 4 });
    expect(steps[3]).toEqual({ phase: 'hold2', durationSeconds: 4 });
  });

  it('generates 4-7-8 cycle steps (no hold2)', () => {
    const steps = getBreathingCycleSteps('478');
    expect(steps).toHaveLength(3);
    expect(steps[0].durationSeconds).toBe(4);
    expect(steps[1].durationSeconds).toBe(7);
    expect(steps[2].durationSeconds).toBe(8);
  });

  it('calculates cycle duration', () => {
    expect(getCycleDuration('box')).toBe(16);
    expect(getCycleDuration('478')).toBe(19);
    expect(getCycleDuration('relaxing')).toBe(12);
  });

  it('calculates cycles for a target duration', () => {
    expect(getCyclesForDuration('box', 60)).toBe(3);
    expect(getCyclesForDuration('box', 64)).toBe(4);
    expect(getCyclesForDuration('478', 60)).toBe(3);
  });

  it('generates energizing breathing cycle steps', () => {
    const steps = getBreathingCycleSteps('energizing');
    expect(steps).toHaveLength(3);
    expect(steps[0]).toEqual({ phase: 'inhale', durationSeconds: 2 });
    expect(steps[1]).toEqual({ phase: 'hold', durationSeconds: 1 });
    expect(steps[2]).toEqual({ phase: 'exhale', durationSeconds: 2 });
  });

  it('generates sleep breathing cycle steps', () => {
    const steps = getBreathingCycleSteps('sleep');
    expect(steps).toHaveLength(3);
    expect(steps[0]).toEqual({ phase: 'inhale', durationSeconds: 4 });
    expect(steps[1]).toEqual({ phase: 'exhale', durationSeconds: 8 });
    expect(steps[2]).toEqual({ phase: 'hold2', durationSeconds: 2 });
  });

  it('calculates energizing and sleep cycle durations', () => {
    expect(getCycleDuration('energizing')).toBe(5);
    expect(getCycleDuration('sleep')).toBe(14);
  });
});

describe('Weekly Report Generator', () => {
  const makeEntry = (
    score: number,
    date: string,
    activityNames: string[] = [],
    emotions: string[] = [],
  ): WeeklyReportEntry => ({ score, date, activityNames, emotions });

  it('returns zeroed report for empty entries', () => {
    const report = generateWeeklyReport('2026-03-01', '2026-03-07', []);
    expect(report.entryCount).toBe(0);
    expect(report.average).toBe(0);
    expect(report.high).toBe(0);
    expect(report.low).toBe(0);
    expect(report.topActivities).toEqual([]);
    expect(report.topEmotions).toEqual([]);
  });

  it('computes average, high, and low from scores', () => {
    const entries = [
      makeEntry(3, '2026-03-01'),
      makeEntry(7, '2026-03-02'),
      makeEntry(5, '2026-03-03'),
    ];
    const report = generateWeeklyReport('2026-03-01', '2026-03-07', entries);
    expect(report.average).toBe(5);
    expect(report.high).toBe(7);
    expect(report.low).toBe(3);
    expect(report.entryCount).toBe(3);
  });

  it('ranks top activities by frequency', () => {
    const entries = [
      makeEntry(7, '2026-03-01', ['Exercise', 'Social']),
      makeEntry(8, '2026-03-02', ['Exercise', 'Reading']),
      makeEntry(6, '2026-03-03', ['Exercise']),
    ];
    const report = generateWeeklyReport('2026-03-01', '2026-03-07', entries);
    expect(report.topActivities[0]).toEqual({ name: 'Exercise', count: 3 });
    expect(report.topActivities).toHaveLength(3);
  });

  it('ranks top emotions by frequency', () => {
    const entries = [
      makeEntry(7, '2026-03-01', [], ['joy', 'serenity']),
      makeEntry(8, '2026-03-02', [], ['joy', 'trust']),
      makeEntry(6, '2026-03-03', [], ['joy']),
    ];
    const report = generateWeeklyReport('2026-03-01', '2026-03-07', entries);
    expect(report.topEmotions[0]).toEqual({ emotion: 'joy', count: 3 });
  });

  it('limits top activities and emotions to 5', () => {
    const manyActivities = Array.from({ length: 8 }, (_, i) => `Activity${i}`);
    const entries = [makeEntry(7, '2026-03-01', manyActivities, manyActivities)];
    const report = generateWeeklyReport('2026-03-01', '2026-03-07', entries);
    expect(report.topActivities).toHaveLength(5);
    expect(report.topEmotions).toHaveLength(5);
  });

  it('preserves week start and end dates', () => {
    const report = generateWeeklyReport('2026-03-01', '2026-03-07', [makeEntry(5, '2026-03-01')]);
    expect(report.weekStart).toBe('2026-03-01');
    expect(report.weekEnd).toBe('2026-03-07');
  });

  it('rounds average to one decimal place', () => {
    const entries = [
      makeEntry(7, '2026-03-01'),
      makeEntry(8, '2026-03-02'),
      makeEntry(6, '2026-03-03'),
    ];
    const report = generateWeeklyReport('2026-03-01', '2026-03-07', entries);
    expect(report.average).toBe(7);
  });
});
