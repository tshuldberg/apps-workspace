import { describe, it, expect } from 'vitest';
import {
  analyzeSymptomsByPhase,
  detectCycleTrend,
  generateCycleInsights,
  getPhaseSignal,
} from '../engine/insights';
import type { CycleStats, CyclePrediction } from '../types';

// ── analyzeSymptomsByPhase ───────────────────────────────────────────

describe('analyzeSymptomsByPhase', () => {
  it('returns empty array for no entries', () => {
    expect(analyzeSymptomsByPhase([])).toEqual([]);
  });

  it('filters symptoms below minOccurrences threshold', () => {
    const entries = [
      { symptom: 'cramps', category: 'physical', phase: 'menstrual' as const },
      { symptom: 'cramps', category: 'physical', phase: 'menstrual' as const },
    ];
    // Default minOccurrences is 3, so 2 occurrences should be filtered
    expect(analyzeSymptomsByPhase(entries)).toEqual([]);
  });

  it('includes symptoms meeting the threshold', () => {
    const entries = [
      { symptom: 'cramps', category: 'physical', phase: 'menstrual' as const },
      { symptom: 'cramps', category: 'physical', phase: 'menstrual' as const },
      { symptom: 'cramps', category: 'physical', phase: 'luteal' as const },
    ];
    const result = analyzeSymptomsByPhase(entries);
    expect(result).toHaveLength(1);
    expect(result[0].symptom).toBe('cramps');
    expect(result[0].dominantPhase).toBe('menstrual');
    expect(result[0].dominantCount).toBe(2);
    expect(result[0].totalCount).toBe(3);
    expect(result[0].phaseConcentration).toBeCloseTo(0.67, 1);
  });

  it('supports custom minOccurrences', () => {
    const entries = [
      { symptom: 'headache', category: 'physical', phase: 'luteal' as const },
    ];
    const result = analyzeSymptomsByPhase(entries, 1);
    expect(result).toHaveLength(1);
  });

  it('sorts by total count descending', () => {
    const entries = [
      ...Array(5).fill({ symptom: 'cramps', category: 'physical', phase: 'menstrual' as const }),
      ...Array(3).fill({ symptom: 'headache', category: 'physical', phase: 'luteal' as const }),
      ...Array(8).fill({ symptom: 'fatigue', category: 'physical', phase: 'luteal' as const }),
    ];
    const result = analyzeSymptomsByPhase(entries);
    expect(result[0].symptom).toBe('fatigue');
    expect(result[1].symptom).toBe('cramps');
    expect(result[2].symptom).toBe('headache');
  });

  it('computes correct phase breakdown', () => {
    const entries = [
      { symptom: 'bloating', category: 'physical', phase: 'menstrual' as const },
      { symptom: 'bloating', category: 'physical', phase: 'menstrual' as const },
      { symptom: 'bloating', category: 'physical', phase: 'luteal' as const },
      { symptom: 'bloating', category: 'physical', phase: 'follicular' as const },
    ];
    const result = analyzeSymptomsByPhase(entries, 3);
    expect(result[0].byPhase).toEqual({
      menstrual: 2,
      follicular: 1,
      ovulation: 0,
      luteal: 1,
    });
  });
});

// ── detectCycleTrend ─────────────────────────────────────────────────

