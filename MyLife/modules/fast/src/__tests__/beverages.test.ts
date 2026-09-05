import { describe, it, expect, beforeEach } from 'vitest';
import type { DatabaseAdapter } from '@mylife/db';
import {
  getBeverageTypes,
  getBeverageType,
  createBeverageType,
  updateBeverageType,
  deleteBeverageType,
  logBeverage,
  getBeverageLogs,
  deleteBeverageLog,
  getDailyHydration,
  getMostRecentBeverageTypes,
  getCaffeineLogsForDate,
} from '../db/beverages';
import {
  MIGRATION_V4_TABLES,
  MIGRATION_V4_INDEXES,
  SEED_BEVERAGE_TYPES,
  SEED_CAFFEINE_SETTINGS,
  CREATE_SETTINGS,
} from '../db/schema';

// ── In-memory SQLite mock ──

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
  db.execute(CREATE_SETTINGS);
  for (const sql of MIGRATION_V4_TABLES) db.execute(sql);
  for (const sql of MIGRATION_V4_INDEXES) db.execute(sql);
  for (const sql of SEED_BEVERAGE_TYPES) db.execute(sql);
  for (const sql of SEED_CAFFEINE_SETTINGS) db.execute(sql);
}

describe('Beverage Types CRUD', () => {
  let db: DatabaseAdapter;

  beforeEach(() => {
    db = createMockDb();
    seedDb(db);
  });

  it('seeds 12 built-in beverage types', () => {
    const types = getBeverageTypes(db);
    expect(types).toHaveLength(12);
    expect(types[0].id).toBe('water');
    expect(types[0].isBuiltin).toBe(true);
  });

  it('getBeverageType returns a specific type', () => {
    const coffee = getBeverageType(db, 'coffee');
    expect(coffee).not.toBeNull();
    expect(coffee!.name).toBe('Coffee');
    expect(coffee!.coefficient).toBe(0.8);
    expect(coffee!.caffeineMg).toBe(95);
  });

  it('getBeverageType returns null for unknown ID', () => {
    expect(getBeverageType(db, 'nonexistent')).toBeNull();
  });

  it('sports_drink has hydration coefficient 1.05', () => {
    const sport = getBeverageType(db, 'sports_drink');
    expect(sport).not.toBeNull();
    expect(sport!.name).toBe('Sports Drink');
    expect(sport!.coefficient).toBe(1.05);
    expect(sport!.defaultOz).toBe(12);
  });

  it('other has hydration coefficient 1.0', () => {
    const other = getBeverageType(db, 'other');
    expect(other).not.toBeNull();
    expect(other!.name).toBe('Other');
    expect(other!.coefficient).toBe(1.0);
  });

  it('juice has hydration coefficient 0.95', () => {
    const juice = getBeverageType(db, 'juice');
    expect(juice).not.toBeNull();
    expect(juice!.coefficient).toBe(0.95);
  });

  it('createBeverageType creates a custom type', () => {
    const kombucha = createBeverageType(db, {
      name: 'Kombucha',
      icon: '🫗',
      defaultOz: 16,
      coefficient: 0.95,
      caffeineMg: 15,
    });
    expect(kombucha.name).toBe('Kombucha');
    expect(kombucha.isBuiltin).toBe(false);
    expect(kombucha.defaultOz).toBe(16);
    expect(kombucha.caffeineMg).toBe(15);
    expect(getBeverageTypes(db)).toHaveLength(13);
  });

  it('createBeverageType rejects empty name', () => {
    expect(() =>
      createBeverageType(db, { name: '', icon: '🫗', defaultOz: 8, coefficient: 1.0 }),
    ).toThrow('Name is required');
  });

  it('createBeverageType rejects volume <= 0', () => {
    expect(() =>
      createBeverageType(db, { name: 'Test', icon: '🫗', defaultOz: 0, coefficient: 1.0 }),
    ).toThrow('Volume must be positive');
  });

  it('createBeverageType rejects volume > 128', () => {
    expect(() =>
      createBeverageType(db, { name: 'Test', icon: '🫗', defaultOz: 200, coefficient: 1.0 }),
    ).toThrow('Volume cannot exceed 128 oz');
  });

  it('createBeverageType rejects coefficient outside [-1.0, 2.0]', () => {
    expect(() =>
      createBeverageType(db, { name: 'Test', icon: '🫗', defaultOz: 8, coefficient: 3.0 }),
    ).toThrow('Coefficient must be between -1.0 and 2.0');
  });

  it('updateBeverageType updates a custom type', () => {
    const custom = createBeverageType(db, { name: 'Soda', icon: '🥤', defaultOz: 12, coefficient: 0.8 });
    const updated = updateBeverageType(db, custom.id, { name: 'Diet Soda', defaultOz: 16 });
    expect(updated!.name).toBe('Diet Soda');
    expect(updated!.defaultOz).toBe(16);
  });

  it('deleteBeverageType deletes a custom type', () => {
    const custom = createBeverageType(db, { name: 'Soda', icon: '🥤', defaultOz: 12, coefficient: 0.8 });
    expect(deleteBeverageType(db, custom.id)).toBe(true);
    expect(getBeverageType(db, custom.id)).toBeNull();
  });

  it('deleteBeverageType rejects built-in types', () => {
    expect(() => deleteBeverageType(db, 'water')).toThrow('Cannot delete built-in beverage type');
  });
});

