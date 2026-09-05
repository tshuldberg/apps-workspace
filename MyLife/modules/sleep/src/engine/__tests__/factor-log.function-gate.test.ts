import { describe, expect, it } from 'vitest';
import {
  PRE_SLEEP_ACTIVITY_TAXONOMY,
  SLEEP_SUPPLEMENT_TAXONOMY,
  type FactorRoomLight,
  type FactorRoomNoise,
  type FactorRoomTemp,
  type PreSleepActivity,
  type SleepSupplement,
} from '../../models/factor-schemas';
import {
  assertComplexitySlope,
  assertMemoryBudget,
  randomInt,
  runDeterministicFuzz,
} from '../../test/function-quality';
import {
  buildFactorCreateInput,
  resolveFactorLogDate,
  type FactorLogDraft,
  type FactorLogMode,
} from '../factor-log';

const MODES: FactorLogMode[] = ['tonight', 'last_night'];
const ROOM_TEMPS: FactorRoomTemp[] = [
  'cold',
  'cool',
  'comfortable',
  'warm',
  'hot',
];
const ROOM_LIGHTS: FactorRoomLight[] = ['dark', 'dim', 'moderate', 'bright'];
const ROOM_NOISES: FactorRoomNoise[] = ['silent', 'quiet', 'moderate', 'loud'];

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

function formatClockTime(totalMinutes: number): string {
  const normalized = ((totalMinutes % (24 * 60)) + (24 * 60)) % (24 * 60);
  return `${pad(Math.floor(normalized / 60))}:${pad(normalized % 60)}`;
}

function maybeClockTime(rng: () => number): string {
  if (rng() < 0.35) {
    return '';
  }

  return formatClockTime(randomInt(rng, 0, (24 * 60) - 1));
}

function pickSubset<T extends string>(
  rng: () => number,
  values: readonly T[],
  maxItems = values.length,
): T[] {
  const selected: T[] = [];

  for (const value of values) {
    if (selected.length >= maxItems) {
      break;
    }
    if (rng() >= 0.55) {
      selected.push(value);
    }
  }

  return selected;
}

function maybePick<T>(rng: () => number, values: readonly T[]): T | null {
  return rng() >= 0.45 ? values[randomInt(rng, 0, values.length - 1)] : null;
}

