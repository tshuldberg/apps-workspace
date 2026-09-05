import { describe, expect, it } from 'vitest';
import type { Factor } from '../../models/factor-schemas';
import type {
  SleepHygieneCheck,
  SleepHygienePracticeId,
} from '../../models/hygiene-schemas';
import type { SleepEntry as SleepEntryRecord } from '../../models/schemas';
import {
  assertComplexitySlope,
  assertMemoryBudget,
  randomInt,
  runDeterministicFuzz,
} from '../../test/function-quality';
import {
  getSleepHygieneDashboard,
  type SleepHygieneDashboardInput,
} from '../hygiene';

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

function dateForIndex(index: number): string {
  return `2026-04-${pad((index % 28) + 1)}`;
}

function entry(index: number): SleepEntryRecord {
  const date = dateForIndex(index);
  return {
    id: `entry-${index}`,
    date,
    bedtime: `${date}T22:30:00.000Z`,
    sleep_onset_time: null,
    wake_time: `${date}T06:30:00.000Z`,
    duration_minutes: 480,
    quality_rating: index % 2 === 0 ? 5 : 3,
    wake_count: 0,
    sleep_latency_minutes: null,
    alarm_time: null,
    snooze_count: 0,
    wake_feeling: index % 2 === 0 ? 'refreshed' : 'groggy',
    notes_md: null,
    created_at: `${date}T06:30:00.000Z`,
    updated_at: `${date}T06:30:00.000Z`,
  };
}

function factor(index: number): Factor {
  const date = dateForIndex(index);
  return {
    id: `factor-${index}`,
    sleep_entry_id: `entry-${index}`,
    date,
    last_caffeine_time: index % 4 === 0 ? '16:00' : '13:00',
    last_meal_time: '19:30',
    alcohol_drinks: index % 5 === 0 ? 1 : 0,
    exercise_today: true,
    exercise_time: '17:30',
    screen_cutoff_time: '21:00',
    room_temp: 'cool',
    room_light: 'dark',
    room_noise: 'quiet',
    supplements: [],
    stress_level: 2,
    pre_sleep_activities: ['reading'],
    notes: null,
    created_at: `${date}T20:00:00.000Z`,
  };
}

function check(
  index: number,
  practiceId: SleepHygienePracticeId,
  met: boolean,
): SleepHygieneCheck {
  const date = dateForIndex(index);
  return {
    id: `check-${index}-${practiceId}`,
    date,
    practice_id: practiceId,
    met,
    source: 'manual',
    notes: null,
    created_at: `${date}T20:00:00.000Z`,
    updated_at: `${date}T20:00:00.000Z`,
  };
}

function makeCase(size: number): SleepHygieneDashboardInput {
  return {
    entries: Array.from({ length: size }, (_, index) => entry(index)),
    factors: Array.from({ length: size }, (_, index) => factor(index)),
    checks: Array.from({ length: Math.floor(size / 4) }, (_, index) =>
      check(index, 'relaxation_routine', index % 2 === 0),
    ),
    referenceDate: '2026-04-07',
    enabledPracticeIds: [
      'no_caffeine_after_2pm',
      'no_screens_1h',
      'relaxation_routine',
    ],
    targetBedtime: '22:30',
  };
}

describe('getSleepHygieneDashboard function quality gate', () => {
  it('matches contract behavior for known cases', () => {
    const result = getSleepHygieneDashboard(makeCase(7));

    expect(result.referenceDate).toBe('2026-04-07');
    expect(result.daily).toHaveLength(7);
    expect(result.today.items).toHaveLength(3);
    expect(result.weeklyScore).not.toBeNull();
  });

  it('passes deterministic fuzz invariants', async () => {
    await runDeterministicFuzz({
      label: 'getSleepHygieneDashboard fuzz',
      iterations: 200,
      seed: 42,
      makeCase: (rng) => makeCase(randomInt(rng, 0, 80)),
      assertCase: async (input) => {
        const result = getSleepHygieneDashboard(input);

        expect(result.daily).toHaveLength(7);
        expect(result.today.items).toHaveLength(
          input.enabledPracticeIds?.length ?? 8,
        );
        if (result.weeklyScore !== null) {
          expect(result.weeklyScore).toBeGreaterThanOrEqual(0);
          expect(result.weeklyScore).toBeLessThanOrEqual(100);
        }
        expect(result.correlation.sampleSize).toBeGreaterThanOrEqual(0);
      },
    });
  });

  it('stays within linear complexity slope budget', async () => {
    await assertComplexitySlope({
      label: 'getSleepHygieneDashboard',
      sizes: [100, 500, 1000],
      expected: 'linear',
      setup: makeCase,
      run: async (input) => {
        getSleepHygieneDashboard(input);
      },
    });
  });

  it('stays within memory budget under repeated calls', async () => {
    await assertMemoryBudget({
      label: 'getSleepHygieneDashboard',
      repeats: 40,
      maxHeapDeltaBytes: 8 * 1024 * 1024,
      setup: () => makeCase(1000),
      run: async (input) => {
        getSleepHygieneDashboard(input);
      },
    });
  });
});
