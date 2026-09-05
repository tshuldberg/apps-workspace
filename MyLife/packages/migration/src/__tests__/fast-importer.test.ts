import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createInMemoryTestDatabase, type InMemoryTestDatabase } from '@mylife/db';
import { importFromMyFast } from '../importers/fast';

// Standalone MyFast DDL (unprefixed tables)
const STANDALONE_DDL = [
  `CREATE TABLE fasts (
    id TEXT PRIMARY KEY,
    protocol TEXT NOT NULL,
    target_hours REAL NOT NULL,
    started_at TEXT NOT NULL,
    ended_at TEXT,
    duration_seconds INTEGER,
    hit_target INTEGER,
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
  `CREATE TABLE weight_entries (
    id TEXT PRIMARY KEY,
    weight_value REAL NOT NULL,
    unit TEXT NOT NULL DEFAULT 'lbs',
    date TEXT NOT NULL,
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
  `CREATE TABLE protocols (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    fasting_hours REAL NOT NULL,
    eating_hours REAL NOT NULL,
    description TEXT,
    is_custom INTEGER NOT NULL DEFAULT 0,
    is_default INTEGER NOT NULL DEFAULT 0,
    sort_order INTEGER NOT NULL DEFAULT 0
  )`,
  `CREATE TABLE streak_cache (
    key TEXT PRIMARY KEY,
    value INTEGER NOT NULL,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
  `CREATE TABLE active_fast (
    id TEXT PRIMARY KEY DEFAULT 'current',
    fast_id TEXT NOT NULL REFERENCES fasts(id) ON DELETE CASCADE,
    protocol TEXT NOT NULL,
    target_hours REAL NOT NULL,
    started_at TEXT NOT NULL
  )`,
  `CREATE TABLE settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  )`,
  `CREATE TABLE water_intake (
    date TEXT PRIMARY KEY,
    count INTEGER NOT NULL DEFAULT 0,
    target INTEGER NOT NULL DEFAULT 8,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
  `CREATE TABLE goals (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL,
    target_value REAL NOT NULL,
    period TEXT NOT NULL,
    direction TEXT NOT NULL DEFAULT 'at_least',
    label TEXT,
    unit TEXT,
    start_date TEXT NOT NULL,
    end_date TEXT,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
  `CREATE TABLE goal_progress (
    id TEXT PRIMARY KEY,
    goal_id TEXT NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
    period_start TEXT NOT NULL,
    period_end TEXT NOT NULL,
    current_value REAL NOT NULL,
    target_value REAL NOT NULL,
    completed INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
  `CREATE TABLE notifications_config (
    key TEXT PRIMARY KEY,
    enabled INTEGER NOT NULL DEFAULT 1
  )`,
];

// Hub DDL for fast tables (ft_ prefix)
const HUB_DDL = [
  `CREATE TABLE IF NOT EXISTS ft_fasts (
    id TEXT PRIMARY KEY,
    protocol TEXT NOT NULL,
    target_hours REAL NOT NULL,
    started_at TEXT NOT NULL,
    ended_at TEXT,
    duration_seconds INTEGER,
    hit_target INTEGER,
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
  `CREATE TABLE IF NOT EXISTS ft_weight_entries (
    id TEXT PRIMARY KEY,
    weight_value REAL NOT NULL,
    unit TEXT NOT NULL DEFAULT 'lbs',
    date TEXT NOT NULL,
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
  `CREATE TABLE IF NOT EXISTS ft_protocols (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    fasting_hours REAL NOT NULL,
    eating_hours REAL NOT NULL,
    description TEXT,
    is_custom INTEGER NOT NULL DEFAULT 0,
    is_default INTEGER NOT NULL DEFAULT 0,
    sort_order INTEGER NOT NULL DEFAULT 0
  )`,
  `CREATE TABLE IF NOT EXISTS ft_streak_cache (
    key TEXT PRIMARY KEY,
    value INTEGER NOT NULL,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
  `CREATE TABLE IF NOT EXISTS ft_active_fast (
    id TEXT PRIMARY KEY DEFAULT 'current',
    fast_id TEXT NOT NULL,
    protocol TEXT NOT NULL,
    target_hours REAL NOT NULL,
    started_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS ft_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS ft_water_intake (
    date TEXT PRIMARY KEY,
    count INTEGER NOT NULL DEFAULT 0,
    target INTEGER NOT NULL DEFAULT 8,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
  `CREATE TABLE IF NOT EXISTS ft_goals (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL,
    target_value REAL NOT NULL,
    period TEXT NOT NULL,
    direction TEXT NOT NULL DEFAULT 'at_least',
    label TEXT,
    unit TEXT,
    start_date TEXT NOT NULL,
    end_date TEXT,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
  `CREATE TABLE IF NOT EXISTS ft_goal_progress (
    id TEXT PRIMARY KEY,
    goal_id TEXT NOT NULL,
    period_start TEXT NOT NULL,
    period_end TEXT NOT NULL,
    current_value REAL NOT NULL,
    target_value REAL NOT NULL,
    completed INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
  `CREATE TABLE IF NOT EXISTS ft_notifications_config (
    key TEXT PRIMARY KEY,
    enabled INTEGER NOT NULL DEFAULT 1
  )`,
];

describe('importFromMyFast', () => {
  let sourceDb: InMemoryTestDatabase;
  let hubDb: InMemoryTestDatabase;

  beforeEach(() => {
    sourceDb = createInMemoryTestDatabase();
    hubDb = createInMemoryTestDatabase();
    for (const ddl of STANDALONE_DDL) {
      sourceDb.adapter.execute(ddl);
    }
    for (const ddl of HUB_DDL) {
      hubDb.adapter.execute(ddl);
    }
  });

  afterEach(() => {
    sourceDb.close();
    hubDb.close();
  });

  it('imports fasts with all fields', () => {
    sourceDb.adapter.execute(
      `INSERT INTO fasts (id, protocol, target_hours, started_at, ended_at, duration_seconds, hit_target, notes)
       VALUES ('f1', '16:8', 16.0, '2025-01-15T20:00:00Z', '2025-01-16T12:30:00Z', 59400, 1, 'Felt great')`,
    );
    sourceDb.adapter.execute(
      `INSERT INTO fasts (id, protocol, target_hours, started_at, ended_at, duration_seconds, hit_target)
       VALUES ('f2', '18:6', 18.0, '2025-01-17T19:00:00Z', '2025-01-18T14:00:00Z', 68400, 1)`,
    );

    const result = importFromMyFast(sourceDb.adapter, hubDb.adapter);

    expect(result.fastsImported).toBe(2);
    expect(result.errors).toHaveLength(0);

    const hubFasts = hubDb.adapter.query<Record<string, unknown>>(
      'SELECT * FROM ft_fasts ORDER BY started_at',
    );
    expect(hubFasts).toHaveLength(2);
    expect(hubFasts[0]!.protocol).toBe('16:8');
    expect(hubFasts[0]!.target_hours).toBe(16.0);
    expect(hubFasts[0]!.notes).toBe('Felt great');
  });

  it('imports protocols', () => {
    sourceDb.adapter.execute(
      `INSERT INTO protocols (id, name, fasting_hours, eating_hours, description, is_custom, is_default, sort_order)
       VALUES ('16:8', 'Lean Gains', 16, 8, 'Most popular', 0, 1, 1)`,
    );
    sourceDb.adapter.execute(
      `INSERT INTO protocols (id, name, fasting_hours, eating_hours, is_custom, sort_order)
       VALUES ('custom-20', 'My Custom', 20, 4, 1, 10)`,
    );

    const result = importFromMyFast(sourceDb.adapter, hubDb.adapter);

    expect(result.protocolsImported).toBe(2);
    const protocols = hubDb.adapter.query<Record<string, unknown>>(
      'SELECT * FROM ft_protocols ORDER BY sort_order',
    );
    expect(protocols).toHaveLength(2);
    expect(protocols[1]!.is_custom).toBe(1);
  });

  it('imports weight entries', () => {
    sourceDb.adapter.execute(
      `INSERT INTO weight_entries (id, weight_value, unit, date, notes)
       VALUES ('w1', 185.5, 'lbs', '2025-01-15', 'Morning')`,
    );

    const result = importFromMyFast(sourceDb.adapter, hubDb.adapter);

    expect(result.weightEntriesImported).toBe(1);
    const weights = hubDb.adapter.query<Record<string, unknown>>('SELECT * FROM ft_weight_entries');
    expect(weights).toHaveLength(1);
    expect(weights[0]!.weight_value).toBe(185.5);
  });

  it('imports settings', () => {
    sourceDb.adapter.execute(
      `INSERT INTO settings (key, value) VALUES ('defaultProtocol', '18:6')`,
    );
    sourceDb.adapter.execute(
      `INSERT INTO settings (key, value) VALUES ('weightUnit', 'kg')`,
    );

    const result = importFromMyFast(sourceDb.adapter, hubDb.adapter);

    expect(result.settingsImported).toBe(2);
    const settings = hubDb.adapter.query<Record<string, unknown>>(
      "SELECT * FROM ft_settings WHERE key = 'weightUnit'",
    );
    expect(settings[0]!.value).toBe('kg');
  });

  it('imports water intake records', () => {
    sourceDb.adapter.execute(
      `INSERT INTO water_intake (date, count, target) VALUES ('2025-01-15', 6, 8)`,
    );

    const result = importFromMyFast(sourceDb.adapter, hubDb.adapter);

    expect(result.waterIntakeImported).toBe(1);
    const water = hubDb.adapter.query<Record<string, unknown>>('SELECT * FROM ft_water_intake');
    expect(water).toHaveLength(1);
    expect(water[0]!.count).toBe(6);
  });

  it('imports goals and goal progress', () => {
    sourceDb.adapter.execute(
      `INSERT INTO goals (id, type, target_value, period, direction, label, start_date, is_active)
       VALUES ('g1', 'weekly_fasts', 5, 'weekly', 'at_least', '5 fasts/week', '2025-01-01', 1)`,
    );
    sourceDb.adapter.execute(
      `INSERT INTO goal_progress (id, goal_id, period_start, period_end, current_value, target_value, completed)
       VALUES ('gp1', 'g1', '2025-01-06', '2025-01-12', 4, 5, 0)`,
    );

    const result = importFromMyFast(sourceDb.adapter, hubDb.adapter);

    expect(result.goalsImported).toBe(1);
    expect(result.goalProgressImported).toBe(1);

    const goals = hubDb.adapter.query<Record<string, unknown>>('SELECT * FROM ft_goals');
    expect(goals).toHaveLength(1);
    expect(goals[0]!.type).toBe('weekly_fasts');

    const progress = hubDb.adapter.query<Record<string, unknown>>('SELECT * FROM ft_goal_progress');
    expect(progress).toHaveLength(1);
    expect(progress[0]!.current_value).toBe(4);
  });

  it('imports notifications config', () => {
    sourceDb.adapter.execute(
      `INSERT INTO notifications_config (key, enabled) VALUES ('fastComplete', 1)`,
    );
    sourceDb.adapter.execute(
      `INSERT INTO notifications_config (key, enabled) VALUES ('progress25', 0)`,
    );

    const result = importFromMyFast(sourceDb.adapter, hubDb.adapter);

    expect(result.notificationsConfigImported).toBe(2);
    const config = hubDb.adapter.query<Record<string, unknown>>(
      'SELECT * FROM ft_notifications_config ORDER BY key',
    );
    expect(config).toHaveLength(2);
  });

  it('imports active fast singleton', () => {
    sourceDb.adapter.execute(
      `INSERT INTO fasts (id, protocol, target_hours, started_at)
       VALUES ('f1', '16:8', 16.0, '2025-01-15T20:00:00Z')`,
    );
    sourceDb.adapter.execute(
      `INSERT INTO active_fast (id, fast_id, protocol, target_hours, started_at)
       VALUES ('current', 'f1', '16:8', 16.0, '2025-01-15T20:00:00Z')`,
    );

    const result = importFromMyFast(sourceDb.adapter, hubDb.adapter);

    expect(result.fastsImported).toBe(1);
    const active = hubDb.adapter.query<Record<string, unknown>>('SELECT * FROM ft_active_fast');
    expect(active).toHaveLength(1);
    expect(active[0]!.fast_id).toBe('f1');
  });

  it('rebuilds streak cache after import', () => {
    // Insert fasts with consecutive days hitting target
    sourceDb.adapter.execute(
      `INSERT INTO fasts (id, protocol, target_hours, started_at, ended_at, duration_seconds, hit_target)
       VALUES ('f1', '16:8', 16, '2025-01-13T20:00:00', '2025-01-14T12:00:00', 57600, 1)`,
    );
    sourceDb.adapter.execute(
      `INSERT INTO fasts (id, protocol, target_hours, started_at, ended_at, duration_seconds, hit_target)
       VALUES ('f2', '16:8', 16, '2025-01-14T20:00:00', '2025-01-15T12:00:00', 57600, 1)`,
    );

    const result = importFromMyFast(sourceDb.adapter, hubDb.adapter);

    expect(result.fastsImported).toBe(2);

    const streakCache = hubDb.adapter.query<Record<string, unknown>>(
      "SELECT * FROM ft_streak_cache WHERE key = 'totalCompleted'",
    );
    expect(streakCache).toHaveLength(1);
    expect(streakCache[0]!.value).toBe(2);
  });

  it('handles empty source database gracefully', () => {
    const result = importFromMyFast(sourceDb.adapter, hubDb.adapter);

    expect(result.fastsImported).toBe(0);
    expect(result.protocolsImported).toBe(0);
    expect(result.weightEntriesImported).toBe(0);
    expect(result.errors).toHaveLength(0);
  });
});
