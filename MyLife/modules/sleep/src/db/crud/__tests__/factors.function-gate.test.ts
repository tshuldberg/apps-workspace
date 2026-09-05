import { describe, expect, it } from 'vitest';
import { createModuleTestDatabase } from '@mylife/db';
import {
  assertComplexitySlope,
  assertMemoryBudget,
  randomInt,
  runDeterministicFuzz,
} from '../../../test/function-quality';
import { SLEEP_MODULE } from '../../../definition';
import {
  PRE_SLEEP_ACTIVITY_TAXONOMY,
  SLEEP_SUPPLEMENT_TAXONOMY,
  type PreSleepActivity,
  type SleepSupplement,
} from '../../../models/factor-schemas';
import { createEntry } from '../entries';
import { createFactor, getFactorCorrelations } from '../factors';

const ROOM_TEMPS = ['cold', 'cool', 'comfortable', 'warm', 'hot'] as const;
const ROOM_LIGHTS = ['dark', 'dim', 'moderate', 'bright'] as const;
const ROOM_NOISES = ['silent', 'quiet', 'moderate', 'loud'] as const;
const WAKE_FEELINGS = [
  'refreshed',
  'groggy',
  'exhausted',
  'energized',
] as const;

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

function formatClockTime(totalMinutes: number): string {
  const normalized = ((totalMinutes % (24 * 60)) + (24 * 60)) % (24 * 60);
  const hours = Math.floor(normalized / 60);
  const minutes = normalized % 60;
  return `${pad(hours)}:${pad(minutes)}`;
}

function buildNight(index: number): {
  bedtime: string;
  wakeTime: string;
  date: string;
} {
  const bedtime = new Date(Date.UTC(2025, 0, 1 + index, 23, 0, 0, 0));
  const wake = new Date(bedtime.getTime() + (8 * 60 * 60 * 1000));

  return {
    bedtime: bedtime.toISOString().replace('.000Z', 'Z'),
    wakeTime: wake.toISOString().replace('.000Z', 'Z'),
    date: wake.toISOString().slice(0, 10),
  };
}

function pickActivity(
  rng: () => number,
  offset: number,
): PreSleepActivity {
  return PRE_SLEEP_ACTIVITY_TAXONOMY[
    (randomInt(rng, 0, PRE_SLEEP_ACTIVITY_TAXONOMY.length - 1) + offset)
      % PRE_SLEEP_ACTIVITY_TAXONOMY.length
  ];
}

function pickSupplement(
  rng: () => number,
  offset: number,
): SleepSupplement {
  return SLEEP_SUPPLEMENT_TAXONOMY[
    (randomInt(rng, 0, SLEEP_SUPPLEMENT_TAXONOMY.length - 1) + offset)
      % SLEEP_SUPPLEMENT_TAXONOMY.length
  ];
}

function seedFactorDataset(
  db: ReturnType<typeof createModuleTestDatabase>,
  size: number,
  rng: () => number,
): void {
  for (let index = 0; index < size; index += 1) {
    const night = buildNight(index);
    const qualityRating = randomInt(rng, 1, 5);
    const exerciseToday = rng() >= 0.45;
    const bedtimeMinutes = 23 * 60;
    const caffeineGap = 30 + (index % 6) * 30;
    const mealGap = 60 + (index % 5) * 30;
    const screenGap = 15 + (index % 4) * 30;
    const exerciseGap = 120 + (index % 5) * 20;

    const entry = createEntry(db.adapter, {
      bedtime: night.bedtime,
      wake_time: night.wakeTime,
      quality_rating: qualityRating,
      wake_count: randomInt(rng, 0, 4),
      snooze_count: randomInt(rng, 0, 2),
      wake_feeling: WAKE_FEELINGS[randomInt(rng, 0, 3)],
    });

    createFactor(db.adapter, {
      sleep_entry_id: entry.id,
      date: night.date,
      last_caffeine_time: formatClockTime(bedtimeMinutes - caffeineGap),
      last_meal_time: formatClockTime(bedtimeMinutes - mealGap),
      alcohol_drinks: index % 3,
      exercise_today: exerciseToday,
      exercise_time: exerciseToday
        ? formatClockTime(bedtimeMinutes - exerciseGap)
        : undefined,
      screen_cutoff_time: formatClockTime(bedtimeMinutes - screenGap),
      room_temp: ROOM_TEMPS[index % ROOM_TEMPS.length],
      room_light: ROOM_LIGHTS[index % ROOM_LIGHTS.length],
      room_noise: ROOM_NOISES[index % ROOM_NOISES.length],
      supplements:
        index % 2 === 0
          ? [pickSupplement(rng, index)]
          : [pickSupplement(rng, index), pickSupplement(rng, index + 2)],
      stress_level: ((index % 5) + 1),
      pre_sleep_activities:
        index % 2 === 0
          ? [pickActivity(rng, index)]
          : [pickActivity(rng, index), pickActivity(rng, index + 3)],
    });
  }
}

