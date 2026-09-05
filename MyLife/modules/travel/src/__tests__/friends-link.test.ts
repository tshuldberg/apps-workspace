import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { DatabaseAdapter } from '@mylife/db';
import { createModuleTestDatabase } from '@mylife/db';
import { TRAVEL_MODULE } from '../definition';
import { createTrip } from '../db/crud/trips';
import {
  getTripCompanions,
  suggestTripCompanions,
} from '../integrations/friends-link';

function createFriendsTables(adapter: DatabaseAdapter): void {
  adapter.execute(`
    CREATE TABLE fn_people (
      id TEXT PRIMARY KEY,
      display_name TEXT NOT NULL,
      is_archived INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    )
  `);
  adapter.execute(`
    CREATE TABLE fn_hangouts (
      id TEXT PRIMARY KEY,
      people_ids TEXT NOT NULL DEFAULT '[]',
      happened_at TEXT NOT NULL,
      created_at TEXT NOT NULL
    )
  `);
}

function insertPerson(
  adapter: DatabaseAdapter,
  params: {
    id: string;
    name: string;
    createdAt: string;
    archived?: boolean;
  },
): void {
  adapter.execute(
    `INSERT INTO fn_people (id, display_name, is_archived, created_at)
     VALUES (?, ?, ?, ?)`,
    [
      params.id,
      params.name,
      params.archived ? 1 : 0,
      params.createdAt,
    ],
  );
}

function insertHangout(
  adapter: DatabaseAdapter,
  params: {
    id: string;
    peopleIds: string[];
    happenedAt: string;
  },
): void {
  adapter.execute(
    `INSERT INTO fn_hangouts (id, people_ids, happened_at, created_at)
     VALUES (?, ?, ?, ?)`,
    [
      params.id,
      JSON.stringify(params.peopleIds),
      params.happenedAt,
      params.happenedAt,
    ],
  );
}

describe('@mylife/travel friends-link integration', () => {
  let adapter: DatabaseAdapter;
  let closeDb: () => void;

  beforeEach(() => {
    const testDb = createModuleTestDatabase('travel', TRAVEL_MODULE.migrations!);
    adapter = testDb.adapter;
    closeDb = testDb.close;
  });

  afterEach(() => {
    closeDb();
  });

  it('getTripCompanions returns [] (forward-wired stub)', () => {
    createFriendsTables(adapter);
    const trip = createTrip(adapter, { name: 'Tokyo' });
    expect(getTripCompanions(adapter, trip.id)).toEqual([]);
  });

  it('getTripCompanions returns [] when friends not installed', () => {
    const trip = createTrip(adapter, { name: 'Tokyo' });
    expect(getTripCompanions(adapter, trip.id)).toEqual([]);
  });

  it('suggestTripCompanions returns [] when fn_people is missing', () => {
    const trip = createTrip(adapter, { name: 'Tokyo' });
    expect(suggestTripCompanions(adapter, trip.id)).toEqual([]);
  });

  it('suggestTripCompanions orders by most-recent hangout, then created_at', () => {
    createFriendsTables(adapter);
    insertPerson(adapter, {
      id: 'p_alice',
      name: 'Alice',
      createdAt: '2026-01-01T00:00:00Z',
    });
    insertPerson(adapter, {
      id: 'p_bob',
      name: 'Bob',
      createdAt: '2026-02-01T00:00:00Z',
    });
    insertPerson(adapter, {
      id: 'p_cara',
      name: 'Cara',
      createdAt: '2026-03-01T00:00:00Z',
    });
    insertHangout(adapter, {
      id: 'h1',
      peopleIds: ['p_alice'],
      happenedAt: '2026-04-10T00:00:00Z',
    });
    insertHangout(adapter, {
      id: 'h2',
      peopleIds: ['p_bob'],
      happenedAt: '2026-04-15T00:00:00Z',
    });

    const trip = createTrip(adapter, { name: 'Tokyo' });
    const result = suggestTripCompanions(adapter, trip.id, 5);
    expect(result.map((r) => r.friendId)).toEqual([
      'p_bob',
      'p_alice',
      'p_cara',
    ]);
    expect(result[0]!.recentInteractionAt).toBe('2026-04-15T00:00:00Z');
    expect(result[2]!.recentInteractionAt).toBeUndefined();
  });

  it('suggestTripCompanions respects limit', () => {
    createFriendsTables(adapter);
    insertPerson(adapter, {
      id: 'p1',
      name: 'One',
      createdAt: '2026-01-01T00:00:00Z',
    });
    insertPerson(adapter, {
      id: 'p2',
      name: 'Two',
      createdAt: '2026-02-01T00:00:00Z',
    });
    insertPerson(adapter, {
      id: 'p3',
      name: 'Three',
      createdAt: '2026-03-01T00:00:00Z',
    });

    const trip = createTrip(adapter, { name: 'Trip' });
    const result = suggestTripCompanions(adapter, trip.id, 2);
    expect(result).toHaveLength(2);
    expect(result.map((r) => r.friendId)).toEqual(['p3', 'p2']);
  });

  it('suggestTripCompanions excludes archived people', () => {
    createFriendsTables(adapter);
    insertPerson(adapter, {
      id: 'p_active',
      name: 'Active',
      createdAt: '2026-01-01T00:00:00Z',
    });
    insertPerson(adapter, {
      id: 'p_archived',
      name: 'Archived',
      createdAt: '2026-02-01T00:00:00Z',
      archived: true,
    });

    const trip = createTrip(adapter, { name: 'Trip' });
    const result = suggestTripCompanions(adapter, trip.id);
    expect(result.map((r) => r.friendId)).toEqual(['p_active']);
  });

  it('suggestTripCompanions falls back when fn_hangouts is missing but fn_people exists', () => {
    adapter.execute(`
      CREATE TABLE fn_people (
        id TEXT PRIMARY KEY,
        display_name TEXT NOT NULL,
        is_archived INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL
      )
    `);
    insertPerson(adapter, {
      id: 'p_alice',
      name: 'Alice',
      createdAt: '2026-01-01T00:00:00Z',
    });
    insertPerson(adapter, {
      id: 'p_bob',
      name: 'Bob',
      createdAt: '2026-02-01T00:00:00Z',
    });

    const trip = createTrip(adapter, { name: 'Trip' });
    const result = suggestTripCompanions(adapter, trip.id);
    expect(result.map((r) => r.friendId)).toEqual(['p_bob', 'p_alice']);
    expect(result[0]!.recentInteractionAt).toBeUndefined();
  });

  it('suggestTripCompanions returns [] for limit 0', () => {
    createFriendsTables(adapter);
    insertPerson(adapter, {
      id: 'p1',
      name: 'One',
      createdAt: '2026-01-01T00:00:00Z',
    });
    const trip = createTrip(adapter, { name: 'Trip' });
    expect(suggestTripCompanions(adapter, trip.id, 0)).toEqual([]);
  });
});
