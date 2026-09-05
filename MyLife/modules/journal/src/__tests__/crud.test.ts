import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createModuleTestDatabase, type InMemoryTestDatabase } from '@mylife/db';
import { JOURNAL_MODULE } from '../definition';
import {
  createJournalNotebook,
  createJournalEntry,
  deleteJournalEntry,
  exportJournalData,
  getEntriesForDate,
  getJournalDashboard,
  getJournalEntryById,
  getJournalNotebookById,
  getJournalSetting,
  listJournalNotebooks,
  listJournalEntries,
  listJournalTags,
  listOnThisDayEntries,
  searchJournalEntries,
  setJournalSetting,
  updateJournalEntry,
} from '../db';
import {
  calculateJournalStreak,
  countWords,
  estimateReadingTimeMinutes,
  getDailyJournalPrompt,
  serializeJournalExport,
  summarizeMoodDistribution,
} from '..';

let testDb: InMemoryTestDatabase;

beforeEach(() => {
  testDb = createModuleTestDatabase('journal', JOURNAL_MODULE.migrations!);
});

afterEach(() => {
  testDb.close();
});

describe('Journal CRUD', () => {
  it('creates and retrieves entries with tags', () => {
    createJournalEntry(testDb.adapter, 'entry-1', {
      entryDate: '2026-03-08',
      title: 'Morning note',
      body: 'Today I wrote a private note.',
      tags: ['Morning', 'Reflection'],
      mood: 'good',
    });

    const entry = getJournalEntryById(testDb.adapter, 'entry-1');
    expect(entry?.title).toBe('Morning note');
    expect(entry?.journalId).toBe('journal-default');
    expect(entry?.tags).toEqual(['morning', 'reflection']);
    expect(entry?.wordCount).toBe(6);
  });

  it('lists and searches entries', () => {
    createJournalEntry(testDb.adapter, 'entry-1', {
      entryDate: '2026-03-08',
      title: 'Morning note',
      body: 'Today I wrote about coffee and plans.',
      tags: ['morning'],
      mood: 'good',
    });
    createJournalEntry(testDb.adapter, 'entry-2', {
      entryDate: '2026-03-07',
      title: 'Evening reset',
      body: 'I reflected on how calm the walk felt.',
      tags: ['reflection'],
      mood: 'great',
    });

    expect(listJournalEntries(testDb.adapter)).toHaveLength(2);
    expect(searchJournalEntries(testDb.adapter, 'coffee')).toHaveLength(1);
    expect(searchJournalEntries(testDb.adapter, 'reflect')[0].matchedTagNames).toContain('reflection');
  });

  it('updates and deletes entries', () => {
    createJournalEntry(testDb.adapter, 'entry-1', {
      entryDate: '2026-03-08',
      body: 'A short draft',
    });

    const updated = updateJournalEntry(testDb.adapter, 'entry-1', {
      body: 'A much longer draft with extra context.',
      tags: ['edited'],
      mood: 'okay',
    });
    expect(updated?.wordCount).toBe(7);
    expect(updated?.tags).toEqual(['edited']);

    deleteJournalEntry(testDb.adapter, 'entry-1');
    expect(getJournalEntryById(testDb.adapter, 'entry-1')).toBeNull();
  });

  it('filters entries by date and exposes tags', () => {
    createJournalEntry(testDb.adapter, 'entry-1', {
      entryDate: '2026-03-08',
      body: 'Today entry',
      tags: ['today'],
    });
    createJournalEntry(testDb.adapter, 'entry-2', {
      entryDate: '2026-03-07',
      body: 'Yesterday entry',
      tags: ['yesterday'],
    });

    expect(getEntriesForDate(testDb.adapter, '2026-03-08')).toHaveLength(1);
    expect(listJournalTags(testDb.adapter).map((tag) => tag.name)).toEqual(['today', 'yesterday']);
  });
});

describe('Journal settings and dashboard', () => {
  it('stores settings', () => {
    expect(getJournalSetting(testDb.adapter, 'editorMode')).toBe('markdown');
    setJournalSetting(testDb.adapter, 'dailyPromptEnabled', 'true');
    expect(getJournalSetting(testDb.adapter, 'dailyPromptEnabled')).toBe('true');
  });

  it('builds dashboard stats', () => {
    createJournalEntry(testDb.adapter, 'entry-1', {
      entryDate: '2026-03-08',
      body: 'One two three four',
      mood: 'good',
    });
    createJournalEntry(testDb.adapter, 'entry-2', {
      entryDate: '2026-03-07',
      body: 'Five six seven',
      mood: 'great',
    });

    const dashboard = getJournalDashboard(testDb.adapter, '2026-03-08');
    expect(dashboard.entryCount).toBe(2);
    expect(dashboard.currentStreak).toBe(2);
    expect(dashboard.totalWords).toBe(7);
    expect(dashboard.latestMood).toBe('good');
    expect(dashboard.journalCount).toBe(1);
  });
});

