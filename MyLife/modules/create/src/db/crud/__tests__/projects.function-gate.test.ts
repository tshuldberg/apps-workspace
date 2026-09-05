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
  createProject,
  listProjects,
} from '../projects';
import type {
  CreateProjectStatus,
  CreateProjectType,
  ListCreateProjectsInput,
} from '../../../models/schemas';

const PROJECT_TYPES: CreateProjectType[] = [
  'art',
  'music',
  'video',
  'writing',
  'code',
  'craft',
  'photo',
  'design',
  'game_dev',
  'other',
];

const PROJECT_STATUSES: CreateProjectStatus[] = [
  'idea',
  'planning',
  'in_progress',
  'revising',
  'complete',
  'archived',
];

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

function seedProjects(
  db: ReturnType<typeof createModuleTestDatabase>,
  count: number,
): Array<{
  id: string;
  title: string;
  type: CreateProjectType;
  status: CreateProjectStatus;
  priority: number;
}> {
  const rows: Array<{
    id: string;
    title: string;
    type: CreateProjectType;
    status: CreateProjectStatus;
    priority: number;
  }> = [];

  for (let index = 0; index < count; index += 1) {
    const id = `proj-${index}`;
    const title = `Project ${String(index).padStart(3, '0')}`;
    const type = PROJECT_TYPES[index % PROJECT_TYPES.length];
    const status = PROJECT_STATUSES[index % PROJECT_STATUSES.length];
    const priority = index % 6;
    createProject(db.adapter, id, {
      title,
      type,
      status,
      priority,
      deadline: `2026-06-${String((index % 28) + 1).padStart(2, '0')}T00:00:00.000Z`,
    });
    rows.push({ id, title, type, status, priority });
  }

  return rows;
}

describe('listProjects function quality gate', () => {
  it('matches contract behavior for known filter, search, and sort cases', async () => {
    await withCreateDb((db) => {
      createProject(db.adapter, 'proj-a', {
        title: 'Poster Sprint',
        type: 'design',
        status: 'in_progress',
        priority: 1,
      });
      createProject(db.adapter, 'proj-b', {
        title: 'Album Mix',
        type: 'music',
        status: 'planning',
        priority: 4,
      });
      createProject(db.adapter, 'proj-c', {
        title: 'Portfolio Refresh',
        type: 'design',
        status: 'in_progress',
        priority: 5,
      });

      expect(
        listProjects(db.adapter, {
          status: 'in_progress',
          sort_by: 'priority',
        }).map((row) => row.id),
      ).toEqual(['proj-c', 'proj-a']);

      expect(
        listProjects(db.adapter, {
          search: 'poster',
          sort_by: 'title',
        }).map((row) => row.id),
      ).toEqual(['proj-a']);
    });
  });

  it('passes deterministic fuzz invariants', async () => {
    await runDeterministicFuzz({
      label: 'listProjects fuzz',
      iterations: 100,
      seed: 42,
      makeCase: (rng) => {
        const count = randomInt(rng, 0, 12);
        return {
          count,
          filters: {
            status:
              rng() >= 0.5
                ? PROJECT_STATUSES[randomInt(rng, 0, PROJECT_STATUSES.length - 1)]
                : undefined,
            type:
              rng() >= 0.5
                ? PROJECT_TYPES[randomInt(rng, 0, PROJECT_TYPES.length - 1)]
                : undefined,
            search: rng() >= 0.5 ? 'Project 00' : undefined,
            sort_by: 'title',
          } satisfies ListCreateProjectsInput,
        };
      },
      assertCase: async ({ count, filters }) => {
        await withCreateDb((db) => {
          const seeded = seedProjects(db, count);
          const actual = listProjects(db.adapter, filters).map((row) => row.id);
          const expected = seeded
            .filter((row) => (filters.status ? row.status === filters.status : true))
            .filter((row) => (filters.type ? row.type === filters.type : true))
            .filter((row) =>
              filters.search
                ? row.title.toLowerCase().includes(filters.search.toLowerCase())
                : true,
            )
            .sort((left, right) => left.title.localeCompare(right.title))
            .map((row) => row.id);

          expect(actual).toEqual(expected);
        });
      },
    });
  });

  it('stays within linear complexity slope budget', async () => {
    await assertComplexitySlope({
      label: 'listProjects',
      sizes: [25, 50, 100],
      expected: 'linear',
      sampleRuns: 3,
      setup: (size) => size,
      run: async (size) => {
        await withCreateDb((db) => {
          seedProjects(db, size);
          listProjects(db.adapter, {
            sort_by: 'title',
            search: 'Project',
          });
        });
      },
    });
  });

  it('stays within memory budget under repeated calls', async () => {
    await assertMemoryBudget({
      label: 'listProjects',
      repeats: 20,
      maxHeapDeltaBytes: 16 * 1024 * 1024,
      setup: () => 60,
      run: async (size) => {
        await withCreateDb((db) => {
          seedProjects(db, size);
          listProjects(db.adapter, {
            sort_by: 'priority',
            status: 'planning',
          });
        });
      },
    });
  });
});
