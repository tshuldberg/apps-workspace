import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createModuleTestDatabase, type InMemoryTestDatabase } from '@mylife/db';
import { NOTES_MODULE } from '../definition';
import {
  createNote,
  createTag,
  deleteNote,
  deleteTag,
  updateNote,
} from '../db/crud';

let testDb: InMemoryTestDatabase;

beforeEach(() => {
  testDb = createModuleTestDatabase('notes', NOTES_MODULE.migrations!);
});

afterEach(() => {
  testDb.close();
});

// Helpers ---------------------------------------------------------------

function readHubTagByLabel(label: string) {
  return testDb.raw
    .prepare(`SELECT id, label, color FROM hub_tags WHERE label = ?`)
    .get(label) as { id: string; label: string; color: string | null } | undefined;
}

function readHubTagIdPointer(ntTagId: string): string | null {
  const row = testDb.raw
    .prepare(`SELECT hub_tag_id FROM nt_tags WHERE id = ?`)
    .get(ntTagId) as { hub_tag_id: string | null } | undefined;
  return row?.hub_tag_id ?? null;
}

function countHubBindings(filter: {
  tagId?: string;
  moduleId?: string;
  entityType?: string;
  entityId?: string;
}) {
  const conditions: string[] = [];
  const params: unknown[] = [];
  if (filter.tagId) {
    conditions.push('tag_id = ?');
    params.push(filter.tagId);
  }
  if (filter.moduleId) {
    conditions.push('module_id = ?');
    params.push(filter.moduleId);
  }
  if (filter.entityType) {
    conditions.push('entity_type = ?');
    params.push(filter.entityType);
  }
  if (filter.entityId) {
    conditions.push('entity_id = ?');
    params.push(filter.entityId);
  }
  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const row = testDb.raw
    .prepare(`SELECT COUNT(*) as count FROM hub_tag_bindings ${where}`)
    .get(...params) as { count: number };
  return row.count;
}

// Tests -----------------------------------------------------------------

