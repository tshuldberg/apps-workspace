import { describe, expect, it } from 'vitest';
import type { Factor } from '../models/factor-schemas';
import type { SleepAnalyticsEntry } from '../engine/analytics';
import {
  correlateAlcohol,
  correlateCaffeine,
  correlateExercise,
  correlateScreenTime,
  correlateStress,
  generateInsight,
  getTopCorrelations,
} from '../engine/correlations';

function formatDate(index: number): string {
  return new Date(Date.UTC(2026, 0, index + 1, 12, 0, 0, 0))
    .toISOString()
    .slice(0, 10);
}

function makeEntry(
  index: number,
  qualityRating: number | null,
  overrides: Partial<SleepAnalyticsEntry> = {},
): SleepAnalyticsEntry {
  const date = overrides.date ?? formatDate(index);

  return {
    id: `entry-${index}`,
    date,
    bedtime: `${date}T23:00:00.000Z`,
    sleep_onset_time: null,
    wake_time: `${date}T07:00:00.000Z`,
    duration_minutes: 480,
    quality_rating: qualityRating,
    wake_count: 1,
    sleep_latency_minutes: 15,
    alarm_time: null,
    snooze_count: 0,
    wake_feeling: 'refreshed',
    notes_md: null,
    created_at: `${date}T07:05:00.000Z`,
    updated_at: `${date}T07:05:00.000Z`,
    ...overrides,
  };
}

function makeFactor(
  entry: SleepAnalyticsEntry,
  overrides: Partial<Factor> = {},
): Factor {
  return {
    id: `factor-${entry.id}`,
    sleep_entry_id: entry.id,
    date: entry.date,
    last_caffeine_time: null,
    last_meal_time: null,
    alcohol_drinks: 0,
    exercise_today: false,
    exercise_time: null,
    screen_cutoff_time: null,
    room_temp: null,
    room_light: null,
    room_noise: null,
    supplements: [],
    stress_level: null,
    pre_sleep_activities: [],
    notes: null,
    created_at: `${entry.date}T07:10:00.000Z`,
    ...overrides,
  };
}

function addNights(
  entries: SleepAnalyticsEntry[],
  factors: Factor[],
  count: number,
  qualityRating: number | null,
  factorOverrides: Partial<Factor>,
  entryOverrides: Partial<SleepAnalyticsEntry> = {},
): void {
  for (let offset = 0; offset < count; offset += 1) {
    const index = entries.length;
    const entry = makeEntry(index, qualityRating, entryOverrides);
    entries.push(entry);
    factors.push(makeFactor(entry, factorOverrides));
  }
}

function findGroupSampleSize(
  groups: readonly { key: string; sampleSize: number }[],
  key: string,
): number {
  return groups.find((group) => group.key === key)?.sampleSize ?? 0;
}

