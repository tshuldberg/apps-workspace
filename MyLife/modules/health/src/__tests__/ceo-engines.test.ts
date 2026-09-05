import { describe, it, expect } from 'vitest';
import {
  calculateHealthScore,
  normalizeSleep,
  normalizeReadiness,
  normalizeAdherence,
  normalizeMood,
  normalizeActivity,
  normalizeMindfulness,
  getLabel,
  calculateDataCompleteness,
} from '../health-score/engine';
import type { HealthScoreInput } from '../health-score/engine';
import {
  correlate,
  correlateAll,
  pearson,
  alignSeries,
  isSignificant,
  classifyStrength,
  classifyDirection,
} from '../correlation/engine';
import type { TimeSeriesPoint } from '../correlation/engine';
import {
  compileWeeklyDigest,
  summarizeSleep,
  summarizeVitals,
  summarizeMood,
  summarizeActivity,
  summarizeFasting,
} from '../digest/engine';
import type { WeeklyDigestInput } from '../digest/engine';

// ============================================================================
// Daily Health Score
// ============================================================================

describe('Daily Health Score', () => {
  const fullInput: HealthScoreInput = {
    readinessScore: 80,
    medicationAdherence: 95,
    sleepQualityScore: 85,
    moodScore: 7,
    fastingCompleted: true,
    breathingMinutes: 10,
    meditationMinutes: 15,
    stepsProgress: 90,
  };

  it('produces a score from 0-100 with full data', () => {
    const result = calculateHealthScore(fullInput);
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
    expect(result.label).toBe('excellent');
    expect(result.dataCompleteness).toBe(1);
  });

  it('handles all-null input with neutral defaults', () => {
    const emptyInput: HealthScoreInput = {
      readinessScore: null,
      medicationAdherence: null,
      sleepQualityScore: null,
      moodScore: null,
      fastingCompleted: null,
      breathingMinutes: null,
      meditationMinutes: null,
      stepsProgress: null,
    };
    const result = calculateHealthScore(emptyInput);
    expect(result.score).toBe(50);
    expect(result.label).toBe('fair');
    expect(result.dataCompleteness).toBe(0);
  });

  it('normalizes sleep quality correctly', () => {
    expect(normalizeSleep(null)).toBe(0.5);
    expect(normalizeSleep(0)).toBe(0);
    expect(normalizeSleep(100)).toBe(1);
    expect(normalizeSleep(50)).toBe(0.5);
  });

  it('normalizes readiness score correctly', () => {
    expect(normalizeReadiness(null)).toBe(0.5);
    expect(normalizeReadiness(80)).toBe(0.8);
  });

  it('normalizes medication adherence correctly', () => {
    expect(normalizeAdherence(null)).toBe(0.5);
    expect(normalizeAdherence(100)).toBe(1);
    expect(normalizeAdherence(0)).toBe(0);
  });

  it('normalizes mood score (1-10) to 0-1', () => {
    expect(normalizeMood(null)).toBe(0.5);
    expect(normalizeMood(1)).toBe(0);
    expect(normalizeMood(10)).toBe(1);
    expect(normalizeMood(5.5)).toBeCloseTo(0.5, 1);
  });

  it('normalizes activity combining steps and fasting', () => {
    expect(normalizeActivity(null, null)).toBe(0.5);
    expect(normalizeActivity(100, null)).toBe(1);
    expect(normalizeActivity(null, true)).toBe(1);
    expect(normalizeActivity(100, true)).toBe(1);
    expect(normalizeActivity(0, false)).toBeCloseTo(0.15, 1);
  });

  it('normalizes mindfulness by total minutes', () => {
    expect(normalizeMindfulness(null, null)).toBe(0.5);
    expect(normalizeMindfulness(10, 0)).toBe(1);
    expect(normalizeMindfulness(0, 5)).toBe(0.8);
    expect(normalizeMindfulness(0, 0)).toBe(0.3);
  });

  it('assigns correct labels', () => {
    expect(getLabel(85)).toBe('excellent');
    expect(getLabel(65)).toBe('good');
    expect(getLabel(45)).toBe('fair');
    expect(getLabel(30)).toBe('needs_attention');
  });

  it('calculates data completeness', () => {
    expect(calculateDataCompleteness(fullInput)).toBe(1);
    const partial: HealthScoreInput = {
      ...fullInput,
      readinessScore: null,
      breathingMinutes: null,
      meditationMinutes: null,
    };
    expect(calculateDataCompleteness(partial)).toBe(0.63);
  });

  it('generates insights for good sleep', () => {
    const result = calculateHealthScore(fullInput);
    expect(result.insights.some((i) => i.includes('sleep'))).toBe(true);
  });
});