describe('Journal CRUD - edge cases', () => {
  it('returns null when getting a nonexistent entry', () => {
    expect(getJournalEntryById(testDb.adapter, 'does-not-exist')).toBeNull();
  });

  it('returns null when updating a nonexistent entry', () => {
    expect(updateJournalEntry(testDb.adapter, 'does-not-exist', { body: 'test' })).toBeNull();
  });

  it('creates entry with no optional fields (minimal input)', () => {
    const entry = createJournalEntry(testDb.adapter, 'min-entry', {
      body: 'Just the body',
    });
    expect(entry.title).toBeNull();
    expect(entry.tags).toEqual([]);
    expect(entry.mood).toBeNull();
    expect(entry.imageUris).toEqual([]);
    expect(entry.wordCount).toBe(3);
  });

  it('normalizes duplicate tags within a single entry', () => {
    const entry = createJournalEntry(testDb.adapter, 'dup-tags', {
      body: 'Entry with duplicate tags',
      tags: ['Morning', 'morning', 'MORNING'],
    });
    expect(entry.tags).toEqual(['morning']);
  });

  it('handles empty body validation through Zod', () => {
    expect(() =>
      createJournalEntry(testDb.adapter, 'bad-entry', {
        body: '',
      }),
    ).toThrow();
  });

  it('stores and retrieves image URIs as JSON', () => {
    const uris = ['file:///photo1.jpg', 'file:///photo2.png'];
    const entry = createJournalEntry(testDb.adapter, 'img-entry', {
      body: 'Entry with images',
      imageUris: uris,
    });
    expect(entry.imageUris).toEqual(uris);
  });

  it('preserves entry date when updating other fields', () => {
    createJournalEntry(testDb.adapter, 'date-entry', {
      entryDate: '2026-01-15',
      body: 'Original body',
    });
    const updated = updateJournalEntry(testDb.adapter, 'date-entry', {
      body: 'Updated body',
    });
    expect(updated?.entryDate).toBe('2026-01-15');
  });

  it('can update entry date', () => {
    createJournalEntry(testDb.adapter, 'move-entry', {
      entryDate: '2026-01-15',
      body: 'Will move this entry',
    });
    const updated = updateJournalEntry(testDb.adapter, 'move-entry', {
      entryDate: '2026-02-20',
    });
    expect(updated?.entryDate).toBe('2026-02-20');
  });

  it('can set mood to null on update', () => {
    createJournalEntry(testDb.adapter, 'mood-entry', {
      body: 'Has mood',
      mood: 'great',
    });
    const updated = updateJournalEntry(testDb.adapter, 'mood-entry', {
      mood: null,
    });
    expect(updated?.mood).toBeNull();
  });

  it('deleting a nonexistent entry does not throw', () => {
    expect(() => deleteJournalEntry(testDb.adapter, 'nope')).not.toThrow();
  });
});

describe('Journal list filters', () => {
  beforeEach(() => {
    createJournalEntry(testDb.adapter, 'f-1', {
      entryDate: '2026-03-08',
      body: 'March eighth entry',
      tags: ['morning'],
      mood: 'good',
    });
    createJournalEntry(testDb.adapter, 'f-2', {
      entryDate: '2026-03-07',
      body: 'March seventh entry',
      tags: ['evening'],
      mood: 'great',
    });
    createJournalEntry(testDb.adapter, 'f-3', {
      entryDate: '2026-02-15',
      body: 'February entry about winter',
      tags: ['morning'],
      mood: 'low',
    });
  });

  it('filters by mood', () => {
    const results = listJournalEntries(testDb.adapter, { mood: 'good' });
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe('f-1');
  });

  it('filters by tag name', () => {
    const results = listJournalEntries(testDb.adapter, { tag: 'morning' });
    expect(results).toHaveLength(2);
  });

  it('filters by date range', () => {
    const results = listJournalEntries(testDb.adapter, {
      startDate: '2026-03-01',
      endDate: '2026-03-31',
    });
    expect(results).toHaveLength(2);
  });

  it('applies limit and offset', () => {
    const page1 = listJournalEntries(testDb.adapter, { limit: 2, offset: 0 });
    expect(page1).toHaveLength(2);
    const page2 = listJournalEntries(testDb.adapter, { limit: 2, offset: 2 });
    expect(page2).toHaveLength(1);
  });

  it('filters by search text in body', () => {
    const results = listJournalEntries(testDb.adapter, { search: 'winter' });
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe('f-3');
  });
});

