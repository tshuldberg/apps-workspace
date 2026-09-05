import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { DatabaseAdapter } from '@mylife/db';
import { createModuleTestDatabase } from '@mylife/db';
import { TRAVEL_MODULE } from '../definition';
import {
  createJournalEntry,
  deleteJournalEntry,
  getJournalEntry,
} from '../db/crud/journal-entries';
import {
  createJournalMemory,
  deleteJournalMemory,
  listJournalMemories,
  reorderJournalMemories,
  updateJournalMemory,
} from '../db/crud/journal-memories';

let adapter: DatabaseAdapter;
let closeDb: () => void;
let entryId: string;

beforeEach(() => {
  const testDb = createModuleTestDatabase('travel', TRAVEL_MODULE.migrations!);
  adapter = testDb.adapter;
  closeDb = testDb.close;
  const entry = createJournalEntry(adapter, { entry_date: '2026-06-01' });
  entryId = entry.id;
});

afterEach(() => {
  closeDb();
});

describe('createJournalMemory', () => {
  it('returns a row with a jm_ prefixed id and defaults', () => {
    const mem = createJournalMemory(adapter, {
      entry_id: entryId,
      kind: 'photo',
    });
    expect(mem.id).toMatch(/^jm_/);
    expect(mem.entry_id).toBe(entryId);
    expect(mem.kind).toBe('photo');
    expect(mem.media_ref).toBeNull();
    expect(mem.caption).toBeNull();
    expect(mem.sort_order).toBe(0);
    expect(mem.created_at).toBeTruthy();
  });

  it('auto-increments sort_order per entry', () => {
    const a = createJournalMemory(adapter, {
      entry_id: entryId,
      kind: 'photo',
    });
    const b = createJournalMemory(adapter, {
      entry_id: entryId,
      kind: 'quote',
    });
    const c = createJournalMemory(adapter, {
      entry_id: entryId,
      kind: 'souvenir',
    });
    expect(a.sort_order).toBe(0);
    expect(b.sort_order).toBe(1);
    expect(c.sort_order).toBe(2);
  });

  it('accepts an explicit sort_order', () => {
    const mem = createJournalMemory(adapter, {
      entry_id: entryId,
      kind: 'photo',
      sort_order: 42,
    });
    expect(mem.sort_order).toBe(42);
  });

  it('rejects an unknown kind', () => {
    expect(() =>
      createJournalMemory(adapter, {
        entry_id: entryId,
        kind: 'whatever' as unknown as 'photo',
      }),
    ).toThrow();
  });

  it('persists media_ref and caption', () => {
    const mem = createJournalMemory(adapter, {
      entry_id: entryId,
      kind: 'photo',
      media_ref: 'file:///tmp/pic.jpg',
      caption: 'Sunset',
    });
    expect(mem.media_ref).toBe('file:///tmp/pic.jpg');
    expect(mem.caption).toBe('Sunset');
  });
});

describe('listJournalMemories', () => {
  it('returns memories ordered by sort_order ASC', () => {
    createJournalMemory(adapter, {
      entry_id: entryId,
      kind: 'photo',
      sort_order: 2,
    });
    createJournalMemory(adapter, {
      entry_id: entryId,
      kind: 'quote',
      sort_order: 0,
    });
    createJournalMemory(adapter, {
      entry_id: entryId,
      kind: 'souvenir',
      sort_order: 1,
    });
    const rows = listJournalMemories(adapter, entryId);
    expect(rows.map((r) => r.kind)).toEqual(['quote', 'souvenir', 'photo']);
  });

  it('returns an empty array when there are none', () => {
    expect(listJournalMemories(adapter, entryId)).toEqual([]);
  });

  it('scopes by entry_id', () => {
    const other = createJournalEntry(adapter, { entry_date: '2026-06-02' });
    createJournalMemory(adapter, { entry_id: entryId, kind: 'photo' });
    createJournalMemory(adapter, { entry_id: other.id, kind: 'quote' });
    expect(listJournalMemories(adapter, entryId)).toHaveLength(1);
    expect(listJournalMemories(adapter, other.id)).toHaveLength(1);
  });
});

describe('updateJournalMemory', () => {
  it('updates allowed fields', () => {
    const mem = createJournalMemory(adapter, {
      entry_id: entryId,
      kind: 'photo',
    });
    updateJournalMemory(adapter, mem.id, {
      caption: 'Updated',
      kind: 'video',
    });
    const rows = listJournalMemories(adapter, entryId);
    expect(rows[0]!.caption).toBe('Updated');
    expect(rows[0]!.kind).toBe('video');
  });

  it('is a no-op for an empty patch', () => {
    const mem = createJournalMemory(adapter, {
      entry_id: entryId,
      kind: 'photo',
      caption: 'keep me',
    });
    updateJournalMemory(adapter, mem.id, {});
    const rows = listJournalMemories(adapter, entryId);
    expect(rows[0]!.caption).toBe('keep me');
  });
});

describe('deleteJournalMemory', () => {
  it('removes the row', () => {
    const mem = createJournalMemory(adapter, {
      entry_id: entryId,
      kind: 'photo',
    });
    deleteJournalMemory(adapter, mem.id);
    expect(listJournalMemories(adapter, entryId)).toHaveLength(0);
  });
});

describe('cascade on entry delete', () => {
  it('removes memories when the parent entry is deleted', () => {
    createJournalMemory(adapter, { entry_id: entryId, kind: 'photo' });
    createJournalMemory(adapter, { entry_id: entryId, kind: 'quote' });
    deleteJournalEntry(adapter, entryId);
    expect(getJournalEntry(adapter, entryId)).toBeNull();
    expect(listJournalMemories(adapter, entryId)).toHaveLength(0);
  });
});

describe('reorderJournalMemories', () => {
  it('reindexes memories to match the provided order', () => {
    const a = createJournalMemory(adapter, {
      entry_id: entryId,
      kind: 'photo',
    });
    const b = createJournalMemory(adapter, {
      entry_id: entryId,
      kind: 'quote',
    });
    const c = createJournalMemory(adapter, {
      entry_id: entryId,
      kind: 'souvenir',
    });

    reorderJournalMemories(adapter, [c.id, a.id, b.id]);
    const rows = listJournalMemories(adapter, entryId);
    expect(rows.map((r) => r.id)).toEqual([c.id, a.id, b.id]);
    expect(rows.map((r) => r.sort_order)).toEqual([0, 1, 2]);
  });

  it('handles an empty id list as a no-op', () => {
    createJournalMemory(adapter, { entry_id: entryId, kind: 'photo' });
    reorderJournalMemories(adapter, []);
    expect(listJournalMemories(adapter, entryId)).toHaveLength(1);
  });
});
