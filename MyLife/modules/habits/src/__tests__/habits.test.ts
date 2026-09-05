import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { DatabaseAdapter } from '@mylife/db';
import { createModuleTestDatabase } from '@mylife/db';
import { HABITS_MODULE } from '../definition';
import {
  createHabit,
  getHabits,
  getHabitById,
  updateHabit,
  deleteHabit,
  countHabits,
  recordCompletion,
  getCompletions,
  getCompletionsForDate,
  deleteCompletion,
  getStreaks,
  getSetting,
  setSetting,
} from '../db/crud';
import { ensurePetState, feedPet, getPetCareState, getPetHistory, playWithPet, restPet } from '../db/pet';
import { getStreaksWithGrace, getNegativeStreaks, getMeasurableStreaks } from '../db/streaks';
import { startSession, endSession, getSessionsForHabit, getSessionsForDate } from '../db/timed-sessions';
import { recordMeasurement, getMeasurementsForHabit, getMeasurementsForDate } from '../db/measurements';
import { getHeatmapData, getHeatmapRange } from '../heatmap';
import { getYearlyStats, getOverallStats } from '../stats';
import { exportHabitsCSV, exportCompletionsCSV, exportAllCSV } from '../export';
// Cycle tracking (periods, symptoms, predictions) has been removed from
// @mylife/habits as part of Phase 0 Fix 1. The underlying hb_periods,
// hb_period_symptoms, hb_predictions, and hb_cycle_settings tables are dropped
// by V8. Cycle tracking now lives in @mylife/cycle with cy_* tables.
// See docs/plans/consolidation/phase-0-research.md.

