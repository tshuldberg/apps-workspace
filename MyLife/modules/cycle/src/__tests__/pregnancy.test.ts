import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createModuleTestDatabase, type InMemoryTestDatabase } from '@mylife/db';
import { CYCLE_MODULE } from '../definition';
import {
  createPregnancyConfig,
  getActivePregnancy,
  getPregnancyConfig,
  getPregnancyHistory,
  endPregnancy,
  updateDueDate,
  createAppointment,
  getAppointmentsByPregnancy,
  getUpcomingAppointments,
  updateAppointment,
  completeAppointment,
  deleteAppointment,
} from '../db/crud';
import {
  calculateDueDateFromLMP,
  calculateDueDateFromConception,
  calculateDueDateFromTransfer,
  calculateDueDate,
  getLMPFromDueDate,
  getCurrentWeek,
  getCurrentTrimester,
  getDaysUntilDue,
  getPregnancyWeekInfo,
  isPastDue,
  formatWeekDisplay,
} from '../engine/pregnancy';

let testDb: InMemoryTestDatabase;

beforeEach(() => {
  testDb = createModuleTestDatabase('cycle', CYCLE_MODULE.migrations!);
});

afterEach(() => {
  testDb.close();
});

// ── Engine Tests ──────────────────────────────────────────────────────

describe('Pregnancy Engine', () => {
  describe('calculateDueDateFromLMP', () => {
    it('adds 280 days to LMP date', () => {
      expect(calculateDueDateFromLMP('2025-06-01')).toBe('2026-03-08');
    });

    it('handles year boundary', () => {
      expect(calculateDueDateFromLMP('2025-04-01')).toBe('2026-01-06');
    });
  });

  describe('calculateDueDateFromConception', () => {
    it('adds 266 days to conception date', () => {
      expect(calculateDueDateFromConception('2025-06-15')).toBe('2026-03-08');
    });
  });

  describe('calculateDueDateFromTransfer', () => {
    it('adds 266 days to transfer date', () => {
      expect(calculateDueDateFromTransfer('2025-06-15')).toBe('2026-03-08');
    });
  });

  describe('calculateDueDate', () => {
    it('uses LMP method', () => {
      const result = calculateDueDate('last_period', { lastPeriodDate: '2025-06-01' });
      expect(result).toBe('2026-03-08');
    });

    it('uses conception method', () => {
      const result = calculateDueDate('conception_date', { conceptionDate: '2025-06-15' });
      expect(result).toBe('2026-03-08');
    });

    it('uses doctor-provided due date directly', () => {
      const result = calculateDueDate('due_date', { dueDate: '2026-03-10' });
      expect(result).toBe('2026-03-10');
    });

    it('uses transfer method', () => {
      const result = calculateDueDate('transfer_date', { transferDate: '2025-06-15' });
      expect(result).toBe('2026-03-08');
    });

    it('throws when required date is missing', () => {
      expect(() => calculateDueDate('last_period', {})).toThrow('Last period date is required');
    });

    it('throws for unknown method', () => {
      expect(() => calculateDueDate('unknown', {})).toThrow('Unknown start method');
    });
  });

  describe('getLMPFromDueDate', () => {
    it('reverses Naegele rule (due date - 280 days)', () => {
      expect(getLMPFromDueDate('2026-03-08')).toBe('2025-06-01');
    });
  });

  describe('getCurrentWeek', () => {
    it('returns correct week with LMP', () => {
      // 20 weeks = 140 days after LMP
      const lmp = '2025-11-01';
      // 140 days later = 2026-03-21
      const today = '2026-03-21';
      const dueDate = calculateDueDateFromLMP(lmp);
      expect(getCurrentWeek(dueDate, today, lmp)).toBe(21);
    });

    it('returns week 1 minimum', () => {
      const dueDate = '2026-12-01';
      const today = '2026-03-22';
      expect(getCurrentWeek(dueDate, today, '2026-03-25')).toBe(1);
    });

    it('handles past due (week 40+)', () => {
      const lmp = '2025-05-01';
      const dueDate = calculateDueDateFromLMP(lmp);
      // 290 days after LMP
      const today = '2026-02-15';
      const week = getCurrentWeek(dueDate, today, lmp);
      expect(week).toBeGreaterThanOrEqual(41);
    });

    it('derives LMP from due date when not provided', () => {
      const dueDate = '2026-08-08';
      const today = '2026-03-22';
      const week = getCurrentWeek(dueDate, today);
      expect(week).toBeGreaterThan(0);
    });
  });

  describe('getCurrentTrimester', () => {
    it('returns 1 for weeks 1-13', () => {
      expect(getCurrentTrimester(1)).toBe(1);
      expect(getCurrentTrimester(13)).toBe(1);
    });

    it('returns 2 for weeks 14-27', () => {
      expect(getCurrentTrimester(14)).toBe(2);
      expect(getCurrentTrimester(27)).toBe(2);
    });

    it('returns 3 for weeks 28+', () => {
      expect(getCurrentTrimester(28)).toBe(3);
      expect(getCurrentTrimester(40)).toBe(3);
    });
  });

  describe('getDaysUntilDue', () => {
    it('returns positive for future due date', () => {
      expect(getDaysUntilDue('2026-04-01', '2026-03-22')).toBe(10);
    });

    it('returns negative for past due date', () => {
      expect(getDaysUntilDue('2026-03-20', '2026-03-22')).toBe(-2);
    });

    it('returns 0 on due date', () => {
      expect(getDaysUntilDue('2026-03-22', '2026-03-22')).toBe(0);
    });
  });

  describe('getPregnancyWeekInfo', () => {
    it('returns too early for weeks 1-3', () => {
      const info = getPregnancyWeekInfo(2);
      expect(info.babySize).toBe('Too early to measure');
      expect(info.babySizeCm).toBe(0);
    });

    it('returns correct data for week 4', () => {
      const info = getPregnancyWeekInfo(4);
      expect(info.babySize).toBe('Poppy seed');
      expect(info.trimester).toBe(1);
    });

    it('returns correct data for week 20', () => {
      const info = getPregnancyWeekInfo(20);
      expect(info.babySize).toBe('Banana');
      expect(info.trimester).toBe(2);
    });

    it('returns correct data for week 40', () => {
      const info = getPregnancyWeekInfo(40);
      expect(info.babySize).toBe('Pumpkin');
      expect(info.trimester).toBe(3);
    });

    it('caps at week 42', () => {
      const info = getPregnancyWeekInfo(45);
      expect(info.week).toBe(42);
    });
  });

  describe('isPastDue', () => {
    it('returns false before due date', () => {
      expect(isPastDue('2026-04-01', '2026-03-22')).toBe(false);
    });

    it('returns true after due date', () => {
      expect(isPastDue('2026-03-20', '2026-03-22')).toBe(true);
    });
  });

  describe('formatWeekDisplay', () => {
    it('formats normal week', () => {
      expect(formatWeekDisplay(20)).toBe('Week 20 of 40');
    });

    it('caps at 42+ weeks for overdue', () => {
      expect(formatWeekDisplay(44)).toBe('42+ weeks');
    });
  });
});

