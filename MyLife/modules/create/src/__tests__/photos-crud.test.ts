import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { DatabaseAdapter } from '@mylife/db';
import { createModuleTestDatabase } from '@mylife/db';
import { CREATE_MODULE } from '../definition';
import {
  createPhoto,
  createProject,
  deletePhoto,
  getPhoto,
  listPhotosByProject,
} from '../db';

let adapter: DatabaseAdapter;
let close: () => void;

beforeEach(() => {
  const testDb = createModuleTestDatabase('create', CREATE_MODULE.migrations ?? []);
  adapter = testDb.adapter;
  close = testDb.close;

  createProject(adapter, 'proj-1', {
    title: 'Illustration pack',
    type: 'design',
  });
});

afterEach(() => {
  close();
});

describe('MyCreate photo CRUD', () => {
  it('round-trips a project photo', () => {
    const created = createPhoto(adapter, 'photo-1', {
      project_id: 'proj-1',
      kind: 'process',
      local_uri: 'file:///tmp/sketch.jpg',
      caption: 'Pencil sketch',
      taken_at: '2026-04-21T12:00:00.000Z',
    });

    expect(created.project_id).toBe('proj-1');
    expect(created.kind).toBe('process');

    const fetched = getPhoto(adapter, 'photo-1');
    expect(fetched).not.toBeNull();
    expect(fetched?.caption).toBe('Pencil sketch');
    expect(fetched?.local_uri).toBe('file:///tmp/sketch.jpg');
  });

  it('lists photos newest first by taken_at fallback created_at', () => {
    createPhoto(adapter, 'photo-older', {
      project_id: 'proj-1',
      kind: 'process',
      local_uri: 'file:///tmp/older.jpg',
      taken_at: '2026-04-20T10:00:00.000Z',
    });
    createPhoto(adapter, 'photo-newer', {
      project_id: 'proj-1',
      kind: 'process',
      local_uri: 'file:///tmp/newer.jpg',
      taken_at: '2026-04-21T10:00:00.000Z',
    });

    expect(listPhotosByProject(adapter, 'proj-1').map((photo) => photo.id)).toEqual([
      'photo-newer',
      'photo-older',
    ]);
  });

  it('deletes stored photos cleanly', () => {
    createPhoto(adapter, 'photo-1', {
      project_id: 'proj-1',
      kind: 'process',
      local_uri: 'file:///tmp/sketch.jpg',
    });

    expect(deletePhoto(adapter, 'photo-1')).toBe(true);
    expect(getPhoto(adapter, 'photo-1')).toBeNull();
    expect(deletePhoto(adapter, 'photo-1')).toBe(false);
  });
});
