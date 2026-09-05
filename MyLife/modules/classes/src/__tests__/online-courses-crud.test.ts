import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { DatabaseAdapter } from '@mylife/db';
import { createModuleTestDatabase } from '@mylife/db';
import { CLASSES_MODULE } from '../definition';
import {
  createOnlineCourse,
  deleteOnlineCourse,
  getCourseStats,
  getOnlineCourse,
  listOnlineCourses,
  updateOnlineCourse,
} from '../db';

let adapter: DatabaseAdapter;
let close: () => void;

beforeEach(() => {
  const testDb = createModuleTestDatabase('classes', CLASSES_MODULE.migrations ?? []);
  adapter = testDb.adapter;
  close = testDb.close;
});

afterEach(() => close());

describe('online-courses CRUD', () => {
  it('round-trips a course with tags serialized', () => {
    const row = createOnlineCourse(adapter, 'oc-1', {
      title: 'Type-Driven Development',
      provider: 'Coursera',
      url: 'https://example.com/tdd',
      instructor: 'Edwin Brady',
      category: 'Programming',
      status: 'in_progress',
      progress_percent: 42,
      started_at: '2026-04-01T00:00:00.000Z',
      estimated_hours: 12,
      actual_hours: 5,
      notes_md: '## Notes',
      rating: 4,
      tags: ['types', 'fp'],
    });

    expect(row.status).toBe('in_progress');
    expect(row.progress_percent).toBe(42);
    const fetched = getOnlineCourse(adapter, 'oc-1');
    expect(fetched).not.toBeNull();
    expect(fetched?.tags).toBe(JSON.stringify(['types', 'fp']));
    expect(fetched?.rating).toBe(4);
  });

  it('defaults status to not_started and progress_percent to 0', () => {
    const row = createOnlineCourse(adapter, 'oc-2', {
      title: 'Casual Learning',
    });
    expect(row.status).toBe('not_started');
    expect(row.progress_percent).toBe(0);
    expect(row.provider).toBeNull();
    expect(row.tags).toBeNull();
  });

  it('updates fields including tag re-serialization and refreshes updated_at', async () => {
    const original = createOnlineCourse(adapter, 'oc-1', {
      title: 'Original Title',
    });
    await new Promise((r) => setTimeout(r, 5));
    updateOnlineCourse(adapter, 'oc-1', {
      title: 'New Title',
      status: 'completed',
      progress_percent: 100,
      tags: ['done'],
    });
    const row = getOnlineCourse(adapter, 'oc-1');
    expect(row?.title).toBe('New Title');
    expect(row?.status).toBe('completed');
    expect(row?.progress_percent).toBe(100);
    expect(row?.tags).toBe(JSON.stringify(['done']));
    expect(row?.updated_at).not.toBe(original.updated_at);
  });

  it('treats empty tags array as null (consistent with study-sessions)', () => {
    createOnlineCourse(adapter, 'oc-1', { title: 'X', tags: [] });
    const row = getOnlineCourse(adapter, 'oc-1');
    expect(row?.tags).toBeNull();
  });

  it('deletes a course', () => {
    createOnlineCourse(adapter, 'oc-1', { title: 'X' });
    deleteOnlineCourse(adapter, 'oc-1');
    expect(getOnlineCourse(adapter, 'oc-1')).toBeNull();
  });

  it('lists all courses newest first', async () => {
    createOnlineCourse(adapter, 'oc-1', { title: 'A' });
    await new Promise((r) => setTimeout(r, 5));
    createOnlineCourse(adapter, 'oc-2', { title: 'B' });
    await new Promise((r) => setTimeout(r, 5));
    createOnlineCourse(adapter, 'oc-3', { title: 'C' });
    const rows = listOnlineCourses(adapter);
    expect(rows.map((r) => r.id)).toEqual(['oc-3', 'oc-2', 'oc-1']);
  });

  it('filters by status', () => {
    createOnlineCourse(adapter, 'oc-a', { title: 'A', status: 'completed' });
    createOnlineCourse(adapter, 'oc-b', { title: 'B', status: 'in_progress' });
    createOnlineCourse(adapter, 'oc-c', { title: 'C', status: 'completed' });
    const completed = listOnlineCourses(adapter, { status: 'completed' });
    expect(completed.map((r) => r.id).sort()).toEqual(['oc-a', 'oc-c']);
  });

  it('rejects invalid status via Zod (e.g. "wat")', () => {
    expect(() =>
      createOnlineCourse(adapter, 'oc-x', {
        title: 'X',
        // @ts-expect-error invalid status string
        status: 'wat',
      }),
    ).toThrow();
  });

  it('getCourseStats aggregates totals and hours spent', () => {
    createOnlineCourse(adapter, 'oc-a', {
      title: 'A',
      status: 'completed',
      actual_hours: 10,
    });
    createOnlineCourse(adapter, 'oc-b', {
      title: 'B',
      status: 'in_progress',
      actual_hours: 4.5,
    });
    createOnlineCourse(adapter, 'oc-c', {
      title: 'C',
      status: 'in_progress',
    });
    createOnlineCourse(adapter, 'oc-d', {
      title: 'D',
      status: 'not_started',
    });
    const stats = getCourseStats(adapter);
    expect(stats.total).toBe(4);
    expect(stats.in_progress).toBe(2);
    expect(stats.completed).toBe(1);
    expect(stats.total_hours_spent).toBeCloseTo(14.5, 5);
  });

  it('getCourseStats returns zero state when empty', () => {
    expect(getCourseStats(adapter)).toEqual({
      total: 0,
      in_progress: 0,
      completed: 0,
      total_hours_spent: 0,
    });
  });
});
