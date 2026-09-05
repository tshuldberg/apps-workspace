import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createModuleTestDatabase, type InMemoryTestDatabase } from '@mylife/db';
import { PETS_MODULE } from '../definition';
import {
  createPet,
  createFeedingSchedule,
  listFeedingSchedulesForPet,
  updateFeedingSchedule,
  deleteFeedingSchedule,
  createFeedingLog,
  listFeedingLogsForDate,
  deleteFeedingLog,
  upsertDietaryInfo,
  getDietaryInfo,
  createFoodTransition,
  getActiveTransition,
  completeTransition,
  deletePet,
} from '../db/crud';
import {
  getDailyFeedingStatus,
  calculateTransitionRatio,
} from '../engine/feeding';

let testDb: InMemoryTestDatabase;

beforeEach(() => {
  testDb = createModuleTestDatabase('pets', PETS_MODULE.migrations!);
});

afterEach(() => {
  testDb.close();
});

function createTestPet(id = 'pet1') {
  return createPet(testDb.adapter, id, {
    name: 'Luna',
    species: 'dog',
    breed: 'Golden Retriever',
  });
}

// ── getDailyFeedingStatus ────────────────────────────────────────────

describe('getDailyFeedingStatus', () => {
  it('returns allComplete=true when all meals fed', () => {
    const schedules = [
      { id: 's1', feedAt: '07:30' },
      { id: 's2', feedAt: '17:30' },
    ];
    const logs = [
      { scheduleId: 's1', date: '2026-03-22', fedAt: '2026-03-22T07:35:00Z' },
      { scheduleId: 's2', date: '2026-03-22', fedAt: '2026-03-22T17:40:00Z' },
    ];
    const result = getDailyFeedingStatus(schedules, logs, '18:00', '2026-03-22');
    expect(result.allComplete).toBe(true);
    expect(result.fedCount).toBe(2);
    expect(result.totalCount).toBe(2);
  });

  it('returns allComplete=false when 1 of 2 meals unfed', () => {
    const schedules = [
      { id: 's1', feedAt: '07:30' },
      { id: 's2', feedAt: '17:30' },
    ];
    const logs = [
      { scheduleId: 's1', date: '2026-03-22', fedAt: '2026-03-22T07:35:00Z' },
    ];
    const result = getDailyFeedingStatus(schedules, logs, '18:00', '2026-03-22');
    expect(result.allComplete).toBe(false);
    expect(result.fedCount).toBe(1);
  });

  it('returns "pending" for future meal time', () => {
    const schedules = [{ id: 's1', feedAt: '17:30' }];
    const result = getDailyFeedingStatus(schedules, [], '10:00', '2026-03-22');
    expect(result.schedules[0].status).toBe('pending');
  });

  it('returns "missed" for past unfed meal', () => {
    const schedules = [{ id: 's1', feedAt: '07:30' }];
    const result = getDailyFeedingStatus(schedules, [], '10:00', '2026-03-22');
    expect(result.schedules[0].status).toBe('missed');
  });

  it('returns allComplete=true when no schedules (vacuous truth)', () => {
    const result = getDailyFeedingStatus([], [], '10:00', '2026-03-22');
    expect(result.allComplete).toBe(true);
    expect(result.totalCount).toBe(0);
  });

  it('handles multiple logs for same schedule+date (uses first)', () => {
    const schedules = [{ id: 's1', feedAt: '07:30' }];
    const logs = [
      { scheduleId: 's1', date: '2026-03-22', fedAt: '2026-03-22T07:35:00Z' },
      { scheduleId: 's1', date: '2026-03-22', fedAt: '2026-03-22T07:50:00Z' },
    ];
    const result = getDailyFeedingStatus(schedules, logs, '10:00', '2026-03-22');
    expect(result.schedules[0].status).toBe('fed');
    expect(result.schedules[0].fedAt).toBe('2026-03-22T07:35:00Z');
  });
});

