import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createModuleTestDatabase, type InMemoryTestDatabase } from '@mylife/db';
import { SHOP_MODULE } from '../definition';
import {
  createGiftPerson,
  deleteGiftPerson,
  getGiftPersonById,
  listGiftPeople,
  updateGiftPerson,
} from '../index';

let testDb: InMemoryTestDatabase;

const DAY = 86_400_000;
const NOW = new Date('2026-04-21T00:00:00Z').getTime();

beforeEach(() => {
  testDb = createModuleTestDatabase('shop', SHOP_MODULE.migrations!);
});

afterEach(() => {
  testDb.close();
});

describe('gift-people CRUD', () => {
  it('creates a person with defaults', () => {
    const p = createGiftPerson(testDb.adapter, { name: 'Mom' });
    expect(p.name).toBe('Mom');
    expect(p.relationship).toBeNull();
    expect(p.nextOccasion).toBeNull();
    expect(p.nextOccasionDate).toBeNull();
    expect(p.notes).toBeNull();
    expect(p.createdAt).toBeGreaterThan(0);
  });

  it('persists optional fields', () => {
    const p = createGiftPerson(testDb.adapter, {
      name: 'Sarah',
      relationship: 'sister',
      nextOccasion: 'birthday',
      nextOccasionDate: NOW + 30 * DAY,
      notes: 'loves yoga',
    });
    expect(p.relationship).toBe('sister');
    expect(p.nextOccasion).toBe('birthday');
    expect(p.nextOccasionDate).toBe(NOW + 30 * DAY);
    expect(p.notes).toBe('loves yoga');
  });

  it('reads missing as null', () => {
    expect(getGiftPersonById(testDb.adapter, 'missing')).toBeNull();
  });

  it('updates partial fields', () => {
    const p = createGiftPerson(testDb.adapter, { name: 'Dad' });
    const updated = updateGiftPerson(testDb.adapter, p.id, {
      relationship: 'father',
      notes: 'likes dark chocolate',
    });
    expect(updated?.relationship).toBe('father');
    expect(updated?.notes).toBe('likes dark chocolate');
    expect(updated?.name).toBe('Dad');
  });

  it('returns null updating missing', () => {
    expect(updateGiftPerson(testDb.adapter, 'missing', { name: 'X' })).toBeNull();
  });

  it('deletes a person', () => {
    const p = createGiftPerson(testDb.adapter, { name: 'Temp' });
    expect(deleteGiftPerson(testDb.adapter, p.id)).toBe(true);
    expect(getGiftPersonById(testDb.adapter, p.id)).toBeNull();
    expect(deleteGiftPerson(testDb.adapter, p.id)).toBe(false);
  });

  it('lists people sorted by next_occasion_date asc with nulls last', () => {
    createGiftPerson(testDb.adapter, { name: 'Z (no date)' });
    createGiftPerson(testDb.adapter, {
      name: 'A',
      nextOccasionDate: NOW + 60 * DAY,
    });
    createGiftPerson(testDb.adapter, {
      name: 'B',
      nextOccasionDate: NOW + 5 * DAY,
    });
    const people = listGiftPeople(testDb.adapter);
    expect(people.map((p) => p.name)).toEqual(['B', 'A', 'Z (no date)']);
  });
});
