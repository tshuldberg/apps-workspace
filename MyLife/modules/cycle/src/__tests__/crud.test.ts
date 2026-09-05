import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createModuleTestDatabase, type InMemoryTestDatabase } from '@mylife/db';
import { CYCLE_MODULE } from '../definition';
import {
  createCycle,
  getCycle,
  getCycles,
  endCycle,
  deleteCycle,
  createCycleDay,
  getCycleDaysByDate,
  getCycleDaysByCycle,
  getCycleDayByDate,
  updateCycleDay,
  deleteCycleDay,
  getSymptomsForDay,
  addSymptom,
  deleteSymptom,
  getCycleStats,
  getSymptomFrequencies,
  getCycleCount,
} from '../db/crud';

let testDb: InMemoryTestDatabase;

beforeEach(() => {
  testDb = createModuleTestDatabase('cycle', CYCLE_MODULE.migrations!);
});

afterEach(() => {
  testDb.close();
});

describe('Cycles', () => {
  it('creates a new cycle', () => {
    const cycle = createCycle(testDb.adapter, 'c1', { startDate: '2026-03-01' });
    expect(cycle.id).toBe('c1');
    expect(cycle.startDate).toBe('2026-03-01');
    expect(cycle.endDate).toBeNull();
    expect(cycle.lengthDays).toBeNull();
    expect(cycle.periodLength).toBeNull();
  });

  it('creates a cycle with period end date', () => {
    const cycle = createCycle(testDb.adapter, 'c2', {
      startDate: '2026-03-01',
      periodEndDate: '2026-03-05',
    });
    expect(cycle.periodEndDate).toBe('2026-03-05');
    expect(cycle.periodLength).toBe(5);
  });

  it('gets a cycle by id', () => {
    createCycle(testDb.adapter, 'c3', { startDate: '2026-03-01' });
    const found = getCycle(testDb.adapter, 'c3');
    expect(found).not.toBeNull();
    expect(found!.startDate).toBe('2026-03-01');
  });

  it('returns null for nonexistent cycle', () => {
    expect(getCycle(testDb.adapter, 'nonexistent')).toBeNull();
  });

  it('lists cycles in reverse chronological order', () => {
    createCycle(testDb.adapter, 'c4', { startDate: '2026-01-01' });
    createCycle(testDb.adapter, 'c5', { startDate: '2026-02-01' });
    createCycle(testDb.adapter, 'c6', { startDate: '2026-03-01' });

    const cycles = getCycles(testDb.adapter);
    expect(cycles).toHaveLength(3);
    expect(cycles[0].startDate).toBe('2026-03-01');
    expect(cycles[2].startDate).toBe('2026-01-01');
  });

  it('ends a cycle with computed length', () => {
    const cycle = createCycle(testDb.adapter, 'c7', { startDate: '2026-02-01' });
    const ended = endCycle(testDb.adapter, cycle.id, '2026-03-01');
    expect(ended).not.toBeNull();
    expect(ended!.lengthDays).toBe(28);
    expect(ended!.endDate).toBe('2026-02-28');
  });

  it('returns null when ending a nonexistent cycle', () => {
    expect(endCycle(testDb.adapter, 'nope', '2026-03-01')).toBeNull();
  });

  it('deletes a cycle', () => {
    createCycle(testDb.adapter, 'c8', { startDate: '2026-03-01' });
    deleteCycle(testDb.adapter, 'c8');
    expect(getCycle(testDb.adapter, 'c8')).toBeNull();
  });

  it('counts total cycles', () => {
    expect(getCycleCount(testDb.adapter)).toBe(0);
    createCycle(testDb.adapter, 'c9', { startDate: '2026-03-01' });
    createCycle(testDb.adapter, 'c10', { startDate: '2026-04-01' });
    expect(getCycleCount(testDb.adapter)).toBe(2);
  });
});

