import { describe, expect, it } from 'vitest';
import { createModuleTestDatabase } from '@mylife/db';
import {
  assertComplexitySlope,
  assertMemoryBudget,
  randomInt,
  runDeterministicFuzz,
} from '../../../test/function-quality';
import { CREATE_MODULE } from '../../../definition';
import { createPhoto, listPhotosByProject } from '../photos';
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
    title: 'Ceramic series',
    type: 'craft',
  });
}

function seedPhotos(
  db: ReturnType<typeof createModuleTestDatabase>,
  count: number,
): Array<{ id: string; takenAt: string }> {
  const seeded: Array<{ id: string; takenAt: string }> = [];

  for (let index = 0; index < count; index += 1) {
    const id = `photo-${index}`;
    const takenAt = `2026-04-${String((index % 28) + 1).padStart(2, '0')}T${String(
      index % 24,
    ).padStart(2, '0')}:00:00.000Z`;
    createPhoto(db.adapter, id, {
      project_id: 'proj-1',
      kind: 'process',
      local_uri: `file:///tmp/${id}.jpg`,
      taken_at: takenAt,
    });
    seeded.push({ id, takenAt });
  }

  return seeded;
}

describe('listPhotosByProject function quality gate', () => {
  it('matches contract behavior for known ordering cases', async () => {
    await withCreateDb((db) => {
      seedProject(db);
      createPhoto(db.adapter, 'photo-old', {
        project_id: 'proj-1',
        kind: 'process',
        local_uri: 'file:///tmp/old.jpg',
        taken_at: '2026-04-01T08:00:00.000Z',
      });
      createPhoto(db.adapter, 'photo-new', {
        project_id: 'proj-1',
        kind: 'process',
        local_uri: 'file:///tmp/new.jpg',
        taken_at: '2026-04-03T08:00:00.000Z',
      });

      expect(listPhotosByProject(db.adapter, 'proj-1').map((photo) => photo.id)).toEqual([
        'photo-new',
        'photo-old',
      ]);
    });
  });

  it('passes deterministic fuzz invariants', async () => {
    await runDeterministicFuzz({
      label: 'listPhotosByProject fuzz',
      iterations: 100,
      seed: 21,
      makeCase: (rng) => randomInt(rng, 0, 20),
      assertCase: async (count) => {
        await withCreateDb((db) => {
          seedProject(db);
          const seeded = seedPhotos(db, count);
          const actual = listPhotosByProject(db.adapter, 'proj-1').map(
            (photo) => photo.id,
          );
          const expected = [...seeded]
            .sort((left, right) => right.takenAt.localeCompare(left.takenAt))
            .map((photo) => photo.id);

          expect(actual).toEqual(expected);
        });
      },
    });
  });

  it('stays within linear complexity slope budget', async () => {
    await assertComplexitySlope({
      label: 'listPhotosByProject',
      sizes: [25, 50, 100],
      expected: 'linear',
      sampleRuns: 3,
      setup: (size) => size,
      run: async (size) => {
        await withCreateDb((db) => {
          seedProject(db);
          seedPhotos(db, size);
          listPhotosByProject(db.adapter, 'proj-1');
        });
      },
    });
  });

  it('stays within memory budget under repeated calls', async () => {
    await assertMemoryBudget({
      label: 'listPhotosByProject',
      repeats: 20,
      maxHeapDeltaBytes: 16 * 1024 * 1024,
      setup: () => 60,
      run: async (size) => {
        await withCreateDb((db) => {
          seedProject(db);
          seedPhotos(db, size);
          listPhotosByProject(db.adapter, 'proj-1');
        });
      },
    });
  });
});