// ── calculateTransitionRatio ─────────────────────────────────────────

describe('calculateTransitionRatio', () => {
  // 10-day duration
  it('day 1 of 10 returns old=75%, new=25%', () => {
    const r = calculateTransitionRatio('2026-03-22', 10, '2026-03-22');
    expect(r.oldPercent).toBe(75);
    expect(r.newPercent).toBe(25);
    expect(r.dayNumber).toBe(1);
    expect(r.isComplete).toBe(false);
  });

  it('day 5 of 10 returns old=50%, new=50%', () => {
    const r = calculateTransitionRatio('2026-03-22', 10, '2026-03-26');
    expect(r.oldPercent).toBe(50);
    expect(r.newPercent).toBe(50);
  });

  it('day 8 of 10 returns old=25%, new=75%', () => {
    const r = calculateTransitionRatio('2026-03-22', 10, '2026-03-29');
    expect(r.oldPercent).toBe(25);
    expect(r.newPercent).toBe(75);
  });

  it('day 10 of 10 returns complete', () => {
    const r = calculateTransitionRatio('2026-03-22', 10, '2026-03-31');
    expect(r.oldPercent).toBe(0);
    expect(r.newPercent).toBe(100);
    expect(r.isComplete).toBe(true);
  });

  // 7-day duration
  it('day 1 of 7 returns old=75%, new=25%', () => {
    const r = calculateTransitionRatio('2026-03-22', 7, '2026-03-22');
    expect(r.oldPercent).toBe(75);
    expect(r.newPercent).toBe(25);
  });

  it('day 7 of 7 returns complete', () => {
    const r = calculateTransitionRatio('2026-03-22', 7, '2026-03-28');
    expect(r.oldPercent).toBe(0);
    expect(r.newPercent).toBe(100);
    expect(r.isComplete).toBe(true);
  });

  // 14-day duration
  it('day 1 of 14 returns old=75%, new=25%', () => {
    const r = calculateTransitionRatio('2026-03-22', 14, '2026-03-22');
    expect(r.oldPercent).toBe(75);
    expect(r.newPercent).toBe(25);
  });

  it('day 14 of 14 returns complete', () => {
    const r = calculateTransitionRatio('2026-03-22', 14, '2026-04-04');
    expect(r.oldPercent).toBe(0);
    expect(r.newPercent).toBe(100);
    expect(r.isComplete).toBe(true);
  });

  it('negative elapsed days returns "not started"', () => {
    const r = calculateTransitionRatio('2026-03-25', 10, '2026-03-22');
    expect(r.phase).toBe('Not started yet');
    expect(r.oldPercent).toBe(100);
    expect(r.newPercent).toBe(0);
    expect(r.isComplete).toBe(false);
  });

  it('returns correct progressPct at each boundary', () => {
    // Day 3 of 10 = 30%
    const r1 = calculateTransitionRatio('2026-03-22', 10, '2026-03-24');
    expect(r1.progressPct).toBe(30);

    // Day 10 of 10 = 100%
    const r2 = calculateTransitionRatio('2026-03-22', 10, '2026-03-31');
    expect(r2.progressPct).toBe(100);
  });

  it('past completion returns complete', () => {
    const r = calculateTransitionRatio('2026-03-22', 10, '2026-04-10');
    expect(r.isComplete).toBe(true);
    expect(r.oldPercent).toBe(0);
    expect(r.newPercent).toBe(100);
    expect(r.progressPct).toBe(100);
  });
});

// ── Feeding CRUD Integration Tests ───────────────────────────────────

