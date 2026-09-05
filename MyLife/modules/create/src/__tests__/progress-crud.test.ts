import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { DatabaseAdapter } from '@mylife/db';
import { createModuleTestDatabase } from '@mylife/db';
import { CREATE_MODULE } from '../definition';
import {
  createProgressEntry,
  createProject,
  deleteProgressEntry,
  getBreakthroughs,
  getProgressEntry,
  getProject,
  listMilestones,
  listProgressByProject,
  recalcProjectActualHours,
  updateProgressEntry,
} from '../db';

let adapter: DatabaseAdapter;
let close: () => void;

beforeEach(() => {
  const testDb = createModuleTestDatabase('create', CREATE_MODULE.migrations ?? []);
  adapter = testDb.adapter;
  close = testDb.close;

  createProject(adapter, 'proj-1', {
    title: 'Short Film',
    type: 'video',
    estimated_hours: 20,
  });
});

afterEach(() => {
  close();
});

describe('MyCreate progress CRUD', () => {
  it('round-trips a progress entry', () => {
    const created = createProgressEntry(adapter, 'entry-1', {
      project_id: 'proj-1',
      date: '2026-04-21T10:00:00.000Z',
      notes_md: 'Blocked the first rough cut.',
      hours_spent: 2.5,
      mood: 'focused',
      photo_ids: ['photo-1'],
    });

    expect(created.hours_spent).toBe(2.5);
    expect(created.photo_ids).toEqual(['photo-1']);

    const fetched = getProgressEntry(adapter, 'entry-1');
    expect(fetched).not.toBeNull();
    expect(fetched?.notes_md).toBe('Blocked the first rough cut.');
    expect(fetched?.mood).toBe('focused');
  });

  it('lists milestones and breakthroughs with project hour aggregation', () => {
    createProgressEntry(adapter, 'entry-1', {
      project_id: 'proj-1',
      date: '2026-04-20T10:00:00.000Z',
      notes_md: 'Outlined sequence',
      hours_spent: 1.5,
      milestone: true,
      milestone_name: 'Storyboard locked',
      breakthrough: 'Found the right transition pacing',
    });
    createProgressEntry(adapter, 'entry-2', {
      project_id: 'proj-1',
      date: '2026-04-21T10:00:00.000Z',
      notes_md: 'Shot pickup footage',
      hours_spent: 2.25,
      roadblock: 'Lighting mismatch',
    });

    const milestones = listMilestones(adapter, 'proj-1');
    expect(milestones).toHaveLength(1);
    expect(milestones[0].milestone_name).toBe('Storyboard locked');

    const breakthroughs = getBreakthroughs(adapter, 'proj-1');
    expect(breakthroughs).toHaveLength(1);
    expect(breakthroughs[0].breakthrough).toContain('transition');

    const project = getProject(adapter, 'proj-1');
    expect(project?.actual_hours).toBeCloseTo(3.75, 5);
  });

  it('recalculates project actual hours on update and delete', () => {
    createProgressEntry(adapter, 'entry-1', {
      project_id: 'proj-1',
      hours_spent: 1.5,
    });
    createProgressEntry(adapter, 'entry-2', {
      project_id: 'proj-1',
      hours_spent: 2.25,
      milestone: true,
      milestone_name: 'First assembly edit',
    });

    const updated = updateProgressEntry(adapter, 'entry-1', {
      hours_spent: 2,
      breakthrough: 'Better pacing',
    });
    expect(updated?.hours_spent).toBe(2);
    expect(updated?.breakthrough).toBe('Better pacing');
    expect(getProject(adapter, 'proj-1')?.actual_hours).toBeCloseTo(4.25, 5);

    deleteProgressEntry(adapter, 'entry-2');
    expect(getProgressEntry(adapter, 'entry-2')).toBeNull();
    expect(recalcProjectActualHours(adapter, 'proj-1')).toBeCloseTo(2, 5);
    expect(getProject(adapter, 'proj-1')?.actual_hours).toBeCloseTo(2, 5);
  });

  it('lists entries newest first by date', () => {
    createProgressEntry(adapter, 'entry-old', {
      project_id: 'proj-1',
      date: '2026-04-01T08:00:00.000Z',
      hours_spent: 1,
    });
    createProgressEntry(adapter, 'entry-new', {
      project_id: 'proj-1',
      date: '2026-04-10T08:00:00.000Z',
      hours_spent: 1,
    });

    expect(
      listProgressByProject(adapter, 'proj-1').map((entry) => entry.id),
    ).toEqual(['entry-new', 'entry-old']);
  });
});