describe('@mylife/habits', () => {
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

  // ── Module definition ──────────────────────────────────────────────────

  describe('HABITS_MODULE definition', () => {
    it('has correct metadata', () => {
      expect(HABITS_MODULE.id).toBe('habits');
      expect(HABITS_MODULE.tier).toBe('premium');
      expect(HABITS_MODULE.storageType).toBe('sqlite');
      expect(HABITS_MODULE.tablePrefix).toBe('hb_');
      expect(HABITS_MODULE.schemaVersion).toBe(8);
    });

    it('has 4 navigation tabs', () => {
      expect(HABITS_MODULE.navigation.tabs).toHaveLength(4);
    });

    it('has habit-stack screen', () => {
      const screen = HABITS_MODULE.navigation.screens.find((s) => s.name === 'habit-stack');
      expect(screen).toBeDefined();
    });
  });

  // ── Seeded data ────────────────────────────────────────────────────────

  describe('seeded data', () => {
    it('has default settings', () => {
      expect(getSetting(adapter, 'weekStartsOn')).toBe('monday');
    });
  });

  // ── Habits CRUD ────────────────────────────────────────────────────────

  describe('habits CRUD', () => {
    it('starts empty', () => {
      expect(countHabits(adapter)).toBe(0);
    });

    it('creates and retrieves a habit', () => {
      createHabit(adapter, 'h1', { name: 'Meditate' });
      expect(countHabits(adapter)).toBe(1);
      const h = getHabitById(adapter, 'h1');
      expect(h).not.toBeNull();
      expect(h!.name).toBe('Meditate');
      expect(h!.frequency).toBe('daily');
      expect(h!.targetCount).toBe(1);
      expect(h!.habitType).toBe('standard');
      expect(h!.timeOfDay).toBe('anytime');
      expect(h!.gracePeriod).toBe(0);
    });

    it('creates a habit with V2 fields', () => {
      createHabit(adapter, 'h1', {
        name: 'Meditation Timer',
        habitType: 'timed',
        timeOfDay: 'morning',
        specificDays: ['mon', 'wed', 'fri'],
        gracePeriod: 1,
        reminderTime: '08:00',
        description: 'Morning meditation',
      });
      const h = getHabitById(adapter, 'h1');
      expect(h!.habitType).toBe('timed');
      expect(h!.timeOfDay).toBe('morning');
      expect(h!.specificDays).toEqual(['mon', 'wed', 'fri']);
      expect(h!.gracePeriod).toBe(1);
      expect(h!.reminderTime).toBe('08:00');
      expect(h!.description).toBe('Morning meditation');
    });

    it('lists habits filtering by archived', () => {
      createHabit(adapter, 'h1', { name: 'Active' });
      createHabit(adapter, 'h2', { name: 'Archived' });
      updateHabit(adapter, 'h2', { isArchived: true });
      expect(getHabits(adapter, { isArchived: false })).toHaveLength(1);
      expect(getHabits(adapter, { isArchived: true })).toHaveLength(1);
      expect(getHabits(adapter)).toHaveLength(2);
    });

    it('updates a habit with V2 fields', () => {
      createHabit(adapter, 'h1', { name: 'Old' });
      updateHabit(adapter, 'h1', {
        name: 'New',
        targetCount: 3,
        habitType: 'negative',
        timeOfDay: 'evening',
        gracePeriod: 2,
      });
      const h = getHabitById(adapter, 'h1');
      expect(h!.name).toBe('New');
      expect(h!.targetCount).toBe(3);
      expect(h!.habitType).toBe('negative');
      expect(h!.timeOfDay).toBe('evening');
      expect(h!.gracePeriod).toBe(2);
    });

    it('deletes a habit', () => {
      createHabit(adapter, 'h1', { name: 'Test' });
      deleteHabit(adapter, 'h1');
      expect(countHabits(adapter)).toBe(0);
    });
  });

  // ── Completions ────────────────────────────────────────────────────────

  describe('completions', () => {
    it('records and retrieves completions', () => {
      createHabit(adapter, 'h1', { name: 'Exercise' });
      recordCompletion(adapter, 'c1', 'h1', '2026-01-15T08:00:00Z');
      recordCompletion(adapter, 'c2', 'h1', '2026-01-16T08:00:00Z');
      const completions = getCompletions(adapter, 'h1');
      expect(completions).toHaveLength(2);
    });

    it('filters completions by date range', () => {
      createHabit(adapter, 'h1', { name: 'Read' });
      recordCompletion(adapter, 'c1', 'h1', '2026-01-10T08:00:00Z');
      recordCompletion(adapter, 'c2', 'h1', '2026-01-20T08:00:00Z');
      const results = getCompletions(adapter, 'h1', { from: '2026-01-15' });
      expect(results).toHaveLength(1);
    });

    it('gets completions for a specific date', () => {
      createHabit(adapter, 'h1', { name: 'Run' });
      recordCompletion(adapter, 'c1', 'h1', '2026-01-15T08:00:00Z');
      recordCompletion(adapter, 'c2', 'h1', '2026-01-16T08:00:00Z');
      const results = getCompletionsForDate(adapter, '2026-01-15');
      expect(results).toHaveLength(1);
    });

    it('deletes a completion', () => {
      createHabit(adapter, 'h1', { name: 'Test' });
      recordCompletion(adapter, 'c1', 'h1', '2026-01-15T08:00:00Z');
      deleteCompletion(adapter, 'c1');
      expect(getCompletions(adapter, 'h1')).toHaveLength(0);
    });
  });

  // ── Streaks ────────────────────────────────────────────────────────────

  describe('streaks', () => {
    it('returns zero for no completions', () => {
      createHabit(adapter, 'h1', { name: 'Test' });
      const streaks = getStreaks(adapter, 'h1');
      expect(streaks.currentStreak).toBe(0);
      expect(streaks.longestStreak).toBe(0);
    });
  });

  // ── Streaks with grace period ──────────────────────────────────────────

  describe('streaks with grace period', () => {
    it('allows 1-day grace period', () => {
      createHabit(adapter, 'h1', { name: 'Test', gracePeriod: 1 });
      // Record completions with a 1-day gap (day 1, skip day 2, day 3)
      recordCompletion(adapter, 'c1', 'h1', '2026-01-01T08:00:00Z');
      recordCompletion(adapter, 'c2', 'h1', '2026-01-03T08:00:00Z');
      recordCompletion(adapter, 'c3', 'h1', '2026-01-04T08:00:00Z');
      const streaks = getStreaksWithGrace(adapter, 'h1', 1);
      // With grace=1, the gap of 2 days between Jan 1 and Jan 3 should not break the streak
      expect(streaks.longestStreak).toBe(3);
    });

    it('breaks streak when gap exceeds grace period', () => {
      createHabit(adapter, 'h1', { name: 'Test' });
      recordCompletion(adapter, 'c1', 'h1', '2026-01-01T08:00:00Z');
      recordCompletion(adapter, 'c2', 'h1', '2026-01-04T08:00:00Z'); // 3-day gap
      const streaks = getStreaksWithGrace(adapter, 'h1', 1);
      expect(streaks.longestStreak).toBe(1); // grace of 1 can't bridge 3-day gap
    });
  });

  // ── Negative habit streaks ─────────────────────────────────────────────

  describe('negative habit streaks', () => {
    it('tracks days since last slip', () => {
      createHabit(adapter, 'h1', { name: 'No Smoking', habitType: 'negative' });
      // Record a slip (value = -1)
      recordCompletion(adapter, 'c1', 'h1', '2026-01-10T08:00:00Z', -1);
      const info = getNegativeStreaks(adapter, 'h1');
      expect(info.daysSinceLastSlip).toBeGreaterThan(0);
    });

    it('computes clean streak between slips', () => {
      createHabit(adapter, 'h1', { name: 'No Junk Food', habitType: 'negative' });
      recordCompletion(adapter, 'c1', 'h1', '2026-01-01T08:00:00Z', -1);
      recordCompletion(adapter, 'c2', 'h1', '2026-01-11T08:00:00Z', -1);
      const info = getNegativeStreaks(adapter, 'h1');
      // 9 days between Jan 1 and Jan 11 (exclusive)
      expect(info.longestCleanStreak).toBeGreaterThanOrEqual(9);
    });
  });

  // ── Timed sessions ────────────────────────────────────────────────────

  describe('timed sessions', () => {
    it('starts and ends a session', () => {
      createHabit(adapter, 'h1', { name: 'Meditate', habitType: 'timed' });
      startSession(adapter, 's1', 'h1', 600);
      const sessions = getSessionsForHabit(adapter, 'h1');
      expect(sessions).toHaveLength(1);
      expect(sessions[0].targetSeconds).toBe(600);
      expect(sessions[0].completed).toBe(false);

      endSession(adapter, 's1', 630);
      const updated = getSessionsForHabit(adapter, 'h1');
      expect(updated[0].durationSeconds).toBe(630);
      expect(updated[0].completed).toBe(true);
    });

    it('filters sessions by date', () => {
      createHabit(adapter, 'h1', { name: 'Focus', habitType: 'timed' });
      // Manually insert with specific date
      adapter.execute(
        `INSERT INTO hb_timed_sessions (id, habit_id, started_at, duration_seconds, target_seconds, completed, created_at)
         VALUES ('s1', 'h1', '2026-01-15T08:00:00Z', 300, 300, 1, '2026-01-15T08:05:00Z')`,
      );
      adapter.execute(
        `INSERT INTO hb_timed_sessions (id, habit_id, started_at, duration_seconds, target_seconds, completed, created_at)
         VALUES ('s2', 'h1', '2026-01-16T08:00:00Z', 300, 300, 1, '2026-01-16T08:05:00Z')`,
      );
      const results = getSessionsForDate(adapter, '2026-01-15');
      expect(results).toHaveLength(1);
    });
  });

  // ── Measurements ──────────────────────────────────────────────────────

  describe('measurements', () => {
    it('records and retrieves measurements', () => {
      createHabit(adapter, 'h1', { name: 'Water Intake', habitType: 'measurable' });
      recordMeasurement(adapter, 'm1', 'h1', '2026-01-15T08:00:00Z', 2.5, 3.0);
      recordMeasurement(adapter, 'm2', 'h1', '2026-01-16T08:00:00Z', 3.5, 3.0);
      const measurements = getMeasurementsForHabit(adapter, 'h1');
      expect(measurements).toHaveLength(2);
      expect(measurements[0].value).toBe(3.5); // DESC order
      expect(measurements[1].target).toBe(3.0);
    });

    it('filters measurements by date', () => {
      createHabit(adapter, 'h1', { name: 'Steps', habitType: 'measurable' });
      recordMeasurement(adapter, 'm1', 'h1', '2026-01-15T10:00:00Z', 8000, 10000);
      recordMeasurement(adapter, 'm2', 'h1', '2026-01-16T10:00:00Z', 12000, 10000);
      const results = getMeasurementsForDate(adapter, '2026-01-15');
      expect(results).toHaveLength(1);
      expect(results[0].value).toBe(8000);
    });
  });

  // ── Measurable habit streaks ──────────────────────────────────────────

  describe('measurable habit streaks', () => {
    it('counts streak when target met', () => {
      createHabit(adapter, 'h1', { name: 'Water', habitType: 'measurable' });
      recordMeasurement(adapter, 'm1', 'h1', '2026-01-01T10:00:00Z', 3.0, 3.0);
      recordMeasurement(adapter, 'm2', 'h1', '2026-01-02T10:00:00Z', 3.5, 3.0);
      recordMeasurement(adapter, 'm3', 'h1', '2026-01-03T10:00:00Z', 2.0, 3.0); // below target
      const streaks = getMeasurableStreaks(adapter, 'h1');
      // Only Jan 1-2 meet target
      expect(streaks.longestStreak).toBe(2);
    });
  });

  // ── Heatmap ───────────────────────────────────────────────────────────

  describe('heatmap', () => {
    it('generates 365 days for a year', () => {
      createHabit(adapter, 'h1', { name: 'Test' });
      recordCompletion(adapter, 'c1', 'h1', '2026-06-15T08:00:00Z');
      const data = getHeatmapData(adapter, 'h1', 2026);
      expect(data.length).toBe(365);
      const june15 = data.find((d) => d.date === '2026-06-15');
      expect(june15!.count).toBe(1);
    });

    it('generates range data', () => {
      createHabit(adapter, 'h1', { name: 'Test' });
      recordCompletion(adapter, 'c1', 'h1', '2026-01-15T08:00:00Z');
      recordCompletion(adapter, 'c2', 'h1', '2026-01-15T12:00:00Z');
      const data = getHeatmapRange(adapter, 'h1', '2026-01-14', '2026-01-16');
      expect(data).toHaveLength(3);
      expect(data[1].date).toBe('2026-01-15');
      expect(data[1].count).toBe(2); // two completions on same day
    });
  });

  // ── Statistics ────────────────────────────────────────────────────────

  describe('statistics', () => {
    it('computes yearly stats', () => {
      createHabit(adapter, 'h1', { name: 'Exercise' });
      recordCompletion(adapter, 'c1', 'h1', '2026-01-15T08:00:00Z');
      recordCompletion(adapter, 'c2', 'h1', '2026-01-16T14:00:00Z');
      recordCompletion(adapter, 'c3', 'h1', '2026-01-17T20:00:00Z');
      const stats = getYearlyStats(adapter, 'h1');
      expect(stats.totalCompletions).toBe(3);
      expect(stats.bestStreak).toBe(3);
      expect(stats.completionRate).toBeGreaterThan(0);
    });

    it('computes overall stats', () => {
      createHabit(adapter, 'h1', { name: 'Read' });
      createHabit(adapter, 'h2', { name: 'Exercise' });
      recordCompletion(adapter, 'c1', 'h1', '2026-01-15T08:00:00Z');
      recordCompletion(adapter, 'c2', 'h2', '2026-01-15T08:00:00Z');
      recordCompletion(adapter, 'c3', 'h2', '2026-01-16T08:00:00Z');
      const stats = getOverallStats(adapter);
      expect(stats.totalHabits).toBe(2);
      expect(stats.totalCompletions).toBe(3);
      expect(stats.bestHabit).not.toBeNull();
      expect(stats.bestHabit!.name).toBe('Exercise');
    });
  });

  // ── CSV export ────────────────────────────────────────────────────────

  describe('CSV export', () => {
    it('exports habits CSV', () => {
      createHabit(adapter, 'h1', { name: 'Read' });
      createHabit(adapter, 'h2', { name: 'Exercise' });
      const csv = exportHabitsCSV(adapter);
      const lines = csv.split('\n');
      expect(lines[0]).toContain('id,name');
      expect(lines).toHaveLength(3); // header + 2 habits
    });

    it('exports completions CSV', () => {
      createHabit(adapter, 'h1', { name: 'Read' });
      recordCompletion(adapter, 'c1', 'h1', '2026-01-15T08:00:00Z');
      const csv = exportCompletionsCSV(adapter, 'h1');
      const lines = csv.split('\n');
      expect(lines[0]).toContain('id,habit_id');
      expect(lines).toHaveLength(2);
    });

    it('exports all data CSV', () => {
      createHabit(adapter, 'h1', { name: 'Read' });
      recordCompletion(adapter, 'c1', 'h1', '2026-01-15T08:00:00Z');
      const csv = exportAllCSV(adapter);
      expect(csv).toContain('# Habits');
      expect(csv).toContain('# Completions');
    });

    it('returns empty string for no data', () => {
      expect(exportHabitsCSV(adapter)).toBe('');
      expect(exportCompletionsCSV(adapter)).toBe('');
    });
  });

  // ── Cycle tracking (REMOVED) ──────────────────────────────────────────
  // The 'cycle tracking' describe block and its periods/symptoms/predictions
  // tests were removed in Phase 0 Fix 1. Cycle tracking is now owned by
  // @mylife/cycle (cy_* tables) and the hb_periods/hb_period_symptoms/
  // hb_predictions/hb_cycle_settings tables are dropped by V8.
  // See docs/plans/consolidation/phase-0-research.md.

  // ── Settings ──────────────────────────────────────────────────────────

  describe('settings', () => {
    it('updates a setting', () => {
      setSetting(adapter, 'weekStartsOn', 'sunday');
      expect(getSetting(adapter, 'weekStartsOn')).toBe('sunday');
    });
  });

  // ── Pet care persistence ─────────────────────────────────────────────

  describe('pet care', () => {
    it('persists care actions and history via settings', () => {
      ensurePetState(adapter);

      const initial = getPetCareState(adapter, '2026-04-07T08:00:00Z');
      const fed = feedPet(adapter);
      const played = playWithPet(adapter);
      const rested = restPet(adapter);
      const history = getPetHistory(adapter);

      expect(fed.petXP).toBeGreaterThan(initial.petXP);
      expect(played.totalInteractions).toBeGreaterThan(fed.totalInteractions);
      expect(rested.energy).toBeGreaterThanOrEqual(played.energy);
      expect(history.length).toBeGreaterThanOrEqual(3);
      expect(history[0].timestamp).toBeTruthy();
    });
  });
});
