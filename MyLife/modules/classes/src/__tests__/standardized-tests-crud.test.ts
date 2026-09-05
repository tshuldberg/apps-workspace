import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { DatabaseAdapter } from '@mylife/db';
import { createModuleTestDatabase } from '@mylife/db';
import { CLASSES_MODULE } from '../definition';
import {
  createStandardizedTest,
  deleteStandardizedTest,
  getBestScoreByName,
  getStandardizedTest,
  getUpcomingTests,
  listStandardizedTests,
  updateStandardizedTest,
} from '../db';

let adapter: DatabaseAdapter;
let close: () => void;

beforeEach(() => {
  const testDb = createModuleTestDatabase('classes', CLASSES_MODULE.migrations ?? []);
  adapter = testDb.adapter;
  close = testDb.close;
});

afterEach(() => close());

describe('standardized-tests CRUD', () => {
  it('round-trips a standardized test with defaults', () => {
    const row = createStandardizedTest(adapter, 't-1', {
      name: 'SAT',
      category: 'undergrad',
    });
    expect(row.status).toBe('planned');
    expect(row.superscore_eligible).toBe(0);
    expect(getStandardizedTest(adapter, 't-1')).toMatchObject({
      id: 't-1',
      name: 'SAT',
      category: 'undergrad',
    });
  });

  it('persists section_scores as JSON and survives roundtrip', () => {
    createStandardizedTest(adapter, 't-1', {
      name: 'SAT',
      category: 'undergrad',
      status: 'completed',
      score: 1480,
      max_score: 1600,
      section_scores: { math: 760, ebrw: 720 },
      superscore_eligible: true,
    });
    const row = getStandardizedTest(adapter, 't-1');
    expect(row?.section_scores).toBe(JSON.stringify({ math: 760, ebrw: 720 }));
    expect(row?.superscore_eligible).toBe(1);
  });

  it('updates score and status', () => {
    createStandardizedTest(adapter, 't-1', { name: 'GRE', category: 'grad' });
    updateStandardizedTest(adapter, 't-1', { status: 'completed', score: 332 });
    const row = getStandardizedTest(adapter, 't-1');
    expect(row?.status).toBe('completed');
    expect(row?.score).toBe(332);
  });

  it('lists by category and status', () => {
    createStandardizedTest(adapter, 'a', { name: 'SAT', category: 'undergrad', status: 'completed' });
    createStandardizedTest(adapter, 'b', { name: 'ACT', category: 'undergrad', status: 'planned' });
    createStandardizedTest(adapter, 'c', { name: 'GRE', category: 'grad', status: 'completed' });

    expect(listStandardizedTests(adapter, { category: 'undergrad' })).toHaveLength(2);
    expect(listStandardizedTests(adapter, { status: 'completed' })).toHaveLength(2);
    expect(
      listStandardizedTests(adapter, { category: 'undergrad', status: 'completed' }),
    ).toHaveLength(1);
  });

  it('getUpcomingTests returns planned/registered tests inside the window', () => {
    const now = new Date('2026-01-01T00:00:00.000Z');
    createStandardizedTest(adapter, 'a', {
      name: 'SAT',
      category: 'undergrad',
      status: 'registered',
      test_date: '2026-01-15T00:00:00.000Z', // in window
    });
    createStandardizedTest(adapter, 'b', {
      name: 'SAT',
      category: 'undergrad',
      status: 'planned',
      test_date: '2026-01-05T00:00:00.000Z', // in window
    });
    createStandardizedTest(adapter, 'c', {
      name: 'SAT',
      category: 'undergrad',
      status: 'completed', // excluded by status
      test_date: '2026-01-10T00:00:00.000Z',
    });
    createStandardizedTest(adapter, 'd', {
      name: 'SAT',
      category: 'undergrad',
      status: 'planned',
      test_date: '2026-04-01T00:00:00.000Z', // out of window
    });

    const upcoming = getUpcomingTests(adapter, 30, now);
    expect(upcoming.map((t) => t.id)).toEqual(['b', 'a']);
  });

  it('getBestScoreByName returns the highest score for non-superscore tests', () => {
    createStandardizedTest(adapter, 'a', {
      name: 'ACT',
      category: 'undergrad',
      status: 'completed',
      score: 30,
    });
    createStandardizedTest(adapter, 'b', {
      name: 'ACT',
      category: 'undergrad',
      status: 'completed',
      score: 33,
    });
    createStandardizedTest(adapter, 'c', {
      name: 'ACT',
      category: 'undergrad',
      status: 'completed',
      score: 28,
    });
    expect(getBestScoreByName(adapter, 'ACT')).toBe(33);
  });

  it('getBestScoreByName aggregates per-section bests when superscore eligible', () => {
    createStandardizedTest(adapter, 'a', {
      name: 'SAT',
      category: 'undergrad',
      status: 'completed',
      score: 1400,
      section_scores: { math: 720, ebrw: 680 },
      superscore_eligible: true,
    });
    createStandardizedTest(adapter, 'b', {
      name: 'SAT',
      category: 'undergrad',
      status: 'completed',
      score: 1430,
      section_scores: { math: 710, ebrw: 720 },
      superscore_eligible: true,
    });
    expect(getBestScoreByName(adapter, 'SAT')).toBe(720 + 720);
  });

  it('getBestScoreByName returns null when no completed tests', () => {
    createStandardizedTest(adapter, 'a', {
      name: 'MCAT',
      category: 'professional',
      status: 'planned',
    });
    expect(getBestScoreByName(adapter, 'MCAT')).toBeNull();
    expect(getBestScoreByName(adapter, 'LSAT')).toBeNull();
  });

  it('deletes a test', () => {
    createStandardizedTest(adapter, 't-1', { name: 'SAT', category: 'undergrad' });
    deleteStandardizedTest(adapter, 't-1');
    expect(getStandardizedTest(adapter, 't-1')).toBeNull();
  });
});
