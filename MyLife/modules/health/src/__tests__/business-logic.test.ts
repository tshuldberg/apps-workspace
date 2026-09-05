import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { DatabaseAdapter } from '@mylife/db';
import { createModuleTestDatabase } from '@mylife/db';
import { HEALTH_MODULE } from '../definition';
import {
  createDocument,
  getDocuments,
  getDocument,
  getDocumentsByType,
  getStarredDocuments,
  updateDocument,
  deleteDocument,
  MAX_DOCUMENT_SIZE,
} from '../documents/crud';
import {
  logVital,
  getVitals,
  getVitalsByType,
  getVitalAggregates,
  getLatestVital,
  deleteVital,
} from '../vitals/crud';
import {
  logSleep,
  getSleepSessions,
  getLastNightSleep,
  computeQualityScore,
  deleteSleepSession,
} from '../sleep/crud';
import {
  createGoal,
  getActiveGoals,
  getGoalById,
  deactivateGoal,
  deleteGoal,
  recordProgress,
  getGoalProgress,
} from '../goals/crud';
import {
  getEmergencyInfo,
  updateEmergencyInfo,
} from '../emergency/crud';
import {
  getHealthSetting,
  setHealthSetting,
  getAllHealthSettings,
  isHealthSyncEnabled,
  setHealthSyncToggle,
} from '../settings';

