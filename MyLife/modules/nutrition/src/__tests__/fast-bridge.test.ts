import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { DatabaseAdapter } from '@mylife/db';
import { createModuleTestDatabase } from '@mylife/db';
import { NUTRITION_MODULE } from '../definition';
import { getEatingWindow, isInEatingWindow } from '../integration/fast-bridge';

describe('fast bridge', () => {
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

  it('returns null when MyFast tables do not exist', () => {
    expect(getEatingWindow(adapter)).toBeNull();
  });

  it('returns null from isInEatingWindow when MyFast not installed', () => {
    expect(isInEatingWindow(adapter)).toBeNull();
  });

  it('returns inactive window when ft_settings exists but no active fast', () => {
    // Create ft_settings table manually
    adapter.execute(`CREATE TABLE IF NOT EXISTS ft_settings (key TEXT PRIMARY KEY, value TEXT NOT NULL)`);
    adapter.execute(`INSERT INTO ft_settings (key, value) VALUES ('defaultPlan', '16')`);

    const window = getEatingWindow(adapter);
    expect(window).not.toBeNull();
    expect(window!.isActive).toBe(false);
    expect(window!.targetHours).toBe(16);
  });

  it('returns true from isInEatingWindow when no fast active', () => {
    adapter.execute(`CREATE TABLE IF NOT EXISTS ft_settings (key TEXT PRIMARY KEY, value TEXT NOT NULL)`);
    adapter.execute(`INSERT INTO ft_settings (key, value) VALUES ('defaultPlan', '16')`);

    expect(isInEatingWindow(adapter)).toBe(true);
  });
});
