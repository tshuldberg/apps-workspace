import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { DatabaseAdapter } from '@mylife/db';
import { createModuleTestDatabase } from '@mylife/db';
import { MEDS_MODULE } from '../definition';
import { createMedicationExtended, decrementPillCount, getMedicationExtended } from '../medication';
import {
  createRemindersForMedication,
  snoozeReminder,
  dismissReminder,
  getRemindersForMedication,
  logDose,
  getDoseLogsForDate,
  getDoseLogsForMedication,
  undoDoseLog,
} from '../reminders';

describe('reminder scheduler', () => {
  let adapter: DatabaseAdapter;
  let closeDb: () => void;
  let idCounter: number;

  beforeEach(() => {
    const testDb = createModuleTestDatabase('meds', MEDS_MODULE.migrations!);
    adapter = testDb.adapter;
    closeDb = testDb.close;
    idCounter = 0;
  });

  afterEach(() => {
    closeDb();
  });

  function nextId(): string {
    return `r-${++idCounter}`;
  }

  describe('createRemindersForMedication', () => {
    it('creates one reminder per time slot for daily medication', () => {
      createMedicationExtended(adapter, 'm1', {
        name: 'Daily Med',
        frequency: 'daily',
        timeSlots: ['08:00', '20:00'],
      });

      createRemindersForMedication(adapter, 'm1', nextId);

      const reminders = getRemindersForMedication(adapter, 'm1');
      expect(reminders).toHaveLength(2);
      expect(reminders[0].time).toBe('08:00');
      expect(reminders[1].time).toBe('20:00');
      // Daily uses all 7 days
      expect(reminders[0].daysOfWeek).toEqual([0, 1, 2, 3, 4, 5, 6]);
    });

    it('creates reminders for twice_daily with 2 time slots', () => {
      createMedicationExtended(adapter, 'm1', {
        name: 'BID Med',
        frequency: 'twice_daily',
        timeSlots: ['09:00', '21:00'],
      });

      createRemindersForMedication(adapter, 'm1', nextId);

      const reminders = getRemindersForMedication(adapter, 'm1');
      expect(reminders).toHaveLength(2);
    });

    it('creates weekly reminders with single day of week', () => {
      createMedicationExtended(adapter, 'm1', {
        name: 'Weekly Med',
        frequency: 'weekly',
        timeSlots: ['10:00'],
      });

      createRemindersForMedication(adapter, 'm1', nextId);

      const reminders = getRemindersForMedication(adapter, 'm1');
      expect(reminders).toHaveLength(1);
      // Weekly: only one day (current day of week)
      expect(reminders[0].daysOfWeek).toHaveLength(1);
    });

    it('skips as_needed medications', () => {
      createMedicationExtended(adapter, 'm1', {
        name: 'PRN Med',
        frequency: 'as_needed',
        timeSlots: ['08:00'],
      });

      createRemindersForMedication(adapter, 'm1', nextId);

      const reminders = getRemindersForMedication(adapter, 'm1');
      expect(reminders).toHaveLength(0);
    });

    it('skips medications with no time slots', () => {
      createMedicationExtended(adapter, 'm1', {
        name: 'No Slots',
        frequency: 'daily',
      });

      createRemindersForMedication(adapter, 'm1', nextId);

      const reminders = getRemindersForMedication(adapter, 'm1');
      expect(reminders).toHaveLength(0);
    });

    it('replaces existing reminders on re-creation', () => {
      createMedicationExtended(adapter, 'm1', {
        name: 'Test',
        frequency: 'daily',
        timeSlots: ['08:00'],
      });

      createRemindersForMedication(adapter, 'm1', nextId);
      expect(getRemindersForMedication(adapter, 'm1')).toHaveLength(1);

      // Update time slots and recreate
      adapter.execute(
        "UPDATE md_medications SET time_slots = ? WHERE id = ?",
        [JSON.stringify(['07:00', '12:00', '19:00']), 'm1'],
      );
      createRemindersForMedication(adapter, 'm1', nextId);

      const reminders = getRemindersForMedication(adapter, 'm1');
      expect(reminders).toHaveLength(3);
    });
  });

  describe('snoozeReminder', () => {
    it('sets snooze_until on a reminder', () => {
      createMedicationExtended(adapter, 'm1', {
        name: 'Test',
        frequency: 'daily',
        timeSlots: ['08:00'],
      });
      createRemindersForMedication(adapter, 'm1', nextId);

      const reminders = getRemindersForMedication(adapter, 'm1');
      snoozeReminder(adapter, reminders[0].id, 15);

      const updated = getRemindersForMedication(adapter, 'm1');
      expect(updated[0].snoozeUntil).not.toBeNull();
    });
  });

  describe('dismissReminder', () => {
    it('sets is_active to false', () => {
      createMedicationExtended(adapter, 'm1', {
        name: 'Test',
        frequency: 'daily',
        timeSlots: ['08:00'],
      });
      createRemindersForMedication(adapter, 'm1', nextId);

      const reminders = getRemindersForMedication(adapter, 'm1');
      dismissReminder(adapter, reminders[0].id);

      const updated = getRemindersForMedication(adapter, 'm1');
      expect(updated[0].isActive).toBe(false);
    });
  });

  describe('logDose', () => {
    it('writes to md_dose_logs', () => {
      createMedicationExtended(adapter, 'm1', { name: 'Test' });

      logDose(adapter, 'dl1', {
        medicationId: 'm1',
        scheduledTime: '2026-01-15T08:00:00Z',
        status: 'taken',
        actualTime: '2026-01-15T08:05:00Z',
      });

      const logs = getDoseLogsForDate(adapter, '2026-01-15');
      expect(logs).toHaveLength(1);
      expect(logs[0].status).toBe('taken');
      expect(logs[0].actualTime).toBe('2026-01-15T08:05:00Z');
    });

    it('logs a skipped dose', () => {
      createMedicationExtended(adapter, 'm1', { name: 'Test' });

      logDose(adapter, 'dl1', {
        medicationId: 'm1',
        scheduledTime: '2026-01-15T08:00:00Z',
        status: 'skipped',
        notes: 'Felt nauseous',
      });

      const logs = getDoseLogsForDate(adapter, '2026-01-15');
      expect(logs[0].status).toBe('skipped');
      expect(logs[0].notes).toBe('Felt nauseous');
    });

    // Supply-decrement contract guard. logDose must NOT touch pill_count on its
    // own: every take surface (mobile + web) calls decrementPillCount explicitly
    // at the call site. If supply depletion ever moves back inside logDose, the
    // surfaces double-count and this test fails, blocking the regression.
    it('does NOT change pill_count when logging a taken dose', () => {
      createMedicationExtended(adapter, 'm1', {
        name: 'Test',
        pillCount: 30,
        pillsPerDose: 1,
      });

      logDose(adapter, 'dl1', {
        medicationId: 'm1',
        scheduledTime: '2026-01-15T08:00:00Z',
        status: 'taken',
        actualTime: '2026-01-15T08:05:00Z',
      });

      expect(getMedicationExtended(adapter, 'm1')?.pillCount).toBe(30);
    });

    it('does NOT change pill_count when logging a late dose', () => {
      createMedicationExtended(adapter, 'm1', {
        name: 'Test',
        pillCount: 12,
        pillsPerDose: 3,
      });

      logDose(adapter, 'dl1', {
        medicationId: 'm1',
        scheduledTime: '2026-01-15T08:00:00Z',
        status: 'late',
        actualTime: '2026-01-15T11:00:00Z',
      });

      expect(getMedicationExtended(adapter, 'm1')?.pillCount).toBe(12);
    });

    it('a single explicit decrementPillCount reduces supply by pills_per_dose exactly once', () => {
      createMedicationExtended(adapter, 'm1', {
        name: 'Test',
        pillCount: 30,
        pillsPerDose: 2,
      });

      // Mirror a take surface: log the dose, then decrement supply once.
      logDose(adapter, 'dl1', {
        medicationId: 'm1',
        scheduledTime: '2026-01-15T08:00:00Z',
        status: 'taken',
      });
      decrementPillCount(adapter, 'm1');

      // pills_per_dose is 2, so a single take removes exactly 2 (not 4).
      expect(getMedicationExtended(adapter, 'm1')?.pillCount).toBe(28);
    });
  });

  describe('getDoseLogsForDate', () => {
    it('returns all logs for a date', () => {
      createMedicationExtended(adapter, 'm1', { name: 'Med A' });
      createMedicationExtended(adapter, 'm2', { name: 'Med B' });

      logDose(adapter, 'dl1', {
        medicationId: 'm1',
        scheduledTime: '2026-01-15T08:00:00Z',
        status: 'taken',
      });
      logDose(adapter, 'dl2', {
        medicationId: 'm2',
        scheduledTime: '2026-01-15T20:00:00Z',
        status: 'taken',
      });
      logDose(adapter, 'dl3', {
        medicationId: 'm1',
        scheduledTime: '2026-01-16T08:00:00Z',
        status: 'taken',
      });

      const logs = getDoseLogsForDate(adapter, '2026-01-15');
      expect(logs).toHaveLength(2);
    });
  });

  describe('undoDoseLog', () => {
    it('deletes the log entry', () => {
      createMedicationExtended(adapter, 'm1', { name: 'Test' });

      logDose(adapter, 'dl1', {
        medicationId: 'm1',
        scheduledTime: '2026-01-15T08:00:00Z',
        status: 'taken',
      });

      undoDoseLog(adapter, 'dl1');
      expect(getDoseLogsForDate(adapter, '2026-01-15')).toHaveLength(0);
    });
  });

  describe('getDoseLogsForMedication', () => {
    it('returns logs for a specific medication', () => {
      createMedicationExtended(adapter, 'm1', { name: 'Med A' });
      createMedicationExtended(adapter, 'm2', { name: 'Med B' });

      logDose(adapter, 'dl1', {
        medicationId: 'm1',
        scheduledTime: '2026-01-15T08:00:00Z',
        status: 'taken',
      });
      logDose(adapter, 'dl2', {
        medicationId: 'm2',
        scheduledTime: '2026-01-15T08:00:00Z',
        status: 'taken',
      });

      const logs = getDoseLogsForMedication(adapter, 'm1');
      expect(logs).toHaveLength(1);
      expect(logs[0].medicationId).toBe('m1');
    });

    it('filters by date range', () => {
      createMedicationExtended(adapter, 'm1', { name: 'Test' });

      logDose(adapter, 'dl1', {
        medicationId: 'm1',
        scheduledTime: '2026-01-10T08:00:00Z',
        status: 'taken',
      });
      logDose(adapter, 'dl2', {
        medicationId: 'm1',
        scheduledTime: '2026-01-20T08:00:00Z',
        status: 'taken',
      });

      const logs = getDoseLogsForMedication(adapter, 'm1', {
        from: '2026-01-15',
      });
      expect(logs).toHaveLength(1);
    });
  });
});
