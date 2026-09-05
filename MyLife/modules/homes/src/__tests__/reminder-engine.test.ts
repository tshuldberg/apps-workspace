import { describe, it, expect } from 'vitest';
import type { DatabaseAdapter } from '@mylife/db';
import {
  calculateScheduleStatus,
  calculateNextDueDate,
  getDefaultSchedules,
  sortByUrgency,
  markComplete,
  getTaskTypeLabel,
} from '../engines/reminder-engine';
import type { ScheduleWithStatus } from '../engines/reminder-engine';
import { createProperty, deleteProperty } from '../db/properties';
import {
  createSchedule,
  deactivateSchedule,
  updateSchedule,
} from '../db/schedules';
import { getSetting, setSetting } from '../db/settings';
import { MaintenanceScheduleSchema, PropertySchema } from '../types';

// ── Mock Database ──

function createMockDb(queryResults: Record<string, unknown[]> = {}) {
  const executed: Array<{ sql: string; params: unknown[] }> = [];
  return {
    db: {
      query: <T>(sql: string, _params?: unknown[]): T[] => {
        for (const [pattern, result] of Object.entries(queryResults)) {
          if (sql.includes(pattern)) return result as T[];
        }
        return [] as T[];
      },
      execute: (sql: string, params?: unknown[]) => {
        executed.push({ sql, params: params ?? [] });
      },
      transaction: (fn: () => void) => fn(),
    } as DatabaseAdapter,
    executed,
  };
}

// ── calculateScheduleStatus ──

describe('calculateScheduleStatus', () => {
  it('returns "ok" when next_due_date is > 14 days away', () => {
    expect(calculateScheduleStatus('2026-06-15', '2026-05-01')).toBe('ok');
  });

  it('returns "due_soon" when within 14 days of next_due_date', () => {
    expect(calculateScheduleStatus('2026-05-10', '2026-05-01')).toBe('due_soon');
  });

  it('returns "due_soon" on exactly 14 days before due', () => {
    expect(calculateScheduleStatus('2026-05-15', '2026-05-01')).toBe('due_soon');
  });

  it('returns "overdue" when past next_due_date', () => {
    expect(calculateScheduleStatus('2026-04-15', '2026-05-01')).toBe('overdue');
  });

  it('returns "unknown" when next_due_date is null', () => {
    expect(calculateScheduleStatus(null)).toBe('unknown');
  });

  it('returns "due_soon" on the exact due date (0 days remaining)', () => {
    expect(calculateScheduleStatus('2026-05-01', '2026-05-01')).toBe('due_soon');
  });
});

// ── calculateNextDueDate ──

