import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { DatabaseAdapter } from '@mylife/db';
import { createModuleTestDatabase } from '@mylife/db';
import { NUTRITION_MODULE } from '../definition';
import {
  createDailyNote,
  getDailyNote,
  getDailyNotes,
  getDailyNotesByDate,
  updateDailyNote,
  deleteDailyNote,
  upsertDailyNote,
  searchNotes,
  parseTags,
  serializeTags,
} from '../notes/crud';
import { createFoodLogEntry } from '../db/food-log';

describe('food diary notes', () => {
  let db: DatabaseAdapter;
  let closeDb: () => void;

  beforeEach(() => {
    const testDb = createModuleTestDatabase('nutrition', NUTRITION_MODULE.migrations!);
    db = testDb.adapter;
    closeDb = testDb.close;
  });

  afterEach(() => {
    closeDb();
  });

  describe('createDailyNote', () => {
    it('stores content, date, and tags', () => {
      createDailyNote(db, 'n1', {
        date: '2026-03-22',
        content: 'Felt great after lunch',
        tags: ['restaurant', 'social'],
        mealTypes: ['lunch'],
        linkedFoodIds: ['food-1'],
      });
      const note = getDailyNote(db, '2026-03-22');
      expect(note).not.toBeNull();
      expect(note!.content).toBe('Felt great after lunch');
      expect(note!.tags).toEqual(['restaurant', 'social']);
      expect(note!.mealTypes).toEqual(['lunch']);
      expect(note!.linkedFoodIds).toEqual(['food-1']);
    });
  });

  describe('getDailyNote', () => {
    it('retrieves by date', () => {
      createDailyNote(db, 'n1', { date: '2026-03-22', content: 'Test note' });
      const note = getDailyNote(db, '2026-03-22');
      expect(note?.date).toBe('2026-03-22');
    });

    it('returns null for missing date', () => {
      const note = getDailyNote(db, '2026-01-01');
      expect(note).toBeNull();
    });
  });

  describe('updateDailyNote', () => {
    it('updates content and updated_at', () => {
      createDailyNote(db, 'n1', { date: '2026-03-22', content: 'Original' });
      updateDailyNote(db, '2026-03-22', {
        content: 'Updated',
        mealTypes: ['dinner'],
        linkedFoodIds: ['food-2'],
      });
      const note = getDailyNote(db, '2026-03-22');
      expect(note!.content).toBe('Updated');
      expect(note!.mealTypes).toEqual(['dinner']);
      expect(note!.linkedFoodIds).toEqual(['food-2']);
    });
  });

  describe('getDailyNotes', () => {
    it('returns notes ordered by date descending', () => {
      createDailyNote(db, 'n1', { date: '2026-03-21', content: 'Earlier note' });
      createDailyNote(db, 'n2', { date: '2026-03-22', content: 'Later note' });

      const notes = getDailyNotes(db);
      expect(notes.map((note) => note.date).slice(0, 2)).toEqual(['2026-03-22', '2026-03-21']);
    });
  });

  describe('getDailyNotesByDate', () => {
    it('returns notes within the requested range', () => {
      createDailyNote(db, 'n1', { date: '2026-03-20', content: 'Outside range' });
      createDailyNote(db, 'n2', { date: '2026-03-22', content: 'Inside range' });

      const notes = getDailyNotesByDate(db, '2026-03-21', '2026-03-23');
      expect(notes).toHaveLength(1);
      expect(notes[0].date).toBe('2026-03-22');
    });
  });

  describe('deleteDailyNote', () => {
    it('removes row when content is empty', () => {
      createDailyNote(db, 'n1', { date: '2026-03-22', content: 'Test' });
      deleteDailyNote(db, '2026-03-22');
      expect(getDailyNote(db, '2026-03-22')).toBeNull();
    });
  });

  describe('upsertDailyNote', () => {
    it('creates if not exists', () => {
      upsertDailyNote(db, 'n1', { date: '2026-03-22', content: 'New note' });
      expect(getDailyNote(db, '2026-03-22')!.content).toBe('New note');
    });

    it('updates if exists (same date)', () => {
      upsertDailyNote(db, 'n1', { date: '2026-03-22', content: 'First' });
      upsertDailyNote(db, 'n2', { date: '2026-03-22', content: 'Second' });
      const note = getDailyNote(db, '2026-03-22');
      expect(note!.content).toBe('Second');
    });

    it('deletes when content is empty', () => {
      upsertDailyNote(db, 'n1', { date: '2026-03-22', content: 'Test' });
      upsertDailyNote(db, 'n2', { date: '2026-03-22', content: '' });
      expect(getDailyNote(db, '2026-03-22')).toBeNull();
    });
  });

  describe('searchNotes', () => {
    it('finds matches in nu_daily_notes.content', () => {
      createDailyNote(db, 'n1', { date: '2026-03-22', content: 'Ate pasta for lunch, felt bloated' });
      createDailyNote(db, 'n2', { date: '2026-03-21', content: 'Great energy all day' });

      const results = searchNotes(db, 'pasta');
      expect(results).toHaveLength(1);
      expect(results[0].source).toBe('daily');
      expect(results[0].date).toBe('2026-03-22');
    });

    it('finds matches in nu_food_log.notes', () => {
      createFoodLogEntry(db, 'log1', {
        date: '2026-03-22',
        mealType: 'lunch',
        notes: 'Italian restaurant downtown',
      });

      const results = searchNotes(db, 'Italian');
      expect(results).toHaveLength(1);
      expect(results[0].source).toBe('meal');
    });

    it('returns empty array for no matches', () => {
      createDailyNote(db, 'n1', { date: '2026-03-22', content: 'Nothing interesting' });
      const results = searchNotes(db, 'xyznonexistent');
      expect(results).toHaveLength(0);
    });

    it('returns empty array for empty query', () => {
      expect(searchNotes(db, '')).toHaveLength(0);
    });
  });

  describe('tag helpers', () => {
    it('parseTags: parses JSON array string to string[]', () => {
      expect(parseTags('["restaurant","social"]')).toEqual(['restaurant', 'social']);
    });

    it('parseTags: returns empty array for null', () => {
      expect(parseTags(null)).toEqual([]);
    });

    it('parseTags: returns empty array for invalid JSON', () => {
      expect(parseTags('invalid')).toEqual([]);
    });

    it('serializeTags: converts string[] to JSON array string', () => {
      expect(serializeTags(['a', 'b'])).toBe('["a","b"]');
    });
  });
});
