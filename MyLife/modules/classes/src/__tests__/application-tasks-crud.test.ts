import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { DatabaseAdapter } from '@mylife/db';
import { createModuleTestDatabase } from '@mylife/db';
import { CLASSES_MODULE } from '../definition';
import {
  createApplication,
  createApplicationTask,
  deleteApplication,
  deleteApplicationTask,
  getApplicationTask,
  listTasksByApplication,
  markTaskComplete,
  updateApplicationTask,
} from '../db';

let adapter: DatabaseAdapter;
let close: () => void;

beforeEach(() => {
  const testDb = createModuleTestDatabase('classes', CLASSES_MODULE.migrations ?? []);
  adapter = testDb.adapter;
  close = testDb.close;
  createApplication(adapter, 'app-1', { name: 'Stanford', type: 'undergrad' });
});

afterEach(() => close());

describe('application-tasks CRUD', () => {
  it('round-trips a task with defaults', () => {
    const row = createApplicationTask(adapter, 'tk-1', {
      application_id: 'app-1',
      title: 'Common App essay',
      kind: 'essay',
    });
    expect(row.status).toBe('not_started');
    expect(row.sort_order).toBe(0);
    expect(getApplicationTask(adapter, 'tk-1')).toMatchObject({
      title: 'Common App essay',
      kind: 'essay',
    });
  });

  it('updates word_count and status', () => {
    createApplicationTask(adapter, 'tk-1', {
      application_id: 'app-1',
      title: 'Why us',
      kind: 'essay',
      word_target: 250,
    });
    updateApplicationTask(adapter, 'tk-1', {
      status: 'in_progress',
      word_count: 180,
    });
    const row = getApplicationTask(adapter, 'tk-1');
    expect(row?.status).toBe('in_progress');
    expect(row?.word_count).toBe(180);
    expect(row?.word_target).toBe(250);
  });

  it('listTasksByApplication orders by sort_order then created_at', () => {
    createApplicationTask(adapter, 'tk-1', {
      application_id: 'app-1',
      title: 'B',
      kind: 'essay',
      sort_order: 2,
    });
    createApplicationTask(adapter, 'tk-2', {
      application_id: 'app-1',
      title: 'A',
      kind: 'essay',
      sort_order: 1,
    });
    createApplicationTask(adapter, 'tk-3', {
      application_id: 'app-1',
      title: 'C',
      kind: 'fee',
      sort_order: 3,
    });
    const list = listTasksByApplication(adapter, 'app-1');
    expect(list.map((t) => t.id)).toEqual(['tk-2', 'tk-1', 'tk-3']);
  });

  it('markTaskComplete sets status=done and completed_at', () => {
    createApplicationTask(adapter, 'tk-1', {
      application_id: 'app-1',
      title: 'Send transcript',
      kind: 'transcript',
    });
    markTaskComplete(adapter, 'tk-1', '2026-04-20T12:00:00.000Z');
    const row = getApplicationTask(adapter, 'tk-1');
    expect(row?.status).toBe('done');
    expect(row?.completed_at).toBe('2026-04-20T12:00:00.000Z');
  });

  it('cascades delete when the parent application is removed', () => {
    createApplicationTask(adapter, 'tk-1', {
      application_id: 'app-1',
      title: 'X',
      kind: 'other',
    });
    deleteApplication(adapter, 'app-1');
    expect(getApplicationTask(adapter, 'tk-1')).toBeNull();
  });

  it('deletes a single task', () => {
    createApplicationTask(adapter, 'tk-1', {
      application_id: 'app-1',
      title: 'X',
      kind: 'other',
    });
    deleteApplicationTask(adapter, 'tk-1');
    expect(getApplicationTask(adapter, 'tk-1')).toBeNull();
  });
});