function normalizeClockTime(value: string): string | null {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function normalizeNote(value: string): string | null {
  const trimmed = value.trim().replace(/\s+/g, ' ');
  return trimmed ? trimmed : null;
}

function makeDraftCase(
  rng: () => number,
  index: number,
): {
  draft: FactorLogDraft;
  mode: FactorLogMode;
  now: Date;
  sleepEntryId: string | null;
  targetDate?: string;
} {
  const now = new Date(
    2026,
    3,
    1 + (index % 20),
    randomInt(rng, 0, 23),
    randomInt(rng, 0, 59),
    0,
    0,
  );
  const mode = MODES[index % MODES.length];
  const exerciseToday = rng() >= 0.4;
  const sleepEntryId = rng() >= 0.5 ? `entry-${index}` : null;
  const targetDate =
    rng() >= 0.5 ? resolveFactorLogDate(mode, now) : undefined;

  return {
    draft: {
      lastCaffeineTime: maybeClockTime(rng),
      lastMealTime: maybeClockTime(rng),
      alcoholDrinks: randomInt(rng, 0, 10),
      exerciseToday,
      exerciseTime: exerciseToday ? maybeClockTime(rng) : '',
      screenCutoffTime: maybeClockTime(rng),
      roomTemp: maybePick(rng, ROOM_TEMPS),
      roomLight: maybePick(rng, ROOM_LIGHTS),
      roomNoise: maybePick(rng, ROOM_NOISES),
      supplements: pickSubset<SleepSupplement>(
        rng,
        SLEEP_SUPPLEMENT_TAXONOMY,
        4,
      ),
      stressLevel: rng() >= 0.3 ? randomInt(rng, 1, 5) : null,
      preSleepActivities: pickSubset<PreSleepActivity>(
        rng,
        PRE_SLEEP_ACTIVITY_TAXONOMY,
        6,
      ),
      disturbancesNote:
        rng() >= 0.5 ? `  note ${index}\nwith detail ${index % 3}  ` : '   ',
    },
    mode,
    now,
    sleepEntryId,
    targetDate,
  };
}

describe('buildFactorCreateInput function quality gate', () => {
  it('matches the factor-log contract for known cases', () => {
    const result = buildFactorCreateInput(
      {
        lastCaffeineTime: '18:15',
        lastMealTime: '20:00',
        alcoholDrinks: 2,
        exerciseToday: false,
        exerciseTime: '17:30',
        screenCutoffTime: '',
        roomTemp: 'cool',
        roomLight: 'dark',
        roomNoise: 'quiet',
        supplements: ['magnesium'],
        stressLevel: 4,
        preSleepActivities: ['reading', 'meditation'],
        disturbancesNote: '  Window noise   after midnight. ',
      },
      {
        date: '2026-04-22',
        sleepEntryId: 'entry-1',
      },
    );

    expect(result).toEqual({
      sleep_entry_id: 'entry-1',
      date: '2026-04-22',
      last_caffeine_time: '18:15',
      last_meal_time: '20:00',
      alcohol_drinks: 2,
      exercise_today: false,
      exercise_time: null,
      screen_cutoff_time: null,
      room_temp: 'cool',
      room_light: 'dark',
      room_noise: 'quiet',
      supplements: ['magnesium'],
      stress_level: 4,
      pre_sleep_activities: ['reading', 'meditation'],
      notes: 'Window noise after midnight.',
    });
  });

  it('passes deterministic fuzz invariants', async () => {
    await runDeterministicFuzz({
      label: 'buildFactorCreateInput fuzz',
      iterations: 200,
      seed: 42,
      makeCase: (rng, index) => makeDraftCase(rng, index),
      assertCase: async ({ draft, mode, now, sleepEntryId, targetDate }) => {
        const result = buildFactorCreateInput(draft, {
          mode,
          now,
          ...(sleepEntryId ? { sleepEntryId } : {}),
          ...(targetDate ? { date: targetDate } : {}),
        });

        expect(result.date).toBe(targetDate ?? resolveFactorLogDate(mode, now));
        expect(result.last_caffeine_time).toBe(
          normalizeClockTime(draft.lastCaffeineTime),
        );
        expect(result.last_meal_time).toBe(
          normalizeClockTime(draft.lastMealTime),
        );
        expect(result.alcohol_drinks).toBe(draft.alcoholDrinks);
        expect(result.exercise_today).toBe(draft.exerciseToday);
        expect(result.exercise_time).toBe(
          draft.exerciseToday ? normalizeClockTime(draft.exerciseTime) : null,
        );
        expect(result.screen_cutoff_time).toBe(
          normalizeClockTime(draft.screenCutoffTime),
        );
        expect(result.room_temp).toBe(draft.roomTemp);
        expect(result.room_light).toBe(draft.roomLight);
        expect(result.room_noise).toBe(draft.roomNoise);
        expect(result.supplements).toEqual(draft.supplements);
        expect(result.stress_level).toBe(draft.stressLevel);
        expect(result.pre_sleep_activities).toEqual(draft.preSleepActivities);
        expect(result.notes).toBe(normalizeNote(draft.disturbancesNote));

        if (sleepEntryId) {
          expect(result.sleep_entry_id).toBe(sleepEntryId);
        } else {
          expect(result).not.toHaveProperty('sleep_entry_id');
        }
      },
    });
  });

  it('stays within linear complexity slope budget for batched conversions', async () => {
    await assertComplexitySlope({
      label: 'buildFactorCreateInput batched calls',
      sizes: [250, 500, 1000],
      expected: 'linear',
      sampleRuns: 3,
      maxRatios: [4.2, 4.2],
      setup: (size) => {
        let index = 0;
        return Array.from({ length: size }, () =>
          makeDraftCase(() => ((index += 1), (index % 10) / 10), index),
        );
      },
      run: async (cases) => {
        for (const input of cases) {
          buildFactorCreateInput(input.draft, {
            mode: input.mode,
            now: input.now,
            ...(input.sleepEntryId ? { sleepEntryId: input.sleepEntryId } : {}),
            ...(input.targetDate ? { date: input.targetDate } : {}),
          });
        }
      },
    });
  });

  it('stays within memory budget under repeated conversions', async () => {
    await assertMemoryBudget({
      label: 'buildFactorCreateInput repeated calls',
      repeats: 12,
      maxHeapDeltaBytes: 8 * 1024 * 1024,
      setup: () => {
        let index = 0;
        return Array.from({ length: 250 }, () =>
          makeDraftCase(() => ((index += 1), (index % 10) / 10), index),
        );
      },
      run: async (cases) => {
        for (const input of cases) {
          buildFactorCreateInput(input.draft, {
            mode: input.mode,
            now: input.now,
            ...(input.sleepEntryId ? { sleepEntryId: input.sleepEntryId } : {}),
            ...(input.targetDate ? { date: input.targetDate } : {}),
          });
        }
      },
    });
  });
});
