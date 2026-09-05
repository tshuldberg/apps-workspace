import { describe, expect, it } from 'vitest';
import { createModuleTestDatabase } from '@mylife/db';
import {
  assertComplexitySlope,
  assertMemoryBudget,
  randomInt,
  runDeterministicFuzz,
} from '../../test/function-quality';
import { SLEEP_MODULE } from '../../definition';
import type { DreamType } from '../../models/dream-schemas';
import { createDream } from '../../db/crud/dreams';
import { indexDream, searchDreams, type DreamSearchOptions } from '../dream-search';

const DREAM_TYPES: DreamType[] = [
  'normal',
  'vivid',
  'nightmare',
  'lucid',
  'recurring',
];

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

function seedDreams(
  db: ReturnType<typeof createModuleTestDatabase>,
  size: number,
): void {
  for (let index = 0; index < size; index += 1) {
    const day = pad((index % 28) + 1);
    const type = DREAM_TYPES[index % DREAM_TYPES.length];
    const keyword = index % 12 === 0 ? 'anchor' : 'ordinary';
    const person = `Person ${index % 11}`;

    createDream(db.adapter, {
      date: `2026-03-${day}`,
      content_md: `Dream ${index} about ${keyword} water, corridors, and ${person}.`,
      type,
      themes: index % 2 === 0 ? ['water'] : ['school'],
      people: [person],
      emotions: index % 3 === 0 ? ['excited'] : ['confused'],
      is_recurring: index % 10 === 0,
      recurring_group_id: index % 10 === 0 ? `group-${index % 5}` : undefined,
    });
  }
}

function withSeededSleepDb<T>(
  size: number,
  run: (
    db: ReturnType<typeof createModuleTestDatabase>,
  ) => Promise<T> | T,
): Promise<T> | T {
  const db = createModuleTestDatabase('sleep', SLEEP_MODULE.migrations ?? []);
  seedDreams(db, size);

  try {
    return run(db);
  } finally {
    db.close();
  }
}

function makeSearchCase(
  rng: () => number,
  index: number,
): {
  size: number;
  query: string;
  options: DreamSearchOptions;
} {
  const size = randomInt(rng, 40, 180);
  const queries = ['anchor', 'water', 'school', 'Person', 'corridors'];
  const typeOptions: Array<DreamType | undefined> = [
    undefined,
    'normal',
    'nightmare',
    'lucid',
  ];
  const startDay = randomInt(rng, 1, 20);
  const endDay = startDay + randomInt(rng, 0, 7);

  return {
    size,
    query: queries[index % queries.length],
    options: {
      type: typeOptions[index % typeOptions.length],
      dateRange:
        rng() >= 0.45
          ? {
              startDate: `2026-03-${pad(startDay)}`,
              endDate: `2026-03-${pad(Math.min(28, endDay))}`,
            }
          : undefined,
    },
  };
}

describe('searchDreams function quality gate', () => {
  it('matches contract behavior for known cases', () => {
    return withSeededSleepDb(60, (db) => {
      const results = searchDreams(db.adapter, 'anchor', {
        type: 'nightmare',
        dateRange: {
          startDate: '2026-03-01',
          endDate: '2026-03-28',
        },
      });

      expect(results.length).toBeGreaterThan(0);
      expect(results.every((dream) => dream.type === 'nightmare')).toBe(true);
      expect(
        results.every((dream) =>
          indexDream(dream).searchable_text.includes('anchor'),
        ),
      ).toBe(true);
    });
  });

  it('passes deterministic fuzz invariants', async () => {
    await runDeterministicFuzz({
      label: 'searchDreams fuzz',
      iterations: 90,
      seed: 42,
      makeCase: (rng, index) => makeSearchCase(rng, index),
      assertCase: async ({ size, query, options }) => {
        await withSeededSleepDb(size, (db) => {
          const results = searchDreams(db.adapter, query, options);

          for (const dream of results) {
            expect(indexDream(dream).searchable_text).toContain(
              query.toLocaleLowerCase(),
            );

            if (options.type) {
              expect(dream.type).toBe(options.type);
            }
            if (options.dateRange?.startDate) {
              expect(dream.date >= options.dateRange.startDate).toBe(true);
            }
            if (options.dateRange?.endDate) {
              expect(dream.date <= options.dateRange.endDate).toBe(true);
            }
          }
        });
      },
    });
  });

  it('stays within linear complexity slope budget', async () => {
    await assertComplexitySlope({
      label: 'searchDreams indexed lookup',
      sizes: [250, 500, 1000],
      expected: 'linear',
      sampleRuns: 3,
      setup: (size) => {
        const db = createModuleTestDatabase(
          'sleep',
          SLEEP_MODULE.migrations ?? [],
        );
        seedDreams(db, size);
        return db;
      },
      run: async (db) => {
        try {
          for (let index = 0; index < 12; index += 1) {
            searchDreams(db.adapter, 'anchor', {
              dateRange: {
                startDate: '2026-03-01',
                endDate: '2026-03-28',
              },
            });
          }
        } finally {
          db.close();
        }
      },
    });
  });

  it('stays within memory budget under repeated calls', async () => {
    const db = createModuleTestDatabase(
      'sleep',
      SLEEP_MODULE.migrations ?? [],
    );
    seedDreams(db, 900);

    try {
      await assertMemoryBudget({
        label: 'searchDreams indexed lookup',
        repeats: 12,
        maxHeapDeltaBytes: 24 * 1024 * 1024,
        setup: () => db,
        run: async (database) => {
          searchDreams(database.adapter, 'anchor');
          searchDreams(database.adapter, 'water', { type: 'normal' });
          searchDreams(database.adapter, 'Person', {
            dateRange: {
              startDate: '2026-03-05',
              endDate: '2026-03-24',
            },
          });
        },
      });
    } finally {
      db.close();
    }
  });
});
