import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { DatabaseAdapter } from '@mylife/db';
import { createModuleTestDatabase } from '@mylife/db';
import { MEDS_MODULE } from '../definition';
import { createMedicationExtended } from '../medication';
import { logDose } from '../reminders/scheduler';
import { createMoodEntry } from '../mood/check-in';
import { seedPredefinedSymptoms, getSymptoms, logSymptom } from '../mood/symptoms';
import {
  getMoodMedicationCorrelation,
  getAdherenceMoodCorrelation,
  getSymptomMedicationCorrelation,
  getOverallWellnessTimeline,
} from '../analytics/correlation';

describe('correlation analysis engine', () => {
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

  describe('getMoodMedicationCorrelation', () => {
    it('CRITICAL: returns before/after mood split around medication start', () => {
      // Insert medication with a known created_at date
      const startDate = '2026-01-15T00:00:00.000Z';
      adapter.execute(
        `INSERT INTO md_medications (id, name, frequency, pill_count, pills_per_dose, time_slots, is_active, sort_order, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, 1, 0, ?, ?)`,
        ['m1', 'Lexapro', 'daily', 30, 1, '["08:00"]', startDate, startDate],
      );

      // Before: mostly unpleasant mood
      for (let i = 1; i <= 5; i++) {
        const day = String(i).padStart(2, '0');
        createMoodEntry(adapter, `before-${i}`, {
          mood: 'anxious',
          energyLevel: 'high',
          pleasantness: 'unpleasant',
          recordedAt: `2026-01-${day}T10:00:00Z`,
        });
      }

      // After: mostly pleasant mood
      for (let i = 16; i <= 25; i++) {
        createMoodEntry(adapter, `after-${i}`, {
          mood: 'content',
          energyLevel: 'low',
          pleasantness: 'pleasant',
          recordedAt: `2026-01-${i}T10:00:00Z`,
        });
      }

      const corr = getMoodMedicationCorrelation(adapter, 'm1', 365);
      expect(corr).not.toBeNull();
      expect(corr!.medicationName).toBe('Lexapro');
      expect(corr!.beforeDataPoints).toBe(5);
      expect(corr!.afterDataPoints).toBe(10);
      expect(corr!.beforeAverage).toBeLessThan(0); // unpleasant = -1
      expect(corr!.afterAverage).toBeGreaterThan(0); // pleasant = +1
    });

    it('returns null for non-existent medication', () => {
      expect(getMoodMedicationCorrelation(adapter, 'nope')).toBeNull();
    });

    it('returns null averages when no mood data exists', () => {
      const startDate = '2026-01-15T00:00:00.000Z';
      adapter.execute(
        `INSERT INTO md_medications (id, name, frequency, pill_count, pills_per_dose, time_slots, is_active, sort_order, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, 1, 0, ?, ?)`,
        ['m1', 'Test', 'daily', 30, 1, '[]', startDate, startDate],
      );

      const corr = getMoodMedicationCorrelation(adapter, 'm1', 365);
      expect(corr!.beforeAverage).toBeNull();
      expect(corr!.afterAverage).toBeNull();
    });
  });

  describe('getAdherenceMoodCorrelation', () => {
    it('returns correlation coefficient between -1 and 1', () => {
      createMedicationExtended(adapter, 'm1', { name: 'Test', frequency: 'daily' });

      // Create paired data: adherent days with pleasant mood, missed days with unpleasant
      // Use recent dates relative to today so they fall within the 30-day window
      const today = new Date();
      for (let i = 1; i <= 10; i++) {
        const d = new Date(today);
        d.setDate(d.getDate() - (11 - i)); // days 11 down to 2 days ago
        const dateStr = d.toISOString().slice(0, 10);
        const taken = i <= 7;

        logDose(adapter, `dl-${i}`, {
          medicationId: 'm1',
          scheduledTime: `${dateStr}T08:00:00Z`,
          status: taken ? 'taken' : 'skipped',
        });

        createMoodEntry(adapter, `me-${i}`, {
          mood: taken ? 'happy' : 'sad',
          energyLevel: taken ? 'high' : 'low',
          pleasantness: taken ? 'pleasant' : 'unpleasant',
          recordedAt: `${dateStr}T20:00:00Z`,
        });
      }

      const corr = getAdherenceMoodCorrelation(adapter, 'm1', 30);
      expect(corr.correlationCoefficient).toBeGreaterThanOrEqual(-1);
      expect(corr.correlationCoefficient).toBeLessThanOrEqual(1);
      // With this data, adherence and mood should positively correlate
      expect(corr.correlationCoefficient).toBeGreaterThan(0);
      expect(corr.adherentDaysMoodAvg).toBeGreaterThan(0);
      expect(corr.missedDaysMoodAvg).toBeLessThan(0);
    });

    it('returns 0 coefficient with insufficient data', () => {
      createMedicationExtended(adapter, 'm1', { name: 'Test' });
      const corr = getAdherenceMoodCorrelation(adapter, 'm1', 30);
      expect(corr.correlationCoefficient).toBe(0);
    });
  });

  describe('getSymptomMedicationCorrelation', () => {
    it('returns symptom frequency changes before/after medication', () => {
      const startDate = '2026-01-15T00:00:00.000Z';
      adapter.execute(
        `INSERT INTO md_medications (id, name, frequency, pill_count, pills_per_dose, time_slots, is_active, sort_order, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, 1, 0, ?, ?)`,
        ['m1', 'Migraine Med', 'daily', 30, 1, '[]', startDate, startDate],
      );

      seedPredefinedSymptoms(adapter);
      const symptoms = getSymptoms(adapter);
      const headache = symptoms.find((s) => s.name === 'headache')!;

      // Log headaches before: 5 occurrences
      for (let i = 1; i <= 5; i++) {
        const day = String(i).padStart(2, '0');
        adapter.execute(
          `INSERT INTO md_symptom_logs (id, symptom_id, severity, logged_at, created_at)
           VALUES (?, ?, 3, ?, ?)`,
          [`sl-b${i}`, headache.id, `2026-01-${day}T12:00:00Z`, `2026-01-${day}T12:00:00Z`],
        );
      }

      // Log headaches after: 2 occurrences (reduced)
      for (let i = 16; i <= 17; i++) {
        adapter.execute(
          `INSERT INTO md_symptom_logs (id, symptom_id, severity, logged_at, created_at)
           VALUES (?, ?, 2, ?, ?)`,
          [`sl-a${i}`, headache.id, `2026-01-${i}T12:00:00Z`, `2026-01-${i}T12:00:00Z`],
        );
      }

      const corr = getSymptomMedicationCorrelation(adapter, 'm1', 365);
      expect(corr).not.toBeNull();
      expect(corr!.medicationName).toBe('Migraine Med');

      const headacheCorr = corr!.symptoms.find((s) => s.symptomName === 'headache');
      expect(headacheCorr).toBeDefined();
      expect(headacheCorr!.beforeCount).toBe(5);
      expect(headacheCorr!.afterCount).toBe(2);
      expect(headacheCorr!.changePercent).toBe(-60); // (2-5)/5 * 100
    });

    it('returns null for non-existent medication', () => {
      expect(getSymptomMedicationCorrelation(adapter, 'nope')).toBeNull();
    });
  });

  describe('getOverallWellnessTimeline', () => {
    it('returns daily entries with mood, adherence, and symptom count', () => {
      createMedicationExtended(adapter, 'm1', { name: 'Test' });

      // Day 1: mood entry + dose + symptom
      createMoodEntry(adapter, 'me1', {
        mood: 'happy',
        energyLevel: 'high',
        pleasantness: 'pleasant',
        recordedAt: '2026-01-01T10:00:00Z',
      });
      logDose(adapter, 'dl1', {
        medicationId: 'm1',
        scheduledTime: '2026-01-01T08:00:00Z',
        status: 'taken',
      });
      seedPredefinedSymptoms(adapter);
      const symptoms = getSymptoms(adapter);
      const headache = symptoms.find((s) => s.name === 'headache')!;
      adapter.execute(
        `INSERT INTO md_symptom_logs (id, symptom_id, severity, logged_at, created_at)
         VALUES (?, ?, 2, ?, ?)`,
        ['sl1', headache.id, '2026-01-01T14:00:00Z', '2026-01-01T14:00:00Z'],
      );

      const timeline = getOverallWellnessTimeline(adapter, '2026-01-01', '2026-01-03');
      expect(timeline).toHaveLength(3);

      // Day 1 has data
      expect(timeline[0].date).toBe('2026-01-01');
      expect(timeline[0].moodScore).toBe(1); // pleasant = 1
      expect(timeline[0].adherenceRate).toBe(100);
      expect(timeline[0].symptomCount).toBe(1);

      // Day 2 has no data
      expect(timeline[1].moodScore).toBeNull();
      expect(timeline[1].adherenceRate).toBe(100); // no doses = 100%
      expect(timeline[1].symptomCount).toBe(0);
    });
  });
});
