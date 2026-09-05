import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createModuleTestDatabase, type InMemoryTestDatabase } from '@mylife/db';
import { SHOP_MODULE } from '../definition';
import {
  createPreference,
  deletePreference,
  getPreference,
  getPreferenceById,
  listPreferences,
  listPreferencesByCategory,
  updatePreference,
} from '../index';

let testDb: InMemoryTestDatabase;

beforeEach(() => {
  testDb = createModuleTestDatabase('shop', SHOP_MODULE.migrations!);
});

afterEach(() => {
  testDb.close();
});

describe('preference CRUD', () => {
  it('creates a preference with defaults', () => {
    const p = createPreference(testDb.adapter, {
      category: 'tech',
      key: 'Phone OS',
      value: 'iOS',
    });
    expect(p.category).toBe('tech');
    expect(p.key).toBe('Phone OS');
    expect(p.value).toBe('iOS');
    expect(p.notes).toBeNull();
    expect(p.createdAt).toBeGreaterThan(0);
  });

  it('persists notes', () => {
    const p = createPreference(testDb.adapter, {
      category: 'allergy',
      key: 'Latex',
      value: 'severe',
      notes: 'carries EpiPen',
    });
    expect(p.notes).toBe('carries EpiPen');
  });

  it('reads missing as null', () => {
    expect(getPreferenceById(testDb.adapter, 'missing')).toBeNull();
  });

  it('updates partial fields', () => {
    const p = createPreference(testDb.adapter, {
      category: 'color',
      key: 'favorite',
      value: 'blue',
    });
    const updated = updatePreference(testDb.adapter, p.id, {
      value: 'teal',
      notes: 'seasonal',
    });
    expect(updated?.value).toBe('teal');
    expect(updated?.notes).toBe('seasonal');
    expect(updated?.key).toBe('favorite');
  });

  it('returns null updating missing', () => {
    expect(
      updatePreference(testDb.adapter, 'missing', { value: 'x' }),
    ).toBeNull();
  });

  it('deletes a preference', () => {
    const p = createPreference(testDb.adapter, {
      category: 'brand',
      key: 'Coffee',
      value: 'Blue Bottle',
    });
    expect(deletePreference(testDb.adapter, p.id)).toBe(true);
    expect(getPreferenceById(testDb.adapter, p.id)).toBeNull();
    expect(deletePreference(testDb.adapter, p.id)).toBe(false);
  });
});

describe('preference list queries', () => {
  function seedSet() {
    createPreference(testDb.adapter, {
      category: 'tech',
      key: 'Phone OS',
      value: 'iOS',
    });
    createPreference(testDb.adapter, {
      category: 'tech',
      key: 'Laptop',
      value: 'MacBook Pro',
    });
    createPreference(testDb.adapter, {
      category: 'color',
      key: 'favorite',
      value: 'blue',
    });
    createPreference(testDb.adapter, {
      category: 'allergy',
      key: 'Latex',
      value: 'severe',
    });
  }

  it('listPreferences returns all', () => {
    seedSet();
    expect(listPreferences(testDb.adapter)).toHaveLength(4);
  });

  it('listPreferencesByCategory filters', () => {
    seedSet();
    const tech = listPreferencesByCategory(testDb.adapter, 'tech');
    expect(tech.map((p) => p.key).sort()).toEqual(['Laptop', 'Phone OS']);
  });

  it('getPreference finds by unique category+key', () => {
    seedSet();
    const found = getPreference(testDb.adapter, 'tech', 'Phone OS');
    expect(found?.value).toBe('iOS');
  });

  it('getPreference returns null for missing', () => {
    seedSet();
    expect(getPreference(testDb.adapter, 'tech', 'Tablet')).toBeNull();
  });
});

describe('preference UNIQUE constraint', () => {
  it('rejects duplicate (category, key)', () => {
    createPreference(testDb.adapter, {
      category: 'household',
      key: 'Detergent',
      value: 'Tide',
    });
    expect(() =>
      createPreference(testDb.adapter, {
        category: 'household',
        key: 'Detergent',
        value: 'Persil',
      }),
    ).toThrow();
  });

  it('allows same key across different categories', () => {
    createPreference(testDb.adapter, {
      category: 'brand',
      key: 'favorite',
      value: 'Patagonia',
    });
    const c = createPreference(testDb.adapter, {
      category: 'color',
      key: 'favorite',
      value: 'green',
    });
    expect(c.id).toBeTruthy();
  });
});
