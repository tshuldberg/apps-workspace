import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { DatabaseAdapter } from '@mylife/db';
import { createModuleTestDatabase } from '@mylife/db';
import { CLASSES_MODULE } from '../definition';
import {
  IllegalAssignmentTransitionError,
  createAssignment,
  createClass,
  createSemester,
  deleteAssignment,
  getAssignment,
  getTimeEstimateAccuracy,
  listAssignmentsByClass,
  listAssignmentsByStatus,
  listOverdueAssignments,
  listUpcomingAssignments,
  markAssignmentSubmitted,
  setAssignmentGrade,
  updateAssignment,
} from '../db';

let adapter: DatabaseAdapter;
let close: () => void;

beforeEach(() => {
  const testDb = createModuleTestDatabase('classes', CLASSES_MODULE.migrations ?? []);
  adapter = testDb.adapter;
  close = testDb.close;
  createSemester(adapter, 'sem-1', { name: 'Fall 2026' });
  createClass(adapter, 'c-cs', { semester_id: 'sem-1', name: 'CS 101', credits: 4 });
  createClass(adapter, 'c-ma', { semester_id: 'sem-1', name: 'MA 201', credits: 3 });
});

afterEach(() => close());

describe('assignments CRUD', () => {
  it('round-trips a created assignment with JSON columns serialized', () => {
    const row = createAssignment(adapter, 'a-1', {
      class_id: 'c-cs',
      title: 'Recursion homework',
      type: 'homework',
      due_at: '2026-04-25T23:59:00.000Z',
      priority: 'high',
      estimated_minutes: 90,
      max_grade: 50,
      group_members: [{ name: 'Alice', responsibilities: 'intro', complete: false }],
      late_policy: { percent_per_day: 10, max_days: 3 },
      depends_on: ['a-0'],
    });
    expect(row.status).toBe('not_started');
    expect(row.priority).toBe('high');
    expect(row.is_recurring).toBe(0);
    expect(row.max_grade).toBe(50);

    const fetched = getAssignment(adapter, 'a-1');
    expect(fetched).not.toBeNull();
    expect(fetched?.group_members).toBe(
      JSON.stringify([{ name: 'Alice', responsibilities: 'intro', complete: false }]),
    );
    expect(fetched?.late_policy).toBe(
      JSON.stringify({ percent_per_day: 10, max_days: 3 }),
    );
    expect(fetched?.depends_on).toBe(JSON.stringify(['a-0']));
  });

  it('defaults status, priority, max_grade, is_recurring', () => {
    const row = createAssignment(adapter, 'a-2', {
      class_id: 'c-cs',
      title: 'Reading',
      type: 'reading',
    });
    expect(row.status).toBe('not_started');
    expect(row.priority).toBe('medium');
    expect(row.max_grade).toBe(100);
    expect(row.is_recurring).toBe(0);
  });

  it('updates fields including JSON re-serialization', () => {
    createAssignment(adapter, 'a-1', {
      class_id: 'c-cs',
      title: 'Quiz',
      type: 'quiz',
    });
    updateAssignment(adapter, 'a-1', {
      title: 'Quiz 1',
      priority: 'critical',
      depends_on: ['a-0', 'a-prev'],
      late_policy: { percent_per_day: 5, max_days: 2 },
    });
    const row = getAssignment(adapter, 'a-1');
    expect(row?.title).toBe('Quiz 1');
    expect(row?.priority).toBe('critical');
    expect(row?.depends_on).toBe(JSON.stringify(['a-0', 'a-prev']));
    expect(row?.late_policy).toBe(JSON.stringify({ percent_per_day: 5, max_days: 2 }));
  });

  it('deletes an assignment', () => {
    createAssignment(adapter, 'a-1', {
      class_id: 'c-cs',
      title: 'X',
      type: 'other',
    });
    deleteAssignment(adapter, 'a-1');
    expect(getAssignment(adapter, 'a-1')).toBeNull();
  });

  it('cascades delete when its parent class is removed', () => {
    createAssignment(adapter, 'a-1', {
      class_id: 'c-cs',
      title: 'X',
      type: 'other',
    });
    adapter.execute(`DELETE FROM cs_classes WHERE id = ?`, ['c-cs']);
    expect(getAssignment(adapter, 'a-1')).toBeNull();
  });

  it('lists assignments by class ordered by due_at asc, nulls last', () => {
    createAssignment(adapter, 'a-1', {
      class_id: 'c-cs',
      title: 'A',
      type: 'homework',
      due_at: '2026-04-25T00:00:00.000Z',
    });
    createAssignment(adapter, 'a-2', {
      class_id: 'c-cs',
      title: 'B',
      type: 'homework',
      due_at: '2026-04-22T00:00:00.000Z',
    });
    createAssignment(adapter, 'a-3', {
      class_id: 'c-cs',
      title: 'C',
      type: 'homework',
    });
    const rows = listAssignmentsByClass(adapter, 'c-cs');
    expect(rows.map((r) => r.id)).toEqual(['a-2', 'a-1', 'a-3']);
  });

  it('lists assignments by status', () => {
    createAssignment(adapter, 'a-1', {
      class_id: 'c-cs',
      title: 'A',
      type: 'homework',
      status: 'in_progress',
    });
    createAssignment(adapter, 'a-2', {
      class_id: 'c-cs',
      title: 'B',
      type: 'homework',
    });
    expect(listAssignmentsByStatus(adapter, 'in_progress').map((r) => r.id)).toEqual([
      'a-1',
    ]);
    expect(listAssignmentsByStatus(adapter, 'not_started').map((r) => r.id)).toEqual([
      'a-2',
    ]);
  });

  it('lists upcoming assignments within N days, excludes graded', () => {
    const now = new Date('2026-04-20T00:00:00.000Z');
    createAssignment(adapter, 'a-1', {
      class_id: 'c-cs',
      title: 'soon',
      type: 'homework',
      due_at: '2026-04-22T00:00:00.000Z',
    });
    createAssignment(adapter, 'a-2', {
      class_id: 'c-cs',
      title: 'past',
      type: 'homework',
      due_at: '2026-04-19T00:00:00.000Z',
    });
    createAssignment(adapter, 'a-3', {
      class_id: 'c-cs',
      title: 'far',
      type: 'homework',
      due_at: '2026-05-30T00:00:00.000Z',
    });
    createAssignment(adapter, 'a-4', {
      class_id: 'c-cs',
      title: 'graded',
      type: 'homework',
      due_at: '2026-04-22T00:00:00.000Z',
      status: 'submitted', // need to step through submitted then graded
    });
    setAssignmentGrade(adapter, 'a-4', 90);

    const upcoming = listUpcomingAssignments(adapter, 7, now);
    expect(upcoming.map((r) => r.id)).toEqual(['a-1']);
  });

  it('lists overdue assignments only when status is not_started or in_progress', () => {
    const now = new Date('2026-04-25T00:00:00.000Z');
    createAssignment(adapter, 'a-1', {
      class_id: 'c-cs',
      title: 'late-not-started',
      type: 'homework',
      due_at: '2026-04-20T00:00:00.000Z',
    });
    createAssignment(adapter, 'a-2', {
      class_id: 'c-cs',
      title: 'late-in-progress',
      type: 'homework',
      due_at: '2026-04-21T00:00:00.000Z',
      status: 'in_progress',
    });
    createAssignment(adapter, 'a-3', {
      class_id: 'c-cs',
      title: 'late-but-submitted',
      type: 'homework',
      due_at: '2026-04-19T00:00:00.000Z',
      status: 'submitted',
    });
    const overdue = listOverdueAssignments(adapter, now);
    expect(overdue.map((r) => r.id).sort()).toEqual(['a-1', 'a-2']);
  });

  it('marks an assignment submitted with provided timestamp', () => {
    createAssignment(adapter, 'a-1', {
      class_id: 'c-cs',
      title: 'X',
      type: 'homework',
      status: 'in_progress',
    });
    markAssignmentSubmitted(adapter, 'a-1', '2026-04-22T12:00:00.000Z');
    const row = getAssignment(adapter, 'a-1');
    expect(row?.status).toBe('submitted');
    expect(row?.submitted_at).toBe('2026-04-22T12:00:00.000Z');
  });

  it('sets a grade and transitions submitted -> graded', () => {
    createAssignment(adapter, 'a-1', {
      class_id: 'c-cs',
      title: 'X',
      type: 'homework',
      status: 'submitted',
    });
    setAssignmentGrade(adapter, 'a-1', 87, 100, '2026-04-26T00:00:00.000Z');
    const row = getAssignment(adapter, 'a-1');
    expect(row?.status).toBe('graded');
    expect(row?.grade).toBe(87);
    expect(row?.graded_at).toBe('2026-04-26T00:00:00.000Z');
  });

  it('rejects illegal status transition not_started -> graded directly', () => {
    createAssignment(adapter, 'a-1', {
      class_id: 'c-cs',
      title: 'X',
      type: 'homework',
    });
    expect(() => updateAssignment(adapter, 'a-1', { status: 'graded' })).toThrow(
      IllegalAssignmentTransitionError,
    );
  });

  it('rejects illegal status transition graded -> not_started', () => {
    createAssignment(adapter, 'a-1', {
      class_id: 'c-cs',
      title: 'X',
      type: 'homework',
      status: 'submitted',
    });
    setAssignmentGrade(adapter, 'a-1', 80);
    expect(() => updateAssignment(adapter, 'a-1', { status: 'not_started' })).toThrow(
      IllegalAssignmentTransitionError,
    );
  });

  it('allows in_progress -> not_started (revertible)', () => {
    createAssignment(adapter, 'a-1', {
      class_id: 'c-cs',
      title: 'X',
      type: 'homework',
      status: 'in_progress',
    });
    expect(() =>
      updateAssignment(adapter, 'a-1', { status: 'not_started' }),
    ).not.toThrow();
  });

  it('throws when updating status on a missing assignment', () => {
    expect(() => updateAssignment(adapter, 'missing', { status: 'in_progress' })).toThrow(
      /Assignment not found/,
    );
  });
});

