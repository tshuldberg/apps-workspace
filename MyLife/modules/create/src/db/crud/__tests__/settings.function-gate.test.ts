import { describe, expect, it } from 'vitest';
import { createModuleTestDatabase } from '@mylife/db';
import {
  assertComplexitySlope,
  assertMemoryBudget,
  randomInt,
  runDeterministicFuzz,
} from '../../../test/function-quality';
import { CREATE_MODULE } from '../../../definition';
import {
  CreateSettingsSchema,
  DEFAULT_CREATE_SETTINGS,
  type UpdateCreateSettingsInput,
} from '../../../models/schemas';
import { getCreateSettings, saveCreateSettings } from '../settings';

const LANDING_TABS = ['projects', 'practice', 'skills', 'portfolio'] as const;
const VISIBILITY_MODES = ['private', 'share_link_only'] as const;

async function withCreateDb<T>(
  run: (
    db: ReturnType<typeof createModuleTestDatabase>,
  ) => Promise<T> | T,
): Promise<T> {
  const db = createModuleTestDatabase('create', CREATE_MODULE.migrations ?? []);
  try {
    return await run(db);
  } finally {
    db.close();
  }
}

function makeRandomSettingsInput(rng: () => number): UpdateCreateSettingsInput {
  const next: UpdateCreateSettingsInput = {};

  if (rng() >= 0.35) {
    next.defaultLandingTab =
      LANDING_TABS[randomInt(rng, 0, LANDING_TABS.length - 1)];
  }
  if (rng() >= 0.35) {
    next.defaultSessionMinutes = randomInt(rng, 15, 240);
  }
  if (rng() >= 0.35) {
    next.weeklyPracticeGoalMinutes = randomInt(rng, 0, 5000);
  }
  if (rng() >= 0.35) {
    next.portfolioVisibility =
      VISIBILITY_MODES[randomInt(rng, 0, VISIBILITY_MODES.length - 1)];
  }
  if (rng() >= 0.35) {
    next.captureReflectionPrompts = rng() >= 0.5;
  }

  return next;
}

describe('saveCreateSettings function quality gate', () => {
  it('merges partial updates onto defaults without losing untouched fields', async () => {
    await withCreateDb((db) => {
      const result = saveCreateSettings(db.adapter, {
        defaultLandingTab: 'practice',
        captureReflectionPrompts: false,
      });

      expect(result).toEqual({
        ...DEFAULT_CREATE_SETTINGS,
        defaultLandingTab: 'practice',
        captureReflectionPrompts: false,
      });
      expect(getCreateSettings(db.adapter)).toEqual(result);
      expect(CreateSettingsSchema.parse(result)).toEqual(result);
    });
  });

  it('passes deterministic fuzz invariants', async () => {
    await runDeterministicFuzz({
      label: 'saveCreateSettings fuzz',
      iterations: 200,
      seed: 42,
      makeCase: (rng) => makeRandomSettingsInput(rng),
      assertCase: async (input) => {
        await withCreateDb((db) => {
          const result = saveCreateSettings(db.adapter, input);
          const expected = CreateSettingsSchema.parse({
            ...DEFAULT_CREATE_SETTINGS,
            ...input,
          });

          expect(result).toEqual(expected);
          expect(getCreateSettings(db.adapter)).toEqual(expected);
        });
      },
    });
  });

  it('stays within linear complexity slope budget for repeated writes', async () => {
    await assertComplexitySlope({
      label: 'saveCreateSettings repeated writes',
      sizes: [10, 20, 40],
      expected: 'linear',
      sampleRuns: 3,
      setup: (size) => size,
      run: async (size) => {
        await withCreateDb((db) => {
          for (let index = 0; index < size; index += 1) {
            saveCreateSettings(db.adapter, {
              defaultLandingTab: LANDING_TABS[index % LANDING_TABS.length],
              defaultSessionMinutes: 15 + (index % 10) * 15,
              weeklyPracticeGoalMinutes: 120 + index,
              portfolioVisibility:
                VISIBILITY_MODES[index % VISIBILITY_MODES.length],
              captureReflectionPrompts: index % 2 === 0,
            });
          }
        });
      },
    });
  });

  it('stays within memory budget under repeated writes', async () => {
    await assertMemoryBudget({
      label: 'saveCreateSettings repeated writes',
      repeats: 20,
      maxHeapDeltaBytes: 16 * 1024 * 1024,
      setup: () => null,
      run: async () => {
        await withCreateDb((db) => {
          for (let index = 0; index < 50; index += 1) {
            saveCreateSettings(db.adapter, {
              defaultLandingTab: LANDING_TABS[index % LANDING_TABS.length],
              defaultSessionMinutes: 15 + (index % 10) * 15,
              weeklyPracticeGoalMinutes: 180 + index,
              portfolioVisibility:
                VISIBILITY_MODES[index % VISIBILITY_MODES.length],
              captureReflectionPrompts: index % 2 === 0,
            });
          }
        });
      },
    });
  });
});
