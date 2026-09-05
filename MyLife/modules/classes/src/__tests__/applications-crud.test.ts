import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { DatabaseAdapter } from '@mylife/db';
import { createModuleTestDatabase } from '@mylife/db';
import { CLASSES_MODULE } from '../definition';
import {
  createApplication,
  createApplicationTask,
  deleteApplication,
  getApplication,
  getApplicationCompletionPercent,
  listApplications,
  listUpcomingDeadlines,
  updateApplication,
} from '../db';

let adapter: DatabaseAdapter;
let close: () => void;

beforeEach(() => {
  const testDb = createModuleTestDatabase('classes', CLASSES_MODULE.migrations ?? []);
  adapter = testDb.adapter;
  close = testDb.close;
});

afterEach(() => close());

describe('applications CRUD', () => {
  it('round-trips an application with defaults', () => {
    const row = createApplication(adapter, 'a-1', {
      name: 'Stanford CS PhD',
      type: 'grad',
      institution: 'Stanford University',
      program: 'PhD Computer Science',
    });
    expect(row.status).toBe('considering');
    expect(row.required_essays_count).toBe(0);
    expect(row.transcripts_requested).toBe(0);
    expect(getApplication(adapter, 'a-1')).toMatchObject({
      name: 'Stanford CS PhD',
      institution: 'Stanford University',
    });
  });

  it('serializes required_test_score_ids as JSON', () => {
    createApplication(adapter, 'a-1', {
      name: 'MIT',
      type: 'undergrad',
      required_test_score_ids: ['t-sat', 't-toefl'],
    });
    const row = getApplication(adapter, 'a-1');
    expect(row?.required_test_score_ids).toBe(JSON.stringify(['t-sat', 't-toefl']));
  });

  it('updates status, deadline, and counters', () => {
    createApplication(adapter, 'a-1', { name: 'Yale', type: 'undergrad' });
    updateApplication(adapter, 'a-1', {
      status: 'submitted',
      essays_drafted: 3,
      essays_finalized: 3,
      transcripts_requested: true,
      transcripts_sent: true,
    });
    const row = getApplication(adapter, 'a-1');
    expect(row?.status).toBe('submitted');
    expect(row?.essays_finalized).toBe(3);
    expect(row?.transcripts_requested).toBe(1);
    expect(row?.transcripts_sent).toBe(1);
  });

  it('listApplications filters by status and type', () => {
    createApplication(adapter, 'a', { name: 'A', type: 'undergrad', status: 'considering' });
    createApplication(adapter, 'b', { name: 'B', type: 'grad', status: 'submitted' });
    createApplication(adapter, 'c', { name: 'C', type: 'scholarship', status: 'submitted' });

    expect(listApplications(adapter)).toHaveLength(3);
    expect(listApplications(adapter, { status: 'submitted' })).toHaveLength(2);
    expect(listApplications(adapter, { type: 'grad' })).toHaveLength(1);
    expect(
      listApplications(adapter, { status: 'submitted', type: 'scholarship' }),
    ).toHaveLength(1);
  });

  it('listUpcomingDeadlines returns deadlines in window, excludes terminal status', () => {
    const now = new Date('2026-01-01T00:00:00.000Z');
    createApplication(adapter, 'a', {
      name: 'In window',
      type: 'undergrad',
      deadline: '2026-01-15T00:00:00.000Z',
    });
    createApplication(adapter, 'b', {
      name: 'Out of window',
      type: 'undergrad',
      deadline: '2026-04-01T00:00:00.000Z',
    });
    createApplication(adapter, 'c', {
      name: 'Already submitted',
      type: 'undergrad',
      deadline: '2026-01-10T00:00:00.000Z',
      status: 'submitted',
    });

    const upcoming = listUpcomingDeadlines(adapter, 30, now);
    expect(upcoming.map((a) => a.id)).toEqual(['a']);
  });

  it('getApplicationCompletionPercent returns 100 when no components apply', () => {
    createApplication(adapter, 'a', { name: 'Empty', type: 'undergrad' });
    expect(getApplicationCompletionPercent(adapter, 'a')).toBe(100);
  });

  it('getApplicationCompletionPercent averages essays + recommenders + transcripts', () => {
    createApplication(adapter, 'a', {
      name: 'Half',
      type: 'undergrad',
      required_essays_count: 4,
      essays_finalized: 2, // 50%
      recommenders_required: 2,
      recommenders_confirmed: 1, // 50%
      transcripts_requested: true,
      transcripts_sent: false, // 0%
    });
    // (0.5 + 0.5 + 0) / 3 = 0.333 -> 33
    expect(getApplicationCompletionPercent(adapter, 'a')).toBe(33);
  });

  it('getApplicationCompletionPercent factors in tasks (skipped count as done)', () => {
    createApplication(adapter, 'a', {
      name: 'Tasks',
      type: 'undergrad',
    });
    createApplicationTask(adapter, 'tk-1', {
      application_id: 'a',
      title: 'Personal essay',
      kind: 'essay',
      status: 'done',
    });
    createApplicationTask(adapter, 'tk-2', {
      application_id: 'a',
      title: 'Supplemental',
      kind: 'supplemental',
      status: 'skipped',
    });
    createApplicationTask(adapter, 'tk-3', {
      application_id: 'a',
      title: 'Portal',
      kind: 'portal_step',
      status: 'in_progress',
    });
    // 2 of 3 done/skipped = 0.6667 -> 67
    expect(getApplicationCompletionPercent(adapter, 'a')).toBe(67);
  });

  it('getApplicationCompletionPercent returns 0 for missing application', () => {
    expect(getApplicationCompletionPercent(adapter, 'nope')).toBe(0);
  });

  it('deletes an application', () => {
    createApplication(adapter, 'a-1', { name: 'X', type: 'job' });
    deleteApplication(adapter, 'a-1');
    expect(getApplication(adapter, 'a-1')).toBeNull();
  });
});