// ── CRUD Tests ────────────────────────────────────────────────────────

describe('Pregnancy Config CRUD', () => {
  it('creates pregnancy from LMP', () => {
    const config = createPregnancyConfig(testDb.adapter, 'p1', {
      startMethod: 'last_period',
      lastPeriodDate: '2025-06-01',
    });
    expect(config.id).toBe('p1');
    expect(config.status).toBe('active');
    expect(config.startMethod).toBe('last_period');
    expect(config.dueDate).toBe('2026-03-08');
    expect(config.lastPeriodDate).toBe('2025-06-01');
  });

  it('creates pregnancy from conception date', () => {
    const config = createPregnancyConfig(testDb.adapter, 'p1', {
      startMethod: 'conception_date',
      conceptionDate: '2025-06-15',
    });
    expect(config.dueDate).toBe('2026-03-08');
    expect(config.conceptionDate).toBe('2025-06-15');
  });

  it('stores user-provided due date directly', () => {
    const config = createPregnancyConfig(testDb.adapter, 'p1', {
      startMethod: 'due_date',
      dueDate: '2026-04-15',
    });
    expect(config.dueDate).toBe('2026-04-15');
  });

  it('rejects creation when active pregnancy exists', () => {
    createPregnancyConfig(testDb.adapter, 'p1', {
      startMethod: 'due_date',
      dueDate: '2026-04-15',
    });
    expect(() =>
      createPregnancyConfig(testDb.adapter, 'p2', {
        startMethod: 'due_date',
        dueDate: '2026-05-01',
      }),
    ).toThrow('An active pregnancy already exists');
  });

  it('getActivePregnancy returns active config', () => {
    createPregnancyConfig(testDb.adapter, 'p1', {
      startMethod: 'due_date',
      dueDate: '2026-04-15',
    });
    const active = getActivePregnancy(testDb.adapter);
    expect(active).not.toBeNull();
    expect(active!.id).toBe('p1');
  });

  it('getActivePregnancy returns null when none active', () => {
    expect(getActivePregnancy(testDb.adapter)).toBeNull();
  });

  it('getPregnancyConfig retrieves by id', () => {
    createPregnancyConfig(testDb.adapter, 'p1', {
      startMethod: 'due_date',
      dueDate: '2026-04-15',
    });
    const config = getPregnancyConfig(testDb.adapter, 'p1');
    expect(config).not.toBeNull();
    expect(config!.dueDate).toBe('2026-04-15');
  });

  it('endPregnancy sets status and end date without deleting data', () => {
    createPregnancyConfig(testDb.adapter, 'p1', {
      startMethod: 'due_date',
      dueDate: '2026-04-15',
    });
    const ended = endPregnancy(testDb.adapter, 'p1', 'completed');
    expect(ended).not.toBeNull();
    expect(ended!.status).toBe('completed');
    expect(ended!.actualEndDate).not.toBeNull();

    // Data preserved
    const config = getPregnancyConfig(testDb.adapter, 'p1');
    expect(config).not.toBeNull();
    expect(config!.status).toBe('completed');
  });

  it('endPregnancy with loss status', () => {
    createPregnancyConfig(testDb.adapter, 'p1', {
      startMethod: 'due_date',
      dueDate: '2026-04-15',
    });
    const ended = endPregnancy(testDb.adapter, 'p1', 'loss');
    expect(ended!.status).toBe('loss');
  });

  it('updateDueDate changes the due date', () => {
    createPregnancyConfig(testDb.adapter, 'p1', {
      startMethod: 'due_date',
      dueDate: '2026-04-15',
    });
    const updated = updateDueDate(testDb.adapter, 'p1', '2026-04-20');
    expect(updated!.dueDate).toBe('2026-04-20');
  });

  it('getPregnancyHistory returns all configs', () => {
    createPregnancyConfig(testDb.adapter, 'p1', {
      startMethod: 'due_date',
      dueDate: '2026-04-15',
    });
    endPregnancy(testDb.adapter, 'p1', 'completed');

    createPregnancyConfig(testDb.adapter, 'p2', {
      startMethod: 'due_date',
      dueDate: '2027-01-01',
    });

    const history = getPregnancyHistory(testDb.adapter);
    expect(history.length).toBe(2);
  });

  it('allows new pregnancy after ending previous one', () => {
    createPregnancyConfig(testDb.adapter, 'p1', {
      startMethod: 'due_date',
      dueDate: '2026-04-15',
    });
    endPregnancy(testDb.adapter, 'p1', 'completed');

    const config = createPregnancyConfig(testDb.adapter, 'p2', {
      startMethod: 'due_date',
      dueDate: '2027-01-01',
    });
    expect(config.id).toBe('p2');
    expect(config.status).toBe('active');
  });
});

