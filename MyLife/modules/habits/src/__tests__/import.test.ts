import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { DatabaseAdapter } from '@mylife/db';
import { createModuleTestDatabase } from '@mylife/db';
import { HABITS_MODULE } from '../definition';
import { exportAllCSV } from '../export';
import { createHabit, recordCompletion, getHabits, getCompletions } from '../db';
import { importAllCSV, parseHabitsCSV, parseCompletionsCSV, importHabits, importCompletions } from '../import';

describe('CSV import', () => {
  let adapter: DatabaseAdapter;
  let closeDb: () => void;

  beforeEach(() => {
    const testDb = createModuleTestDatabase('habits', HABITS_MODULE.migrations!);
    adapter = testDb.adapter;
    closeDb = testDb.close;
  });

  afterEach(() => {
    closeDb();
  });

  it('round-trip: export then import preserves habits', () => {
    createHabit(adapter, 'h1', { name: 'Read' });
    createHabit(adapter, 'h2', { name: 'Run', frequency: 'weekly', habitType: 'timed', targetCount: 1800 });

    const csv = exportAllCSV(adapter);

    // New DB for import
    const db2 = createModuleTestDatabase('habits', HABITS_MODULE.migrations!);
    const result = importAllCSV(db2.adapter, csv);
    expect(result.habits.imported).toBe(2);
    expect(result.habits.skipped).toBe(0);

    const imported = getHabits(db2.adapter);
    expect(imported).toHaveLength(2);
    expect(imported.find((h) => h.id === 'h1')?.name).toBe('Read');
    expect(imported.find((h) => h.id === 'h2')?.frequency).toBe('weekly');
    db2.close();
  });

  it('round-trip: export then import preserves completions', () => {
    createHabit(adapter, 'h1', { name: 'Read' });
    recordCompletion(adapter, 'c1', 'h1', '2025-01-01T10:00:00Z', 1);
    recordCompletion(adapter, 'c2', 'h1', '2025-01-02T10:00:00Z', 1);

    const csv = exportAllCSV(adapter);

    const db2 = createModuleTestDatabase('habits', HABITS_MODULE.migrations!);
    // Import habits first, then completions
    const result = importAllCSV(db2.adapter, csv);
    expect(result.habits.imported).toBe(1);
    expect(result.completions.imported).toBe(2);

    const completions = getCompletions(db2.adapter, 'h1');
    expect(completions).toHaveLength(2);
    db2.close();
  });

  it('skips duplicates on re-import', () => {
    createHabit(adapter, 'h1', { name: 'Read' });
    const csv = exportAllCSV(adapter);

    // Import into same DB (has h1 already)
    const result = importAllCSV(adapter, csv);
    expect(result.habits.imported).toBe(0);
    expect(result.habits.skipped).toBe(1);
  });

  it('handles empty CSV gracefully', () => {
    const result = importAllCSV(adapter, '');
    expect(result.habits.imported).toBe(0);
    expect(result.completions.imported).toBe(0);
  });

  it('handles CSV with only habits section', () => {
    createHabit(adapter, 'h1', { name: 'Meditate' });
    const csv = '# Habits\n' + exportAllCSV(adapter).split('\n').slice(1).join('\n');

    const db2 = createModuleTestDatabase('habits', HABITS_MODULE.migrations!);
    const result = importHabits(db2.adapter, csv);
    expect(result.imported).toBe(1);
    db2.close();
  });

  it('parseHabitsCSV returns parsed rows', () => {
    const csv = 'id,name,description\nh1,Read,A book';
    const parsed = parseHabitsCSV(csv);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].id).toBe('h1');
    expect(parsed[0].name).toBe('Read');
  });

  it('parseCompletionsCSV returns parsed rows', () => {
    const csv = 'id,habit_id,completed_at,value,notes,created_at\nc1,h1,2025-01-01,1,,2025-01-01';
    const parsed = parseCompletionsCSV(csv);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].habit_id).toBe('h1');
  });

  it('handles malformed CSV rows with errors', () => {
    // Row with no id or name
    const csv = '# Habits\nid,name\n,';
    const result = importHabits(adapter, csv);
    expect(result.imported).toBe(0);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('handles CSV with quoted fields containing commas', () => {
    const csv = 'id,name,description\nh1,"Read, Write",A book';
    const parsed = parseHabitsCSV(csv);
    expect(parsed[0].name).toBe('Read, Write');
  });

  it('importCompletions handles missing section', () => {
    const csv = '# Habits\nid,name\nh1,Read';
    const result = importCompletions(adapter, csv);
    expect(result.imported).toBe(0);
  });
});