// ============================================================================
// Cross-Domain Correlation
// ============================================================================

describe('Cross-Domain Correlation', () => {
  const makeSeries = (values: number[], startDate = '2026-03-01'): TimeSeriesPoint[] =>
    values.map((v, i) => ({
      date: `2026-03-${String(i + 1).padStart(2, '0')}`,
      value: v,
    }));

  it('computes perfect positive correlation', () => {
    const a = makeSeries([1, 2, 3, 4, 5, 6, 7]);
    const b = makeSeries([10, 20, 30, 40, 50, 60, 70]);
    const result = correlate(a, b, 'A', 'B');
    expect(result.coefficient).toBe(1);
    expect(result.strength).toBe('strong');
    expect(result.direction).toBe('positive');
  });

  it('computes perfect negative correlation', () => {
    const a = makeSeries([1, 2, 3, 4, 5, 6, 7]);
    const b = makeSeries([70, 60, 50, 40, 30, 20, 10]);
    const result = correlate(a, b);
    expect(result.coefficient).toBe(-1);
    expect(result.direction).toBe('negative');
  });

  it('returns none for insufficient data', () => {
    const a = makeSeries([1, 2, 3]);
    const b = makeSeries([4, 5, 6]);
    const result = correlate(a, b);
    expect(result.strength).toBe('none');
    expect(result.interpretation).toContain('Insufficient data');
  });

  it('aligns series by date', () => {
    const a: TimeSeriesPoint[] = [
      { date: '2026-03-01', value: 1 },
      { date: '2026-03-02', value: 2 },
      { date: '2026-03-04', value: 4 },
    ];
    const b: TimeSeriesPoint[] = [
      { date: '2026-03-02', value: 20 },
      { date: '2026-03-03', value: 30 },
      { date: '2026-03-04', value: 40 },
    ];
    const { alignedA, alignedB } = alignSeries(a, b);
    expect(alignedA).toEqual([2, 4]);
    expect(alignedB).toEqual([20, 40]);
  });

  it('classifies correlation strength', () => {
    expect(classifyStrength(0.8)).toBe('strong');
    expect(classifyStrength(0.5)).toBe('moderate');
    expect(classifyStrength(0.3)).toBe('weak');
    expect(classifyStrength(0.1)).toBe('none');
  });

  it('classifies correlation direction', () => {
    expect(classifyDirection(0.5)).toBe('positive');
    expect(classifyDirection(-0.5)).toBe('negative');
    expect(classifyDirection(0.1)).toBe('none');
  });

  it('tests significance correctly', () => {
    expect(isSignificant(0.9, 10)).toBe(true);
    expect(isSignificant(0.1, 10)).toBe(false);
    expect(isSignificant(0.5, 3)).toBe(false);
  });

  it('correlateAll finds significant pairs and sorts by strength', () => {
    const domains = [
      { name: 'Sleep', series: makeSeries([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]) },
      { name: 'Mood', series: makeSeries([2, 4, 6, 8, 10, 12, 14, 16, 18, 20]) },
      { name: 'Random', series: makeSeries([5, 3, 8, 1, 9, 2, 7, 4, 6, 10]) },
    ];
    const results = correlateAll(domains);
    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results[0].domainA).toBe('Sleep');
    expect(results[0].domainB).toBe('Mood');
  });

  it('pearson returns 0 for zero-variance arrays', () => {
    expect(pearson([5, 5, 5, 5, 5, 5, 5], [1, 2, 3, 4, 5, 6, 7])).toBe(0);
  });
});

// ============================================================================
// Weekly Health Digest
// ============================================================================

