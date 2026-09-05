import { describe, it, expect, beforeEach } from 'vitest';
import type { DatabaseAdapter } from '@mylife/db';
import {
  getContainerPresets,
  getContainerPreset,
  createContainerPreset,
  updateContainerPreset,
  deleteContainerPreset,
  reorderContainerPresets,
  volumeToGlasses,
} from '../db/containers';
import {
  CREATE_CONTAINER_PRESETS,
  SEED_CONTAINER_PRESETS,
} from '../db/schema';

function createMockDb(): DatabaseAdapter {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const Database = require('better-sqlite3');
  const db = new Database(':memory:');

  return {
    query: <T>(sql: string, params?: unknown[]): T[] => {
      const stmt = db.prepare(sql);
      return (params ? stmt.all(...params) : stmt.all()) as T[];
    },
    execute: (sql: string, params?: unknown[]): void => {
      const stmt = db.prepare(sql);
      if (params) stmt.run(...params);
      else stmt.run();
    },
    transaction: (fn: () => void): void => {
      const trx = db.transaction(fn);
      trx();
    },
  };
}

function seedDb(db: DatabaseAdapter): void {
  db.execute(CREATE_CONTAINER_PRESETS);
  db.execute(`CREATE INDEX IF NOT EXISTS ft_container_sort_idx ON ft_container_presets(sort_order)`);
  for (const sql of SEED_CONTAINER_PRESETS) db.execute(sql);
}

describe('Container Presets CRUD', () => {
  let db: DatabaseAdapter;

  beforeEach(() => {
    db = createMockDb();
    seedDb(db);
  });

  it('seeds 5 built-in container presets', () => {
    const presets = getContainerPresets(db);
    expect(presets).toHaveLength(5);
    expect(presets[0].id).toBe('small_glass');
    expect(presets[0].volumeOz).toBe(8);
    expect(presets[0].isBuiltin).toBe(true);
  });

  it('getContainerPreset returns specific preset', () => {
    const bottle = getContainerPreset(db, 'large_bottle');
    expect(bottle).not.toBeNull();
    expect(bottle!.name).toBe('Large Bottle');
    expect(bottle!.volumeOz).toBe(32);
  });

  it('getContainerPreset returns null for unknown ID', () => {
    expect(getContainerPreset(db, 'nonexistent')).toBeNull();
  });

  it('createContainerPreset creates a custom preset', () => {
    const stanley = createContainerPreset(db, { name: 'Stanley', volumeOz: 40, icon: '🥤' });
    expect(stanley.name).toBe('Stanley');
    expect(stanley.volumeOz).toBe(40);
    expect(stanley.isBuiltin).toBe(false);
    expect(getContainerPresets(db)).toHaveLength(6);
  });

  it('createContainerPreset rejects empty name', () => {
    expect(() => createContainerPreset(db, { name: '', volumeOz: 8 })).toThrow('Name is required');
  });

  it('createContainerPreset rejects name > 30 chars', () => {
    expect(() => createContainerPreset(db, { name: 'A'.repeat(31), volumeOz: 8 })).toThrow('30 characters');
  });

  it('createContainerPreset rejects volume <= 0', () => {
    expect(() => createContainerPreset(db, { name: 'Test', volumeOz: 0 })).toThrow('Volume must be positive');
  });

  it('createContainerPreset rejects volume > 128', () => {
    expect(() => createContainerPreset(db, { name: 'Test', volumeOz: 200 })).toThrow('Volume cannot exceed 128 oz');
  });

  it('updateContainerPreset updates fields', () => {
    const custom = createContainerPreset(db, { name: 'Mug', volumeOz: 10 });
    const updated = updateContainerPreset(db, custom.id, { name: 'Office Mug', volumeOz: 12 });
    expect(updated!.name).toBe('Office Mug');
    expect(updated!.volumeOz).toBe(12);
  });

  it('updateContainerPreset allows built-in volume change', () => {
    const updated = updateContainerPreset(db, 'small_glass', { volumeOz: 10 });
    expect(updated!.volumeOz).toBe(10);
  });

  it('deleteContainerPreset deletes custom preset', () => {
    const custom = createContainerPreset(db, { name: 'Mug', volumeOz: 10 });
    expect(deleteContainerPreset(db, custom.id)).toBe(true);
    expect(getContainerPreset(db, custom.id)).toBeNull();
  });

  it('deleteContainerPreset rejects built-in preset', () => {
    expect(() => deleteContainerPreset(db, 'small_glass')).toThrow('Cannot delete built-in container preset');
  });

  it('reorderContainerPresets updates sort order', () => {
    reorderContainerPresets(db, ['xl_bottle', 'large_bottle', 'bottle', 'can', 'small_glass']);
    const presets = getContainerPresets(db);
    expect(presets[0].id).toBe('xl_bottle');
    expect(presets[4].id).toBe('small_glass');
  });
});

describe('volumeToGlasses', () => {
  it('8oz = 1.0 glasses', () => {
    expect(volumeToGlasses(8)).toBe(1.0);
  });

  it('12oz = 1.5 glasses', () => {
    expect(volumeToGlasses(12)).toBe(1.5);
  });

  it('32oz = 4.0 glasses', () => {
    expect(volumeToGlasses(32)).toBe(4.0);
  });

  it('40oz = 5.0 glasses', () => {
    expect(volumeToGlasses(40)).toBe(5.0);
  });

  it('2oz rounds to minimum 0.5', () => {
    expect(volumeToGlasses(2)).toBe(0.5);
  });

  it('6oz rounds to 1.0', () => {
    expect(volumeToGlasses(6)).toBe(1.0);
  });
});