describe('Beverage Log CRUD', () => {
  let db: DatabaseAdapter;

  beforeEach(() => {
    db = createMockDb();
    seedDb(db);
  });

  it('logBeverage creates entry with correct hydration', () => {
    const log = logBeverage(db, { beverageTypeId: 'coffee', volumeOz: 8 });
    expect(log.beverageTypeId).toBe('coffee');
    expect(log.volumeOz).toBe(8);
    expect(log.hydrationOz).toBeCloseTo(6.4, 1); // 8 * 0.8
  });

  it('logBeverage with water has 1:1 hydration', () => {
    const log = logBeverage(db, { beverageTypeId: 'water', volumeOz: 8 });
    expect(log.hydrationOz).toBe(8.0);
  });

  it('logBeverage with alcohol has negative hydration', () => {
    const log = logBeverage(db, { beverageTypeId: 'alcohol', volumeOz: 12 });
    expect(log.hydrationOz).toBeCloseTo(-6.0, 1); // 12 * -0.5
  });

  it('logBeverage with sports drink has >1.0 hydration', () => {
    const log = logBeverage(db, { beverageTypeId: 'sports_drink', volumeOz: 12 });
    expect(log.hydrationOz).toBeCloseTo(12.6, 1); // 12 * 1.05
  });

  it('logBeverage with juice applies 0.95 coefficient', () => {
    const log = logBeverage(db, { beverageTypeId: 'juice', volumeOz: 8 });
    expect(log.hydrationOz).toBeCloseTo(7.6, 1); // 8 * 0.95
  });

  it('logBeverage rejects unknown type', () => {
    expect(() => logBeverage(db, { beverageTypeId: 'unknown', volumeOz: 8 })).toThrow('Unknown beverage type');
  });

  it('logBeverage rejects volume <= 0', () => {
    expect(() => logBeverage(db, { beverageTypeId: 'water', volumeOz: 0 })).toThrow('Volume must be positive');
  });

  it('getBeverageLogs returns logs for a date', () => {
    const today = new Date();
    logBeverage(db, { beverageTypeId: 'water', volumeOz: 8, date: today });
    logBeverage(db, { beverageTypeId: 'coffee', volumeOz: 8, date: today });
    const logs = getBeverageLogs(db, today);
    expect(logs).toHaveLength(2);
  });

  it('deleteBeverageLog removes an entry', () => {
    const log = logBeverage(db, { beverageTypeId: 'water', volumeOz: 8 });
    expect(deleteBeverageLog(db, log.id)).toBe(true);
    expect(getBeverageLogs(db)).toHaveLength(0);
  });

  it('getDailyHydration sums correctly', () => {
    const today = new Date();
    // 3 waters (24oz) + 1 coffee (6.4oz) = 30.4oz
    logBeverage(db, { beverageTypeId: 'water', volumeOz: 8, date: today });
    logBeverage(db, { beverageTypeId: 'water', volumeOz: 8, date: today });
    logBeverage(db, { beverageTypeId: 'water', volumeOz: 8, date: today });
    logBeverage(db, { beverageTypeId: 'coffee', volumeOz: 8, date: today });
    const summary = getDailyHydration(db, 8, today);
    expect(summary.totalHydrationOz).toBeCloseTo(30.4, 1);
    expect(summary.totalGlasses).toBeCloseTo(3.8, 1);
    expect(summary.logCount).toBe(4);
  });

  it('getDailyHydration clamps to 0 when only alcohol', () => {
    const today = new Date();
    logBeverage(db, { beverageTypeId: 'alcohol', volumeOz: 12, date: today });
    const summary = getDailyHydration(db, 8, today);
    expect(summary.totalHydrationOz).toBe(0);
  });

  it('getMostRecentBeverageTypes returns recently used types', () => {
    const today = new Date();
    logBeverage(db, { beverageTypeId: 'water', volumeOz: 8, date: today });
    logBeverage(db, { beverageTypeId: 'coffee', volumeOz: 8, date: today });
    const recent = getMostRecentBeverageTypes(db, 4);
    expect(recent).toHaveLength(2);
    // Most recent first
    expect(recent[0].id).toBe('coffee');
  });

  it('deleteBeverageType does not cascade-delete logs', () => {
    const custom = createBeverageType(db, { name: 'Soda', icon: '🥤', defaultOz: 12, coefficient: 0.8 });
    logBeverage(db, { beverageTypeId: custom.id, volumeOz: 12 });
    // SQLite FK enforcement is off by default in better-sqlite3 unless enabled
    // The log entry should remain (orphaned but counted)
    deleteBeverageType(db, custom.id);
    expect(getBeverageLogs(db)).toHaveLength(1);
  });
});

describe('Caffeine Queries', () => {
  let db: DatabaseAdapter;

  beforeEach(() => {
    db = createMockDb();
    seedDb(db);
  });

  it('getCaffeineLogsForDate returns caffeinated drinks only', () => {
    const today = new Date();
    logBeverage(db, { beverageTypeId: 'coffee', volumeOz: 8, date: today });
    logBeverage(db, { beverageTypeId: 'water', volumeOz: 8, date: today });
    logBeverage(db, { beverageTypeId: 'green_tea', volumeOz: 8, date: today });
    const caffLogs = getCaffeineLogsForDate(db, today);
    expect(caffLogs).toHaveLength(2); // coffee + green_tea
  });

  it('getCaffeineLogsForDate scales caffeine by volume', () => {
    const today = new Date();
    logBeverage(db, { beverageTypeId: 'coffee', volumeOz: 16, date: today }); // double volume
    const caffLogs = getCaffeineLogsForDate(db, today);
    expect(caffLogs[0].caffeineMg).toBeCloseTo(190, 0); // 95 * (16/8)
  });

  it('getCaffeineLogsForDate excludes herbal tea (0mg)', () => {
    const today = new Date();
    logBeverage(db, { beverageTypeId: 'herbal_tea', volumeOz: 8, date: today });
    const caffLogs = getCaffeineLogsForDate(db, today);
    expect(caffLogs).toHaveLength(0);
  });
});