describe('Feeding Schedule Extended CRUD', () => {
  it('creates schedule with new V3 fields', () => {
    createTestPet();
    const schedule = createFeedingSchedule(testDb.adapter, 'fs1', {
      petId: 'pet1',
      label: 'Breakfast',
      foodName: 'Blue Buffalo',
      feedAt: '07:30',
      portionSize: 1.5,
      portionUnit: 'cups',
      mealLabel: 'breakfast',
      reminderEnabled: true,
    });
    expect(schedule.portionSize).toBe(1.5);
    expect(schedule.portionUnit).toBe('cups');
    expect(schedule.mealLabel).toBe('breakfast');
    expect(schedule.reminderEnabled).toBe(true);
    expect(schedule.sortOrder).toBe(0);
  });

  it('updates feeding schedule', () => {
    createTestPet();
    createFeedingSchedule(testDb.adapter, 'fs1', {
      petId: 'pet1',
      label: 'Breakfast',
      feedAt: '07:30',
    });
    const updated = updateFeedingSchedule(testDb.adapter, 'fs1', {
      foodName: 'Orijen Original',
      portionSize: 2.0,
      reminderEnabled: false,
    });
    expect(updated!.foodName).toBe('Orijen Original');
    expect(updated!.portionSize).toBe(2.0);
    expect(updated!.reminderEnabled).toBe(false);
  });

  it('deletes feeding schedule', () => {
    createTestPet();
    createFeedingSchedule(testDb.adapter, 'fs1', {
      petId: 'pet1',
      label: 'Breakfast',
      feedAt: '07:30',
    });
    deleteFeedingSchedule(testDb.adapter, 'fs1');
    expect(listFeedingSchedulesForPet(testDb.adapter, 'pet1')).toHaveLength(0);
  });
});

describe('Feeding Log CRUD', () => {
  it('creates feeding log and retrieves by date', () => {
    createTestPet();
    createFeedingSchedule(testDb.adapter, 'fs1', {
      petId: 'pet1',
      label: 'Breakfast',
      feedAt: '07:30',
    });
    const log = createFeedingLog(testDb.adapter, 'fl1', {
      scheduleId: 'fs1',
      petId: 'pet1',
      date: '2026-03-22',
    });
    expect(log.scheduleId).toBe('fs1');
    expect(log.date).toBe('2026-03-22');

    const logs = listFeedingLogsForDate(testDb.adapter, 'pet1', '2026-03-22');
    expect(logs).toHaveLength(1);
    expect(logs[0].id).toBe('fl1');
  });

  it('rejects duplicate log for same schedule+date', () => {
    createTestPet();
    createFeedingSchedule(testDb.adapter, 'fs1', {
      petId: 'pet1',
      label: 'Breakfast',
      feedAt: '07:30',
    });
    createFeedingLog(testDb.adapter, 'fl1', {
      scheduleId: 'fs1',
      petId: 'pet1',
      date: '2026-03-22',
    });
    expect(() =>
      createFeedingLog(testDb.adapter, 'fl2', {
        scheduleId: 'fs1',
        petId: 'pet1',
        date: '2026-03-22',
      }),
    ).toThrow('A feeding log already exists');
  });

  it('allows log for different date', () => {
    createTestPet();
    createFeedingSchedule(testDb.adapter, 'fs1', {
      petId: 'pet1',
      label: 'Breakfast',
      feedAt: '07:30',
    });
    createFeedingLog(testDb.adapter, 'fl1', {
      scheduleId: 'fs1',
      petId: 'pet1',
      date: '2026-03-22',
    });
    const log2 = createFeedingLog(testDb.adapter, 'fl2', {
      scheduleId: 'fs1',
      petId: 'pet1',
      date: '2026-03-23',
    });
    expect(log2.date).toBe('2026-03-23');
  });

  it('deletes feeding log', () => {
    createTestPet();
    createFeedingSchedule(testDb.adapter, 'fs1', {
      petId: 'pet1',
      label: 'Breakfast',
      feedAt: '07:30',
    });
    createFeedingLog(testDb.adapter, 'fl1', {
      scheduleId: 'fs1',
      petId: 'pet1',
      date: '2026-03-22',
    });
    deleteFeedingLog(testDb.adapter, 'fl1');
    expect(listFeedingLogsForDate(testDb.adapter, 'pet1', '2026-03-22')).toHaveLength(0);
  });
});

