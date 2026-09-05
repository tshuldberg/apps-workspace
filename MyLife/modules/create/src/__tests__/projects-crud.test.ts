import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { DatabaseAdapter } from '@mylife/db';
import {
  createInMemoryTestDatabase,
  createModuleTestDatabase,
  initializeHubDatabase,
  runModuleMigrations,
} from '@mylife/db';
import { CREATE_MODULE } from '../definition';
import {
  CREATE_MIGRATION_V1,
  CREATE_MIGRATION_V2,
  addProjectHours,
  createProject,
  deleteProject,
  getProject,
  listProjects,
  updateProject,
  updateProjectStatus,
} from '../db';

let adapter: DatabaseAdapter;
let close: () => void;

beforeEach(() => {
  const testDb = createModuleTestDatabase('create', CREATE_MODULE.migrations ?? []);
  adapter = testDb.adapter;
  close = testDb.close;
});

afterEach(() => {
  close();
});

describe('MyCreate project migrations', () => {
  it('applies v1 to v2 cleanly and preserves v1 data', () => {
    const db = createInMemoryTestDatabase();

    try {
      initializeHubDatabase(db.adapter);
      expect(
        runModuleMigrations(db.adapter, 'create', [CREATE_MIGRATION_V1]),
      ).toBe(1);

      db.adapter.execute(
        `INSERT INTO ct_settings (key, value) VALUES (?, ?)`,
        ['defaultLandingTab', 'projects'],
      );

      expect(
        runModuleMigrations(db.adapter, 'create', [
          CREATE_MIGRATION_V1,
          CREATE_MIGRATION_V2,
        ]),
      ).toBe(1);

      const tables = db.adapter
        .query<{ name: string }>(
          `SELECT name FROM sqlite_master
           WHERE type = 'table' AND name LIKE 'ct_%'
           ORDER BY name`,
        )
        .map((row) => row.name);

      expect(tables).toEqual([
        'ct_photos',
        'ct_progress_entries',
        'ct_projects',
        'ct_settings',
      ]);

      expect(
        db.adapter.query<{ value: string }>(
          `SELECT value FROM ct_settings WHERE key = ?`,
          ['defaultLandingTab'],
        ),
      ).toEqual([{ value: 'projects' }]);

      expect(
        db.adapter.query<{ version: number }>(
          `SELECT MAX(version) AS version
           FROM hub_schema_versions
           WHERE module_id = ?`,
          ['create'],
        ),
      ).toEqual([{ version: 2 }]);
    } finally {
      db.close();
    }
  });
});

describe('MyCreate projects CRUD', () => {
  it('round-trips a project with serialized arrays and nullable fields', () => {
    const created = createProject(adapter, 'proj-1', {
      title: 'Album Artwork',
      type: 'art',
      description_md: 'Cover art for an EP',
      status: 'planning',
      priority: 3,
      deadline: '2026-05-15T00:00:00.000Z',
      estimated_hours: 12,
      tools_used: ['Procreate', 'iPad'],
      collaborators: ['Maya'],
      published_url: 'https://example.com/artwork',
      inspiration_refs: ['mood-board://1', 'note://palette'],
    });

    expect(created.status).toBe('planning');
    expect(created.tools_used).toEqual(['Procreate', 'iPad']);
    expect(created.collaborators).toEqual(['Maya']);
    expect(created.actual_hours).toBe(0);

    const fetched = getProject(adapter, 'proj-1');
    expect(fetched).not.toBeNull();
    expect(fetched?.title).toBe('Album Artwork');
    expect(fetched?.type).toBe('art');
    expect(fetched?.published_url).toBe('https://example.com/artwork');
    expect(fetched?.inspiration_refs).toEqual([
      'mood-board://1',
      'note://palette',
    ]);
  });

  it('updates scalar and array fields and refreshes status timestamps', async () => {
    const created = createProject(adapter, 'proj-1', {
      title: 'Devlog',
      type: 'video',
    });

    expect(created.started_at).toBeNull();
    expect(created.completed_at).toBeNull();

    await new Promise((resolve) => setTimeout(resolve, 5));
    const inProgress = updateProjectStatus(adapter, 'proj-1', 'in_progress');
    expect(inProgress?.status).toBe('in_progress');
    expect(inProgress?.started_at).not.toBeNull();

    await new Promise((resolve) => setTimeout(resolve, 5));
    const updated = updateProject(adapter, 'proj-1', {
      collaborators: ['Alex', 'Rin'],
      tools_used: ['Final Cut Pro'],
      outcome_notes: 'Published weekly build log',
      satisfaction_rating: 5,
    });
    expect(updated?.collaborators).toEqual(['Alex', 'Rin']);
    expect(updated?.tools_used).toEqual(['Final Cut Pro']);
    expect(updated?.satisfaction_rating).toBe(5);

    await new Promise((resolve) => setTimeout(resolve, 5));
    const complete = updateProjectStatus(adapter, 'proj-1', 'complete');
    expect(complete?.status).toBe('complete');
    expect(complete?.completed_at).not.toBeNull();
    expect(complete?.updated_at).not.toBe(created.updated_at);
  });

  it('filters by status and type, searches by title, and sorts by priority/deadline/title', () => {
    createProject(adapter, 'proj-a', {
      title: 'Poster Concepts',
      type: 'design',
      status: 'planning',
      priority: 1,
      deadline: '2026-06-10T00:00:00.000Z',
    });
    createProject(adapter, 'proj-b', {
      title: 'Zine Draft',
      type: 'writing',
      status: 'in_progress',
      priority: 5,
      deadline: '2026-05-01T00:00:00.000Z',
    });
    createProject(adapter, 'proj-c', {
      title: 'Ambient Loop',
      type: 'music',
      status: 'in_progress',
      priority: 3,
    });

    expect(
      listProjects(adapter, {
        status: 'in_progress',
        sort_by: 'title',
      }).map((row) => row.id),
    ).toEqual(['proj-c', 'proj-b']);

    expect(
      listProjects(adapter, { type: 'music' }).map((row) => row.id),
    ).toEqual(['proj-c']);

    expect(
      listProjects(adapter, { search: 'poster' }).map((row) => row.id),
    ).toEqual(['proj-a']);

    expect(
      listProjects(adapter, { sort_by: 'priority' }).map((row) => row.id),
    ).toEqual(['proj-b', 'proj-c', 'proj-a']);

    expect(
      listProjects(adapter, { sort_by: 'deadline' }).map((row) => row.id),
    ).toEqual(['proj-b', 'proj-a', 'proj-c']);

    expect(
      listProjects(adapter, { sort_by: 'title' }).map((row) => row.id),
    ).toEqual(['proj-c', 'proj-a', 'proj-b']);
  });

  it('adds hours and deletes a project cleanly', () => {
    createProject(adapter, 'proj-1', {
      title: 'Game prototype',
      type: 'game_dev',
    });

    const withHours = addProjectHours(adapter, 'proj-1', 2.5);
    expect(withHours?.actual_hours).toBeCloseTo(2.5, 5);

    deleteProject(adapter, 'proj-1');
    expect(getProject(adapter, 'proj-1')).toBeNull();
  });
});
