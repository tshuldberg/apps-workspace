import type { Migration } from '@mylife/module-registry';

export const CREATE_SLEEP_ENTRIES = `
CREATE TABLE IF NOT EXISTS sl_sleep_entries (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL,
  bedtime TEXT,
  sleep_onset_time TEXT,
  wake_time TEXT,
  duration_minutes INTEGER,
  quality_rating INTEGER CHECK (quality_rating BETWEEN 1 AND 5),
  wake_count INTEGER NOT NULL DEFAULT 0,
  sleep_latency_minutes INTEGER,
  alarm_time TEXT,
  snooze_count INTEGER NOT NULL DEFAULT 0,
  wake_feeling TEXT CHECK (wake_feeling IN ('refreshed', 'groggy', 'exhausted', 'energized')),
  notes_md TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

export const CREATE_NAPS = `
CREATE TABLE IF NOT EXISTS sl_naps (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL,
  start_time TEXT NOT NULL,
  duration_minutes INTEGER NOT NULL,
  intentional INTEGER NOT NULL DEFAULT 1,
  quality INTEGER CHECK (quality BETWEEN 1 AND 5),
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

export const CREATE_DREAMS = `
CREATE TABLE IF NOT EXISTS sl_dreams (
  id TEXT PRIMARY KEY,
  sleep_entry_id TEXT REFERENCES sl_sleep_entries(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  content_md TEXT,
  type TEXT NOT NULL DEFAULT 'normal' CHECK (type IN ('normal', 'vivid', 'nightmare', 'lucid', 'recurring')),
  themes TEXT NOT NULL DEFAULT '[]',
  people TEXT NOT NULL DEFAULT '[]',
  emotions TEXT NOT NULL DEFAULT '[]',
  is_lucid INTEGER NOT NULL DEFAULT 0,
  is_recurring INTEGER NOT NULL DEFAULT 0,
  recurring_group_id TEXT,
  sketch_photo_id TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

export const CREATE_FACTORS = `
CREATE TABLE IF NOT EXISTS sl_factors (
  id TEXT PRIMARY KEY,
  sleep_entry_id TEXT REFERENCES sl_sleep_entries(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  last_caffeine_time TEXT,
  last_meal_time TEXT,
  alcohol_drinks INTEGER NOT NULL DEFAULT 0,
  exercise_today INTEGER NOT NULL DEFAULT 0,
  exercise_time TEXT,
  screen_cutoff_time TEXT,
  room_temp TEXT,
  room_light TEXT,
  room_noise TEXT,
  supplements TEXT NOT NULL DEFAULT '[]',
  stress_level INTEGER CHECK (stress_level BETWEEN 1 AND 5),
  pre_sleep_activities TEXT NOT NULL DEFAULT '[]',
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

export const CREATE_GOALS = `
CREATE TABLE IF NOT EXISTS sl_goals (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN ('duration', 'bedtime', 'wake_time', 'consistency')),
  target_value TEXT NOT NULL,
  start_date TEXT,
  end_date TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

export const CREATE_STREAKS = `
CREATE TABLE IF NOT EXISTS sl_streaks (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN ('quality_above_3', 'on_time_bed', 'target_hours', 'no_snooze')),
  current_count INTEGER NOT NULL DEFAULT 0,
  longest_count INTEGER NOT NULL DEFAULT 0,
  last_date TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

export const CREATE_STREAK_HISTORY = `
CREATE TABLE IF NOT EXISTS sl_streak_history (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN ('quality_above_3', 'on_time_bed', 'target_hours', 'no_snooze')),
  date TEXT NOT NULL,
  met INTEGER NOT NULL DEFAULT 0,
  current_count INTEGER NOT NULL DEFAULT 0,
  longest_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(type, date)
)`;

export const CREATE_HYGIENE_CHECKS = `
CREATE TABLE IF NOT EXISTS sl_hygiene_checks (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL,
  practice_id TEXT NOT NULL CHECK (practice_id IN (
    'no_caffeine_after_2pm',
    'no_screens_1h',
    'consistent_bedtime_30m',
    'cool_dark_room',
    'no_alcohol_3h',
    'exercise_timing',
    'relaxation_routine',
    'no_heavy_meals_2h'
  )),
  met INTEGER NOT NULL DEFAULT 0,
  source TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'auto')),
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(date, practice_id)
)`;

export const CREATE_SETTINGS = `
CREATE TABLE IF NOT EXISTS sl_settings (
  key TEXT PRIMARY KEY,
  value TEXT
)`;

export const ALL_TABLES = [
  CREATE_SLEEP_ENTRIES,
  CREATE_NAPS,
  CREATE_DREAMS,
  CREATE_FACTORS,
  CREATE_GOALS,
  CREATE_STREAKS,
  CREATE_SETTINGS,
];

export const CREATE_INDEXES = [
  `CREATE INDEX IF NOT EXISTS sl_sleep_entries_date_idx ON sl_sleep_entries(date)`,
  `CREATE INDEX IF NOT EXISTS sl_dreams_entry_idx ON sl_dreams(sleep_entry_id)`,
  `CREATE INDEX IF NOT EXISTS sl_dreams_date_idx ON sl_dreams(date)`,
  `CREATE INDEX IF NOT EXISTS sl_factors_entry_idx ON sl_factors(sleep_entry_id)`,
  `CREATE INDEX IF NOT EXISTS sl_goals_active_idx ON sl_goals(is_active)`,
];

// -- v2: dream search + recurring groups (P2-A) --
// Mirrors src/db/migrations/002_dream_fts.sql for human review.

export const CREATE_DREAM_V2_INDEXES = [
  `CREATE INDEX IF NOT EXISTS sl_dreams_type_idx ON sl_dreams(type)`,
  `CREATE INDEX IF NOT EXISTS sl_dreams_recurring_group_idx ON sl_dreams(recurring_group_id)`,
];

export const CREATE_DREAMS_FTS = `
CREATE VIRTUAL TABLE IF NOT EXISTS sl_dreams_fts USING fts5(
  content_md,
  themes,
  people,
  content='sl_dreams',
  content_rowid='rowid'
)`;

export const CREATE_DREAMS_FTS_INSERT_TRIGGER = `
CREATE TRIGGER IF NOT EXISTS sl_dreams_fts_insert AFTER INSERT ON sl_dreams BEGIN
  INSERT INTO sl_dreams_fts(rowid, content_md, themes, people)
  VALUES (NEW.rowid, NEW.content_md, NEW.themes, NEW.people);
END`;

export const CREATE_DREAMS_FTS_DELETE_TRIGGER = `
CREATE TRIGGER IF NOT EXISTS sl_dreams_fts_delete AFTER DELETE ON sl_dreams BEGIN
  INSERT INTO sl_dreams_fts(sl_dreams_fts, rowid, content_md, themes, people)
  VALUES ('delete', OLD.rowid, OLD.content_md, OLD.themes, OLD.people);
END`;

export const CREATE_DREAMS_FTS_UPDATE_TRIGGER = `
CREATE TRIGGER IF NOT EXISTS sl_dreams_fts_update AFTER UPDATE ON sl_dreams BEGIN
  INSERT INTO sl_dreams_fts(sl_dreams_fts, rowid, content_md, themes, people)
  VALUES ('delete', OLD.rowid, OLD.content_md, OLD.themes, OLD.people);
  INSERT INTO sl_dreams_fts(rowid, content_md, themes, people)
  VALUES (NEW.rowid, NEW.content_md, NEW.themes, NEW.people);
END`;

export const DREAM_FTS_MIGRATION_UP = [
  ...CREATE_DREAM_V2_INDEXES,
  CREATE_DREAMS_FTS,
  CREATE_DREAMS_FTS_INSERT_TRIGGER,
  CREATE_DREAMS_FTS_DELETE_TRIGGER,
  CREATE_DREAMS_FTS_UPDATE_TRIGGER,
  `INSERT INTO sl_dreams_fts(sl_dreams_fts) VALUES('rebuild')`,
];

export const CREATE_STREAK_HISTORY_INDEXES = [
  `CREATE INDEX IF NOT EXISTS sl_streak_history_type_date_idx ON sl_streak_history(type, date)`,
];

export const STREAK_HISTORY_MIGRATION_UP = [
  CREATE_STREAK_HISTORY,
  ...CREATE_STREAK_HISTORY_INDEXES,
];

export const CREATE_HYGIENE_INDEXES = [
  `CREATE INDEX IF NOT EXISTS sl_hygiene_checks_date_idx ON sl_hygiene_checks(date)`,
];

export const HYGIENE_MIGRATION_UP = [
  CREATE_HYGIENE_CHECKS,
  ...CREATE_HYGIENE_INDEXES,
];

export const SEED_SETTINGS = [
  `INSERT OR IGNORE INTO sl_settings (key, value) VALUES ('sleep.targetHours', '8')`,
  `INSERT OR IGNORE INTO sl_settings (key, value) VALUES ('sleep.hygiene.enabledPractices', '["no_caffeine_after_2pm","no_screens_1h","consistent_bedtime_30m","cool_dark_room","no_alcohol_3h","exercise_timing","relaxation_routine","no_heavy_meals_2h"]')`,
  `INSERT OR IGNORE INTO sl_settings (key, value) VALUES ('bridge.mood.enabled', 'false')`,
  `INSERT OR IGNORE INTO sl_settings (key, value) VALUES ('bridge.habits.enabled', 'false')`,
  `INSERT OR IGNORE INTO sl_settings (key, value) VALUES ('bridge.health.enabled', 'false')`,
];

export const SLEEP_MIGRATIONS: Migration[] = [
  {
    version: 1,
    description: 'Initial sleep schema -- entries, naps, dreams, factors, goals, streaks, settings',
    up: [...ALL_TABLES, ...CREATE_INDEXES, ...SEED_SETTINGS],
    down: [
      'DROP TABLE IF EXISTS sl_settings',
      'DROP TABLE IF EXISTS sl_streaks',
      'DROP TABLE IF EXISTS sl_goals',
      'DROP TABLE IF EXISTS sl_factors',
      'DROP TABLE IF EXISTS sl_dreams',
      'DROP TABLE IF EXISTS sl_naps',
      'DROP TABLE IF EXISTS sl_sleep_entries',
    ],
  },
  {
    version: 2,
    description: 'Dream search FTS, recurring-group indexes, and dream query support',
    up: DREAM_FTS_MIGRATION_UP,
    down: [
      'DROP TRIGGER IF EXISTS sl_dreams_fts_update',
      'DROP TRIGGER IF EXISTS sl_dreams_fts_delete',
      'DROP TRIGGER IF EXISTS sl_dreams_fts_insert',
      'DROP TABLE IF EXISTS sl_dreams_fts',
      'DROP INDEX IF EXISTS sl_dreams_recurring_group_idx',
      'DROP INDEX IF EXISTS sl_dreams_type_idx',
    ],
  },
  {
    version: 3,
    description: 'Goal progress streak history for sleep accountability charts',
    up: STREAK_HISTORY_MIGRATION_UP,
    down: [
      'DROP INDEX IF EXISTS sl_streak_history_type_date_idx',
      'DROP TABLE IF EXISTS sl_streak_history',
    ],
  },
  {
    version: 4,
    description: 'Sleep hygiene daily check-off persistence',
    up: HYGIENE_MIGRATION_UP,
    down: [
      'DROP INDEX IF EXISTS sl_hygiene_checks_date_idx',
      'DROP TABLE IF EXISTS sl_hygiene_checks',
    ],
  },
];

export function getSleepMigrations(): Migration[] {
  return SLEEP_MIGRATIONS;
}