describe('detectCycleTrend', () => {
  it('returns insufficient_data for fewer than 4 cycles', () => {
    const result = detectCycleTrend([28, 29, 30]);
    expect(result.direction).toBe('insufficient_data');
    expect(result.regularityTrend).toBe('insufficient_data');
  });

  it('detects stable cycles', () => {
    const result = detectCycleTrend([28, 28, 28, 28, 28, 28]);
    expect(result.direction).toBe('stable');
    expect(result.stdDev).toBe(0);
    expect(result.regularity).toBe(1);
  });

  it('detects lengthening trend', () => {
    const result = detectCycleTrend([26, 27, 28, 29, 30, 31]);
    expect(result.direction).toBe('lengthening');
    expect(result.slopePerCycle).toBeGreaterThan(0.3);
  });

  it('detects shortening trend', () => {
    const result = detectCycleTrend([32, 31, 30, 29, 28, 27]);
    expect(result.direction).toBe('shortening');
    expect(result.slopePerCycle).toBeLessThan(-0.3);
  });

  it('filters tracking gaps over 90 days', () => {
    const result = detectCycleTrend([28, 120, 28, 28, 28]);
    // 120-day entry filtered, leaving only 4 valid entries
    expect(result.direction).toBe('stable');
  });

  it('computes regularity score between 0 and 1', () => {
    const regular = detectCycleTrend([28, 28, 28, 28]);
    expect(regular.regularity).toBe(1);

    const irregular = detectCycleTrend([21, 35, 22, 38]);
    expect(irregular.regularity).toBeLessThan(0.8);
    expect(irregular.regularity).toBeGreaterThanOrEqual(0);
  });

  it('detects improving regularity trend', () => {
    // First half: wide variation, second half: tight
    const result = detectCycleTrend([22, 35, 24, 33, 28, 28, 28, 28]);
    expect(result.regularityTrend).toBe('improving');
  });

  it('detects worsening regularity trend', () => {
    // First half: tight, second half: wide variation
    const result = detectCycleTrend([28, 28, 28, 28, 22, 35, 23, 34]);
    expect(result.regularityTrend).toBe('worsening');
  });
});

// ── generateCycleInsights ────────────────────────────────────────────

describe('generateCycleInsights', () => {
  const baseStats: CycleStats = {
    totalCycles: 6,
    averageCycleLength: 28,
    averagePeriodLength: 5,
    shortestCycle: 26,
    longestCycle: 30,
    cycleLengthStdDev: 1.5,
  };

  const basePrediction: CyclePrediction = {
    predictedStartDate: '2026-04-10',
    predictedEndDate: '2026-04-14',
    fertileWindowStart: '2026-03-28',
    fertileWindowEnd: '2026-04-01',
    confidence: 0.87,
    daysUntilNextPeriod: 17,
  };

  it('returns needs_data insight for fewer than 2 cycles', () => {
    const stats = { ...baseStats, totalCycles: 1 };
    const result = generateCycleInsights(stats, null, null, [], '2026-03-24');
    expect(result).toHaveLength(1);
    expect(result[0].key).toBe('needs_data');
    expect(result[0].priority).toBe('high');
  });

  it('generates next period insight', () => {
    const result = generateCycleInsights(baseStats, basePrediction, null, [], '2026-03-24');
    const periodInsight = result.find((i) => i.key === 'next_period');
    expect(periodInsight).toBeDefined();
    expect(periodInsight!.text).toContain('17 days');
    expect(periodInsight!.text).toContain('87%');
  });

  it('generates period_soon insight when <= 3 days away', () => {
    const prediction = { ...basePrediction, daysUntilNextPeriod: 2 };
    const result = generateCycleInsights(baseStats, prediction, null, [], '2026-04-08');
    const soon = result.find((i) => i.key === 'period_soon');
    expect(soon).toBeDefined();
    expect(soon!.priority).toBe('high');
  });

  it('generates period_expected insight when period is due or late', () => {
    const prediction = { ...basePrediction, daysUntilNextPeriod: 0 };
    const result = generateCycleInsights(baseStats, prediction, null, [], '2026-04-10');
    const expected = result.find((i) => i.key === 'period_expected');
    expect(expected).toBeDefined();
    expect(expected!.priority).toBe('high');
  });

  it('generates fertile window insight when in window', () => {
    const result = generateCycleInsights(baseStats, basePrediction, null, [], '2026-03-29');
    const fertile = result.find((i) => i.key === 'fertile_now');
    expect(fertile).toBeDefined();
    expect(fertile!.priority).toBe('high');
  });

  it('generates regularity insights', () => {
    const irregularStats = { ...baseStats, cycleLengthStdDev: 5, shortestCycle: 21, longestCycle: 35 };
    const result = generateCycleInsights(irregularStats, null, null, [], '2026-03-24');
    const irregular = result.find((i) => i.key === 'irregular');
    expect(irregular).toBeDefined();
  });

  it('generates trend insights', () => {
    const trend = {
      direction: 'lengthening' as const,
      slopePerCycle: 0.8,
      stdDev: 2,
      regularity: 0.9,
      regularityTrend: 'stable' as const,
    };
    const result = generateCycleInsights(baseStats, null, trend, [], '2026-03-24');
    const trendInsight = result.find((i) => i.key === 'trend_lengthening');
    expect(trendInsight).toBeDefined();
    expect(trendInsight!.text).toContain('+0.8');
  });

  it('generates symptom pattern insights for strong patterns', () => {
    const patterns = [
      {
        symptom: 'cramps',
        category: 'physical',
        dominantPhase: 'menstrual' as const,
        dominantCount: 5,
        totalCount: 6,
        phaseConcentration: 0.83,
        byPhase: { menstrual: 5, follicular: 1, ovulation: 0, luteal: 0 },
      },
    ];
    const result = generateCycleInsights(baseStats, null, null, patterns, '2026-03-24');
    const symptomInsight = result.find((i) => i.key === 'symptom_pattern_cramps');
    expect(symptomInsight).toBeDefined();
    expect(symptomInsight!.text).toContain('Cramps');
    expect(symptomInsight!.text).toContain('menstrual');
    expect(symptomInsight!.text).toContain('83%');
  });

  it('sorts insights by priority (high first)', () => {
    const prediction = { ...basePrediction, daysUntilNextPeriod: 1 };
    const trend = {
      direction: 'shortening' as const,
      slopePerCycle: -0.5,
      stdDev: 2,
      regularity: 0.9,
      regularityTrend: 'improving' as const,
    };
    const result = generateCycleInsights(baseStats, prediction, trend, [], '2026-04-09');
    expect(result[0].priority).toBe('high');
    // Medium and low come after
    const priorities = result.map((i) => i.priority);
    const order = priorities.map((p) => ({ high: 0, medium: 1, low: 2 }[p]));
    for (let i = 1; i < order.length; i++) {
      expect(order[i]).toBeGreaterThanOrEqual(order[i - 1]);
    }
  });
});

