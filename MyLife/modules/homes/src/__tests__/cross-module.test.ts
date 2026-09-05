import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { DatabaseAdapter } from '@mylife/db';
import { createModuleTestDatabase } from '@mylife/db';
import { HOMES_MODULE } from '../definition';
import { crossModule, getTodayCards } from '../cross-module';
import { createProperty } from '../db/properties';
import { createSchedule } from '../db/schedules';
import { createCostEntry } from '../db/cost-entries';
import { createProject } from '../db/projects';

const NOW = new Date('2026-04-15T12:00:00Z');

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

describe('homes getTodayCards', () => {
  let adapter: DatabaseAdapter;
  let closeDb: () => void;

  beforeEach(() => {
    const testDb = createModuleTestDatabase('homes', HOMES_MODULE.migrations!);
    adapter = testDb.adapter;
    closeDb = testDb.close;
  });

  afterEach(() => {
    closeDb();
  });

  it('returns [] for an empty database', () => {
    const cards = getTodayCards(adapter, { now: NOW });
    expect(cards).toEqual([]);
  });

  it('returns a maintenance reminder when next_due_date is today or earlier', () => {
    createProperty(adapter, 'prop1', { name: 'Main House' });
    createSchedule(adapter, 'sched1', {
      propertyId: 'prop1',
      taskType: 'gutter_cleaning',
      intervalMonths: 6,
      nextDueDate: isoDate(NOW),
    });

    const cards = getTodayCards(adapter, { now: NOW });
    const reminder = cards.find((c) => c.kind === 'reminder');
    expect(reminder).toBeDefined();
    expect(reminder!.priority).toBe(70);
    expect(reminder!.title).toContain('Gutter cleaning');
    expect(reminder!.title).toContain('Main House');
    expect(reminder!.moduleId).toBe('homes');
    expect(reminder!.cta?.route).toBe('/homes/schedule-detail');
  });

  it('skips inactive maintenance schedules', () => {
    createProperty(adapter, 'prop1', { name: 'Main House' });
    createSchedule(adapter, 'sched1', {
      propertyId: 'prop1',
      taskType: 'hvac_filter',
      intervalMonths: 3,
      nextDueDate: isoDate(NOW),
    });
    adapter.execute(`UPDATE hm_maintenance_schedules SET is_active = 0 WHERE id = 'sched1'`);

    const cards = getTodayCards(adapter, { now: NOW });
    expect(cards.find((c) => c.kind === 'reminder')).toBeUndefined();
  });

  it('returns an in-progress project as a progress card', () => {
    createProperty(adapter, 'prop1', { name: 'Main House' });
    createProject(adapter, 'proj1', {
      propertyId: 'prop1',
      name: 'Kitchen Remodel',
      status: 'in_progress',
      budgetCents: 100000,
      actualCostCents: 25000,
    });

    const cards = getTodayCards(adapter, { now: NOW });
    const progress = cards.find((c) => c.kind === 'progress');
    expect(progress).toBeDefined();
    expect(progress!.title).toContain('Kitchen Remodel');
    expect(progress!.title).toContain('25%');
    expect(progress!.moduleId).toBe('homes');
  });

  it('does not surface projects in other statuses', () => {
    createProperty(adapter, 'prop1', { name: 'Main House' });
    createProject(adapter, 'proj1', {
      propertyId: 'prop1',
      name: 'Old Plan',
      status: 'planning',
    });
    createProject(adapter, 'proj2', {
      propertyId: 'prop1',
      name: 'Done Already',
      status: 'completed',
    });

    const cards = getTodayCards(adapter, { now: NOW });
    expect(cards.find((c) => c.kind === 'progress')).toBeUndefined();
  });

  it('returns a cost insight when month-over-month variance exceeds 25%', () => {
    createProperty(adapter, 'prop1', { name: 'Main House' });

    // Previous month (March 2026): $200 total
    createCostEntry(adapter, 'cost-prev', {
      propertyId: 'prop1',
      category: 'maintenance',
      description: 'Gutter cleaning',
      amountCents: 20000,
      costDate: '2026-03-15',
    });

    // Current month (April 2026): $400 total = +100% vs prior
    createCostEntry(adapter, 'cost-cur1', {
      propertyId: 'prop1',
      category: 'repair',
      description: 'Plumbing',
      amountCents: 25000,
      costDate: '2026-04-05',
    });
    createCostEntry(adapter, 'cost-cur2', {
      propertyId: 'prop1',
      category: 'maintenance',
      description: 'HVAC service',
      amountCents: 15000,
      costDate: '2026-04-10',
    });

    const cards = getTodayCards(adapter, { now: NOW });
    const insight = cards.find((c) => c.kind === 'insight');
    expect(insight).toBeDefined();
    expect(insight!.title).toContain('up');
    expect(insight!.moduleId).toBe('homes');
  });

  it('skips the cost insight when variance is within 25%', () => {
    createProperty(adapter, 'prop1', { name: 'Main House' });
    createCostEntry(adapter, 'cost-prev', {
      propertyId: 'prop1',
      category: 'maintenance',
      description: 'A',
      amountCents: 20000,
      costDate: '2026-03-10',
    });
    createCostEntry(adapter, 'cost-cur', {
      propertyId: 'prop1',
      category: 'maintenance',
      description: 'B',
      amountCents: 22000,
      costDate: '2026-04-10',
    });

    const cards = getTodayCards(adapter, { now: NOW });
    expect(cards.find((c) => c.kind === 'insight')).toBeUndefined();
  });

  it('caps at 3 cards and never exceeds priority 100', () => {
    createProperty(adapter, 'prop1', { name: 'Main House' });
    createSchedule(adapter, 'sched1', {
      propertyId: 'prop1',
      taskType: 'roof_inspection',
      intervalMonths: 12,
      nextDueDate: isoDate(NOW),
    });
    createProject(adapter, 'proj1', {
      propertyId: 'prop1',
      name: 'Bath Reno',
      status: 'in_progress',
      budgetCents: 50000,
      actualCostCents: 10000,
    });
    createCostEntry(adapter, 'cost-prev', {
      propertyId: 'prop1',
      category: 'maintenance',
      description: 'A',
      amountCents: 10000,
      costDate: '2026-03-01',
    });
    createCostEntry(adapter, 'cost-cur', {
      propertyId: 'prop1',
      category: 'maintenance',
      description: 'B',
      amountCents: 50000,
      costDate: '2026-04-01',
    });

    const cards = getTodayCards(adapter, { now: NOW });
    expect(cards.length).toBeLessThanOrEqual(3);
    for (const card of cards) {
      expect(card.priority).toBeLessThanOrEqual(100);
      expect(card.priority).toBeGreaterThanOrEqual(0);
    }
    // Sorted by priority desc
    for (let i = 1; i < cards.length; i++) {
      expect(cards[i - 1].priority).toBeGreaterThanOrEqual(cards[i].priority);
    }
  });

  describe('HOMES_MODULE.crossModule', () => {
    it('is wired into the module definition', () => {
      expect(HOMES_MODULE.crossModule).toBeDefined();
      expect(HOMES_MODULE.crossModule!.getTodayCards).toBeTypeOf('function');
    });

    it('exported crossModule object exposes getTodayCards', () => {
      expect(crossModule.getTodayCards).toBeTypeOf('function');
      const result = crossModule.getTodayCards!(adapter, { now: NOW });
      expect(Array.isArray(result)).toBe(true);
    });
  });
});