describe('Notes tags shadow-write', () => {
  describe('createTag', () => {
    it('creates the nt_tags row and a matching hub_tags row, with hub_tag_id pointer', () => {
      const created = createTag(testDb.adapter, 't1', { name: 'reading', color: '#C9894D' });

      expect(created.id).toBe('t1');
      const hub = readHubTagByLabel('reading');
      expect(hub).toBeDefined();
      expect(hub?.color).toBe('#C9894D');
      expect(readHubTagIdPointer('t1')).toBe(hub!.id);
    });

    it('points two module-scoped tags with the same label at the same hub_tags row', () => {
      // Two different modules could create tags with identical labels. Within
      // notes alone, `nt_tags.name` is UNIQUE so we simulate the cross-row
      // idempotency by creating → deleting → recreating with the same label.
      createTag(testDb.adapter, 't1', { name: 'focus' });
      const firstHubId = readHubTagIdPointer('t1');
      deleteTag(testDb.adapter, 't1');

      createTag(testDb.adapter, 't2', { name: 'focus' });
      const secondHubId = readHubTagIdPointer('t2');

      expect(firstHubId).not.toBeNull();
      expect(secondHubId).toBe(firstHubId);

      const hubRows = testDb.raw
        .prepare(`SELECT COUNT(*) as count FROM hub_tags WHERE label = ?`)
        .get('focus') as { count: number };
      expect(hubRows.count).toBe(1);
    });

    it('rolls back the nt_tags insert when the hub write throws', () => {
      // Drop the canonical hub_tags table so any shadow-write attempt throws
      // synchronously inside the transaction. The per-module insert must be
      // rolled back along with it (both-or-neither invariant).
      testDb.adapter.execute('DROP TABLE hub_tag_bindings');
      testDb.adapter.execute('DROP TABLE hub_tags');

      expect(() =>
        createTag(testDb.adapter, 't-fail', { name: 'bad' }),
      ).toThrow();

      const ntRow = testDb.raw
        .prepare(`SELECT id FROM nt_tags WHERE id = ?`)
        .get('t-fail');
      expect(ntRow).toBeUndefined();
    });
  });

  describe('note → tag binding shadow-write', () => {
    it('writes hub_tag_bindings when createNote attaches tagIds', () => {
      createTag(testDb.adapter, 't1', { name: 'work' });
      const hubTagId = readHubTagIdPointer('t1')!;

      createNote(testDb.adapter, 'n1', { title: 'Meeting', tagIds: ['t1'] });

      expect(
        countHubBindings({
          tagId: hubTagId,
          moduleId: 'notes',
          entityType: 'note',
          entityId: 'n1',
        }),
      ).toBe(1);
    });

    it('removes the hub_tag_bindings row when updateNote clears tagIds', () => {
      createTag(testDb.adapter, 't1', { name: 'work' });
      const hubTagId = readHubTagIdPointer('t1')!;
      createNote(testDb.adapter, 'n1', { title: 'Meeting', tagIds: ['t1'] });

      updateNote(testDb.adapter, 'n1', { tagIds: [] });

      expect(
        countHubBindings({
          tagId: hubTagId,
          moduleId: 'notes',
          entityType: 'note',
          entityId: 'n1',
        }),
      ).toBe(0);
    });

    it('swaps hub bindings when updateNote replaces tagIds with a different tag', () => {
      createTag(testDb.adapter, 't1', { name: 'work' });
      createTag(testDb.adapter, 't2', { name: 'personal' });
      const hub1 = readHubTagIdPointer('t1')!;
      const hub2 = readHubTagIdPointer('t2')!;

      createNote(testDb.adapter, 'n1', { title: 'Meeting', tagIds: ['t1'] });
      updateNote(testDb.adapter, 'n1', { tagIds: ['t2'] });

      expect(
        countHubBindings({ tagId: hub1, moduleId: 'notes', entityId: 'n1' }),
      ).toBe(0);
      expect(
        countHubBindings({ tagId: hub2, moduleId: 'notes', entityId: 'n1' }),
      ).toBe(1);
    });
  });

  describe('deleteTag', () => {
    it('removes the module-scoped note bindings but leaves the canonical hub_tags row alone', () => {
      createTag(testDb.adapter, 't1', { name: 'archive' });
      const hubTagId = readHubTagIdPointer('t1')!;
      createNote(testDb.adapter, 'n1', { title: 'A', tagIds: ['t1'] });
      createNote(testDb.adapter, 'n2', { title: 'B', tagIds: ['t1'] });

      expect(countHubBindings({ tagId: hubTagId, moduleId: 'notes' })).toBe(2);

      deleteTag(testDb.adapter, 't1');

      // Bindings gone for notes module.
      expect(countHubBindings({ tagId: hubTagId, moduleId: 'notes' })).toBe(0);

      // Canonical hub tag row preserved: other modules may still use it.
      const hubRow = testDb.raw
        .prepare(`SELECT id FROM hub_tags WHERE id = ?`)
        .get(hubTagId);
      expect(hubRow).toBeDefined();

      // nt_note_tags rows are cascade-cleaned by the FK on nt_tags delete.
      const ntLinks = testDb.raw
        .prepare(`SELECT COUNT(*) as count FROM nt_note_tags WHERE tag_id = ?`)
        .get('t1') as { count: number };
      expect(ntLinks.count).toBe(0);
    });
  });

  describe('deleteNote', () => {
    it('unbinds every hub_tag_binding owned by the deleted note', () => {
      createTag(testDb.adapter, 't1', { name: 'work' });
      createTag(testDb.adapter, 't2', { name: 'deep' });
      createNote(testDb.adapter, 'n1', { title: 'A', tagIds: ['t1', 't2'] });
      createNote(testDb.adapter, 'n2', { title: 'B', tagIds: ['t1'] });

      // Sanity: both notes show up in hub_tag_bindings.
      expect(
        countHubBindings({ moduleId: 'notes', entityType: 'note', entityId: 'n1' }),
      ).toBe(2);
      expect(
        countHubBindings({ moduleId: 'notes', entityType: 'note', entityId: 'n2' }),
      ).toBe(1);

      deleteNote(testDb.adapter, 'n1');

      // Only n1's bindings removed; n2 untouched; canonical hub_tags rows preserved.
      expect(
        countHubBindings({ moduleId: 'notes', entityType: 'note', entityId: 'n1' }),
      ).toBe(0);
      expect(
        countHubBindings({ moduleId: 'notes', entityType: 'note', entityId: 'n2' }),
      ).toBe(1);

      const hubTagRows = testDb.raw
        .prepare(`SELECT COUNT(*) as count FROM hub_tags`)
        .get() as { count: number };
      expect(hubTagRows.count).toBe(2);
    });
  });
});
