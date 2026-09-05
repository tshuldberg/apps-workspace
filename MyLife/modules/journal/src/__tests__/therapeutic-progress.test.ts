import { describe, it, expect } from 'vitest';
import {
  computeThoughtRecordCompletionRate,
  computeAvgBeliefReduction,
  rankDistortionsByFrequency,
  computeEmotionalIntensityTrend,
  computeTherapyPrepConsistency,
  computeTherapeuticProgress,
} from '../engine/therapeutic-progress';

describe('computeThoughtRecordCompletionRate', () => {
  it('returns 0 for empty records', () => {
    expect(computeThoughtRecordCompletionRate([])).toBe(0);
  });

  it('returns 1 when all complete', () => {
    const records = [{ status: 'complete' }, { status: 'complete' }];
    expect(computeThoughtRecordCompletionRate(records)).toBe(1);
  });

  it('returns correct ratio', () => {
    const records = [
      { status: 'complete' },
      { status: 'draft' },
      { status: 'complete' },
      { status: 'draft' },
    ];
    expect(computeThoughtRecordCompletionRate(records)).toBe(0.5);
  });
});

describe('computeAvgBeliefReduction', () => {
  it('returns 0 for empty records', () => {
    expect(computeAvgBeliefReduction([])).toBe(0);
  });

  it('returns 0 when no completed records with belief data', () => {
    const records = [
      { status: 'draft', thoughtBeliefBefore: 80, thoughtBeliefAfter: null },
    ];
    expect(computeAvgBeliefReduction(records)).toBe(0);
  });

  it('computes average reduction for completed records', () => {
    const records = [
      { status: 'complete', thoughtBeliefBefore: 80, thoughtBeliefAfter: 30 }, // 50 reduction
      { status: 'complete', thoughtBeliefBefore: 70, thoughtBeliefAfter: 40 }, // 30 reduction
      { status: 'draft', thoughtBeliefBefore: 90, thoughtBeliefAfter: 90 },   // ignored
    ];
    expect(computeAvgBeliefReduction(records)).toBe(40); // (50+30)/2
  });

  it('handles records where belief increased', () => {
    const records = [
      { status: 'complete', thoughtBeliefBefore: 30, thoughtBeliefAfter: 50 }, // -20
    ];
    expect(computeAvgBeliefReduction(records)).toBe(-20);
  });
});

describe('rankDistortionsByFrequency', () => {
  it('returns empty for no distortions', () => {
    expect(rankDistortionsByFrequency([])).toEqual([]);
  });

  it('ranks by frequency descending', () => {
    const distortions = [
      { distortionType: 'all_or_nothing' },
      { distortionType: 'fortune_telling' },
      { distortionType: 'all_or_nothing' },
      { distortionType: 'all_or_nothing' },
      { distortionType: 'fortune_telling' },
    ];
    const result = rankDistortionsByFrequency(distortions);
    expect(result[0].type).toBe('all_or_nothing');
    expect(result[0].count).toBe(3);
    expect(result[0].label).toBe('All-or-Nothing Thinking');
    expect(result[1].type).toBe('fortune_telling');
    expect(result[1].count).toBe(2);
  });

  it('respects limit', () => {
    const distortions = Array.from({ length: 10 }, (_, i) => ({
      distortionType: `type_${i}`,
    }));
    const result = rankDistortionsByFrequency(distortions, 3);
    expect(result).toHaveLength(3);
  });
});

describe('computeEmotionalIntensityTrend', () => {
  it('returns stable for fewer than 4 records', () => {
    expect(computeEmotionalIntensityTrend([
      { intensityBefore: 80, date: '2026-01-01' },
    ])).toBe('stable');
  });

  it('detects improving trend (decreasing intensity)', () => {
    const emotions = [
      { intensityBefore: 80, date: '2026-01-01' },
      { intensityBefore: 75, date: '2026-01-02' },
      { intensityBefore: 40, date: '2026-01-03' },
      { intensityBefore: 30, date: '2026-01-04' },
    ];
    expect(computeEmotionalIntensityTrend(emotions)).toBe('improving');
  });

  it('detects worsening trend (increasing intensity)', () => {
    const emotions = [
      { intensityBefore: 30, date: '2026-01-01' },
      { intensityBefore: 35, date: '2026-01-02' },
      { intensityBefore: 70, date: '2026-01-03' },
      { intensityBefore: 80, date: '2026-01-04' },
    ];
    expect(computeEmotionalIntensityTrend(emotions)).toBe('worsening');
  });

  it('returns stable when change is within threshold', () => {
    const emotions = [
      { intensityBefore: 50, date: '2026-01-01' },
      { intensityBefore: 52, date: '2026-01-02' },
      { intensityBefore: 48, date: '2026-01-03' },
      { intensityBefore: 51, date: '2026-01-04' },
    ];
    expect(computeEmotionalIntensityTrend(emotions)).toBe('stable');
  });
});

describe('computeTherapyPrepConsistency', () => {
  it('returns 0 for no entries', () => {
    const result = computeTherapyPrepConsistency([]);
    expect(result.consistency).toBe(0);
    expect(result.totalSessions).toBe(0);
  });

  it('computes consistency ratio', () => {
    const entries = [
      { entryType: 'therapy_prep', therapySessionNumber: 1 },
      { entryType: 'standard', therapySessionNumber: 1 },
      { entryType: 'standard', therapySessionNumber: 2 },
      { entryType: 'therapy_prep', therapySessionNumber: 3 },
      { entryType: 'standard', therapySessionNumber: 3 },
    ];
    const result = computeTherapyPrepConsistency(entries);
    expect(result.totalSessions).toBe(3);
    expect(result.sessionsWithPrep).toBe(2);
    expect(result.consistency).toBeCloseTo(0.67, 1);
  });
});

describe('computeTherapeuticProgress', () => {
  it('returns zero progress for empty data', () => {
    const result = computeTherapeuticProgress([], [], [], []);
    expect(result.thoughtRecordCompletionRate).toBe(0);
    expect(result.avgBeliefReduction).toBe(0);
    expect(result.topDistortions).toEqual([]);
    expect(result.emotionalIntensityTrend).toBe('stable');
    expect(result.therapyPrepConsistency).toBe(0);
  });
});