describe('calculateNextDueDate', () => {
  it('computes correct date from last_completed_date + interval_months', () => {
    const result = calculateNextDueDate({
      intervalMonths: 3,
      lastCompletedDate: '2026-01-15',
      createdAt: '2025-12-01T00:00:00.000Z',
      seasonPreference: null,
      snoozeDays: 0,
    });
    expect(result).toBe('2026-04-15');
  });

  it('falls back to createdAt when last_completed_date is null', () => {
    const result = calculateNextDueDate({
      intervalMonths: 6,
      lastCompletedDate: null,
      createdAt: '2026-01-01T00:00:00.000Z',
      seasonPreference: null,
      snoozeDays: 0,
    });
    expect(result).toBe('2026-07-01');
  });

  it('adds snooze_days correctly', () => {
    const result = calculateNextDueDate({
      intervalMonths: 3,
      lastCompletedDate: '2026-01-01',
      createdAt: '2025-12-01T00:00:00.000Z',
      seasonPreference: null,
      snoozeDays: 14,
    });
    expect(result).toBe('2026-04-15');
  });

  it('shifts forward to spring (March 1) when season_preference is "spring" and raw date is in January', () => {
    const result = calculateNextDueDate({
      intervalMonths: 6,
      lastCompletedDate: '2025-07-01',
      createdAt: '2025-01-01T00:00:00.000Z',
      seasonPreference: 'spring',
      snoozeDays: 0,
    });
    // 2025-07-01 + 6 months = 2026-01-01, which is winter, shift to spring = 2026-03-01
    expect(result).toBe('2026-03-01');
  });

  it('shifts forward to fall (September 1) when season_preference is "fall" and raw date is in July', () => {
    const result = calculateNextDueDate({
      intervalMonths: 6,
      lastCompletedDate: '2026-01-01',
      createdAt: '2025-01-01T00:00:00.000Z',
      seasonPreference: 'fall',
      snoozeDays: 0,
    });
    // 2026-01-01 + 6 months = 2026-07-01, which is summer, shift to fall = 2026-09-01
    expect(result).toBe('2026-09-01');
  });

  it('leaves date unchanged when already in preferred season', () => {
    const result = calculateNextDueDate({
      intervalMonths: 12,
      lastCompletedDate: '2025-03-15',
      createdAt: '2025-01-01T00:00:00.000Z',
      seasonPreference: 'spring',
      snoozeDays: 0,
    });
    // 2025-03-15 + 12 months = 2026-03-15, already in spring (Mar-May)
    expect(result).toBe('2026-03-15');
  });

  it('shifts to next year season start when raw date is past current year window', () => {
    const result = calculateNextDueDate({
      intervalMonths: 3,
      lastCompletedDate: '2026-07-01',
      createdAt: '2025-01-01T00:00:00.000Z',
      seasonPreference: 'spring',
      snoozeDays: 0,
    });
    // 2026-07-01 + 3 months = 2026-10-01, past spring, shift to next spring = 2027-03-01
    expect(result).toBe('2027-03-01');
  });

  it('handles winter season preference correctly (Dec-Feb wrap)', () => {
    const result = calculateNextDueDate({
      intervalMonths: 6,
      lastCompletedDate: '2025-06-01',
      createdAt: '2025-01-01T00:00:00.000Z',
      seasonPreference: 'winter',
      snoozeDays: 0,
    });
    // 2025-06-01 + 6 months = 2025-12-01, which IS winter (Dec), so no shift
    expect(result).toBe('2025-12-01');
  });

  it('handles winter shift when raw date is in summer', () => {
    const result = calculateNextDueDate({
      intervalMonths: 3,
      lastCompletedDate: '2026-03-01',
      createdAt: '2025-01-01T00:00:00.000Z',
      seasonPreference: 'winter',
      snoozeDays: 0,
    });
    // 2026-03-01 + 3 months = 2026-06-01, which is summer, shift to winter = 2026-12-01
    expect(result).toBe('2026-12-01');
  });

  it('combines season shift and snooze days', () => {
    const result = calculateNextDueDate({
      intervalMonths: 6,
      lastCompletedDate: '2025-07-01',
      createdAt: '2025-01-01T00:00:00.000Z',
      seasonPreference: 'spring',
      snoozeDays: 14,
    });
    // 2025-07-01 + 6 months = 2026-01-01, shift to spring = 2026-03-01, + 14 days = 2026-03-15
    expect(result).toBe('2026-03-15');
  });
});

// ── getDefaultSchedules ──

describe('getDefaultSchedules', () => {
  it('returns exactly 10 presets for house + own', () => {
    const presets = getDefaultSchedules('house', 'own');
    expect(presets).toHaveLength(10);
  });

  it('returns exactly 10 presets for townhouse + own', () => {
    const presets = getDefaultSchedules('townhouse', 'own');
    expect(presets).toHaveLength(10);
  });

  it('returns exactly 5 presets for condo + own', () => {
    const presets = getDefaultSchedules('condo', 'own');
    expect(presets).toHaveLength(5);
  });

  it('returns exactly 5 presets for apartment + own', () => {
    const presets = getDefaultSchedules('apartment', 'own');
    expect(presets).toHaveLength(5);
  });

  it('returns exactly 3 presets for other + own', () => {
    const presets = getDefaultSchedules('other', 'own');
    expect(presets).toHaveLength(3);
  });

  it('returns exactly 4 renter presets for house + rent', () => {
    const presets = getDefaultSchedules('house', 'rent');
    expect(presets).toHaveLength(4);
    const types = presets.map((p) => p.taskType);
    expect(types).toContain('hvac_filter');
    expect(types).toContain('smoke_detector');
    expect(types).toContain('dryer_vent');
    expect(types).toContain('appliance_service');
  });

  it('returns exactly 4 renter presets for apartment + rent', () => {
    const presets = getDefaultSchedules('apartment', 'rent');
    expect(presets).toHaveLength(4);
  });

  it('hvac_filter preset has interval_months=3 and no season_preference', () => {
    const presets = getDefaultSchedules('house', 'own');
    const hvac = presets.find((p) => p.taskType === 'hvac_filter');
    expect(hvac).toBeDefined();
    expect(hvac!.intervalMonths).toBe(3);
    expect(hvac!.seasonPreference).toBeNull();
  });

  it('gutter_cleaning preset has interval_months=6 and season_preference="fall"', () => {
    const presets = getDefaultSchedules('house', 'own');
    const gutter = presets.find((p) => p.taskType === 'gutter_cleaning');
    expect(gutter).toBeDefined();
    expect(gutter!.intervalMonths).toBe(6);
    expect(gutter!.seasonPreference).toBe('fall');
  });
});

// ── sortByUrgency ──