describe('Weekly Health Digest', () => {
  const fullDigestInput: WeeklyDigestInput = {
    dateFrom: '2026-03-17',
    dateTo: '2026-03-23',
    sleepSessions: [
      { date: '2026-03-17', qualityScore: 85, durationMinutes: 450 },
      { date: '2026-03-18', qualityScore: 72, durationMinutes: 390 },
      { date: '2026-03-19', qualityScore: 90, durationMinutes: 480 },
    ],
    vitalReadings: [
      { type: 'heart_rate', date: '2026-03-17', value: 68 },
      { type: 'heart_rate', date: '2026-03-18', value: 72 },
      { type: 'blood_oxygen', date: '2026-03-17', value: 97 },
    ],
    medicationAdherence: 95,
    moodEntries: [
      { date: '2026-03-17', pleasantness: 'pleasant' },
      { date: '2026-03-18', pleasantness: 'pleasant' },
      { date: '2026-03-19', pleasantness: 'neutral' },
    ],
    activityDays: [
      { date: '2026-03-17', steps: 12000, stepsGoal: 10000 },
      { date: '2026-03-18', steps: 8000, stepsGoal: 10000 },
      { date: '2026-03-19', steps: 15000, stepsGoal: 10000 },
    ],
    fastingDays: [
      { date: '2026-03-17', completed: true },
      { date: '2026-03-18', completed: true },
      { date: '2026-03-19', completed: false },
    ],
    breathingSessions: 5,
    meditationMinutes: 30,
  };

  it('compiles a complete weekly digest', () => {
    const digest = compileWeeklyDigest(fullDigestInput);
    expect(digest.period.from).toBe('2026-03-17');
    expect(digest.period.to).toBe('2026-03-23');
    expect(digest.sections.sleep.totalNights).toBe(3);
    expect(digest.sections.vitals.totalReadings).toBe(3);
    expect(digest.sections.medication.adherenceRate).toBe(95);
    expect(digest.sections.mood.totalEntries).toBe(3);
    expect(digest.sections.activity.totalDays).toBe(3);
    expect(digest.sections.fasting.totalDays).toBe(3);
  });

  it('summarizes sleep with best/worst night', () => {
    const sleep = summarizeSleep(fullDigestInput.sleepSessions);
    expect(sleep.bestNight).toBe('2026-03-19');
    expect(sleep.worstNight).toBe('2026-03-18');
    expect(sleep.averageQuality).toBeCloseTo(82.3, 0);
  });

  it('summarizes vitals by type with averages', () => {
    const vitals = summarizeVitals(fullDigestInput.vitalReadings);
    expect(vitals.types).toContain('heart_rate');
    expect(vitals.types).toContain('blood_oxygen');
    expect(vitals.averagesByType['heart_rate']).toBe(70);
  });

  it('summarizes mood percentages', () => {
    const mood = summarizeMood(fullDigestInput.moodEntries);
    expect(mood.pleasantPercent).toBeCloseTo(66.7, 0);
  });

  it('summarizes activity with goal hit days', () => {
    const activity = summarizeActivity(fullDigestInput.activityDays);
    expect(activity.goalHitDays).toBe(2);
    expect(activity.totalDays).toBe(3);
  });

  it('summarizes fasting completion rate', () => {
    const fasting = summarizeFasting(fullDigestInput.fastingDays);
    expect(fasting.completedDays).toBe(2);
    expect(fasting.completionRate).toBeCloseTo(66.7, 0);
  });

  it('generates highlights for good performance', () => {
    const digest = compileWeeklyDigest({
      ...fullDigestInput,
      sleepSessions: [
        { date: '2026-03-17', qualityScore: 90, durationMinutes: 480 },
        { date: '2026-03-18', qualityScore: 85, durationMinutes: 450 },
      ],
      medicationAdherence: 100,
    });
    expect(digest.highlights.some((h) => h.includes('sleep'))).toBe(true);
    expect(digest.highlights.some((h) => h.includes('medication'))).toBe(true);
  });

  it('generates concerns for poor performance', () => {
    const digest = compileWeeklyDigest({
      ...fullDigestInput,
      sleepSessions: [
        { date: '2026-03-17', qualityScore: 30, durationMinutes: 300 },
      ],
      medicationAdherence: 50,
    });
    expect(digest.concerns.some((c) => c.includes('sleep') || c.includes('Sleep'))).toBe(true);
    expect(digest.concerns.some((c) => c.includes('adherence') || c.includes('Medication'))).toBe(true);
  });

  it('handles empty input gracefully', () => {
    const emptyInput: WeeklyDigestInput = {
      dateFrom: '2026-03-17',
      dateTo: '2026-03-23',
      sleepSessions: [],
      vitalReadings: [],
      medicationAdherence: 0,
      moodEntries: [],
      activityDays: [],
      fastingDays: [],
      breathingSessions: 0,
      meditationMinutes: 0,
    };
    const digest = compileWeeklyDigest(emptyInput);
    expect(digest.sections.sleep.totalNights).toBe(0);
    expect(digest.sections.vitals.totalReadings).toBe(0);
    expect(digest.highlights.length).toBe(0);
  });
});