describe('Dietary Info CRUD', () => {
  it('upsert creates on first call', () => {
    createTestPet();
    const info = upsertDietaryInfo(testDb.adapter, 'di1', {
      petId: 'pet1',
      allergies: ['chicken', 'soy'],
      restrictions: ['grain-free'],
      specialInstructions: 'Mix with warm water',
    });
    expect(info.allergies).toEqual(['chicken', 'soy']);
    expect(info.restrictions).toEqual(['grain-free']);
    expect(info.specialInstructions).toBe('Mix with warm water');
  });

  it('upsert updates on second call', () => {
    createTestPet();
    upsertDietaryInfo(testDb.adapter, 'di1', {
      petId: 'pet1',
      allergies: ['chicken'],
    });
    const updated = upsertDietaryInfo(testDb.adapter, 'di2', {
      petId: 'pet1',
      allergies: ['chicken', 'beef'],
      restrictions: ['low-sodium'],
    });
    expect(updated.allergies).toEqual(['chicken', 'beef']);
    expect(updated.restrictions).toEqual(['low-sodium']);
  });

  it('getDietaryInfo returns null when none exists', () => {
    createTestPet();
    expect(getDietaryInfo(testDb.adapter, 'pet1')).toBeNull();
  });

  it('allergies stored and retrieved as JSON array', () => {
    createTestPet();
    upsertDietaryInfo(testDb.adapter, 'di1', {
      petId: 'pet1',
      allergies: ['chicken', 'soy', 'corn'],
    });
    const info = getDietaryInfo(testDb.adapter, 'pet1');
    expect(Array.isArray(info!.allergies)).toBe(true);
    expect(info!.allergies).toHaveLength(3);
  });
});

describe('Food Transition CRUD', () => {
  it('creates food transition', () => {
    createTestPet();
    const transition = createFoodTransition(testDb.adapter, 'ft1', {
      petId: 'pet1',
      previousFood: 'Blue Buffalo',
      newFood: 'Orijen Original',
      startDate: '2026-03-22',
      durationDays: 10,
    });
    expect(transition.previousFood).toBe('Blue Buffalo');
    expect(transition.newFood).toBe('Orijen Original');
    expect(transition.status).toBe('active');
  });

  it('auto-cancels previous active transition', () => {
    createTestPet();
    createFoodTransition(testDb.adapter, 'ft1', {
      petId: 'pet1',
      previousFood: 'Food A',
      newFood: 'Food B',
      startDate: '2026-03-20',
      durationDays: 10,
    });
    createFoodTransition(testDb.adapter, 'ft2', {
      petId: 'pet1',
      previousFood: 'Food B',
      newFood: 'Food C',
      startDate: '2026-03-22',
      durationDays: 7,
    });

    const active = getActiveTransition(testDb.adapter, 'pet1');
    expect(active!.id).toBe('ft2');
    expect(active!.newFood).toBe('Food C');
  });

  it('rejects same previous and new food', () => {
    createTestPet();
    expect(() =>
      createFoodTransition(testDb.adapter, 'ft1', {
        petId: 'pet1',
        previousFood: 'Blue Buffalo',
        newFood: 'Blue Buffalo',
        startDate: '2026-03-22',
      }),
    ).toThrow('Previous and new food must be different');
  });

  it('completes transition', () => {
    createTestPet();
    createFoodTransition(testDb.adapter, 'ft1', {
      petId: 'pet1',
      previousFood: 'Food A',
      newFood: 'Food B',
      startDate: '2026-03-22',
      durationDays: 10,
    });
    const completed = completeTransition(testDb.adapter, 'ft1');
    expect(completed!.status).toBe('completed');
    expect(getActiveTransition(testDb.adapter, 'pet1')).toBeNull();
  });
});

// ── Cascade Delete ───────────────────────────────────────────────────

