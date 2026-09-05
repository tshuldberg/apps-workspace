import { describe, expect, it } from 'vitest';
import type { Factor } from '../../models/factor-schemas';
import {
  assertComplexitySlope,
  assertMemoryBudget,
  randomInt,
  runDeterministicFuzz,
} from '../../test/function-quality';
import type { SleepAnalyticsEntry } from '../analytics';
import {
  correlateExercise,
  getTopCorrelations,
} from '../correlations';

function formatDate(index: number): string {
  return new Date(Date.UTC(2026, 0, index + 1, 12, 0, 0, 0))
    .toISOString()
    .slice(0, 10);
}

function makeEntry(index: number, qualityRating = 1 + (index % 5)): SleepAnalyticsEntry {
  const date = formatDate(index);

  return {
    id: `entry-${index}`,
    date,
    bedtime:
      index % 4 === 0
        ? `${date}T00:30:00.000Z`
        : `${date}T23:00:00.000Z`,
    sleep_onset_time: null,
    wake_time: `${date}T07:00:00.000Z`,
    duration_minutes: 420 + ((index % 5) * 30),
    quality_rating: index % 17 === 0 ? null : qualityRating,
    wake_count: index % 4,
    sleep_latency_minutes: index % 35,
    alarm_time: null,
    snooze_count: 0,
    wake_feeling: 'refreshed',
    notes_md: null,
    created_at: `${date}T07:05:00.000Z`,
    updated_at: `${date}T07:05:00.000Z`,
  };
}

function makeFactor(entry: SleepAnalyticsEntry, index: number): Factor {
  const isPreferred = index % 2 === 0;

  return {
    id: `factor-${index}`,
    sleep_entry_id: entry.id,
    date: entry.date,
    last_caffeine_time: isPreferred ? '13:00' : '19:00',
    last_meal_time: null,
    alcohol_drinks: isPreferred ? 0 : 1,
    exercise_today: isPreferred,
    exercise_time: isPreferred ? '17:00' : null,
    screen_cutoff_time: entry.bedtime.includes('T00:30')
      ? isPreferred
        ? '23:00'
        : '00:10'
      : isPreferred
        ? '21:30'
        : '22:45',
    room_temp: null,
    room_light: null,
    room_noise: null,
    supplements: [],
    stress_level: isPreferred ? 2 : 5,
    pre_sleep_activities: [],
    notes: null,
    created_at: `${entry.date}T07:10:00.000Z`,
  };
}

function makeDataset(size: number): {
  entries: SleepAnalyticsEntry[];
  factors: Factor[];
} {
  const entries = Array.from({ length: size }, (_, index) => {
    const quality = index % 2 === 0 ? 5 : 2;
    return makeEntry(index, quality);
  });
  const factors = entries.map(makeFactor);
  return { entries, factors };
}

describe('sleep correlations function quality gate', () => {
  it('matches known reportable contracts', () => {
    const { entries, factors } = makeDataset(20);
    const exercise = correlateExercise(entries, factors);
    const top = getTopCorrelations(entries, factors);

    expect(exercise.status).toBe('reportable');
    expect(exercise.direction).toBe('positive');
    expect(top.length).toBeGreaterThan(0);
    expect(top.every((correlation) => correlation.insight)).toBe(true);
  });

  it('passes deterministic fuzz invariants', async () => {
    await runDeterministicFuzz({
      label: 'getTopCorrelations fuzz',
      iterations: 80,
      seed: 84,
      makeCase: (rng) => makeDataset(randomInt(rng, 0, 120)),
      assertCase: async ({ entries, factors }) => {
        const top = getTopCorrelations(entries, factors);
        for (let index = 1; index < top.length; index += 1) {
          expect(Math.abs(top[index - 1].difference ?? 0))
            .toBeGreaterThanOrEqual(Math.abs(top[index].difference ?? 0));
        }
        expect(
          top.every((correlation) => correlation.status === 'reportable'),
        ).toBe(true);
      },
    });
  });

  it('stays within linear complexity for top correlations', async () => {
    await assertComplexitySlope({
      label: 'getTopCorrelations',
      sizes: [500, 1000, 2000],
      expected: 'linear',
      maxRatios: [5.5, 5.5],
      sampleRuns: 3,
      setup: makeDataset,
      run: async ({ entries, factors }) => {
        getTopCorrelations(entries, factors);
      },
    });
  });

  it('stays within memory budget under repeated calls', async () => {
    await assertMemoryBudget({
      label: 'getTopCorrelations memory',
      repeats: 20,
      maxHeapDeltaBytes: 10 * 1024 * 1024,
      setup: () => makeDataset(800),
      run: async ({ entries, factors }) => {
        getTopCorrelations(entries, factors);
      },
    });
  });
});