describe('Journal search edge cases', () => {
  it('returns empty for empty query string', () => {
    expect(searchJournalEntries(testDb.adapter, '')).toEqual([]);
  });

  it('returns empty for whitespace-only query', () => {
    expect(searchJournalEntries(testDb.adapter, '   ')).toEqual([]);
  });

  it('treats LIKE wildcards as literal characters', () => {
    createJournalEntry(testDb.adapter, 'pct-entry', {
      body: 'This has 100% success rate',
    });
    createJournalEntry(testDb.adapter, 'no-pct-entry', {
      body: 'This has no special characters',
    });
    // Searching for "%" should match only the entry containing a literal %
    const results = searchJournalEntries(testDb.adapter, '100%');
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe('pct-entry');

    // Searching for "_" should not match single-char wildcard
    const underscoreResults = searchJournalEntries(testDb.adapter, 'a_b');
    expect(underscoreResults).toHaveLength(0);
  });
});

describe('Multiple journals, prompts, and export', () => {
  it('creates multiple notebooks and scopes entries to a notebook', () => {
    createJournalNotebook(testDb.adapter, 'travel', {
      name: 'Travel',
      description: 'Trips and movement',
      isDefault: false,
    });
    createJournalEntry(testDb.adapter, 'travel-entry', {
      journalId: 'travel',
      entryDate: '2026-03-08',
      body: 'A long airport layover but a good view.',
      tags: ['travel'],
    });

    expect(listJournalNotebooks(testDb.adapter)).toHaveLength(2);
    expect(getJournalNotebookById(testDb.adapter, 'travel')?.name).toBe('Travel');
    expect(listJournalEntries(testDb.adapter, { journalId: 'travel' })).toHaveLength(1);
    expect(listJournalTags(testDb.adapter, 'travel').map((tag) => tag.name)).toEqual(['travel']);
  });

  it('returns on-this-day entries and exports notebook data', () => {
    createJournalNotebook(testDb.adapter, 'gratitude', {
      name: 'Gratitude',
      isDefault: false,
    });
    createJournalEntry(testDb.adapter, 'old-entry', {
      journalId: 'gratitude',
      entryDate: '2025-03-08',
      title: 'Last year',
      body: 'I felt calmer after a slow morning walk.',
      tags: ['memory'],
    });

    const onThisDay = listOnThisDayEntries(testDb.adapter, '2026-03-08', 'gratitude');
    expect(onThisDay).toHaveLength(1);
    expect(onThisDay[0].yearsAgo).toBe(1);

    const bundle = exportJournalData(testDb.adapter, 'gratitude');
    expect(bundle.journals).toHaveLength(1);
    expect(bundle.entries).toHaveLength(1);
    expect(serializeJournalExport(bundle, 'markdown')).toContain('# Last year');
    expect(serializeJournalExport(bundle, 'text')).toContain('Date: 2025-03-08');
  });

  it('generates deterministic daily prompts', () => {
    const prompt = getDailyJournalPrompt('2026-03-08', 'gratitude');
    expect(prompt.category).toBe('gratitude');
    expect(prompt.prompt.length).toBeGreaterThan(0);
  });
});

describe('Journal settings', () => {
  it('returns null for unknown setting key', () => {
    expect(getJournalSetting(testDb.adapter, 'nonexistent')).toBeNull();
  });

  it('overwrites existing setting value', () => {
    setJournalSetting(testDb.adapter, 'editorMode', 'plain');
    expect(getJournalSetting(testDb.adapter, 'editorMode')).toBe('plain');
    setJournalSetting(testDb.adapter, 'editorMode', 'markdown');
    expect(getJournalSetting(testDb.adapter, 'editorMode')).toBe('markdown');
  });
});

describe('Journal dashboard edge cases', () => {
  it('returns zeros for empty journal', () => {
    const dashboard = getJournalDashboard(testDb.adapter, '2026-03-08');
    expect(dashboard.entryCount).toBe(0);
    expect(dashboard.currentStreak).toBe(0);
    expect(dashboard.longestStreak).toBe(0);
    expect(dashboard.totalWords).toBe(0);
    expect(dashboard.monthlyWords).toBe(0);
    expect(dashboard.latestMood).toBeNull();
  });

  it('computes monthly words only for entries in the reference month', () => {
    createJournalEntry(testDb.adapter, 'jan-entry', {
      entryDate: '2026-01-15',
      body: 'January words here today',
    });
    createJournalEntry(testDb.adapter, 'mar-entry', {
      entryDate: '2026-03-08',
      body: 'March words',
    });

    const dashboard = getJournalDashboard(testDb.adapter, '2026-03-08');
    expect(dashboard.totalWords).toBe(6);
    expect(dashboard.monthlyWords).toBe(2);
  });
});
