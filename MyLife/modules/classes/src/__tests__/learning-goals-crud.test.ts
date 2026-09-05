import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { DatabaseAdapter } from '@mylife/db';
import { createModuleTestDatabase } from '@mylife/db';
import { CLASSES_MODULE } from '../definition';
import {
  createCertification,
  createLearningGoal,
  createOnlineCourse,
  deleteLearningGoal,
  getGoalProgress,
  getLearningGoal,
  listLearningGoals,
  updateLearningGoal,
} from '../db';

let adapter: DatabaseAdapter;
let close: () => void;

beforeEach(() => {
  const testDb = createModuleTestDatabase('classes', CLASSES_MODULE.migrations ?? []);
  adapter = testDb.adapter;
  close = testDb.close;
});

afterEach(() => close());

describe('learning-goals CRUD', () => {
  it('round-trips a goal with serialized id arrays', () => {
    const row = createLearningGoal(adapter, 'g-1', {
      title: 'Become a cloud architect',
      description_md: '## Plan',
      target_date: '2026-12-31T00:00:00.000Z',
      course_ids: ['oc-1', 'oc-2'],
      certification_ids: ['cert-1'],
    });

    expect(row.status).toBe('active');
    const fetched = getLearningGoal(adapter, 'g-1');
    expect(fetched).not.toBeNull();
    expect(fetched?.course_ids).toBe(JSON.stringify(['oc-1', 'oc-2']));
    expect(fetched?.certification_ids).toBe(JSON.stringify(['cert-1']));
  });

  it('updates fields and re-serializes link arrays', () => {
    createLearningGoal(adapter, 'g-1', { title: 'Goal' });
    updateLearningGoal(adapter, 'g-1', {
      title: 'Better goal',
      status: 'completed',
      course_ids: ['oc-9'],
      completed_at: '2026-04-20T00:00:00.000Z',
    });
    const row = getLearningGoal(adapter, 'g-1');
    expect(row?.title).toBe('Better goal');
    expect(row?.status).toBe('completed');
    expect(row?.course_ids).toBe(JSON.stringify(['oc-9']));
    expect(row?.completed_at).toBe('2026-04-20T00:00:00.000Z');
  });

  it('deletes a goal', () => {
    createLearningGoal(adapter, 'g-1', { title: 'X' });
    deleteLearningGoal(adapter, 'g-1');
    expect(getLearningGoal(adapter, 'g-1')).toBeNull();
  });

  it('lists goals with target_date asc, then nulls last', () => {
    createLearningGoal(adapter, 'g-late', {
      title: 'Late',
      target_date: '2026-12-01T00:00:00.000Z',
    });
    createLearningGoal(adapter, 'g-early', {
      title: 'Early',
      target_date: '2026-06-01T00:00:00.000Z',
    });
    createLearningGoal(adapter, 'g-none', { title: 'None' });

    const rows = listLearningGoals(adapter);
    expect(rows.map((r) => r.id)).toEqual(['g-early', 'g-late', 'g-none']);
  });

  it('getGoalProgress returns zero state for missing goal', () => {
    const progress = getGoalProgress(adapter, 'missing');
    expect(progress).toEqual({
      total_items: 0,
      completed_items: 0,
      percent: 0,
      goal: null,
    });
  });

  it('getGoalProgress reports completed courses + issued certs', () => {
    createOnlineCourse(adapter, 'oc-done', {
      title: 'Done',
      status: 'completed',
    });
    createOnlineCourse(adapter, 'oc-active', {
      title: 'Active',
      status: 'in_progress',
    });
    createCertification(adapter, 'cert-issued', {
      name: 'Issued',
      issued_at: '2026-01-01T00:00:00.000Z',
    });
    createCertification(adapter, 'cert-pending', { name: 'Pending' });

    createLearningGoal(adapter, 'g-1', {
      title: 'Mixed',
      course_ids: ['oc-done', 'oc-active'],
      certification_ids: ['cert-issued', 'cert-pending'],
    });

    const progress = getGoalProgress(adapter, 'g-1');
    expect(progress.total_items).toBe(4);
    expect(progress.completed_items).toBe(2);
    expect(progress.percent).toBeCloseTo(50, 5);
    expect(progress.goal?.id).toBe('g-1');
  });

  it('getGoalProgress counts missing rows toward total but not completed', () => {
    createOnlineCourse(adapter, 'oc-done', {
      title: 'Done',
      status: 'completed',
    });
    createLearningGoal(adapter, 'g-1', {
      title: 'With ghost',
      course_ids: ['oc-done', 'oc-missing'],
    });
    const progress = getGoalProgress(adapter, 'g-1');
    expect(progress.total_items).toBe(2);
    expect(progress.completed_items).toBe(1);
    expect(progress.percent).toBeCloseTo(50, 5);
  });
});
