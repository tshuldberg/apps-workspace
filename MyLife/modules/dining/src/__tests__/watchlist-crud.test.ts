import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { DatabaseAdapter } from '@mylife/db';
import { createModuleTestDatabase } from '@mylife/db';
import { DINING_MODULE } from '../definition';
import {
  createWatchlistEntry,
  getWatchlistEntry,
  updateWatchlistEntry,
  deleteWatchlistEntry,
  listWatchlistEntries,
  fulfillWatchlistEntry,
  expireStaleEntries,
} from '../db/crud/watchlist';
import { createRestaurant } from '../db/crud/restaurants';

let db: DatabaseAdapter;
let closeDb: () => void;
let nextId = 0;

function genId(): string {
  nextId += 1;
  return `test-${nextId.toString().padStart(4, '0')}`;
}

function setupRestaurant(name = 'Test Restaurant'): string {
  const id = genId();
  createRestaurant(db, id, { name });
  return id;
}

beforeEach(() => {
  nextId = 0;
  const testDb = createModuleTestDatabase('dining', DINING_MODULE.migrations!);
  db = testDb.adapter;
  closeDb = testDb.close;
});

afterEach(() => {
  closeDb();
});

describe('Watchlist CRUD round-trip', () => {
  it('creates and retrieves a watchlist entry', () => {
    const restaurantId = setupRestaurant('Sushi Place');
    const id = genId();
    const entry = createWatchlistEntry(db, id, {
      restaurant_id: restaurantId,
      party_size: 4,
      date_range_start: '2026-05-01',
      date_range_end: '2026-05-15',
    });

    expect(entry.id).toBe(id);
    expect(entry.restaurant_id).toBe(restaurantId);
    expect(entry.party_size).toBe(4);
    expect(entry.status).toBe('active');
    expect(entry.notify_enabled).toBe(1);

    const fetched = getWatchlistEntry(db, id);
    expect(fetched).not.toBeNull();
    expect(fetched!.restaurant_name).toBe('Sushi Place');
    expect(fetched!.party_size).toBe(4);
    expect(fetched!.date_range_start).toBe('2026-05-01');
    expect(fetched!.date_range_end).toBe('2026-05-15');
  });

  it('returns null for non-existent entry', () => {
    expect(getWatchlistEntry(db, 'does-not-exist')).toBeNull();
  });

  it('updates a watchlist entry', () => {
    const restaurantId = setupRestaurant();
    const id = genId();
    createWatchlistEntry(db, id, {
      restaurant_id: restaurantId,
      party_size: 2,
    });

    updateWatchlistEntry(db, id, { party_size: 6, notes: 'Birthday dinner' });

    const updated = getWatchlistEntry(db, id);
    expect(updated!.party_size).toBe(6);
    expect(updated!.notes).toBe('Birthday dinner');
  });

  it('deletes a watchlist entry', () => {
    const restaurantId = setupRestaurant();
    const id = genId();
    createWatchlistEntry(db, id, {
      restaurant_id: restaurantId,
      party_size: 2,
    });

    deleteWatchlistEntry(db, id);
    expect(getWatchlistEntry(db, id)).toBeNull();
  });
});

describe('listWatchlistEntries', () => {
  it('lists active entries', () => {
    const r1 = setupRestaurant('Place A');
    const r2 = setupRestaurant('Place B');

    createWatchlistEntry(db, genId(), { restaurant_id: r1, party_size: 2 });
    createWatchlistEntry(db, genId(), { restaurant_id: r2, party_size: 4 });

    const entries = listWatchlistEntries(db);
    expect(entries).toHaveLength(2);
  });

  it('filters by status', () => {
    const restaurantId = setupRestaurant();
    const id1 = genId();
    const id2 = genId();

    createWatchlistEntry(db, id1, { restaurant_id: restaurantId, party_size: 2 });
    createWatchlistEntry(db, id2, { restaurant_id: restaurantId, party_size: 4 });
    fulfillWatchlistEntry(db, id1);

    const active = listWatchlistEntries(db, { status: 'active' });
    expect(active).toHaveLength(1);
    expect(active[0].id).toBe(id2);

    const fulfilled = listWatchlistEntries(db, { status: 'fulfilled' });
    expect(fulfilled).toHaveLength(1);
    expect(fulfilled[0].id).toBe(id1);
  });

  it('filters by restaurant_id', () => {
    const r1 = setupRestaurant('Place A');
    const r2 = setupRestaurant('Place B');

    createWatchlistEntry(db, genId(), { restaurant_id: r1, party_size: 2 });
    createWatchlistEntry(db, genId(), { restaurant_id: r2, party_size: 4 });
    createWatchlistEntry(db, genId(), { restaurant_id: r1, party_size: 6 });

    const forR1 = listWatchlistEntries(db, { restaurant_id: r1 });
    expect(forR1).toHaveLength(2);

    const forR2 = listWatchlistEntries(db, { restaurant_id: r2 });
    expect(forR2).toHaveLength(1);
  });
});

describe('fulfillWatchlistEntry', () => {
  it('sets status to fulfilled', () => {
    const restaurantId = setupRestaurant();
    const id = genId();
    createWatchlistEntry(db, id, { restaurant_id: restaurantId, party_size: 2 });

    fulfillWatchlistEntry(db, id);

    const entry = getWatchlistEntry(db, id);
    expect(entry!.status).toBe('fulfilled');
  });
});

describe('expireStaleEntries', () => {
  it('expires entries with past date_range_end', () => {
    const restaurantId = setupRestaurant();

    const pastId = genId();
    createWatchlistEntry(db, pastId, {
      restaurant_id: restaurantId,
      party_size: 2,
      date_range_start: '2020-01-01',
      date_range_end: '2020-01-31',
    });

    const futureId = genId();
    createWatchlistEntry(db, futureId, {
      restaurant_id: restaurantId,
      party_size: 4,
      date_range_start: '2030-01-01',
      date_range_end: '2030-12-31',
    });

    const noEndId = genId();
    createWatchlistEntry(db, noEndId, {
      restaurant_id: restaurantId,
      party_size: 2,
    });

    expireStaleEntries(db);

    const past = getWatchlistEntry(db, pastId);
    expect(past!.status).toBe('expired');

    const future = getWatchlistEntry(db, futureId);
    expect(future!.status).toBe('active');

    const noEnd = getWatchlistEntry(db, noEndId);
    expect(noEnd!.status).toBe('active');
  });

  it('does not expire already fulfilled entries', () => {
    const restaurantId = setupRestaurant();
    const id = genId();
    createWatchlistEntry(db, id, {
      restaurant_id: restaurantId,
      party_size: 2,
      date_range_end: '2020-01-01',
    });

    fulfillWatchlistEntry(db, id);
    expireStaleEntries(db);

    const entry = getWatchlistEntry(db, id);
    expect(entry!.status).toBe('fulfilled');
  });
});