describe('Cycle Days', () => {
  it('creates a cycle day with date', () => {
    const day = createCycleDay(testDb.adapter, 'd1', { date: '2026-03-01' });
    expect(day.id).toBe('d1');
    expect(day.date).toBe('2026-03-01');
    expect(day.flowLevel).toBeNull();
    expect(day.phase).toBeNull();
  });

  it('creates a cycle day with flow and phase', () => {
    const day = createCycleDay(testDb.adapter, 'd2', {
      date: '2026-03-01',
      phase: 'menstrual',
      flowLevel: 'heavy',
      notes: 'First day',
    });
    expect(day.phase).toBe('menstrual');
    expect(day.flowLevel).toBe('heavy');
    expect(day.notes).toBe('First day');
  });

  it('creates a cycle day with symptoms', () => {
    const day = createCycleDay(testDb.adapter, 'd3', {
      date: '2026-03-01',
      symptoms: [
        { category: 'physical', symptom: 'cramps', intensity: 'severe' },
        { category: 'mood', symptom: 'irritable', intensity: 'moderate' },
      ],
    });
    const symptoms = getSymptomsForDay(testDb.adapter, day.id);
    expect(symptoms).toHaveLength(2);
    expect(symptoms[0].symptom).toBe('cramps');
    expect(symptoms[0].intensity).toBe('severe');
    expect(symptoms[1].symptom).toBe('irritable');
  });

  it('gets cycle days by date', () => {
    createCycleDay(testDb.adapter, 'd4', { date: '2026-03-01' });
    const days = getCycleDaysByDate(testDb.adapter, '2026-03-01');
    expect(days).toHaveLength(1);
    expect(days[0].date).toBe('2026-03-01');
  });

  it('gets a single cycle day by date', () => {
    createCycleDay(testDb.adapter, 'd5', { date: '2026-03-05' });
    const found = getCycleDayByDate(testDb.adapter, '2026-03-05');
    expect(found).not.toBeNull();
    expect(found!.date).toBe('2026-03-05');

    expect(getCycleDayByDate(testDb.adapter, '2026-04-01')).toBeNull();
  });

  it('gets cycle days by cycle id', () => {
    const cycle = createCycle(testDb.adapter, 'c-days', { startDate: '2026-03-01' });
    createCycleDay(testDb.adapter, 'd6', { date: '2026-03-01', cycleId: cycle.id });
    createCycleDay(testDb.adapter, 'd7', { date: '2026-03-02', cycleId: cycle.id });

    const days = getCycleDaysByCycle(testDb.adapter, cycle.id);
    expect(days).toHaveLength(2);
    expect(days[0].date).toBe('2026-03-01');
    expect(days[1].date).toBe('2026-03-02');
  });

  it('updates a cycle day', () => {
    const day = createCycleDay(testDb.adapter, 'd8', { date: '2026-03-01' });
    const updated = updateCycleDay(testDb.adapter, day.id, {
      flowLevel: 'medium',
      notes: 'Updated notes',
    });
    expect(updated).not.toBeNull();
    expect(updated!.flowLevel).toBe('medium');
    expect(updated!.notes).toBe('Updated notes');
  });

  it('returns null when updating nonexistent day', () => {
    expect(updateCycleDay(testDb.adapter, 'nope', { notes: 'x' })).toBeNull();
  });

  it('returns unchanged day when no updates provided', () => {
    const day = createCycleDay(testDb.adapter, 'd9', { date: '2026-03-01', notes: 'original' });
    const same = updateCycleDay(testDb.adapter, day.id, {});
    expect(same).not.toBeNull();
    expect(same!.notes).toBe('original');
  });

  it('deletes a cycle day and cascades symptoms', () => {
    const day = createCycleDay(testDb.adapter, 'd10', {
      date: '2026-03-01',
      symptoms: [{ category: 'physical', symptom: 'cramps' }],
    });
    expect(getSymptomsForDay(testDb.adapter, day.id)).toHaveLength(1);

    deleteCycleDay(testDb.adapter, day.id);
    expect(getCycleDayByDate(testDb.adapter, '2026-03-01')).toBeNull();
    expect(getSymptomsForDay(testDb.adapter, day.id)).toHaveLength(0);
  });
});

