import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createModuleTestDatabase, type InMemoryTestDatabase } from '@mylife/db';
import { SHOP_MODULE } from '../definition';
import {
  upsertStoreNote,
  getStoreNoteById,
  getStoreNoteByName,
  listStoreNotes,
  deleteStoreNote,
} from '../index';

let testDb: InMemoryTestDatabase;

beforeEach(() => {
  testDb = createModuleTestDatabase('shop', SHOP_MODULE.migrations!);
});

afterEach(() => {
  testDb.close();
});

describe('store-notes CRUD', () => {
  it('inserts a new note when store_name is unseen', () => {
    const note = upsertStoreNote(testDb.adapter, {
      storeName: 'Costco',
      returnsPolicy: 'No questions, almost ever',
      shippingNotes: 'Ships heavy',
      rewardsNotes: 'Executive 2%',
    });
    expect(note.storeName).toBe('Costco');
    expect(note.returnsPolicy).toContain('No questions');
  });

  it('upserts (updates in place) when store_name already exists', () => {
    const a = upsertStoreNote(testDb.adapter, {
      storeName: 'REI',
      returnsPolicy: '1 year',
    });
    const b = upsertStoreNote(testDb.adapter, {
      storeName: 'REI',
      returnsPolicy: '90 days',
      rewardsNotes: 'Co-op dividend',
    });
    expect(b.id).toBe(a.id);
    expect(b.returnsPolicy).toBe('90 days');
    expect(b.rewardsNotes).toBe('Co-op dividend');
    const all = listStoreNotes(testDb.adapter);
    expect(all).toHaveLength(1);
  });

  it('getStoreNoteByName matches exact store_name', () => {
    upsertStoreNote(testDb.adapter, { storeName: 'Target' });
    expect(getStoreNoteByName(testDb.adapter, 'Target')?.storeName).toBe(
      'Target',
    );
    expect(getStoreNoteByName(testDb.adapter, 'TARGET')).toBeNull();
  });

  it('getStoreNoteById returns null for missing id', () => {
    expect(getStoreNoteById(testDb.adapter, 'missing')).toBeNull();
  });

  it('listStoreNotes sorts ascending by name', () => {
    upsertStoreNote(testDb.adapter, { storeName: 'Zebra Co' });
    upsertStoreNote(testDb.adapter, { storeName: 'Apple' });
    upsertStoreNote(testDb.adapter, { storeName: 'Microsoft' });
    const names = listStoreNotes(testDb.adapter).map((n) => n.storeName);
    expect(names).toEqual(['Apple', 'Microsoft', 'Zebra Co']);
  });

  it('deletes a store note', () => {
    const n = upsertStoreNote(testDb.adapter, { storeName: 'Gone' });
    expect(deleteStoreNote(testDb.adapter, n.id)).toBe(true);
    expect(getStoreNoteById(testDb.adapter, n.id)).toBeNull();
    expect(deleteStoreNote(testDb.adapter, n.id)).toBe(false);
  });

  it('rejects empty store name', () => {
    expect(() =>
      upsertStoreNote(testDb.adapter, { storeName: '' }),
    ).toThrow();
  });
});
