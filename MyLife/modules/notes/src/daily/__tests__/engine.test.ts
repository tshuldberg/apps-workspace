import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createModuleTestDatabase, type InMemoryTestDatabase } from '@mylife/db';
import { NOTES_MODULE } from '../../definition';
import {
  formatDailyTitle,
  getOrCreateDailyNote,
  getDailyNoteDates,
  getDailyNoteByDate,
  isDailyNote,
} from '../engine';
import { createNote } from '../../db/crud';

let testDb: InMemoryTestDatabase;

beforeEach(() => {
  testDb = createModuleTestDatabase('notes', NOTES_MODULE.migrations!);
});

afterEach(() => {
  testDb.close();
});

describe('formatDailyTitle', () => {
  it('formats YYYY-MM-DD (passthrough)', () => {
    expect(formatDailyTitle('2026-03-22')).toBe('2026-03-22');
  });

  it('formats MMM D, YYYY', () => {
    expect(formatDailyTitle('2026-03-22', 'MMM D, YYYY')).toBe('Mar 22, 2026');
  });

  it('formats dddd, MMMM D', () => {
    expect(formatDailyTitle('2026-03-22', 'dddd, MMMM D')).toBe('Sunday, March 22');
  });

  it('handles January 1', () => {
    expect(formatDailyTitle('2026-01-01', 'MMM D, YYYY')).toBe('Jan 1, 2026');
  });

  it('handles December 31', () => {
    expect(formatDailyTitle('2026-12-31', 'MMM D, YYYY')).toBe('Dec 31, 2026');
  });
});

describe('getOrCreateDailyNote', () => {
  it('creates a new daily note when none exists', () => {
    const note = getOrCreateDailyNote(testDb.adapter, '2026-03-22');
    expect(note.isDailyNote).toBe(true);
    expect(note.dailyDate).toBe('2026-03-22');
    expect(note.title).toBe('2026-03-22');
  });

  it('returns existing note when one exists', () => {
    const first = getOrCreateDailyNote(testDb.adapter, '2026-03-22');
    const second = getOrCreateDailyNote(testDb.adapter, '2026-03-22');
    expect(second.id).toBe(first.id);
  });

  it('uses template body when provided', () => {
    const note = getOrCreateDailyNote(testDb.adapter, '2026-03-22', {
      templateBody: '## Today\n\n- [ ] Task 1',
    });
    expect(note.body).toBe('## Today\n\n- [ ] Task 1');
    expect(note.wordCount).toBe(4);
  });

  it('uses configured folder', () => {
    // Create a folder first
    testDb.adapter.execute(
      `INSERT INTO nt_folders (id, name, created_at, updated_at) VALUES (?, ?, datetime('now'), datetime('now'))`,
      ['f1', 'Daily'],
    );
    const note = getOrCreateDailyNote(testDb.adapter, '2026-03-22', { folderId: 'f1' });
    expect(note.folderId).toBe('f1');
  });

  it('uses custom title format', () => {
    const note = getOrCreateDailyNote(testDb.adapter, '2026-03-22', {
      titleFormat: 'MMM D, YYYY',
    });
    expect(note.title).toBe('Mar 22, 2026');
  });
});

describe('getDailyNoteDates', () => {
  it('returns dates of daily notes in descending order', () => {
    getOrCreateDailyNote(testDb.adapter, '2026-03-20');
    getOrCreateDailyNote(testDb.adapter, '2026-03-22');
    getOrCreateDailyNote(testDb.adapter, '2026-03-21');

    const dates = getDailyNoteDates(testDb.adapter);
    expect(dates).toEqual(['2026-03-22', '2026-03-21', '2026-03-20']);
  });

  it('returns empty array when no daily notes exist', () => {
    expect(getDailyNoteDates(testDb.adapter)).toEqual([]);
  });
});

describe('getDailyNoteByDate', () => {
  it('returns note for date that has one', () => {
    getOrCreateDailyNote(testDb.adapter, '2026-03-22');
    const note = getDailyNoteByDate(testDb.adapter, '2026-03-22');
    expect(note).not.toBeNull();
    expect(note!.dailyDate).toBe('2026-03-22');
  });

  it('returns null for date without note', () => {
    expect(getDailyNoteByDate(testDb.adapter, '2026-03-22')).toBeNull();
  });
});

describe('isDailyNote', () => {
  it('returns true for daily notes', () => {
    const note = getOrCreateDailyNote(testDb.adapter, '2026-03-22');
    expect(isDailyNote(note)).toBe(true);
  });

  it('returns false for regular notes', () => {
    const note = createNote(testDb.adapter, 'n1', { title: 'Regular' });
    expect(isDailyNote(note)).toBe(false);
  });
});
