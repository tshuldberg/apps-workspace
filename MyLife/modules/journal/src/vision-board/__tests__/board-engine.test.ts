import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createModuleTestDatabase, type InMemoryTestDatabase } from '@mylife/db';
import { JOURNAL_MODULE } from '../../definition';
import {
  getExportDimensions,
  normalizedToPixels,
  validateItemSize,
  clampRotation,
  isBoardLimitReached,
  isItemLimitReached,
} from '../board-engine';

let testDb: InMemoryTestDatabase;

beforeEach(() => {
  testDb = createModuleTestDatabase('journal', JOURNAL_MODULE.migrations!);
});

afterEach(() => {
  testDb.close();
});

describe('getExportDimensions', () => {
  it('returns 1200x1600 for portrait', () => {
    expect(getExportDimensions('portrait')).toEqual({ width: 1200, height: 1600 });
  });

  it('returns 1600x1200 for landscape', () => {
    expect(getExportDimensions('landscape')).toEqual({ width: 1600, height: 1200 });
  });
});

describe('normalizedToPixels', () => {
  it('converts center position on portrait canvas', () => {
    const result = normalizedToPixels(0.5, 0.5, 1200, 1600);
    expect(result).toEqual({ x: 600, y: 800 });
  });

  it('converts quarter position on landscape canvas', () => {
    const result = normalizedToPixels(0.25, 0.75, 1600, 1200);
    expect(result).toEqual({ x: 400, y: 900 });
  });

  it('converts origin (0, 0)', () => {
    const result = normalizedToPixels(0, 0, 1200, 1600);
    expect(result).toEqual({ x: 0, y: 0 });
  });
});

describe('validateItemSize', () => {
  it('accepts valid sizes', () => {
    expect(validateItemSize(0.3, 0.3)).toBeNull();
    expect(validateItemSize(0.05, 0.05)).toBeNull();
    expect(validateItemSize(1, 1)).toBeNull();
  });

  it('rejects width below minimum', () => {
    expect(validateItemSize(0.03, 0.3)).toBe('Item width must be at least 5% of canvas');
  });

  it('rejects height below minimum', () => {
    expect(validateItemSize(0.3, 0.03)).toBe('Item height must be at least 5% of canvas');
  });

  it('rejects width above maximum', () => {
    expect(validateItemSize(1.1, 0.3)).toBe('Item width cannot exceed canvas width');
  });
});

describe('clampRotation', () => {
  it('returns value within range unchanged', () => {
    expect(clampRotation(45)).toBe(45);
    expect(clampRotation(-90)).toBe(-90);
    expect(clampRotation(0)).toBe(0);
  });

  it('clamps above 180 to 180', () => {
    expect(clampRotation(200)).toBe(180);
  });

  it('clamps below -180 to -180', () => {
    expect(clampRotation(-200)).toBe(-180);
  });
});

describe('isBoardLimitReached', () => {
  it('returns false when under limit', () => {
    expect(isBoardLimitReached(5)).toBe(false);
    expect(isBoardLimitReached(9)).toBe(false);
  });

  it('returns true at limit', () => {
    expect(isBoardLimitReached(10)).toBe(true);
  });

  it('returns true above limit', () => {
    expect(isBoardLimitReached(11)).toBe(true);
  });
});

describe('isItemLimitReached', () => {
  it('returns false when under limit', () => {
    expect(isItemLimitReached(25)).toBe(false);
  });

  it('returns true at 50', () => {
    expect(isItemLimitReached(50)).toBe(true);
  });
});

describe('V4 migration creates vision board tables', () => {
  it('jn_vision_boards table exists', () => {
    const tables = testDb.adapter.query<{ name: string }>(
      `SELECT name FROM sqlite_master WHERE type='table' AND name='jn_vision_boards'`,
    );
    expect(tables).toHaveLength(1);
  });

  it('jn_vision_board_items table exists', () => {
    const tables = testDb.adapter.query<{ name: string }>(
      `SELECT name FROM sqlite_master WHERE type='table' AND name='jn_vision_board_items'`,
    );
    expect(tables).toHaveLength(1);
  });
});