describe('Cascade Delete', () => {
  it('deleting pet cascades to feeding logs, dietary info, and transitions', () => {
    createTestPet();
    createFeedingSchedule(testDb.adapter, 'fs1', {
      petId: 'pet1',
      label: 'Breakfast',
      feedAt: '07:30',
    });
    createFeedingLog(testDb.adapter, 'fl1', {
      scheduleId: 'fs1',
      petId: 'pet1',
      date: '2026-03-22',
    });
    upsertDietaryInfo(testDb.adapter, 'di1', {
      petId: 'pet1',
      allergies: ['chicken'],
    });
    createFoodTransition(testDb.adapter, 'ft1', {
      petId: 'pet1',
      previousFood: 'Food A',
      newFood: 'Food B',
      startDate: '2026-03-22',
      durationDays: 10,
    });

    deletePet(testDb.adapter, 'pet1');

    expect(listFeedingSchedulesForPet(testDb.adapter, 'pet1')).toHaveLength(0);
    expect(listFeedingLogsForDate(testDb.adapter, 'pet1', '2026-03-22')).toHaveLength(0);
    expect(getDietaryInfo(testDb.adapter, 'pet1')).toBeNull();
    expect(getActiveTransition(testDb.adapter, 'pet1')).toBeNull();
  });
});

// ── Integration: Full Flow ───────────────────────────────────────────

describe('Feeding Integration', () => {
  it('full flow: create schedule -> log meal -> check status', () => {
    createTestPet();
    const schedule = createFeedingSchedule(testDb.adapter, 'fs1', {
      petId: 'pet1',
      label: 'Breakfast',
      foodName: 'Blue Buffalo Chicken',
      feedAt: '07:30',
      portionSize: 1.5,
      portionUnit: 'cups',
      mealLabel: 'breakfast',
    });

    // Before feeding: pending or missed depending on time
    const before = getDailyFeedingStatus(
      [{ id: schedule.id, feedAt: schedule.feedAt }],
      [],
      '10:00',
      '2026-03-22',
    );
    expect(before.allComplete).toBe(false);
    expect(before.schedules[0].status).toBe('missed');

    // Log the meal
    createFeedingLog(testDb.adapter, 'fl1', {
      scheduleId: 'fs1',
      petId: 'pet1',
      date: '2026-03-22',
    });

    const logs = listFeedingLogsForDate(testDb.adapter, 'pet1', '2026-03-22');
    const after = getDailyFeedingStatus(
      [{ id: schedule.id, feedAt: schedule.feedAt }],
      logs.map((l) => ({ scheduleId: l.scheduleId, date: l.date, fedAt: l.fedAt })),
      '10:00',
      '2026-03-22',
    );
    expect(after.allComplete).toBe(true);
    expect(after.schedules[0].status).toBe('fed');
  });

  it('multi-pet data isolation', () => {
    createTestPet('pet1');
    createPet(testDb.adapter, 'pet2', { name: 'Max', species: 'cat' });

    createFeedingSchedule(testDb.adapter, 'fs1', {
      petId: 'pet1',
      label: 'Breakfast',
      feedAt: '07:30',
    });
    createFeedingSchedule(testDb.adapter, 'fs2', {
      petId: 'pet2',
      label: 'Dinner',
      feedAt: '18:00',
    });

    expect(listFeedingSchedulesForPet(testDb.adapter, 'pet1')).toHaveLength(1);
    expect(listFeedingSchedulesForPet(testDb.adapter, 'pet2')).toHaveLength(1);

    upsertDietaryInfo(testDb.adapter, 'di1', {
      petId: 'pet1',
      allergies: ['chicken'],
    });
    upsertDietaryInfo(testDb.adapter, 'di2', {
      petId: 'pet2',
      allergies: ['fish'],
    });

    expect(getDietaryInfo(testDb.adapter, 'pet1')!.allergies).toEqual(['chicken']);
    expect(getDietaryInfo(testDb.adapter, 'pet2')!.allergies).toEqual(['fish']);
  });
});