describe('Appointment CRUD', () => {
  beforeEach(() => {
    createPregnancyConfig(testDb.adapter, 'p1', {
      startMethod: 'due_date',
      dueDate: '2026-08-01',
    });
  });

  it('creates an appointment', () => {
    const appt = createAppointment(testDb.adapter, 'a1', {
      pregnancyId: 'p1',
      title: '12-week scan',
      date: '2026-04-15',
    });
    expect(appt.id).toBe('a1');
    expect(appt.title).toBe('12-week scan');
    expect(appt.completed).toBe(false);
  });

  it('creates appointment with all fields', () => {
    const appt = createAppointment(testDb.adapter, 'a1', {
      pregnancyId: 'p1',
      title: '20-week ultrasound',
      date: '2026-05-20',
      time: '10:30',
      location: 'City Hospital',
      notes: 'Bring insurance card',
    });
    expect(appt.time).toBe('10:30');
    expect(appt.location).toBe('City Hospital');
    expect(appt.notes).toBe('Bring insurance card');
  });

  it('gets appointments by pregnancy', () => {
    createAppointment(testDb.adapter, 'a1', {
      pregnancyId: 'p1',
      title: 'Scan 1',
      date: '2026-04-15',
    });
    createAppointment(testDb.adapter, 'a2', {
      pregnancyId: 'p1',
      title: 'Scan 2',
      date: '2026-05-15',
    });
    const appts = getAppointmentsByPregnancy(testDb.adapter, 'p1');
    expect(appts.length).toBe(2);
    expect(appts[0].date).toBe('2026-04-15');
  });

  it('gets upcoming appointments (future, uncompleted)', () => {
    createAppointment(testDb.adapter, 'a1', {
      pregnancyId: 'p1',
      title: 'Past',
      date: '2026-03-01',
    });
    createAppointment(testDb.adapter, 'a2', {
      pregnancyId: 'p1',
      title: 'Future 1',
      date: '2026-04-15',
    });
    createAppointment(testDb.adapter, 'a3', {
      pregnancyId: 'p1',
      title: 'Future 2',
      date: '2026-05-01',
    });

    const upcoming = getUpcomingAppointments(testDb.adapter, 'p1', '2026-03-22');
    expect(upcoming.length).toBe(2);
    expect(upcoming[0].title).toBe('Future 1');
  });

  it('updates an appointment', () => {
    createAppointment(testDb.adapter, 'a1', {
      pregnancyId: 'p1',
      title: 'Old title',
      date: '2026-04-15',
    });
    const updated = updateAppointment(testDb.adapter, 'a1', {
      title: 'New title',
      location: 'New place',
    });
    expect(updated!.title).toBe('New title');
    expect(updated!.location).toBe('New place');
  });

  it('completes an appointment', () => {
    createAppointment(testDb.adapter, 'a1', {
      pregnancyId: 'p1',
      title: 'Checkup',
      date: '2026-04-15',
    });
    const completed = completeAppointment(testDb.adapter, 'a1');
    expect(completed!.completed).toBe(true);
  });

  it('deletes an appointment', () => {
    createAppointment(testDb.adapter, 'a1', {
      pregnancyId: 'p1',
      title: 'Checkup',
      date: '2026-04-15',
    });
    deleteAppointment(testDb.adapter, 'a1');
    const appts = getAppointmentsByPregnancy(testDb.adapter, 'p1');
    expect(appts.length).toBe(0);
  });

  it('cascades delete when pregnancy is deleted', () => {
    createAppointment(testDb.adapter, 'a1', {
      pregnancyId: 'p1',
      title: 'Checkup',
      date: '2026-04-15',
    });
    // Delete the pregnancy config directly
    testDb.adapter.execute('DELETE FROM cy_pregnancy_config WHERE id = ?', ['p1']);
    const appts = getAppointmentsByPregnancy(testDb.adapter, 'p1');
    expect(appts.length).toBe(0);
  });
});

