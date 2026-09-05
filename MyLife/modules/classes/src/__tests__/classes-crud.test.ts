import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { DatabaseAdapter } from '@mylife/db';
import { createModuleTestDatabase } from '@mylife/db';
import { CLASSES_MODULE } from '../definition';
import {
  createClass,
  createSemester,
  deleteClass,
  detectClassConflicts,
  getClass,
  getScheduleForWeek,
  listClassesBySemester,
  updateClass,
} from '../db';

let adapter: DatabaseAdapter;
let close: () => void;

beforeEach(() => {
  const testDb = createModuleTestDatabase('classes', CLASSES_MODULE.migrations ?? []);
  adapter = testDb.adapter;
  close = testDb.close;
  createSemester(adapter, 'sem-1', { name: 'Fall 2026' });
});

afterEach(() => close());

describe('classes CRUD', () => {
  it('round-trips a class with day_times and category_weights', () => {
    const created = createClass(adapter, 'c-1', {
      semester_id: 'sem-1',
      name: 'CS 101',
      code: 'CS 101',
      section: '001',
      credits: 4,
      day_times: [
        { day: 'mon', start_time: '09:00', end_time: '10:15' },
        { day: 'wed', start_time: '09:00', end_time: '10:15' },
      ],
      room: '210',
      building: 'Hall A',
      category_weights: { exams: 40, homework: 30, participation: 20, final: 10 },
      color: '#22C55E',
    });

    expect(created.color).toBe('#22C55E');
    const fetched = getClass(adapter, 'c-1');
    expect(fetched?.name).toBe('CS 101');
    expect(JSON.parse(fetched!.day_times!)).toHaveLength(2);
    expect(JSON.parse(fetched!.category_weights!)).toMatchObject({ exams: 40 });
  });

  it('listBySemester returns only classes in that semester', () => {
    createSemester(adapter, 'sem-2', { name: 'Spring 2027' });
    createClass(adapter, 'c-1', { semester_id: 'sem-1', name: 'CS 101' });
    createClass(adapter, 'c-2', { semester_id: 'sem-1', name: 'MA 201' });
    createClass(adapter, 'c-3', { semester_id: 'sem-2', name: 'CS 201' });

    const fall = listClassesBySemester(adapter, 'sem-1');
    expect(fall.map((c) => c.id).sort()).toEqual(['c-1', 'c-2']);
    const spring = listClassesBySemester(adapter, 'sem-2');
    expect(spring.map((c) => c.id)).toEqual(['c-3']);
  });

  it('updates a class and refreshes updated_at', async () => {
    createClass(adapter, 'c-1', { semester_id: 'sem-1', name: 'CS 101' });
    const before = getClass(adapter, 'c-1')!.updated_at;

    await new Promise((resolve) => setTimeout(resolve, 10));
    updateClass(adapter, 'c-1', {
      name: 'CS 101 Honors',
      day_times: [{ day: 'tue', start_time: '13:00', end_time: '14:30' }],
    });

    const row = getClass(adapter, 'c-1');
    expect(row?.name).toBe('CS 101 Honors');
    expect(JSON.parse(row!.day_times!)).toEqual([
      { day: 'tue', start_time: '13:00', end_time: '14:30' },
    ]);
    expect(row?.updated_at).not.toBe(before);
  });

  it('deletes a class', () => {
    createClass(adapter, 'c-1', { semester_id: 'sem-1', name: 'CS 101' });
    deleteClass(adapter, 'c-1');
    expect(getClass(adapter, 'c-1')).toBeNull();
  });

  describe('getScheduleForWeek', () => {
    it('returns blocks ordered by day-of-week then start_time', () => {
      createClass(adapter, 'c-1', {
        semester_id: 'sem-1',
        name: 'CS 101',
        day_times: [
          { day: 'wed', start_time: '09:00', end_time: '10:15' },
          { day: 'mon', start_time: '14:00', end_time: '15:30' },
        ],
      });
      createClass(adapter, 'c-2', {
        semester_id: 'sem-1',
        name: 'MA 201',
        day_times: [{ day: 'mon', start_time: '09:00', end_time: '10:15' }],
      });
      createClass(adapter, 'c-3', {
        semester_id: 'sem-1',
        name: 'EN 110',
        day_times: [],
      });

      const blocks = getScheduleForWeek(adapter, 'sem-1');
      expect(blocks.map((b) => `${b.block.day} ${b.block.start_time} ${b.cls.name}`)).toEqual([
        'mon 09:00 MA 201',
        'mon 14:00 CS 101',
        'wed 09:00 CS 101',
      ]);
    });
  });

  describe('detectClassConflicts wrapper', () => {
    it('flags overlapping classes in the same semester', () => {
      createClass(adapter, 'c-1', {
        semester_id: 'sem-1',
        name: 'CS 101',
        day_times: [{ day: 'mon', start_time: '09:00', end_time: '10:30' }],
      });
      createClass(adapter, 'c-2', {
        semester_id: 'sem-1',
        name: 'MA 201',
        day_times: [{ day: 'mon', start_time: '10:00', end_time: '11:00' }],
      });
      createClass(adapter, 'c-3', {
        semester_id: 'sem-1',
        name: 'EN 110',
        day_times: [{ day: 'tue', start_time: '09:00', end_time: '10:30' }],
      });

      const conflicts = detectClassConflicts(adapter, 'sem-1');
      expect(conflicts).toHaveLength(1);
      expect(conflicts[0].overlap_minutes).toBe(30);
      expect(conflicts[0].day).toBe('mon');
    });
  });
});
