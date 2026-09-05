import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { DatabaseAdapter } from '@mylife/db';
import { createModuleTestDatabase } from '@mylife/db';
import { CLASSES_MODULE } from '../definition';
import {
  archiveSemester,
  createClass,
  createSemester,
  deleteSemester,
  getSemester,
  getSemesterStats,
  listSemesters,
  setCurrentSemester,
  updateSemester,
} from '../db';

let adapter: DatabaseAdapter;
let close: () => void;

beforeEach(() => {
  const testDb = createModuleTestDatabase('classes', CLASSES_MODULE.migrations ?? []);
  adapter = testDb.adapter;
  close = testDb.close;
});

afterEach(() => close());

describe('semesters CRUD', () => {
  it('round-trips a created semester', () => {
    const row = createSemester(adapter, 'sem-1', {
      name: 'Fall 2026',
      start_date: '2026-08-15',
      end_date: '2026-12-15',
      institution: 'State U',
      credit_hours: 15,
    });

    expect(row.name).toBe('Fall 2026');
    expect(row.is_current).toBe(0);
    expect(getSemester(adapter, 'sem-1')).toMatchObject({
      id: 'sem-1',
      name: 'Fall 2026',
      institution: 'State U',
      credit_hours: 15,
    });
  });

  it('lists semesters newest first with current pinned to top', () => {
    createSemester(adapter, 'a', { name: 'Spring 2026', start_date: '2026-01-15' });
    createSemester(adapter, 'b', { name: 'Fall 2026', start_date: '2026-08-15' });
    createSemester(adapter, 'c', { name: 'Spring 2027', start_date: '2027-01-15', is_current: true });

    const all = listSemesters(adapter);
    expect(all.map((s) => s.id)).toEqual(['c', 'b', 'a']);
    expect(all[0].is_current).toBe(1);
  });

  it('updates non-current fields without disturbing is_current', () => {
    createSemester(adapter, 'sem-1', { name: 'Fall 2026', is_current: true });
    updateSemester(adapter, 'sem-1', { credit_hours: 18, gpa: 3.6 });

    const row = getSemester(adapter, 'sem-1');
    expect(row?.credit_hours).toBe(18);
    expect(row?.gpa).toBe(3.6);
    expect(row?.is_current).toBe(1);
  });

  it('enforces single-current invariant via setCurrent', () => {
    createSemester(adapter, 'a', { name: 'A', is_current: true });
    createSemester(adapter, 'b', { name: 'B' });
    createSemester(adapter, 'c', { name: 'C' });

    setCurrentSemester(adapter, 'b');

    const all = listSemesters(adapter);
    const currents = all.filter((s) => s.is_current === 1).map((s) => s.id);
    expect(currents).toEqual(['b']);
  });

  it('enforces single-current invariant when creating a new current semester', () => {
    createSemester(adapter, 'a', { name: 'A', is_current: true });
    createSemester(adapter, 'b', { name: 'B', is_current: true });

    const all = listSemesters(adapter);
    expect(all.filter((s) => s.is_current === 1).map((s) => s.id)).toEqual(['b']);
  });

  it('archives a semester by clearing is_current', () => {
    createSemester(adapter, 'sem-1', { name: 'Fall 2026', is_current: true });
    archiveSemester(adapter, 'sem-1');
    expect(getSemester(adapter, 'sem-1')?.is_current).toBe(0);
  });

  it('deletes a semester (and cascades classes)', () => {
    createSemester(adapter, 'sem-1', { name: 'Fall 2026' });
    createClass(adapter, 'c-1', { semester_id: 'sem-1', name: 'CS 101' });

    deleteSemester(adapter, 'sem-1');
    expect(getSemester(adapter, 'sem-1')).toBeNull();
    const remaining = adapter.query<{ count: number }>(
      `SELECT COUNT(*) AS count FROM cs_classes WHERE semester_id = 'sem-1'`,
    );
    expect(remaining[0].count).toBe(0);
  });

  describe('getStats', () => {
    it('returns zeros for an empty semester', () => {
      createSemester(adapter, 'sem-1', { name: 'Fall 2026' });
      const stats = getSemesterStats(adapter, 'sem-1');
      expect(stats).toEqual({ class_count: 0, gpa: null, credit_hours: 0 });
    });

    it('aggregates class count and credit hours, ignores ungraded classes for GPA', () => {
      createSemester(adapter, 'sem-1', { name: 'Fall 2026' });
      createClass(adapter, 'c-1', { semester_id: 'sem-1', name: 'CS 101', credits: 4, current_grade: 3.7 });
      createClass(adapter, 'c-2', { semester_id: 'sem-1', name: 'MA 201', credits: 3, current_grade: 4.0 });
      createClass(adapter, 'c-3', { semester_id: 'sem-1', name: 'EN 110', credits: 3 }); // ungraded

      const stats = getSemesterStats(adapter, 'sem-1');
      expect(stats.class_count).toBe(3);
      expect(stats.credit_hours).toBe(10);
      // weighted gpa: (3.7*4 + 4.0*3) / (4+3) = (14.8 + 12) / 7 = 3.8285...
      expect(stats.gpa).toBeCloseTo((3.7 * 4 + 4.0 * 3) / 7, 4);
    });
  });
});
