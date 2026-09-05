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
  DREAM_THEME_TAXONOMY,
  DreamCreateSchema,
  DreamSchema,
  type DreamCreateInput,
  type DreamType,
} from '../../../models/dream-schemas';
import { createDream } from '../dreams';

const DREAM_TYPES: DreamType[] = [
  'normal',
  'vivid',
  'nightmare',
  'lucid',
  'recurring',
];

const DREAM_EMOTIONS = [
  'excited',
  'peaceful',
  'anxious',
  'confused',
  'scared',
] as const;

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

function makeDreamInput(
  rng: () => number,
  index: number,
): DreamCreateInput {
  const day = 1 + (index % 28);
  const type = DREAM_TYPES[randomInt(rng, 0, DREAM_TYPES.length - 1)];
  const isRecurring = type === 'recurring' || rng() >= 0.82;
  const isLucid = type === 'lucid' || rng() >= 0.75;
  const themeA = DREAM_THEME_TAXONOMY[index % DREAM_THEME_TAXONOMY.length];
  const themeB =
    DREAM_THEME_TAXONOMY[
      (index + randomInt(rng, 1, DREAM_THEME_TAXONOMY.length - 1)) %
        DREAM_THEME_TAXONOMY.length
    ];
  const emotion = DREAM_EMOTIONS[index % DREAM_EMOTIONS.length];

  return {
    date: `2026-03-${pad(day)}`,
    content_md: `  Dream ${index} about ${themeA} and ${themeB}.  `,
    type,
    themes: rng() >= 0.5 ? [themeA, ` ${themeB} `, themeA] : [themeA],
    people: rng() >= 0.45 ? [`Person ${index % 7}`, ` Person ${index % 7} `] : [],
    emotions: [emotion, ` ${emotion} `],
    is_lucid: isLucid,
    is_recurring: isRecurring,
    recurring_group_id:
      isRecurring && rng() >= 0.5 ? `group-${index % 9}` : undefined,
  };
}

async function withSleepDb<T>(
  run: (
    db: ReturnType<typeof createModuleTestDatabase>,
  ) => Promise<T> | T,
): Promise<T> {
  const db = createModuleTestDatabase('sleep', SLEEP_MODULE.migrations ?? []);
  try {
    return await run(db);
  } finally {
    db.close();
  }
}

describe('createDream function quality gate', () => {
  it('matches contract behavior for known cases', () => {
    return withSleepDb((db) => {
      const result = createDream(db.adapter, {
        date: '2026-03-12',
        content_md: '  A bright river carried me above the city.  ',
        type: 'recurring',
        themes: ['flying', 'water', ' flying '],
        people: ['Old Friend', ' Old Friend '],
        emotions: ['Excited', 'excited'],
        is_lucid: true,
      });

      expect(DreamSchema.parse(result)).toEqual(result);
      expect(result.content_md).toBe(
        'A bright river carried me above the city.',
      );
      expect(result.themes).toEqual(['flying', 'water']);
      expect(result.people).toEqual(['Old Friend']);
      expect(result.emotions).toEqual(['excited']);
      expect(result.is_lucid).toBe(true);
      expect(result.is_recurring).toBe(true);
      expect(result.recurring_group_id).toBe(result.id);
    });
  });

  it('passes deterministic fuzz invariants', async () => {
    await runDeterministicFuzz({
      label: 'createDream fuzz',
      iterations: 140,
      seed: 42,
      makeCase: (rng, index) => makeDreamInput(rng, index),
      assertCase: async (input) => {
        await withSleepDb((db) => {
          const parsed = DreamCreateSchema.parse(input);
          const result = createDream(db.adapter, parsed);

          expect(DreamSchema.parse(result)).toEqual(result);
          expect(result.date).toBe(parsed.date);
          expect(result.content_md).toBe(parsed.content_md.trim());
          expect(
            new Set(result.themes.map((value) => value.toLocaleLowerCase())).size,
          ).toBe(result.themes.length);
          expect(
            new Set(result.people.map((value) => value.toLocaleLowerCase())).size,
          ).toBe(result.people.length);
          expect(
            new Set(
              result.emotions.map((value) => value.toLocaleLowerCase()),
            ).size,
          ).toBe(result.emotions.length);

          if (parsed.type === 'lucid') {
            expect(result.is_lucid).toBe(true);
          }
          if (parsed.type === 'recurring') {
            expect(result.is_recurring).toBe(true);
          }
          if (result.is_recurring) {
            expect(result.recurring_group_id).toBeTruthy();
          } else {
            expect(result.recurring_group_id).toBeNull();
          }
        });
      },
    });
  });

  it('stays within linear complexity slope budget', async () => {
    await assertComplexitySlope({
      label: 'createDream repeated inserts',
      sizes: [20, 40, 80],
      expected: 'linear',
      sampleRuns: 3,
      setup: (size) => {
        let index = 0;
        return Array.from({ length: size }, () =>
          makeDreamInput(() => ((index += 1), (index % 10) / 10), index),
        );
      },
      run: async (inputs) => {
        await withSleepDb((db) => {
          for (const input of inputs) {
            createDream(db.adapter, input);
          }
        });
      },
    });
  });

  it('stays within memory budget under repeated calls', async () => {
    await assertMemoryBudget({
      label: 'createDream repeated inserts',
      repeats: 12,
      maxHeapDeltaBytes: 12 * 1024 * 1024,
      setup: () => {
        let index = 0;
        return Array.from({ length: 30 }, () =>
          makeDreamInput(() => ((index += 1), (index % 10) / 10), index),
        );
      },
      run: async (inputs) => {
        await withSleepDb((db) => {
          for (const input of inputs) {
            createDream(db.adapter, input);
          }
        });
      },
    });
  });
});