async function withSeededSleepDb<T>(
  size: number,
  run: (
    db: ReturnType<typeof createModuleTestDatabase>,
  ) => Promise<T> | T,
  seed: number = 42,
): Promise<T> {
  const db = createModuleTestDatabase('sleep', SLEEP_MODULE.migrations ?? []);
  let cursor = 0;
  const rng = () => ((cursor = (cursor + seed + 7) % 1000), (cursor % 10) / 10);
  seedFactorDataset(db, size, rng);

  try {
    return await run(db);
  } finally {
    db.close();
  }
}

describe('getFactorCorrelations function quality gate', () => {
  it('matches contract behavior for known cases', async () => {
    await withSeededSleepDb(8, (db) => {
      const result = getFactorCorrelations(db.adapter);

      expect(result.sampleSize).toBe(8);
      expect(result.points).toHaveLength(8);
      expect(result.numericCorrelations).toHaveLength(7);
      expect(result.points.every((point) => point.qualityRating !== null)).toBe(true);
      expect(
        result.points.every(
          (point) => point.exerciseToday || point.exerciseMinutesBeforeBed === null,
        ),
      ).toBe(true);
    });
  });

  it('passes deterministic fuzz invariants', async () => {
    await runDeterministicFuzz({
      label: 'getFactorCorrelations fuzz',
      iterations: 80,
      seed: 42,
      makeCase: (rng) => ({
        size: randomInt(rng, 5, 60),
      }),
      assertCase: async ({ size }, index) => {
        await withSeededSleepDb(size, (db) => {
          const result = getFactorCorrelations(db.adapter);

          expect(result.sampleSize).toBe(size);
          expect(result.points).toHaveLength(size);
          expect(
            result.activityAssociations.every((item) =>
              PRE_SLEEP_ACTIVITY_TAXONOMY.includes(item.value as PreSleepActivity),
            ),
          ).toBe(true);
          expect(
            result.supplementAssociations.every((item) =>
              SLEEP_SUPPLEMENT_TAXONOMY.includes(item.value as SleepSupplement),
            ),
          ).toBe(true);
          expect(
            result.numericCorrelations.every((item) => item.sampleSize <= size),
          ).toBe(true);

          for (let pointIndex = 1; pointIndex < result.points.length; pointIndex += 1) {
            expect(result.points[pointIndex - 1].date <= result.points[pointIndex].date)
              .toBe(true);
          }
        }, index + 11);
      },
    });
  });

  it('stays within linear complexity slope budget', async () => {
    await assertComplexitySlope({
      label: 'getFactorCorrelations',
      sizes: [50, 100, 200],
      expected: 'linear',
      maxRatios: [4.6, 4.2],
      warmupRuns: 2,
      sampleRuns: 3,
      setup: (size) => {
        const db = createModuleTestDatabase('sleep', SLEEP_MODULE.migrations ?? []);
        let cursor = 0;
        const rng = () => ((cursor += 3), (cursor % 10) / 10);
        seedFactorDataset(db, size, rng);
        return db;
      },
      run: async (db) => {
        try {
          getFactorCorrelations(db.adapter);
        } finally {
          db.close();
        }
      },
    });
  });

  it('stays within memory budget under repeated calls', async () => {
    await assertMemoryBudget({
      label: 'getFactorCorrelations',
      repeats: 8,
      maxHeapDeltaBytes: 64 * 1024 * 1024,
      setup: () => {
        const db = createModuleTestDatabase('sleep', SLEEP_MODULE.migrations ?? []);
        let cursor = 0;
        const rng = () => ((cursor += 5), (cursor % 10) / 10);
        seedFactorDataset(db, 120, rng);
        return db;
      },
      run: async (db) => {
        try {
          getFactorCorrelations(db.adapter);
        } finally {
          db.close();
        }
      },
    });
  });
});
