import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { DatabaseAdapter } from '@mylife/db';
import { createModuleTestDatabase } from '@mylife/db';
import { DINING_MODULE } from '../definition';
import { createRestaurant } from '../db/crud/restaurants';
import { createVisit } from '../db/crud/visits';
import {
  createPhoto,
  getPhoto,
  deletePhoto,
  listPhotosByVisit,
  listPhotosByDish,
} from '../db/crud/photos';

let db: DatabaseAdapter;
let closeDb: () => void;
let nextId = 0;

function genId(): string {
  nextId += 1;
  return `test-${nextId.toString().padStart(4, '0')}`;
}

beforeEach(() => {
  nextId = 0;
  const testDb = createModuleTestDatabase('dining', DINING_MODULE.migrations!);
  db = testDb.adapter;
  closeDb = testDb.close;
});

afterEach(() => {
  closeDb();
});

describe('Photo CRUD', () => {
  it('creates a photo and lists by visit', () => {
    const rId = genId();
    createRestaurant(db, rId, { name: 'Photo Test' });
    const vId = genId();
    createVisit(db, vId, {
      restaurant_id: rId,
      visited_at: '2025-06-01T18:00:00Z',
      overall_rating: 4,
    });

    const pId = genId();
    const photo = createPhoto(db, pId, {
      visit_id: vId,
      kind: 'dish',
      local_uri: '/photos/dish1.jpg',
      caption: 'Amazing ramen',
      width: 1920,
      height: 1080,
      size_bytes: 250000,
    });

    expect(photo.id).toBe(pId);
    expect(photo.visit_id).toBe(vId);
    expect(photo.kind).toBe('dish');
    expect(photo.local_uri).toBe('/photos/dish1.jpg');
    expect(photo.caption).toBe('Amazing ramen');

    const fetched = getPhoto(db, pId);
    expect(fetched).not.toBeNull();
    expect(fetched!.width).toBe(1920);
    expect(fetched!.height).toBe(1080);

    const byVisit = listPhotosByVisit(db, vId);
    expect(byVisit).toHaveLength(1);
    expect(byVisit[0].id).toBe(pId);
  });

  it('deletes a photo', () => {
    const rId = genId();
    createRestaurant(db, rId, { name: 'Delete Photo Test' });
    const vId = genId();
    createVisit(db, vId, {
      restaurant_id: rId,
      visited_at: '2025-06-01T18:00:00Z',
      overall_rating: 3,
    });

    const pId = genId();
    createPhoto(db, pId, {
      visit_id: vId,
      kind: 'interior',
      local_uri: '/photos/interior.jpg',
    });

    deletePhoto(db, pId);
    expect(getPhoto(db, pId)).toBeNull();
    expect(listPhotosByVisit(db, vId)).toHaveLength(0);
  });

  it('lists photos by dish_id (empty for now, dishes come in P3)', () => {
    const result = listPhotosByDish(db, 'some-dish-id');
    expect(result).toEqual([]);
  });

  it('returns null for non-existent photo', () => {
    expect(getPhoto(db, 'does-not-exist')).toBeNull();
  });
});
