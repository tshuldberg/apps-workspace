import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { DatabaseAdapter } from '@mylife/db';
import { createModuleTestDatabase } from '@mylife/db';
import { NUTRITION_MODULE } from '../definition';

describe('nutrition schema', () => {
  let adapter: DatabaseAdapter;
  let closeDb: () => void;

  beforeEach(() => {
    const testDb = createModuleTestDatabase('nutrition', NUTRITION_MODULE.migrations!);
    adapter = testDb.adapter;
    closeDb = testDb.close;
  });

  afterEach(() => {
    closeDb();
  });

  it('has correct module metadata', () => {
    expect(NUTRITION_MODULE.id).toBe('nutrition');
    expect(NUTRITION_MODULE.tier).toBe('premium');
    expect(NUTRITION_MODULE.storageType).toBe('sqlite');
    expect(NUTRITION_MODULE.tablePrefix).toBe('nu_');
    expect(NUTRITION_MODULE.accentColor).toBe('#F97316');
    expect(NUTRITION_MODULE.schemaVersion).toBe(8);
  });

  it('has 6 navigation tabs', () => {
    expect(NUTRITION_MODULE.navigation.tabs).toHaveLength(6);
    expect(NUTRITION_MODULE.navigation.tabs[0].key).toBe('home');
  });

  it('has 17 screens', () => {
    expect(NUTRITION_MODULE.navigation.screens).toHaveLength(17);
  });

  it('creates all tables including V4', () => {
    const tables = adapter.query<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'nu_%' ORDER BY name",
    );
    const tableNames = tables.map((t) => t.name);
    expect(tableNames).toContain('nu_foods');
    expect(tableNames).toContain('nu_nutrients');
    expect(tableNames).toContain('nu_food_nutrients');
    expect(tableNames).toContain('nu_food_log');
    expect(tableNames).toContain('nu_food_log_items');
    expect(tableNames).toContain('nu_daily_goals');
    expect(tableNames).toContain('nu_settings');
    expect(tableNames).toContain('nu_barcode_cache');
    expect(tableNames).toContain('nu_photo_log');
    // V4 tables
    expect(tableNames).toContain('nu_water_log');
    expect(tableNames).toContain('nu_energy_log');
    expect(tableNames).toContain('nu_daily_notes');
    expect(tableNames).toContain('nu_restaurants');
    expect(tableNames).toContain('nu_menu_items');
  });

  it('creates FTS5 virtual table', () => {
    const tables = adapter.query<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type='table' AND name = 'nu_foods_fts'",
    );
    expect(tables).toHaveLength(1);
  });

  it('creates indexes', () => {
    const indexes = adapter.query<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type='index' AND name LIKE 'nu_%'",
    );
    expect(indexes.length).toBeGreaterThanOrEqual(10);
  });

  it('seeds default settings including V4', () => {
    const settings = adapter.query<{ key: string; value: string }>(
      'SELECT key, value FROM nu_settings',
    );
    const map = Object.fromEntries(settings.map((s) => [s.key, s.value]));
    expect(map.defaultMealType).toBe('lunch');
    expect(map.calorieGoal).toBe('2000');
    // V4 settings
    expect(map.waterGoalMl).toBe('2500');
    expect(map.waterContainersMl).toBe('[250, 500, 750]');
    expect(map.waterUnit).toBe('ml');
    expect(map.syncEnabled).toBe('false');
    expect(map.syncDirection).toBe('read');
  });

  it('seeds USDA nutrient definitions', () => {
    const count = adapter.query<{ c: number }>(
      'SELECT COUNT(*) as c FROM nu_nutrients',
    )[0].c;
    expect(count).toBeGreaterThanOrEqual(70);
  });

  it('seeds USDA food data', () => {
    const count = adapter.query<{ c: number }>(
      "SELECT COUNT(*) as c FROM nu_foods WHERE source = 'usda'",
    )[0].c;
    expect(count).toBeGreaterThanOrEqual(80);
  });

  it('has FTS triggers', () => {
    const triggers = adapter.query<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type='trigger' AND name LIKE 'nu_%'",
    );
    const names = triggers.map((t) => t.name);
    // V1-V2 food triggers
    expect(names).toContain('nu_foods_ai');
    expect(names).toContain('nu_foods_ad');
    expect(names).toContain('nu_foods_au');
    // V4 restaurant triggers
    expect(names).toContain('nu_restaurants_ai');
    expect(names).toContain('nu_restaurants_ad');
    expect(names).toContain('nu_restaurants_au');
    // V4 menu item triggers
    expect(names).toContain('nu_menu_items_ai');
    expect(names).toContain('nu_menu_items_ad');
    expect(names).toContain('nu_menu_items_au');
  });

  it('seeds restaurant data', () => {
    const count = adapter.query<{ c: number }>(
      "SELECT COUNT(*) as c FROM nu_restaurants WHERE source = 'seed'",
    )[0].c;
    expect(count).toBeGreaterThanOrEqual(20);
  });

  it('seeds menu items for restaurants', () => {
    const count = adapter.query<{ c: number }>(
      "SELECT COUNT(*) as c FROM nu_menu_items WHERE source = 'seed'",
    )[0].c;
    expect(count).toBeGreaterThanOrEqual(100);
  });
});
