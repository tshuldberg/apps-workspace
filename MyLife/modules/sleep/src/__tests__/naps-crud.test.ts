import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  createModuleTestDatabase,
  type InMemoryTestDatabase,
} from '@mylife/db';
import { SLEEP_MODULE } from '../definition';
import {
  createNap,
  deleteNap,
  getNapsByDate,
  listNaps,
} from '../db/crud';

let testDb: InMemoryTestDatabase;

beforeEach(() => {
  testDb = createModuleTestDatabase('sleep', SLEEP_MODULE.migrations ?? []);
});

afterEach(() => {
  testDb.close();
});

describe('nap CRUD', () => {
  it('creates a nap with boolean intent preserved', () => {
    const nap = createNap(testDb.adapter, {
      date: '2026-03-02',
      start_time: '2026-03-02T14:00:00Z',
      duration_minutes: 25,
      intentional: false,
      quality: 4,
      notes: 'Accidentally fell asleep on the couch.',
    });

    expect(nap.intentional).toBe(false);
    expect(nap.duration_minutes).toBe(25);
    expect(nap.quality).toBe(4);
  });

  it('lists naps by exact date and date range', () => {
    createNap(testDb.adapter, {
      date: '2026-03-02',
      start_time: '2026-03-02T13:00:00Z',
      duration_minutes: 20,
      intentional: true,
    });
    createNap(testDb.adapter, {
      date: '2026-03-03',
      start_time: '2026-03-03T15:30:00Z',
      duration_minutes: 35,
      intentional: true,
    });
    createNap(testDb.adapter, {
      date: '2026-03-05',
      start_time: '2026-03-05T12:15:00Z',
      duration_minutes: 15,
      intentional: false,
    });

    expect(getNapsByDate(testDb.adapter, '2026-03-03')).toHaveLength(1);
    expect(
      listNaps(testDb.adapter, {
        startDate: '2026-03-02',
        endDate: '2026-03-03',
      }),
    ).toHaveLength(2);
  });

  it('deletes a nap', () => {
    const nap = createNap(testDb.adapter, {
      date: '2026-03-04',
      start_time: '2026-03-04T12:00:00Z',
      duration_minutes: 30,
      intentional: true,
    });

    expect(deleteNap(testDb.adapter, nap.id)).toBe(true);
    expect(deleteNap(testDb.adapter, nap.id)).toBe(false);
  });

  it('rejects invalid nap inputs', () => {
    expect(() =>
      createNap(testDb.adapter, {
        date: '2026-03-04',
        start_time: '2026-03-05T12:00:00Z',
        duration_minutes: 30,
        intentional: true,
      }),
    ).toThrow(/match/i);

    expect(() =>
      createNap(testDb.adapter, {
        date: '2999-03-04',
        start_time: '2999-03-04T12:00:00Z',
        duration_minutes: 30,
        intentional: true,
      }),
    ).toThrow(/future/i);
  });
});