// ── Integration Tests ─────────────────────────────────────────────────

describe('Pregnancy Integration', () => {
  it('full flow: LMP -> pregnancy mode -> end pregnancy', () => {
    // Create pregnancy from LMP
    const config = createPregnancyConfig(testDb.adapter, 'p1', {
      startMethod: 'last_period',
      lastPeriodDate: '2025-11-01',
    });
    expect(config.status).toBe('active');
    expect(config.dueDate).toBe('2026-08-08');

    // Check current week (around week 20-21 for 2026-03-22)
    const week = getCurrentWeek(config.dueDate, '2026-03-22', config.lastPeriodDate);
    expect(week).toBeGreaterThanOrEqual(20);
    expect(week).toBeLessThanOrEqual(22);

    // Baby info for that week
    const info = getPregnancyWeekInfo(week);
    expect(info.trimester).toBe(2);

    // Add appointments
    createAppointment(testDb.adapter, 'a1', {
      pregnancyId: 'p1',
      title: '20-week anatomy scan',
      date: '2026-03-25',
    });

    const upcoming = getUpcomingAppointments(testDb.adapter, 'p1', '2026-03-22');
    expect(upcoming.length).toBe(1);

    // End pregnancy (baby arrived)
    const ended = endPregnancy(testDb.adapter, 'p1', 'completed');
    expect(ended!.status).toBe('completed');

    // Verify no active pregnancy
    expect(getActivePregnancy(testDb.adapter)).toBeNull();

    // Data preserved in history
    const history = getPregnancyHistory(testDb.adapter);
    expect(history.length).toBe(1);
    expect(history[0].status).toBe('completed');
  });

  it('multiple pregnancies: first completed, second active', () => {
    createPregnancyConfig(testDb.adapter, 'p1', {
      startMethod: 'due_date',
      dueDate: '2026-04-15',
    });
    endPregnancy(testDb.adapter, 'p1', 'completed');

    createPregnancyConfig(testDb.adapter, 'p2', {
      startMethod: 'due_date',
      dueDate: '2027-01-01',
    });

    const active = getActivePregnancy(testDb.adapter);
    expect(active!.id).toBe('p2');

    const history = getPregnancyHistory(testDb.adapter);
    expect(history.length).toBe(2);
  });
});
