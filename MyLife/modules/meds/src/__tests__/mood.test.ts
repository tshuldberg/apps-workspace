import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { DatabaseAdapter } from '@mylife/db';
import { createModuleTestDatabase } from '@mylife/db';
import { MEDS_MODULE } from '../definition';
import {
  createMoodEntry,
  getMoodEntries,
  getMoodEntryById,
  deleteMoodEntry,
  getDailyMoodSummary,
  addActivity,
  getActivities,
  removeActivity,
  seedPredefinedSymptoms,
  getSymptoms,
  createCustomSymptom,
  logSymptom,
  getSymptomLogs,
  getMoodCalendar,
  getMoodCalendarMonth,
  getDayDetail,
} from '../mood';

describe('mood, activities, symptoms, and calendar', () => {
  let adapter: DatabaseAdapter;
  let closeDb: () => void;

  beforeEach(() => {
    const testDb = createModuleTestDatabase('meds', MEDS_MODULE.migrations!);
    adapter = testDb.adapter;
    closeDb = testDb.close;
  });

  afterEach(() => {
    closeDb();
  });

  describe('createMoodEntry', () => {
    it('creates a mood entry with all fields', () => {
      createMoodEntry(adapter, 'me1', {
        mood: 'content',
        energyLevel: 'high',
        pleasantness: 'pleasant',
        intensity: 4,
        notes: 'Good morning',
        recordedAt: '2026-01-15T09:00:00Z',
      });

      const entry = getMoodEntryById(adapter, 'me1');
      expect(entry).not.toBeNull();
      expect(entry!.mood).toBe('content');
      expect(entry!.energyLevel).toBe('high');
      expect(entry!.pleasantness).toBe('pleasant');
      expect(entry!.intensity).toBe(4);
      expect(entry!.notes).toBe('Good morning');
    });

    it('defaults intensity to 3', () => {
      createMoodEntry(adapter, 'me1', {
        mood: 'calm',
        energyLevel: 'low',
        pleasantness: 'pleasant',
      });

      const entry = getMoodEntryById(adapter, 'me1');
      expect(entry!.intensity).toBe(3);
    });
  });

  describe('getMoodEntries', () => {
    it('returns entries ordered by recorded_at descending', () => {
      createMoodEntry(adapter, 'me1', {
        mood: 'happy',
        energyLevel: 'high',
        pleasantness: 'pleasant',
        recordedAt: '2026-01-10T08:00:00Z',
      });
      createMoodEntry(adapter, 'me2', {
        mood: 'sad',
        energyLevel: 'low',
        pleasantness: 'unpleasant',
        recordedAt: '2026-01-15T08:00:00Z',
      });

      const entries = getMoodEntries(adapter);
      expect(entries).toHaveLength(2);
      expect(entries[0].mood).toBe('sad'); // newest first
    });

    it('filters by date range', () => {
      createMoodEntry(adapter, 'me1', {
        mood: 'happy',
        energyLevel: 'high',
        pleasantness: 'pleasant',
        recordedAt: '2026-01-05T08:00:00Z',
      });
      createMoodEntry(adapter, 'me2', {
        mood: 'calm',
        energyLevel: 'low',
        pleasantness: 'pleasant',
        recordedAt: '2026-01-15T08:00:00Z',
      });

      const filtered = getMoodEntries(adapter, '2026-01-10');
      expect(filtered).toHaveLength(1);
      expect(filtered[0].mood).toBe('calm');
    });
  });

  describe('getMoodEntryById', () => {
    it('returns null for non-existent entry', () => {
      expect(getMoodEntryById(adapter, 'nope')).toBeNull();
    });
  });

  describe('deleteMoodEntry', () => {
    it('removes the entry', () => {
      createMoodEntry(adapter, 'me1', {
        mood: 'happy',
        energyLevel: 'high',
        pleasantness: 'pleasant',
      });

      deleteMoodEntry(adapter, 'me1');
      expect(getMoodEntryById(adapter, 'me1')).toBeNull();
    });
  });

  describe('getDailyMoodSummary', () => {
    it('returns summary for a day with entries', () => {
      createMoodEntry(adapter, 'me1', {
        mood: 'excited',
        energyLevel: 'high',
        pleasantness: 'pleasant',
        intensity: 5,
        recordedAt: '2026-01-15T09:00:00Z',
      });
      createMoodEntry(adapter, 'me2', {
        mood: 'calm',
        energyLevel: 'low',
        pleasantness: 'pleasant',
        intensity: 3,
        recordedAt: '2026-01-15T21:00:00Z',
      });

      addActivity(adapter, 'a1', 'me1', 'exercise');

      const summary = getDailyMoodSummary(adapter, '2026-01-15');
      expect(summary.entries).toHaveLength(2);
      expect(summary.dominantMood).toBe('calm'); // most recent (sorted desc)
      expect(summary.averageIntensity).toBe(4); // (5+3)/2
      expect(summary.activities).toContain('exercise');
    });

    it('returns null values for empty day', () => {
      const summary = getDailyMoodSummary(adapter, '2026-01-15');
      expect(summary.entries).toHaveLength(0);
      expect(summary.dominantMood).toBeNull();
      expect(summary.averageIntensity).toBeNull();
    });
  });

  describe('activities', () => {
    it('adds and retrieves activities for a mood entry', () => {
      createMoodEntry(adapter, 'me1', {
        mood: 'happy',
        energyLevel: 'high',
        pleasantness: 'pleasant',
      });

      addActivity(adapter, 'a1', 'me1', 'exercise');
      addActivity(adapter, 'a2', 'me1', 'meditation');

      const activities = getActivities(adapter, 'me1');
      expect(activities).toHaveLength(2);
      expect(activities[0].activity).toBe('exercise');
      expect(activities[1].activity).toBe('meditation');
    });

    it('removes an activity by ID', () => {
      createMoodEntry(adapter, 'me1', {
        mood: 'happy',
        energyLevel: 'high',
        pleasantness: 'pleasant',
      });

      addActivity(adapter, 'a1', 'me1', 'exercise');
      removeActivity(adapter, 'a1');

      expect(getActivities(adapter, 'me1')).toHaveLength(0);
    });
  });

  describe('symptoms', () => {
    it('seeds predefined symptoms', () => {
      seedPredefinedSymptoms(adapter);

      const symptoms = getSymptoms(adapter);
      expect(symptoms.length).toBeGreaterThanOrEqual(12); // 12 predefined
      expect(symptoms.some((s) => s.name === 'headache')).toBe(true);
      expect(symptoms.some((s) => s.name === 'nausea')).toBe(true);
    });

    it('seedPredefinedSymptoms is idempotent', () => {
      seedPredefinedSymptoms(adapter);
      const count1 = getSymptoms(adapter).length;
      seedPredefinedSymptoms(adapter);
      const count2 = getSymptoms(adapter).length;
      expect(count2).toBe(count1);
    });

    it('creates a custom symptom', () => {
      createCustomSymptom(adapter, 'cs1', 'tingling');

      const symptoms = getSymptoms(adapter);
      const custom = symptoms.find((s) => s.name === 'tingling');
      expect(custom).toBeDefined();
      expect(custom!.isCustom).toBe(true);
    });

    it('logs a symptom', () => {
      seedPredefinedSymptoms(adapter);
      const symptoms = getSymptoms(adapter);
      const headache = symptoms.find((s) => s.name === 'headache')!;

      logSymptom(adapter, 'sl1', headache.id, 3, 'Mild headache after lunch');

      const logs = getSymptomLogs(adapter);
      expect(logs).toHaveLength(1);
      expect(logs[0].symptomId).toBe(headache.id);
      expect(logs[0].severity).toBe(3);
      expect(logs[0].notes).toBe('Mild headache after lunch');
    });

    it('filters symptom logs by date range', () => {
      seedPredefinedSymptoms(adapter);
      const symptoms = getSymptoms(adapter);
      const headache = symptoms.find((s) => s.name === 'headache')!;

      logSymptom(adapter, 'sl1', headache.id, 2);

      // Log was created "now", so filtering future should be empty
      const logsFiltered = getSymptomLogs(adapter, '2099-01-01');
      expect(logsFiltered).toHaveLength(0);
    });
  });

  describe('mood calendar', () => {
    it('getMoodCalendar returns 365/366 entries for a year', () => {
      createMoodEntry(adapter, 'me1', {
        mood: 'happy',
        energyLevel: 'high',
        pleasantness: 'pleasant',
        recordedAt: '2026-06-15T10:00:00Z',
      });

      const calendar = getMoodCalendar(adapter, 2026);
      expect(calendar).toHaveLength(365);

      const june15 = calendar.find((d) => d.date === '2026-06-15');
      expect(june15!.hasData).toBe(true);
      expect(june15!.dominantMood).toBe('happy');
      expect(june15!.pleasantness).toBe('pleasant');

      const jan1 = calendar.find((d) => d.date === '2026-01-01');
      expect(jan1!.hasData).toBe(false);
      expect(jan1!.dominantMood).toBeNull();
    });

    it('getMoodCalendarMonth returns entries for a single month', () => {
      createMoodEntry(adapter, 'me1', {
        mood: 'happy',
        energyLevel: 'high',
        pleasantness: 'pleasant',
        recordedAt: '2026-03-10T10:00:00Z',
      });

      const month = getMoodCalendarMonth(adapter, 2026, 3);
      expect(month).toHaveLength(31); // March has 31 days

      const mar10 = month.find((d) => d.date === '2026-03-10');
      expect(mar10!.hasData).toBe(true);
    });
  });

  describe('getDayDetail', () => {
    it('returns entries, activities, and symptoms for a day', () => {
      createMoodEntry(adapter, 'me1', {
        mood: 'happy',
        energyLevel: 'high',
        pleasantness: 'pleasant',
        recordedAt: '2026-01-15T09:00:00Z',
      });

      addActivity(adapter, 'a1', 'me1', 'walking');

      seedPredefinedSymptoms(adapter);
      const symptoms = getSymptoms(adapter);
      const headache = symptoms.find((s) => s.name === 'headache')!;

      // Insert symptom log with matching date
      adapter.execute(
        `INSERT INTO md_symptom_logs (id, symptom_id, severity, notes, logged_at, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        ['sl1', headache.id, 2, null, '2026-01-15T14:00:00Z', '2026-01-15T14:00:00Z'],
      );

      const detail = getDayDetail(adapter, '2026-01-15');
      expect(detail.entries).toHaveLength(1);
      expect(detail.activities).toHaveLength(1);
      expect(detail.activities[0].activity).toBe('walking');
      expect(detail.symptoms).toHaveLength(1);
      expect(detail.symptoms[0].symptomId).toBe(headache.id);
    });

    it('returns empty arrays for a day with no data', () => {
      const detail = getDayDetail(adapter, '2026-01-15');
      expect(detail.entries).toHaveLength(0);
      expect(detail.activities).toHaveLength(0);
      expect(detail.symptoms).toHaveLength(0);
    });
  });
});