describe('sortByUrgency', () => {
  it('sorts overdue before due_soon, due_soon before ok', () => {
    const schedules: ScheduleWithStatus[] = [
      makeScheduleWithStatus('s1', 'ok', '2026-06-01'),
      makeScheduleWithStatus('s2', 'overdue', '2026-03-01'),
      makeScheduleWithStatus('s3', 'due_soon', '2026-04-15'),
    ];

    const sorted = sortByUrgency(schedules);
    expect(sorted[0].id).toBe('s2');
    expect(sorted[1].id).toBe('s3');
    expect(sorted[2].id).toBe('s1');
  });

  it('sorts within same status by next_due_date ascending', () => {
    const schedules: ScheduleWithStatus[] = [
      makeScheduleWithStatus('s1', 'overdue', '2026-03-15'),
      makeScheduleWithStatus('s2', 'overdue', '2026-03-01'),
    ];

    const sorted = sortByUrgency(schedules);
    expect(sorted[0].id).toBe('s2');
    expect(sorted[1].id).toBe('s1');
  });

  it('places unknown status last', () => {
    const schedules: ScheduleWithStatus[] = [
      makeScheduleWithStatus('s1', 'unknown', null),
      makeScheduleWithStatus('s2', 'ok', '2026-06-01'),
    ];

    const sorted = sortByUrgency(schedules);
    expect(sorted[0].id).toBe('s2');
    expect(sorted[1].id).toBe('s1');
  });
});

// ── markComplete ──

describe('markComplete', () => {
  it('sets last_completed_date to today and resets snooze values', () => {
    const result = markComplete(
      {
        intervalMonths: 3,
        seasonPreference: null,
        createdAt: '2025-01-01T00:00:00.000Z',
      },
      '2026-05-01',
    );

    expect(result.lastCompletedDate).toBe('2026-05-01');
    expect(result.snoozeDays).toBe(0);
    expect(result.snoozeCount).toBe(0);
  });

  it('recalculates next_due_date from completion date', () => {
    const result = markComplete(
      {
        intervalMonths: 6,
        seasonPreference: null,
        createdAt: '2025-01-01T00:00:00.000Z',
      },
      '2026-05-01',
    );

    expect(result.nextDueDate).toBe('2026-11-01');
  });

  it('applies season preference when recalculating', () => {
    const result = markComplete(
      {
        intervalMonths: 6,
        seasonPreference: 'fall',
        createdAt: '2025-01-01T00:00:00.000Z',
      },
      '2026-01-01',
    );

    // 2026-01-01 + 6 months = 2026-07-01 (summer), shift to fall = 2026-09-01
    expect(result.nextDueDate).toBe('2026-09-01');
  });
});

// ── getTaskTypeLabel ──

describe('getTaskTypeLabel', () => {
  it('returns display name for known task type', () => {
    expect(getTaskTypeLabel('hvac_filter')).toBe('HVAC Filter Change');
    expect(getTaskTypeLabel('gutter_cleaning')).toBe('Gutter Cleaning');
  });

  it('returns custom label for custom task type', () => {
    expect(getTaskTypeLabel('custom', 'Pool Cleaning')).toBe('Pool Cleaning');
  });

  it('returns "Custom" when no custom label provided', () => {
    expect(getTaskTypeLabel('custom')).toBe('Custom');
  });
});

// ── Zod Validation ──

describe('Zod validation', () => {
  it('rejects schedule with interval_months < 1', () => {
    const result = MaintenanceScheduleSchema.safeParse(
      makeValidSchedule({ intervalMonths: 0 }),
    );
    expect(result.success).toBe(false);
  });

  it('rejects schedule with interval_months > 120', () => {
    const result = MaintenanceScheduleSchema.safeParse(
      makeValidSchedule({ intervalMonths: 121 }),
    );
    expect(result.success).toBe(false);
  });

  it('accepts schedule with interval_months = 1', () => {
    const result = MaintenanceScheduleSchema.safeParse(
      makeValidSchedule({ intervalMonths: 1 }),
    );
    expect(result.success).toBe(true);
  });

  it('accepts schedule with interval_months = 120', () => {
    const result = MaintenanceScheduleSchema.safeParse(
      makeValidSchedule({ intervalMonths: 120 }),
    );
    expect(result.success).toBe(true);
  });

  it('accepts valid PropertySchema with all required fields', () => {
    const result = PropertySchema.safeParse({
      id: 'prop-1',
      name: 'Main House',
      address: '123 Oak St',
      city: 'Austin',
      state: 'TX',
      yearBuilt: 2015,
      sqft: 2400,
      propertyType: 'house',
      ownershipType: 'own',
      listingId: null,
      notes: null,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    });
    expect(result.success).toBe(true);
  });
});

// ── Property CRUD ──