// ── getPhaseSignal ───────────────────────────────────────────────────

describe('getPhaseSignal', () => {
  it('returns menstrual phase for day 1-5 of a 28-day cycle', () => {
    const signal = getPhaseSignal('2026-03-20', '2026-03-22', 28, null);
    expect(signal.phase).toBe('menstrual');
    expect(signal.dayOfCycle).toBe(3);
    expect(signal.cycleLength).toBe(28);
    expect(signal.daysUntilNextPeriod).toBeNull();
    expect(signal.isInFertileWindow).toBe(false);
  });

  it('returns follicular phase mid-cycle', () => {
    const signal = getPhaseSignal('2026-03-01', '2026-03-10', 28, null);
    expect(signal.phase).toBe('follicular');
    expect(signal.dayOfCycle).toBe(10);
  });

  it('returns ovulation phase around day 14-16', () => {
    const signal = getPhaseSignal('2026-03-01', '2026-03-15', 28, null);
    expect(signal.phase).toBe('ovulation');
    expect(signal.dayOfCycle).toBe(15);
  });

  it('returns luteal phase late in cycle', () => {
    const signal = getPhaseSignal('2026-03-01', '2026-03-22', 28, null);
    expect(signal.phase).toBe('luteal');
    expect(signal.dayOfCycle).toBe(22);
  });

  it('detects fertile window from prediction', () => {
    const prediction: CyclePrediction = {
      predictedStartDate: '2026-04-10',
      predictedEndDate: '2026-04-14',
      fertileWindowStart: '2026-03-28',
      fertileWindowEnd: '2026-04-01',
      confidence: 0.85,
      daysUntilNextPeriod: 12,
    };
    const signal = getPhaseSignal('2026-03-15', '2026-03-29', 28, prediction);
    expect(signal.isInFertileWindow).toBe(true);
  });

  it('returns daysUntilNextPeriod from prediction', () => {
    const prediction: CyclePrediction = {
      predictedStartDate: '2026-04-10',
      predictedEndDate: '2026-04-14',
      fertileWindowStart: null,
      fertileWindowEnd: null,
      confidence: 0.85,
      daysUntilNextPeriod: 12,
    };
    const signal = getPhaseSignal('2026-03-15', '2026-03-29', 28, prediction);
    expect(signal.daysUntilNextPeriod).toBe(12);
  });

  it('clamps dayOfCycle to minimum 1', () => {
    // Future cycle start date
    const signal = getPhaseSignal('2026-03-30', '2026-03-24', 28, null);
    expect(signal.dayOfCycle).toBe(1);
  });
});