describe('sleep factor correlations', () => {
  it('reports exercise impact with explicit confidence and insight copy', () => {
    const entries: SleepAnalyticsEntry[] = [];
    const factors: Factor[] = [];
    addNights(entries, factors, 7, 5, { exercise_today: true });
    addNights(entries, factors, 7, 3, { exercise_today: false });

    const result = correlateExercise(entries, factors);

    expect(result).toMatchObject({
      factor: 'exercise',
      status: 'reportable',
      direction: 'positive',
      confidence: 'low',
      sampleSize: 14,
      difference: 2,
      impactPercent: 66.7,
      favorableGroupKey: 'with_exercise',
      baselineGroupKey: 'without_exercise',
      insight: 'Sleep quality is 66.7% better on exercise days.',
    });
    expect(generateInsight(result)).toBe(result.insight);
  });

  it('compares caffeine cutoff, alcohol use, and stress groups by mean quality', () => {
    const entries: SleepAnalyticsEntry[] = [];
    const factors: Factor[] = [];
    addNights(entries, factors, 7, 5, {
      last_caffeine_time: '13:30',
      alcohol_drinks: 0,
      stress_level: 1,
    });
    addNights(entries, factors, 7, 3, {
      last_caffeine_time: '19:15',
      alcohol_drinks: 2,
      stress_level: 5,
    });

    expect(correlateCaffeine(entries, factors)).toMatchObject({
      factor: 'caffeine',
      status: 'reportable',
      difference: 2,
      thresholdLabel: 'Early before 2 PM, late after 6 PM',
      insight: 'Sleep quality is 66.7% better when caffeine stops before 2 PM.',
    });
    expect(correlateAlcohol(entries, factors)).toMatchObject({
      factor: 'alcohol',
      status: 'reportable',
      difference: 2,
      insight: 'Sleep quality is 66.7% better on nights without alcohol.',
    });
    expect(correlateStress(entries, factors)).toMatchObject({
      factor: 'stress',
      status: 'reportable',
      direction: 'positive',
      difference: 2,
      insight: 'Sleep quality is 66.7% better after low-stress days.',
    });
  });

  it('normalizes cross-midnight bedtime when comparing screen cutoff timing', () => {
    const entries: SleepAnalyticsEntry[] = [];
    const factors: Factor[] = [];
    addNights(entries, factors, 7, 5, { screen_cutoff_time: '23:00' }, {
      bedtime: '2026-04-02T00:30:00.000Z',
    });
    addNights(entries, factors, 7, 3, { screen_cutoff_time: '00:10' }, {
      bedtime: '2026-04-02T00:30:00.000Z',
    });

    const result = correlateScreenTime(entries, factors);

    expect(result).toMatchObject({
      factor: 'screen_time',
      status: 'reportable',
      difference: 2,
      thresholdLabel: 'Early more than 1 hour before bed, late less than 30 minutes before bed',
      insight: 'Sleep quality is 66.7% better when screens stop more than 1 hour before bed.',
    });
    expect(findGroupSampleSize(result.groups, 'early_screen_cutoff')).toBe(7);
    expect(findGroupSampleSize(result.groups, 'late_screen_cutoff')).toBe(7);
  });

  it('returns explicit insufficient sample states for empty, one-sided, and missing-field data', () => {
    expect(correlateExercise([], [])).toMatchObject({
      status: 'insufficient_data',
      sampleSize: 0,
      reason: 'At least 7 rated nights are required in each comparison group.',
      insight: null,
    });

    const oneSidedEntries: SleepAnalyticsEntry[] = [];
    const oneSidedFactors: Factor[] = [];
    addNights(oneSidedEntries, oneSidedFactors, 7, 5, {
      exercise_today: true,
    });
    expect(correlateExercise(oneSidedEntries, oneSidedFactors)).toMatchObject({
      status: 'insufficient_data',
      sampleSize: 7,
    });

    const missingQualityEntries: SleepAnalyticsEntry[] = [];
    const missingQualityFactors: Factor[] = [];
    addNights(missingQualityEntries, missingQualityFactors, 6, 5, {
      exercise_today: true,
    });
    addNights(missingQualityEntries, missingQualityFactors, 1, null, {
      exercise_today: true,
    });
    addNights(missingQualityEntries, missingQualityFactors, 7, 3, {
      exercise_today: false,
    });
    const missingQuality = correlateExercise(
      missingQualityEntries,
      missingQualityFactors,
    );
    expect(missingQuality.status).toBe('insufficient_data');
    expect(findGroupSampleSize(missingQuality.groups, 'with_exercise')).toBe(6);

    const missingCaffeineEntries: SleepAnalyticsEntry[] = [];
    const missingCaffeineFactors: Factor[] = [];
    addNights(missingCaffeineEntries, missingCaffeineFactors, 14, 4, {
      last_caffeine_time: null,
    });
    expect(correlateCaffeine(missingCaffeineEntries, missingCaffeineFactors))
      .toMatchObject({
        status: 'insufficient_data',
        sampleSize: 0,
      });
  });

  it('keeps ties deterministic and filters not-significant correlations', () => {
    const tiedEntries: SleepAnalyticsEntry[] = [];
    const tiedFactors: Factor[] = [];
    addNights(tiedEntries, tiedFactors, 7, 5, {
      exercise_today: true,
      last_caffeine_time: '13:00',
    });
    addNights(tiedEntries, tiedFactors, 7, 3, {
      exercise_today: false,
      last_caffeine_time: '19:00',
    });

    expect(getTopCorrelations(tiedEntries, tiedFactors).map((item) => item.factor))
      .toEqual(['exercise', 'caffeine']);

    const flatEntries: SleepAnalyticsEntry[] = [];
    const flatFactors: Factor[] = [];
    addNights(flatEntries, flatFactors, 7, 4, { exercise_today: true });
    addNights(flatEntries, flatFactors, 7, 4, { exercise_today: false });

    const flatResult = correlateExercise(flatEntries, flatFactors);
    expect(flatResult).toMatchObject({
      status: 'not_significant',
      direction: 'neutral',
      difference: 0,
      insight: null,
    });
    expect(getTopCorrelations(flatEntries, flatFactors)).toEqual([]);
  });
});