describe('health business logic', () => {
  let db: DatabaseAdapter;
  let closeDb: () => void;

  beforeEach(() => {
    const testDb = createModuleTestDatabase('health', HEALTH_MODULE.migrations!);
    db = testDb.adapter;
    closeDb = testDb.close;
  });

  afterEach(() => {
    closeDb();
  });

  // --- Documents ---

  describe('documents', () => {
    const sampleContent = new Uint8Array([0x25, 0x50, 0x44, 0x46]); // %PDF

    it('creates and retrieves a document', () => {
      const id = createDocument(db, {
        title: 'Blood Test Results',
        type: 'lab_result',
        mime_type: 'application/pdf',
        content: sampleContent,
        notes: 'Annual checkup',
        document_date: '2026-03-01',
        tags: ['annual', 'blood'],
      });

      expect(id).toBeTruthy();

      const doc = getDocument(db, id);
      expect(doc).not.toBeNull();
      expect(doc!.title).toBe('Blood Test Results');
      expect(doc!.type).toBe('lab_result');
      expect(doc!.file_size).toBe(4);
      expect(doc!.notes).toBe('Annual checkup');
    });

    it('lists documents without content blob', () => {
      createDocument(db, {
        title: 'Doc 1',
        type: 'lab_result',
        mime_type: 'application/pdf',
        content: sampleContent,
      });

      const docs = getDocuments(db);
      expect(docs).toHaveLength(1);
      expect(docs[0]).not.toHaveProperty('content');
    });

    it('filters by type', () => {
      createDocument(db, { title: 'Lab', type: 'lab_result', mime_type: 'application/pdf', content: sampleContent });
      createDocument(db, { title: 'Insurance', type: 'insurance', mime_type: 'image/jpeg', content: sampleContent });

      const labs = getDocumentsByType(db, 'lab_result');
      expect(labs).toHaveLength(1);
      expect(labs[0].title).toBe('Lab');
    });

    it('stars and retrieves starred documents', () => {
      const id = createDocument(db, { title: 'Important', type: 'prescription', mime_type: 'application/pdf', content: sampleContent });
      updateDocument(db, id, { is_starred: true });

      const starred = getStarredDocuments(db);
      expect(starred).toHaveLength(1);
      expect(starred[0].is_starred).toBe(1);
    });

    it('deletes a document', () => {
      const id = createDocument(db, { title: 'Temp', type: 'other', mime_type: 'text/plain', content: sampleContent });
      deleteDocument(db, id);
      expect(getDocument(db, id)).toBeNull();
    });

    it('rejects documents exceeding max size', () => {
      const bigContent = new Uint8Array(MAX_DOCUMENT_SIZE + 1);
      expect(() => createDocument(db, {
        title: 'Too Big',
        type: 'other',
        mime_type: 'application/octet-stream',
        content: bigContent,
      })).toThrow('exceeds maximum size');
    });
  });

  // --- Vitals ---

  describe('vitals', () => {
    it('logs and retrieves a vital', () => {
      const id = logVital(db, {
        vital_type: 'heart_rate',
        value: 72,
        unit: 'bpm',
        source: 'manual',
      });

      expect(id).toBeTruthy();
      const vitals = getVitals(db);
      expect(vitals).toHaveLength(1);
      expect(vitals[0].vital_type).toBe('heart_rate');
      expect(vitals[0].value).toBe(72);
    });

    it('filters by type', () => {
      logVital(db, { vital_type: 'heart_rate', value: 72, unit: 'bpm' });
      logVital(db, { vital_type: 'steps', value: 8000, unit: 'steps' });

      const hrOnly = getVitalsByType(db, 'heart_rate');
      expect(hrOnly).toHaveLength(1);
    });

    it('gets latest vital', () => {
      logVital(db, { vital_type: 'heart_rate', value: 70, unit: 'bpm', recorded_at: '2026-03-01T08:00:00Z' });
      logVital(db, { vital_type: 'heart_rate', value: 75, unit: 'bpm', recorded_at: '2026-03-01T12:00:00Z' });

      const latest = getLatestVital(db, 'heart_rate');
      expect(latest).not.toBeNull();
      expect(latest!.value).toBe(75);
    });

    it('computes daily aggregates', () => {
      logVital(db, { vital_type: 'heart_rate', value: 60, unit: 'bpm', recorded_at: new Date().toISOString() });
      logVital(db, { vital_type: 'heart_rate', value: 80, unit: 'bpm', recorded_at: new Date().toISOString() });

      const aggs = getVitalAggregates(db, 'heart_rate', 7);
      expect(aggs).toHaveLength(1);
      expect(aggs[0].avg).toBe(70);
      expect(aggs[0].min).toBe(60);
      expect(aggs[0].max).toBe(80);
      expect(aggs[0].count).toBe(2);
    });

    it('logs blood pressure with secondary value', () => {
      logVital(db, {
        vital_type: 'blood_pressure',
        value: 120,
        value_secondary: 80,
        unit: 'mmHg',
      });

      const latest = getLatestVital(db, 'blood_pressure');
      expect(latest!.value).toBe(120);
      expect(latest!.value_secondary).toBe(80);
    });

    it('deletes a vital', () => {
      const id = logVital(db, { vital_type: 'steps', value: 5000, unit: 'steps' });
      deleteVital(db, id);
      expect(getVitals(db)).toHaveLength(0);
    });
  });

  // --- Sleep ---

  describe('sleep', () => {
    it('logs a sleep session with quality score', () => {
      const id = logSleep(db, {
        start_time: '2026-03-01T22:00:00Z',
        end_time: '2026-03-02T06:00:00Z',
        deep_minutes: 90,
        rem_minutes: 110,
        awake_minutes: 20,
      });

      expect(id).toBeTruthy();
      const sessions = getSleepSessions(db);
      expect(sessions).toHaveLength(1);
      expect(sessions[0].duration_minutes).toBe(480);
      expect(sessions[0].quality_score).toBeGreaterThan(0);
    });

    it('gets last night sleep', () => {
      logSleep(db, {
        start_time: '2026-02-28T23:00:00Z',
        end_time: '2026-03-01T07:00:00Z',
      });
      logSleep(db, {
        start_time: '2026-03-01T22:00:00Z',
        end_time: '2026-03-02T06:30:00Z',
      });

      const last = getLastNightSleep(db);
      expect(last).not.toBeNull();
      expect(last!.duration_minutes).toBe(510);
    });

    it('deletes a sleep session', () => {
      const id = logSleep(db, {
        start_time: '2026-03-01T22:00:00Z',
        end_time: '2026-03-02T06:00:00Z',
      });
      deleteSleepSession(db, id);
      expect(getSleepSessions(db)).toHaveLength(0);
    });
  });

  describe('computeQualityScore', () => {
    it('returns high score for ideal sleep', () => {
      // 8 hours, 20% deep, 25% REM, minimal awake
      const score = computeQualityScore(480, 96, 120, 10);
      expect(score).toBeGreaterThan(85);
    });

    it('returns lower score for short sleep', () => {
      const idealScore = computeQualityScore(480, 96, 120, 10);
      const shortScore = computeQualityScore(300, 60, 75, 10);
      expect(shortScore).toBeLessThan(idealScore);
    });

    it('handles no stage breakdown', () => {
      const score = computeQualityScore(480, null, null, null);
      expect(score).toBeGreaterThan(90);
    });
  });

  // --- Goals ---

  describe('goals', () => {
    it('creates and retrieves a goal', () => {
      const id = createGoal(db, {
        domain: 'steps',
        metric: 'daily_steps',
        target_value: 10000,
        unit: 'steps',
        period: 'daily',
        direction: 'at_least',
        label: '10K Steps Daily',
      });

      expect(id).toBeTruthy();
      const goals = getActiveGoals(db);
      expect(goals).toHaveLength(1);
      expect(goals[0].domain).toBe('steps');
      expect(goals[0].target_value).toBe(10000);
    });

    it('deactivates a goal', () => {
      const id = createGoal(db, { domain: 'fasting', metric: 'weekly_fasts', target_value: 5 });
      deactivateGoal(db, id);

      const active = getActiveGoals(db);
      expect(active).toHaveLength(0);

      const goal = getGoalById(db, id);
      expect(goal!.is_active).toBe(0);
    });

    it('records and evaluates progress (at_least)', () => {
      const goalId = createGoal(db, {
        domain: 'steps',
        metric: 'daily_steps',
        target_value: 10000,
        direction: 'at_least',
      });

      recordProgress(db, goalId, '2026-03-01', '2026-03-01', 12000, 10000);
      const progress = getGoalProgress(db, goalId);
      expect(progress).toHaveLength(1);
      expect(progress[0].completed).toBe(1);
    });

    it('records and evaluates progress (at_most)', () => {
      const goalId = createGoal(db, {
        domain: 'weight',
        metric: 'body_weight',
        target_value: 180,
        direction: 'at_most',
      });

      recordProgress(db, goalId, '2026-03-01', '2026-03-01', 175, 180);
      const progress = getGoalProgress(db, goalId);
      expect(progress[0].completed).toBe(1);
    });

    it('deletes a goal and its progress', () => {
      const goalId = createGoal(db, { domain: 'sleep', metric: 'hours', target_value: 8 });
      recordProgress(db, goalId, '2026-03-01', '2026-03-01', 7.5, 8);
      deleteGoal(db, goalId);

      expect(getGoalById(db, goalId)).toBeNull();
      expect(getGoalProgress(db, goalId)).toHaveLength(0);
    });
  });

  // --- Emergency Info ---

  describe('emergency info', () => {
    it('creates and retrieves emergency info', () => {
      updateEmergencyInfo(db, {
        full_name: 'John Doe',
        blood_type: 'O+',
        allergies: 'Penicillin, Shellfish',
        organ_donor: true,
      });

      const info = getEmergencyInfo(db);
      expect(info).not.toBeNull();
      expect(info!.full_name).toBe('John Doe');
      expect(info!.blood_type).toBe('O+');
      expect(info!.allergies).toBe('Penicillin, Shellfish');
      expect(info!.organ_donor).toBe(1);
    });

    it('updates existing emergency info', () => {
      updateEmergencyInfo(db, { full_name: 'Jane' });
      updateEmergencyInfo(db, { blood_type: 'A-', primary_physician: 'Dr. Smith' });

      const info = getEmergencyInfo(db);
      expect(info!.full_name).toBe('Jane');
      expect(info!.blood_type).toBe('A-');
      expect(info!.primary_physician).toBe('Dr. Smith');
    });

    it('returns null when no profile exists', () => {
      expect(getEmergencyInfo(db)).toBeNull();
    });
  });

  // --- Settings ---

  describe('settings', () => {
    it('reads seeded default settings', () => {
      const value = getHealthSetting(db, 'healthSync.enabled');
      expect(value).toBe('false');
    });

    it('sets and gets a custom setting', () => {
      setHealthSetting(db, 'custom.key', 'custom_value');
      expect(getHealthSetting(db, 'custom.key')).toBe('custom_value');
    });

    it('gets all settings', () => {
      const all = getAllHealthSettings(db);
      expect(Object.keys(all).length).toBeGreaterThanOrEqual(18);
      expect(all['healthSync.enabled']).toBe('false');
    });

    it('toggles health sync for a data type', () => {
      expect(isHealthSyncEnabled(db, 'heartRate')).toBe(true); // seeded as true
      setHealthSyncToggle(db, 'heartRate', false);
      expect(isHealthSyncEnabled(db, 'heartRate')).toBe(false);
    });
  });
});
