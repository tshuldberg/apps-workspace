import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { DatabaseAdapter } from '@mylife/db';
import { createModuleTestDatabase } from '@mylife/db';
import { DINING_MODULE } from '../definition';
import { createRestaurant } from '../db/crud/restaurants';
import { createReservation } from '../db/crud/reservations';
import {
  createImport,
  getImport,
  confirmImport,
  rejectImport,
  listPendingImports,
} from '../db/crud/imports';

let db: DatabaseAdapter;
let closeDb: () => void;
let nextId = 0;

function genId(): string {
  nextId += 1;
  return `test-${nextId.toString().padStart(4, '0')}`;
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

describe('createImport', () => {
  it('creates an import record', () => {
    const id = genId();
    const record = createImport(db, id, {
      source: 'email_resy',
      raw_text: 'Your reservation at Bestia is confirmed for March 15, 2026.',
    });

    expect(record.id).toBe(id);
    expect(record.source).toBe('email_resy');
    expect(record.status).toBe('pending');
    expect(record.reservation_id).toBeNull();
    expect(record.raw_text).toContain('Bestia');
  });
});

describe('getImport', () => {
  it('retrieves an import by id', () => {
    const id = genId();
    createImport(db, id, {
      source: 'csv',
      raw_text: 'some,csv,data',
    });

    const fetched = getImport(db, id);
    expect(fetched).not.toBeNull();
    expect(fetched!.source).toBe('csv');
  });

  it('returns null for nonexistent', () => {
    expect(getImport(db, 'nope')).toBeNull();
  });
});

describe('confirmImport', () => {
  it('links to a reservation and sets status to confirmed', () => {
    const restaurantId = genId();
    createRestaurant(db, restaurantId, { name: 'Bestia' });

    const resId = genId();
    createReservation(db, resId, {
      restaurant_id: restaurantId,
      reserved_at: '2026-03-15T19:00:00Z',
      party_size: 4,
    });

    const impId = genId();
    createImport(db, impId, {
      source: 'email_resy',
      raw_text: 'Confirmation email text',
    });

    confirmImport(db, impId, resId);

    const fetched = getImport(db, impId);
    expect(fetched!.status).toBe('confirmed');
    expect(fetched!.reservation_id).toBe(resId);
  });
});

describe('rejectImport', () => {
  it('sets status to rejected', () => {
    const id = genId();
    createImport(db, id, {
      source: 'manual_paste',
      raw_text: 'Invalid data',
    });

    rejectImport(db, id);

    const fetched = getImport(db, id);
    expect(fetched!.status).toBe('rejected');
  });
});

describe('listPendingImports', () => {
  it('returns only pending imports', () => {
    const id1 = genId();
    const id2 = genId();
    const id3 = genId();

    createImport(db, id1, { source: 'email_resy', raw_text: 'text 1' });
    createImport(db, id2, { source: 'email_opentable', raw_text: 'text 2' });
    createImport(db, id3, { source: 'csv', raw_text: 'text 3' });

    rejectImport(db, id2);

    const pending = listPendingImports(db);
    expect(pending).toHaveLength(2);
    expect(pending.map((p) => p.id).sort()).toEqual([id1, id3].sort());
  });
});
