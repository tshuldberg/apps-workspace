import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createModuleTestDatabase, type InMemoryTestDatabase } from '@mylife/db';
import { MOOD_MODULE } from '../definition';
import {
  createMoodEntry,
  getMoodEntryById,
  getMoodEntries,
  getMoodEntriesByDate,
  deleteMoodEntry,
  getMoodEntryCount,
  getEmotionTagsForEntry,
  createActivity,
  getActivities,
  getActivityById,
  updateActivity,
  deleteActivity,
  getActivitiesForEntry,
  seedDefaultActivities,
  createBreathingSession,
  getBreathingSessions,
  getSetting,
  setSetting,
  getDailyAverages,
  getTopEmotions,
} from '../db/crud';

let testDb: InMemoryTestDatabase;

beforeEach(() => {
  testDb = createModuleTestDatabase('mood', MOOD_MODULE.migrations!);
});

afterEach(() => {
  testDb.close();
});

describe('Mood Entries', () => {
  it('creates a basic mood entry', () => {
    const entry = createMoodEntry(testDb.adapter, 'e1', { score: 7 });
    expect(entry.id).toBe('e1');
    expect(entry.score).toBe(7);
    expect(entry.note).toBeNull();
    expect(entry.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('creates an entry with note and emotions', () => {
    const entry = createMoodEntry(testDb.adapter, 'e2', {
      score: 8,
      note: 'Great morning walk',
      emotions: [
        { emotion: 'joy', intensity: 3 },
        { emotion: 'serenity', intensity: 2 },
      ],
    });
    expect(entry.score).toBe(8);
    expect(entry.note).toBe('Great morning walk');

    const tags = getEmotionTagsForEntry(testDb.adapter, 'e2');
    expect(tags).toHaveLength(2);
    expect(tags[0].emotion).toBe('joy');
    expect(tags[0].intensity).toBe(3);
  });

  it('creates an entry with activity tags', () => {
    const activity = createActivity(testDb.adapter, 'a1', { name: 'Exercise' });
    createMoodEntry(testDb.adapter, 'e3', {
      score: 9,
      activityIds: [activity.id],
    });
    const links = getActivitiesForEntry(testDb.adapter, 'e3');
    expect(links).toHaveLength(1);
    expect(links[0].activityId).toBe('a1');
  });

  it('validates score range', () => {
    expect(() => createMoodEntry(testDb.adapter, 'bad', { score: 0 })).toThrow();
    expect(() => createMoodEntry(testDb.adapter, 'bad', { score: 11 })).toThrow();
  });

  it('gets entry by id', () => {
    createMoodEntry(testDb.adapter, 'e4', { score: 5 });
    const found = getMoodEntryById(testDb.adapter, 'e4');
    expect(found).not.toBeNull();
    expect(found!.score).toBe(5);

    const notFound = getMoodEntryById(testDb.adapter, 'nope');
    expect(notFound).toBeNull();
  });

  it('lists entries with filters', () => {
    createMoodEntry(testDb.adapter, 'e5', { score: 3, loggedAt: '2026-03-01T10:00:00Z' });
    createMoodEntry(testDb.adapter, 'e6', { score: 8, loggedAt: '2026-03-02T10:00:00Z' });
    createMoodEntry(testDb.adapter, 'e7', { score: 6, loggedAt: '2026-03-03T10:00:00Z' });

    const all = getMoodEntries(testDb.adapter);
    expect(all).toHaveLength(3);

    const highOnly = getMoodEntries(testDb.adapter, { minScore: 7 });
    expect(highOnly).toHaveLength(1);
    expect(highOnly[0].score).toBe(8);

    const dateRange = getMoodEntries(testDb.adapter, {
      startDate: '2026-03-01',
      endDate: '2026-03-02',
    });
    expect(dateRange).toHaveLength(2);
  });

  it('gets entries by date', () => {
    createMoodEntry(testDb.adapter, 'e8', { score: 4, loggedAt: '2026-03-05T08:00:00Z' });
    createMoodEntry(testDb.adapter, 'e9', { score: 7, loggedAt: '2026-03-05T12:00:00Z' });
    createMoodEntry(testDb.adapter, 'e10', { score: 9, loggedAt: '2026-03-06T08:00:00Z' });

    const march5 = getMoodEntriesByDate(testDb.adapter, '2026-03-05');
    expect(march5).toHaveLength(2);
  });

  it('deletes an entry and cascades to emotion tags', () => {
    createMoodEntry(testDb.adapter, 'e11', {
      score: 5,
      emotions: [{ emotion: 'sadness', intensity: 2 }],
    });
    expect(getEmotionTagsForEntry(testDb.adapter, 'e11')).toHaveLength(1);

    deleteMoodEntry(testDb.adapter, 'e11');
    expect(getMoodEntryById(testDb.adapter, 'e11')).toBeNull();
    expect(getEmotionTagsForEntry(testDb.adapter, 'e11')).toHaveLength(0);
  });

  it('counts total entries', () => {
    expect(getMoodEntryCount(testDb.adapter)).toBe(0);
    createMoodEntry(testDb.adapter, 'c1', { score: 5 });
    createMoodEntry(testDb.adapter, 'c2', { score: 7 });
    expect(getMoodEntryCount(testDb.adapter)).toBe(2);
  });
});

describe('Activities', () => {
  it('creates and retrieves an activity', () => {
    const a = createActivity(testDb.adapter, 'a1', {
      name: 'Exercise',
      icon: 'dumbbell',
      category: 'health',
    });
    expect(a.name).toBe('Exercise');
    expect(a.isDefault).toBe(false);

    const found = getActivityById(testDb.adapter, 'a1');
    expect(found).not.toBeNull();
    expect(found!.icon).toBe('dumbbell');
  });

  it('lists activities sorted by sort_order', () => {
    createActivity(testDb.adapter, 'a2', { name: 'Zzz', sortOrder: 2 });
    createActivity(testDb.adapter, 'a3', { name: 'Aaa', sortOrder: 1 });
    const list = getActivities(testDb.adapter);
    expect(list[0].name).toBe('Aaa');
    expect(list[1].name).toBe('Zzz');
  });

  it('updates an activity', () => {
    createActivity(testDb.adapter, 'a4', { name: 'Old' });
    const updated = updateActivity(testDb.adapter, 'a4', { name: 'New' });
    expect(updated!.name).toBe('New');
  });

  it('deletes an activity', () => {
    createActivity(testDb.adapter, 'a5', { name: 'Temp' });
    deleteActivity(testDb.adapter, 'a5');
    expect(getActivityById(testDb.adapter, 'a5')).toBeNull();
  });

  it('seeds default activities only once', () => {
    seedDefaultActivities(testDb.adapter);
    const first = getActivities(testDb.adapter);
    expect(first.length).toBeGreaterThan(0);

    seedDefaultActivities(testDb.adapter);
    const second = getActivities(testDb.adapter);
    expect(second.length).toBe(first.length);
  });
});

describe('Breathing Sessions', () => {
  it('creates and retrieves a breathing session', () => {
    const s = createBreathingSession(testDb.adapter, 'b1', {
      pattern: 'box',
      durationSeconds: 240,
      cyclesCompleted: 15,
    });
    expect(s.pattern).toBe('box');
    expect(s.cyclesCompleted).toBe(15);

    const list = getBreathingSessions(testDb.adapter);
    expect(list).toHaveLength(1);
    expect(list[0].id).toBe('b1');
  });
});

describe('Settings', () => {
  it('gets and sets settings', () => {
    expect(getSetting(testDb.adapter, 'theme')).toBeNull();
    setSetting(testDb.adapter, 'theme', 'dark');
    expect(getSetting(testDb.adapter, 'theme')).toBe('dark');
    setSetting(testDb.adapter, 'theme', 'light');
    expect(getSetting(testDb.adapter, 'theme')).toBe('light');
  });
});

describe('Analytics', () => {
  it('calculates daily averages', () => {
    createMoodEntry(testDb.adapter, 'd1', { score: 4, loggedAt: '2026-03-01T08:00:00Z' });
    createMoodEntry(testDb.adapter, 'd2', { score: 6, loggedAt: '2026-03-01T12:00:00Z' });
    createMoodEntry(testDb.adapter, 'd3', { score: 8, loggedAt: '2026-03-02T08:00:00Z' });

    const avgs = getDailyAverages(testDb.adapter, '2026-03-01', '2026-03-02');
    expect(avgs).toHaveLength(2);
    expect(avgs[0].date).toBe('2026-03-01');
    expect(avgs[0].average).toBe(5);
    expect(avgs[0].count).toBe(2);
    expect(avgs[1].average).toBe(8);
  });

  it('returns top emotions for a date range', () => {
    createMoodEntry(testDb.adapter, 'te1', {
      score: 7,
      loggedAt: '2026-03-01T10:00:00Z',
      emotions: [{ emotion: 'joy', intensity: 3 }, { emotion: 'serenity', intensity: 1 }],
    });
    createMoodEntry(testDb.adapter, 'te2', {
      score: 3,
      loggedAt: '2026-03-02T10:00:00Z',
      emotions: [{ emotion: 'sadness', intensity: 2 }, { emotion: 'joy', intensity: 1 }],
    });

    const top = getTopEmotions(testDb.adapter, '2026-03-01', '2026-03-02');
    expect(top[0].emotion).toBe('joy');
    expect(top[0].count).toBe(2);
  });
});