describe('Symptoms', () => {
  it('adds a symptom to an existing day', () => {
    const day = createCycleDay(testDb.adapter, 'd-sym1', { date: '2026-03-01' });
    const symptom = addSymptom(testDb.adapter, 's1', day.id, 'physical', 'headache', 'mild');
    expect(symptom.symptom).toBe('headache');
    expect(symptom.intensity).toBe('mild');
    expect(symptom.category).toBe('physical');

    const all = getSymptomsForDay(testDb.adapter, day.id);
    expect(all).toHaveLength(1);
  });

  it('uses default intensity of moderate', () => {
    const day = createCycleDay(testDb.adapter, 'd-sym2', { date: '2026-03-01' });
    const symptom = addSymptom(testDb.adapter, 's2', day.id, 'mood', 'anxious');
    expect(symptom.intensity).toBe('moderate');
  });

  it('deletes a symptom', () => {
    const day = createCycleDay(testDb.adapter, 'd-sym3', { date: '2026-03-01' });
    const s1 = addSymptom(testDb.adapter, 's3', day.id, 'physical', 'cramps');
    const s2 = addSymptom(testDb.adapter, 's4', day.id, 'physical', 'headache');
    expect(getSymptomsForDay(testDb.adapter, day.id)).toHaveLength(2);

    deleteSymptom(testDb.adapter, s1.id);
    const remaining = getSymptomsForDay(testDb.adapter, day.id);
    expect(remaining).toHaveLength(1);
    expect(remaining[0].symptom).toBe('headache');
  });
});

describe('Analytics', () => {
  it('returns empty stats with no completed cycles', () => {
    const stats = getCycleStats(testDb.adapter);
    expect(stats.totalCycles).toBe(0);
    expect(stats.averageCycleLength).toBeNull();
    expect(stats.averagePeriodLength).toBeNull();
    expect(stats.shortestCycle).toBeNull();
    expect(stats.longestCycle).toBeNull();
    expect(stats.cycleLengthStdDev).toBeNull();
  });

  it('computes stats from completed cycles', () => {
    const c1 = createCycle(testDb.adapter, 'cs1', {
      startDate: '2026-01-01',
      periodEndDate: '2026-01-05',
    });
    endCycle(testDb.adapter, c1.id, '2026-01-29');

    const c2 = createCycle(testDb.adapter, 'cs2', {
      startDate: '2026-01-29',
      periodEndDate: '2026-02-02',
    });
    endCycle(testDb.adapter, c2.id, '2026-02-26');

    const c3 = createCycle(testDb.adapter, 'cs3', {
      startDate: '2026-02-26',
      periodEndDate: '2026-03-02',
    });
    endCycle(testDb.adapter, c3.id, '2026-03-26');

    const stats = getCycleStats(testDb.adapter);
    expect(stats.totalCycles).toBe(3);
    expect(stats.averageCycleLength).toBe(28);
    expect(stats.averagePeriodLength).toBe(5);
    expect(stats.shortestCycle).toBe(28);
    expect(stats.longestCycle).toBe(28);
    expect(stats.cycleLengthStdDev).toBe(0);
  });

  it('computes symptom frequencies', () => {
    const d1 = createCycleDay(testDb.adapter, 'd-freq1', { date: '2026-03-01' });
    addSymptom(testDb.adapter, 'sf1', d1.id, 'physical', 'cramps');
    addSymptom(testDb.adapter, 'sf2', d1.id, 'mood', 'irritable');

    const d2 = createCycleDay(testDb.adapter, 'd-freq2', { date: '2026-03-02' });
    addSymptom(testDb.adapter, 'sf3', d2.id, 'physical', 'cramps');
    addSymptom(testDb.adapter, 'sf4', d2.id, 'physical', 'headache');

    const freqs = getSymptomFrequencies(testDb.adapter);
    expect(freqs[0].symptom).toBe('cramps');
    expect(freqs[0].count).toBe(2);
    expect(freqs).toHaveLength(3);
  });
});
