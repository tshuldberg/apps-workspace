import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { DatabaseAdapter } from '@mylife/db';
import { createModuleTestDatabase } from '@mylife/db';
import { DINING_MODULE } from '../definition';
import {
  createTag,
  listTags,
  addTagToRestaurant,
  removeTagFromRestaurant,
  getTagsForRestaurant,
} from '../db/crud/tags';
import { createRestaurant } from '../db/crud/restaurants';

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

describe('Tag CRUD round-trip', () => {
  it('creates and lists tags', () => {
    const id = genId();
    const tag = createTag(db, id, {
      name: 'Italian',
      color: '#E74C3C',
      kind: 'cuisine',
    });

    expect(tag.id).toBe(id);
    expect(tag.name).toBe('Italian');
    expect(tag.color).toBe('#E74C3C');
    expect(tag.kind).toBe('cuisine');
    expect(tag.created_at).toBeTruthy();

    const all = listTags(db);
    expect(all).toHaveLength(1);
    expect(all[0].name).toBe('Italian');
  });

  it('creates a tag with no color', () => {
    const tag = createTag(db, genId(), {
      name: 'Date Night',
      kind: 'occasion',
    });
    expect(tag.color).toBeNull();
    expect(tag.kind).toBe('occasion');
  });
});

describe('addTagToRestaurant / removeTagFromRestaurant', () => {
  it('links and unlinks tags', () => {
    const rId = genId();
    const t1 = genId();
    const t2 = genId();

    createRestaurant(db, rId, { name: 'Test Place' });
    createTag(db, t1, { name: 'Italian', kind: 'cuisine' });
    createTag(db, t2, { name: 'Romantic', kind: 'vibe' });

    addTagToRestaurant(db, rId, t1);
    addTagToRestaurant(db, rId, t2);

    let tags = getTagsForRestaurant(db, rId);
    expect(tags).toHaveLength(2);
    expect(tags.map((t) => t.name).sort()).toEqual(['Italian', 'Romantic']);

    removeTagFromRestaurant(db, rId, t1);
    tags = getTagsForRestaurant(db, rId);
    expect(tags).toHaveLength(1);
    expect(tags[0].name).toBe('Romantic');
  });

  it('handles duplicate tag additions gracefully', () => {
    const rId = genId();
    const tId = genId();

    createRestaurant(db, rId, { name: 'Dupe Test' });
    createTag(db, tId, { name: 'Mexican', kind: 'cuisine' });

    addTagToRestaurant(db, rId, tId);
    addTagToRestaurant(db, rId, tId); // should not throw

    const tags = getTagsForRestaurant(db, rId);
    expect(tags).toHaveLength(1);
  });
});

describe('getTagsForRestaurant', () => {
  it('returns correct tags ordered by name', () => {
    const rId = genId();
    const tZ = genId();
    const tA = genId();
    const tM = genId();

    createRestaurant(db, rId, { name: 'Multi-tag Place' });
    createTag(db, tZ, { name: 'Zen', kind: 'vibe' });
    createTag(db, tA, { name: 'After Work', kind: 'occasion' });
    createTag(db, tM, { name: 'Mediterranean', kind: 'cuisine' });

    addTagToRestaurant(db, rId, tZ);
    addTagToRestaurant(db, rId, tA);
    addTagToRestaurant(db, rId, tM);

    const tags = getTagsForRestaurant(db, rId);
    expect(tags.map((t) => t.name)).toEqual(['After Work', 'Mediterranean', 'Zen']);
  });

  it('returns empty array for restaurant with no tags', () => {
    const rId = genId();
    createRestaurant(db, rId, { name: 'No Tags' });
    expect(getTagsForRestaurant(db, rId)).toEqual([]);
  });
});

describe('listTags with kind filter', () => {
  it('filters by kind', () => {
    createTag(db, genId(), { name: 'Italian', kind: 'cuisine' });
    createTag(db, genId(), { name: 'Japanese', kind: 'cuisine' });
    createTag(db, genId(), { name: 'Romantic', kind: 'vibe' });
    createTag(db, genId(), { name: 'Date Night', kind: 'occasion' });

    const cuisines = listTags(db, 'cuisine');
    expect(cuisines).toHaveLength(2);
    expect(cuisines.every((t) => t.kind === 'cuisine')).toBe(true);

    const vibes = listTags(db, 'vibe');
    expect(vibes).toHaveLength(1);
    expect(vibes[0].name).toBe('Romantic');

    const all = listTags(db);
    expect(all).toHaveLength(4);
  });
});
