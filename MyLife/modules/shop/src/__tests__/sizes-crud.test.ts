import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createModuleTestDatabase, type InMemoryTestDatabase } from '@mylife/db';
import { SHOP_MODULE } from '../definition';
import {
  createSize,
  deleteSize,
  getSizeById,
  listSizes,
  listSizesByBrand,
  listSizesByType,
  searchSizesByBrand,
  updateSize,
} from '../index';

let testDb: InMemoryTestDatabase;

beforeEach(() => {
  testDb = createModuleTestDatabase('shop', SHOP_MODULE.migrations!);
});

afterEach(() => {
  testDb.close();
});

describe('size CRUD', () => {
  it('creates a size with defaults', () => {
    const s = createSize(testDb.adapter, {
      type: 'clothing',
      brand: 'Nike',
      sizeValue: 'M',
    });
    expect(s.type).toBe('clothing');
    expect(s.brand).toBe('Nike');
    expect(s.sizeValue).toBe('M');
    expect(s.fitNotes).toBeNull();
    expect(s.lastVerified).toBeNull();
    expect(s.createdAt).toBeGreaterThan(0);
  });

  it('persists optional fields', () => {
    const now = Date.now();
    const s = createSize(testDb.adapter, {
      type: 'shoe',
      brand: 'Allbirds',
      sizeValue: '10.5',
      fitNotes: 'runs half size small',
      lastVerified: now,
    });
    expect(s.fitNotes).toBe('runs half size small');
    expect(s.lastVerified).toBe(now);
  });

  it('reads missing as null', () => {
    expect(getSizeById(testDb.adapter, 'missing')).toBeNull();
  });

  it('updates partial fields', () => {
    const s = createSize(testDb.adapter, {
      type: 'clothing',
      brand: 'Uniqlo',
      sizeValue: 'L',
    });
    const updated = updateSize(testDb.adapter, s.id, {
      sizeValue: 'XL',
      fitNotes: 'shoulders tight',
    });
    expect(updated?.sizeValue).toBe('XL');
    expect(updated?.fitNotes).toBe('shoulders tight');
    expect(updated?.brand).toBe('Uniqlo');
  });

  it('returns null updating missing', () => {
    expect(
      updateSize(testDb.adapter, 'missing', { sizeValue: 'M' }),
    ).toBeNull();
  });

  it('deletes a size', () => {
    const s = createSize(testDb.adapter, {
      type: 'ring',
      brand: 'Mejuri',
      sizeValue: '7',
    });
    expect(deleteSize(testDb.adapter, s.id)).toBe(true);
    expect(getSizeById(testDb.adapter, s.id)).toBeNull();
    expect(deleteSize(testDb.adapter, s.id)).toBe(false);
  });

  it('allows duplicate brand/type entries (no unique constraint)', () => {
    createSize(testDb.adapter, {
      type: 'clothing',
      brand: 'Zara',
      sizeValue: 'M',
    });
    const second = createSize(testDb.adapter, {
      type: 'clothing',
      brand: 'Zara',
      sizeValue: 'L',
      fitNotes: 'for oversized fit',
    });
    expect(second.id).toBeTruthy();
    const all = listSizesByBrand(testDb.adapter, 'Zara');
    expect(all).toHaveLength(2);
  });
});

describe('size list queries', () => {
  function seedSet() {
    createSize(testDb.adapter, {
      type: 'clothing',
      brand: 'Nike',
      sizeValue: 'M',
    });
    createSize(testDb.adapter, {
      type: 'shoe',
      brand: 'Nike',
      sizeValue: '10',
    });
    createSize(testDb.adapter, {
      type: 'clothing',
      brand: 'Adidas',
      sizeValue: 'L',
    });
    createSize(testDb.adapter, {
      type: 'ring',
      brand: 'Mejuri',
      sizeValue: '7',
    });
  }

  it('listSizes returns all by default', () => {
    seedSet();
    expect(listSizes(testDb.adapter)).toHaveLength(4);
  });

  it('listSizes filters by type', () => {
    seedSet();
    const clothes = listSizes(testDb.adapter, { type: 'clothing' });
    expect(clothes.map((s) => s.brand).sort()).toEqual(['Adidas', 'Nike']);
  });

  it('listSizesByType filters by type', () => {
    seedSet();
    const shoes = listSizesByType(testDb.adapter, 'shoe');
    expect(shoes).toHaveLength(1);
    expect(shoes[0]!.sizeValue).toBe('10');
  });

  it('listSizesByBrand returns all types for brand', () => {
    seedSet();
    const nike = listSizesByBrand(testDb.adapter, 'Nike');
    expect(nike).toHaveLength(2);
    expect(nike.map((s) => s.type).sort()).toEqual(['clothing', 'shoe']);
  });

  it('searchSizesByBrand does partial match case-insensitive', () => {
    seedSet();
    const nik = searchSizesByBrand(testDb.adapter, 'nik');
    expect(nik.map((s) => s.brand)).toEqual(['Nike', 'Nike']);
  });

  it('searchSizesByBrand returns empty for blank query', () => {
    seedSet();
    expect(searchSizesByBrand(testDb.adapter, '   ')).toEqual([]);
  });
});
