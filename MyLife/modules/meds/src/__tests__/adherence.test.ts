import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { DatabaseAdapter } from '@mylife/db';
import { createModuleTestDatabase } from '@mylife/db';
import { MEDS_MODULE } from '../definition';
import { createMedicationExtended } from '../medication';
import { logDose } from '../reminders/scheduler';
import {
  getAdherenceRate,
  getStreak,
  getAdherenceStats,
} from '../reminders/adherence';
import { getAdherenceByDay, getAdherenceCalendar } from '../reminders/calendar';

describe('adherence engine', () => {
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

  describe('getAdherenceRate (V2)', () => {
    it('returns 0 for no dose logs', () => {
      createMedicationExtended(adapter, 'm1', { name: 'Test' });
      expect(getAdherenceRate(adapter, 'm1', '2026-01-01', '2026-01-31')).toBe(0);
    });

    it('returns 100 when all doses taken', () => {
      createMedicationExtended(adapter, 'm1', { name: 'Test' });

      for (let d = 1; d <= 10; d++) {
        const day = String(d).padStart(2, '0');
        logDose(adapter, `dl-${d}`, {
          medicationId: 'm1',
          scheduledTime: `2026-01-${day}T08:00:00Z`,
          status: 'taken',
        });
      }

      const rate = getAdherenceRate(adapter, 'm1', '2026-01-01', '2026-01-31');
      expect(rate).toBe(100);
    });

    it('counts late as taken for adherence', () => {
      createMedicationExtended(adapter, 'm1', { name: 'Test' });

      logDose(adapter, 'dl1', {
        medicationId: 'm1',
        scheduledTime: '2026-01-01T08:00:00Z',
        status: 'taken',
      });
      logDose(adapter, 'dl2', {
        medicationId: 'm1',
        scheduledTime: '2026-01-02T08:00:00Z',
        status: 'late',
      });

      const rate = getAdherenceRate(adapter, 'm1', '2026-01-01', '2026-01-31');
      expect(rate).toBe(100);
    });

    it('excludes snoozed from count', () => {
      createMedicationExtended(adapter, 'm1', { name: 'Test' });

      logDose(adapter, 'dl1', {
        medicationId: 'm1',
        scheduledTime: '2026-01-01T08:00:00Z',
        status: 'taken',
      });
      logDose(adapter, 'dl2', {
        medicationId: 'm1',
        scheduledTime: '2026-01-02T08:00:00Z',
        status: 'snoozed',
      });

      const rate = getAdherenceRate(adapter, 'm1', '2026-01-01', '2026-01-31');
      expect(rate).toBe(100); // snoozed excluded, 1/1 = 100%
    });

    it('CRITICAL: 28 taken + 2 missed = 93.3% adherence', () => {
      createMedicationExtended(adapter, 'm1', { name: 'Daily Med', frequency: 'daily' });

      for (let d = 1; d <= 30; d++) {
        const day = String(d).padStart(2, '0');
        const status = d <= 28 ? 'taken' : 'skipped';
        logDose(adapter, `dl-${d}`, {
          medicationId: 'm1',
          scheduledTime: `2026-01-${day}T08:00:00Z`,
          status: status as 'taken' | 'skipped',
        });
      }

      const rate = getAdherenceRate(adapter, 'm1', '2026-01-01', '2026-01-31');
      // 28/30 = 0.93333... => Math.round(0.93333 * 1000) / 10 = 93.3
      expect(rate).toBe(93.3);
    });
  });

  describe('getStreak', () => {
    it('returns 0 for no dose logs', () => {
      createMedicationExtended(adapter, 'm1', { name: 'Test' });
      expect(getStreak(adapter, 'm1')).toBe(0);
    });

    it('returns 0 for as_needed medications', () => {
      createMedicationExtended(adapter, 'm1', { name: 'PRN', frequency: 'as_needed' });
      logDose(adapter, 'dl1', {
        medicationId: 'm1',
        scheduledTime: '2026-01-15T08:00:00Z',
        status: 'taken',
      });
      expect(getStreak(adapter, 'm1')).toBe(0);
    });

    it('counts consecutive days with all taken', () => {
      createMedicationExtended(adapter, 'm1', { name: 'Test', frequency: 'daily' });

      // 3 consecutive days all taken
      logDose(adapter, 'dl1', {
        medicationId: 'm1',
        scheduledTime: '2026-02-26T08:00:00Z',
        status: 'taken',
      });
      logDose(adapter, 'dl2', {
        medicationId: 'm1',
        scheduledTime: '2026-02-27T08:00:00Z',
        status: 'taken',
      });
      logDose(adapter, 'dl3', {
        medicationId: 'm1',
        scheduledTime: '2026-02-28T08:00:00Z',
        status: 'taken',
      });

      expect(getStreak(adapter, 'm1')).toBe(3);
    });

    it('breaks streak on skipped dose', () => {
      createMedicationExtended(adapter, 'm1', { name: 'Test', frequency: 'daily' });

      logDose(adapter, 'dl1', {
        medicationId: 'm1',
        scheduledTime: '2026-02-26T08:00:00Z',
        status: 'taken',
      });
      logDose(adapter, 'dl2', {
        medicationId: 'm1',
        scheduledTime: '2026-02-27T08:00:00Z',
        status: 'skipped',
      });
      logDose(adapter, 'dl3', {
        medicationId: 'm1',
        scheduledTime: '2026-02-28T08:00:00Z',
        status: 'taken',
      });

      expect(getStreak(adapter, 'm1')).toBe(1);
    });

    it('counts late as taken for streak purposes', () => {
      createMedicationExtended(adapter, 'm1', { name: 'Test', frequency: 'daily' });

      logDose(adapter, 'dl1', {
        medicationId: 'm1',
        scheduledTime: '2026-02-27T08:00:00Z',
        status: 'late',
      });
      logDose(adapter, 'dl2', {
        medicationId: 'm1',
        scheduledTime: '2026-02-28T08:00:00Z',
        status: 'taken',
      });

      expect(getStreak(adapter, 'm1')).toBe(2);
    });
  });

  describe('getAdherenceStats', () => {
    it('returns combined stats', () => {
      createMedicationExtended(adapter, 'm1', { name: 'Test', frequency: 'daily' });

      // Use dates well in the past (but within 30-day window) to avoid
      // timezone flakiness when today's dose at T08:00Z is after current UTC time.
      const base = new Date();
      base.setDate(base.getDate() - 2); // start from 2 days ago
      for (let i = 0; i < 5; i++) {
        const d = new Date(base);
        d.setDate(d.getDate() - i);
        const dateStr = d.toISOString().slice(0, 10);
        const status = i < 4 ? 'taken' : 'skipped';
        logDose(adapter, `dl-${i}`, {
          medicationId: 'm1',
          scheduledTime: `${dateStr}T08:00:00Z`,
          status: status as 'taken' | 'skipped',
        });
      }

      const stats = getAdherenceStats(adapter, 'm1', 30);
      expect(stats.totalTaken).toBe(4);
      expect(stats.totalMissed).toBe(1);
      expect(stats.totalLate).toBe(0);
      expect(stats.rate).toBe(80);
    });
  });

  describe('getAdherenceByDay', () => {
    it('returns per-day adherence for a month', () => {
      createMedicationExtended(adapter, 'm1', { name: 'Test' });

      logDose(adapter, 'dl1', {
        medicationId: 'm1',
        scheduledTime: '2026-01-05T08:00:00Z',
        status: 'taken',
      });
      logDose(adapter, 'dl2', {
        medicationId: 'm1',
        scheduledTime: '2026-01-10T08:00:00Z',
        status: 'skipped',
      });

      const days = getAdherenceByDay(adapter, 'm1', '2026-01');
      expect(days).toHaveLength(31); // January has 31 days

      const jan5 = days.find((d) => d.date === '2026-01-05');
      expect(jan5!.status).toBe('taken');

      const jan10 = days.find((d) => d.date === '2026-01-10');
      expect(jan10!.status).toBe('missed');

      const jan1 = days.find((d) => d.date === '2026-01-01');
      expect(jan1!.status).toBe('none');
    });

    it('marks partial days correctly', () => {
      createMedicationExtended(adapter, 'm1', { name: 'Test' });

      logDose(adapter, 'dl1', {
        medicationId: 'm1',
        scheduledTime: '2026-01-05T08:00:00Z',
        status: 'taken',
      });
      logDose(adapter, 'dl2', {
        medicationId: 'm1',
        scheduledTime: '2026-01-05T20:00:00Z',
        status: 'skipped',
      });

      const days = getAdherenceByDay(adapter, 'm1', '2026-01');
      const jan5 = days.find((d) => d.date === '2026-01-05');
      expect(jan5!.status).toBe('partial');
    });

    it('marks late days correctly', () => {
      createMedicationExtended(adapter, 'm1', { name: 'Test' });

      logDose(adapter, 'dl1', {
        medicationId: 'm1',
        scheduledTime: '2026-01-05T08:00:00Z',
        status: 'late',
      });

      const days = getAdherenceByDay(adapter, 'm1', '2026-01');
      const jan5 = days.find((d) => d.date === '2026-01-05');
      expect(jan5!.status).toBe('late');
    });
  });

  describe('getAdherenceCalendar', () => {
    it('returns combined calendar for all active medications', () => {
      createMedicationExtended(adapter, 'm1', { name: 'Med A' });
      createMedicationExtended(adapter, 'm2', { name: 'Med B' });

      logDose(adapter, 'dl1', {
        medicationId: 'm1',
        scheduledTime: '2026-01-05T08:00:00Z',
        status: 'taken',
      });
      logDose(adapter, 'dl2', {
        medicationId: 'm2',
        scheduledTime: '2026-01-05T20:00:00Z',
        status: 'skipped',
      });

      const calendar = getAdherenceCalendar(adapter, '2026-01');
      expect(calendar).toHaveLength(31);

      const jan5 = calendar.find((d) => d.date === '2026-01-05');
      expect(jan5!.meds).toHaveLength(2);
      expect(jan5!.meds.find((m) => m.name === 'Med A')!.status).toBe('taken');
      expect(jan5!.meds.find((m) => m.name === 'Med B')!.status).toBe('missed');
    });

    it('returns empty meds array for days with no data', () => {
      createMedicationExtended(adapter, 'm1', { name: 'Med A' });

      const calendar = getAdherenceCalendar(adapter, '2026-01');
      const jan1 = calendar.find((d) => d.date === '2026-01-01');
      expect(jan1!.meds).toHaveLength(1);
      expect(jan1!.meds[0].status).toBe('none');
    });
  });
});
