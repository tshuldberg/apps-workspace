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
  createProgressEntry,
  listProgressByProject,
} from '../progress';
import { createProject } from '../projects';

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

function seedProject(db: ReturnType<typeof createModuleTestDatabase>): void {
  createProject(db.adapter, 'proj-1', {
    title: 'Animation Reel',
    type: 'video',
  });
}

function seedProgressEntries(
  db: ReturnType<typeof createModuleTestDatabase>,
  count: number,
): Array<{ id: string; date: string }> {
  const rows: Array<{ id: string; date: string }> = [];

  for (let index = 0; index < count; index += 1) {
    const id = `entry-${index}`;
    const date = `2026-04-${String((index % 28) + 1).padStart(2, '0')}T${String(
      index % 24,
    ).padStart(2, '0')}:00:00.000Z`;
    createProgressEntry(db.adapter, id, {
      project_id: 'proj-1',
      date,
      notes_md: `Worked on scene ${index}`,
      hours_spent: (index % 5) + 0.5,
      milestone: index % 7 === 0,
      milestone_name: index % 7 === 0 ? `Milestone ${index}` : undefined,
    });
    rows.push({ id, date });
  }

  return rows;
}

describe('listProgressByProject function quality gate', () => {
  it('matches contract behavior for known timeline ordering cases', async () => {
    await withCreateDb((db) => {
      seedProject(db);
      createProgressEntry(db.adapter, 'entry-old', {
        project_id: 'proj-1',
        date: '2026-04-01T08:00:00.000Z',
        hours_spent: 1,
      });
      createProgressEntry(db.adapter, 'entry-new', {
        project_id: 'proj-1',
        date: '2026-04-03T08:00:00.000Z',
        hours_spent: 2,
      });

      expect(
        listProgressByProject(db.adapter, 'proj-1').map((entry) => entry.id),
      ).toEqual(['entry-new', 'entry-old']);
    });
  });

  it('passes deterministic fuzz invariants', async () => {
    await runDeterministicFuzz({
      label: 'listProgressByProject fuzz',
      iterations: 100,
      seed: 42,
      makeCase: (rng) => randomInt(rng, 0, 16),
      assertCase: async (count) => {
        await withCreateDb((db) => {
          seedProject(db);
          const seeded = seedProgressEntries(db, count);
          const actual = listProgressByProject(db.adapter, 'proj-1').map(
            (entry) => entry.id,
          );
          const expected = [...seeded]
            .sort((left, right) => right.date.localeCompare(left.date))
            .map((entry) => entry.id);

          expect(actual).toEqual(expected);
        });
      },
    });
  });

  it('stays within linear complexity slope budget', async () => {
    await assertComplexitySlope({
      label: 'listProgressByProject',
      sizes: [25, 50, 100],
      expected: 'linear',
      sampleRuns: 3,
      setup: (size) => size,
      run: async (size) => {
        await withCreateDb((db) => {
          seedProject(db);
          seedProgressEntries(db, size);
          listProgressByProject(db.adapter, 'proj-1');
        });
      },
    });
  });

  it('stays within memory budget under repeated calls', async () => {
    await assertMemoryBudget({
      label: 'listProgressByProject',
      repeats: 20,
      maxHeapDeltaBytes: 16 * 1024 * 1024,
      setup: () => 60,
      run: async (size) => {
        await withCreateDb((db) => {
          seedProject(db);
          seedProgressEntries(db, size);
          listProgressByProject(db.adapter, 'proj-1');
        });
      },
    });
  });
});