describe('getTimeEstimateAccuracy', () => {
  it('returns zero-state when no rows have both estimate and actual', () => {
    createAssignment(adapter, 'a-1', {
      class_id: 'c-cs',
      title: 'X',
      type: 'homework',
      estimated_minutes: 60,
    });
    const stats = getTimeEstimateAccuracy(adapter);
    expect(stats).toEqual({
      sample_count: 0,
      avg_actual_over_estimated_ratio: null,
      mean_absolute_error_minutes: null,
    });
  });

  it('computes ratio and MAE across multiple rows', () => {
    createAssignment(adapter, 'a-1', {
      class_id: 'c-cs',
      title: 'X',
      type: 'homework',
      estimated_minutes: 60,
      actual_minutes: 90,
    });
    createAssignment(adapter, 'a-2', {
      class_id: 'c-cs',
      title: 'Y',
      type: 'homework',
      estimated_minutes: 30,
      actual_minutes: 30,
    });
    createAssignment(adapter, 'a-3', {
      class_id: 'c-ma',
      title: 'Z',
      type: 'homework',
      estimated_minutes: 60,
      actual_minutes: 120,
    });

    const all = getTimeEstimateAccuracy(adapter);
    expect(all.sample_count).toBe(3);
    // ratios: 1.5, 1.0, 2.0 -> avg = 1.5
    expect(all.avg_actual_over_estimated_ratio).toBeCloseTo(1.5, 5);
    // errors: 30, 0, 60 -> mean = 30
    expect(all.mean_absolute_error_minutes).toBeCloseTo(30, 5);

    const csOnly = getTimeEstimateAccuracy(adapter, 'c-cs');
    expect(csOnly.sample_count).toBe(2);
    // ratios: 1.5, 1.0 -> avg = 1.25
    expect(csOnly.avg_actual_over_estimated_ratio).toBeCloseTo(1.25, 5);
    // errors: 30, 0 -> mean = 15
    expect(csOnly.mean_absolute_error_minutes).toBeCloseTo(15, 5);
  });
});