describe('property CRUD', () => {
  it('creates a property with required fields', () => {
    const { db, executed } = createMockDb();
    const prop = createProperty(db, 'prop-1', {
      name: 'Main House',
    });

    expect(prop.id).toBe('prop-1');
    expect(prop.name).toBe('Main House');
    expect(prop.propertyType).toBe('house');
    expect(prop.ownershipType).toBe('own');
    expect(executed).toHaveLength(1);
    expect(executed[0].sql).toContain('INSERT INTO hm_properties');
  });

  it('creates a property with all optional fields', () => {
    const { db } = createMockDb();
    const prop = createProperty(db, 'prop-2', {
      name: 'Beach Condo',
      address: '456 Ocean Dr',
      city: 'Miami',
      state: 'FL',
      yearBuilt: 2020,
      sqft: 1200,
      propertyType: 'condo',
      ownershipType: 'rent',
      notes: 'Great view',
    });

    expect(prop.propertyType).toBe('condo');
    expect(prop.ownershipType).toBe('rent');
    expect(prop.city).toBe('Miami');
  });

  it('deletes a property', () => {
    const { db, executed } = createMockDb();
    deleteProperty(db, 'prop-1');

    expect(executed).toHaveLength(1);
    expect(executed[0].sql).toContain('DELETE FROM hm_properties');
    expect(executed[0].params[0]).toBe('prop-1');
  });
});

// ── Schedule CRUD ──

describe('schedule CRUD', () => {
  it('creates a schedule with defaults', () => {
    const { db, executed } = createMockDb();
    const sched = createSchedule(db, 'sched-1', {
      propertyId: 'prop-1',
      taskType: 'hvac_filter',
      intervalMonths: 3,
    });

    expect(sched.id).toBe('sched-1');
    expect(sched.taskType).toBe('hvac_filter');
    expect(sched.intervalMonths).toBe(3);
    expect(sched.isActive).toBe(true);
    expect(sched.snoozeDays).toBe(0);
    expect(sched.snoozeCount).toBe(0);
    expect(executed).toHaveLength(1);
    expect(executed[0].sql).toContain('INSERT INTO hm_maintenance_schedules');
  });

  it('deactivates a schedule (does not delete)', () => {
    const { db, executed } = createMockDb();
    deactivateSchedule(db, 'sched-1');

    expect(executed).toHaveLength(1);
    expect(executed[0].sql).toContain('UPDATE hm_maintenance_schedules SET is_active = 0');
  });

  it('updates schedule fields', () => {
    const { db, executed } = createMockDb();
    updateSchedule(db, 'sched-1', {
      intervalMonths: 6,
      snoozeDays: 14,
      snoozeCount: 1,
    });

    expect(executed).toHaveLength(1);
    expect(executed[0].sql).toContain('UPDATE hm_maintenance_schedules SET');
    expect(executed[0].params).toContain(6);
    expect(executed[0].params).toContain(14);
    expect(executed[0].params).toContain(1);
  });
});

// ── Settings CRUD ──

describe('settings CRUD', () => {
  it('returns null for missing setting', () => {
    const { db } = createMockDb();
    expect(getSetting(db, 'nonexistent')).toBeNull();
  });

  it('returns value for existing setting', () => {
    const { db } = createMockDb({
      'hm_settings': [{ value: 'true' }],
    });
    expect(getSetting(db, 'reminderNotificationsEnabled')).toBe('true');
  });

  it('upserts a setting', () => {
    const { db, executed } = createMockDb();
    setSetting(db, 'reminderNotificationsEnabled', 'false');

    expect(executed).toHaveLength(1);
    expect(executed[0].sql).toContain('INSERT INTO hm_settings');
    expect(executed[0].sql).toContain('ON CONFLICT');
  });
});

// ── Helpers ──

function makeScheduleWithStatus(
  id: string,
  status: 'overdue' | 'due_soon' | 'ok' | 'unknown',
  nextDueDate: string | null,
): ScheduleWithStatus {
  return {
    id,
    propertyId: 'prop-1',
    taskType: 'hvac_filter',
    taskTypeCustom: null,
    intervalMonths: 3,
    seasonPreference: null,
    lastCompletedDate: null,
    nextDueDate,
    isActive: true,
    snoozeDays: 0,
    snoozeCount: 0,
    notes: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    status,
  };
}

function makeValidSchedule(overrides: Record<string, unknown> = {}) {
  return {
    id: 'sched-1',
    propertyId: 'prop-1',
    taskType: 'hvac_filter',
    taskTypeCustom: null,
    intervalMonths: 3,
    seasonPreference: null,
    lastCompletedDate: null,
    nextDueDate: null,
    isActive: true,
    snoozeDays: 0,
    snoozeCount: 0,
    notes: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}
