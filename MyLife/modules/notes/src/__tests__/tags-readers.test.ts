/**
 * Phase 2 Wave A reader tests for @mylife/notes/shared/tags.
 *
 * Validates the cross-module read-side of the Phase 1c shadow-write path:
 * once notes have shadow-written into hub_tags + hub_tag_bindings, these
 * helpers should surface (a) every note bound to a label and (b) every
 * cross-module entity bound to that same label.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { bindTag, createModuleTestDatabase, type InMemoryTestDatabase } from '@mylife/db';
import { NOTES_MODULE } from '../definition';
import { createNote, createTag } from '../db/crud';
import {
  getCrossModuleEntitiesForTagLabel,
  getNotesWithTagLabel,
} from '../shared/tags';

let testDb: InMemoryTestDatabase;

beforeEach(() => {
  testDb = createModuleTestDatabase('notes', NOTES_MODULE.migrations!);
});

afterEach(() => {
  testDb.close();
});

function getHubTagIdForLabel(label: string): string {
  const row = testDb.raw
    .prepare(`SELECT id FROM hub_tags WHERE label = ?`)
    .get(label) as { id: string } | undefined;
  if (!row) throw new Error(`hub tag not found for label: ${label}`);
  return row.id;
}

describe('getNotesWithTagLabel', () => {
  it('returns notes bound to the canonical hub tag for a label', () => {
    createTag(testDb.adapter, 't1', { name: 'reading' });
    createNote(testDb.adapter, 'n1', { title: 'Borges', tagIds: ['t1'] });
    createNote(testDb.adapter, 'n2', { title: 'Calvino', tagIds: ['t1'] });
    createNote(testDb.adapter, 'n3', { title: 'Untagged' });

    const matches = getNotesWithTagLabel(testDb.adapter, 'reading');

    expect(matches.map((n) => n.id).sort()).toEqual(['n1', 'n2']);
    expect(matches.find((n) => n.id === 'n3')).toBeUndefined();
  });

  it('returns an empty array for an unknown tag label', () => {
    createTag(testDb.adapter, 't1', { name: 'reading' });
    createNote(testDb.adapter, 'n1', { title: 'Borges', tagIds: ['t1'] });

    expect(getNotesWithTagLabel(testDb.adapter, 'nonexistent')).toEqual([]);
  });

  it('returns an empty array when the tag exists but no notes are bound', () => {
    createTag(testDb.adapter, 't1', { name: 'lonely' });

    expect(getNotesWithTagLabel(testDb.adapter, 'lonely')).toEqual([]);
  });
});

describe('getCrossModuleEntitiesForTagLabel', () => {
  it('returns one entry per (module, entityType, entityId) bound to the tag', () => {
    createTag(testDb.adapter, 't1', { name: 'reading' });
    createNote(testDb.adapter, 'n1', { title: 'Borges', tagIds: ['t1'] });
    createNote(testDb.adapter, 'n2', { title: 'Calvino', tagIds: ['t1'] });

    const entities = getCrossModuleEntitiesForTagLabel(
      testDb.adapter,
      'reading',
    );

    expect(entities).toHaveLength(2);
    for (const entity of entities) {
      expect(entity.moduleId).toBe('notes');
      expect(entity.entityType).toBe('note');
      expect(entity.count).toBe(1);
    }
    expect(entities.map((e) => e.entityId).sort()).toEqual(['n1', 'n2']);
  });

  it('surfaces bindings from other modules sharing the same hub tag', () => {
    // Notes shadow-writes the canonical hub tag plus its own binding.
    createTag(testDb.adapter, 't1', { name: 'work' });
    createNote(testDb.adapter, 'n1', { title: 'Standup', tagIds: ['t1'] });

    // Simulate a second module (e.g. budget, books) binding the same tag
    // to one of its own entities. We use the public bindTag helper directly
    // so the test does not depend on any particular module's shadow-write
    // path -- the cross-module reader only cares about hub_tag_bindings.
    const hubTagId = getHubTagIdForLabel('work');
    bindTag(testDb.adapter, {
      tagId: hubTagId,
      moduleId: 'test-module',
      entityType: 'task',
      entityId: 'task-42',
    });

    const entities = getCrossModuleEntitiesForTagLabel(testDb.adapter, 'work');

    expect(entities).toHaveLength(2);
    const byModule = new Map(entities.map((e) => [e.moduleId, e]));
    expect(byModule.get('notes')?.entityId).toBe('n1');
    expect(byModule.get('test-module')?.entityId).toBe('task-42');
    expect(byModule.get('test-module')?.entityType).toBe('task');
  });

  it('returns an empty array for an unknown label', () => {
    expect(
      getCrossModuleEntitiesForTagLabel(testDb.adapter, 'never-bound'),
    ).toEqual([]);
  });
});
