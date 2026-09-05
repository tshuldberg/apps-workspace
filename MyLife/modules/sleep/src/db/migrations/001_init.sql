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
);

CREATE TABLE IF NOT EXISTS sl_naps (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL,
  start_time TEXT NOT NULL,
  duration_minutes INTEGER NOT NULL,
  intentional INTEGER NOT NULL DEFAULT 1,
  quality INTEGER CHECK (quality BETWEEN 1 AND 5),
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

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
);

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
);

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
);

CREATE TABLE IF NOT EXISTS sl_streaks (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN ('quality_above_3', 'on_time_bed', 'target_hours', 'no_snooze')),
  current_count INTEGER NOT NULL DEFAULT 0,
  longest_count INTEGER NOT NULL DEFAULT 0,
  last_date TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sl_settings (
  key TEXT PRIMARY KEY,
  value TEXT
);

CREATE INDEX IF NOT EXISTS sl_sleep_entries_date_idx ON sl_sleep_entries(date);
CREATE INDEX IF NOT EXISTS sl_dreams_entry_idx ON sl_dreams(sleep_entry_id);
CREATE INDEX IF NOT EXISTS sl_dreams_date_idx ON sl_dreams(date);
CREATE INDEX IF NOT EXISTS sl_factors_entry_idx ON sl_factors(sleep_entry_id);
CREATE INDEX IF NOT EXISTS sl_goals_active_idx ON sl_goals(is_active);

INSERT OR IGNORE INTO sl_settings (key, value) VALUES ('sleep.targetHours', '8');
INSERT OR IGNORE INTO sl_settings (key, value) VALUES ('bridge.mood.enabled', 'false');
INSERT OR IGNORE INTO sl_settings (key, value) VALUES ('bridge.habits.enabled', 'false');
INSERT OR IGNORE INTO sl_settings (key, value) VALUES ('bridge.health.enabled', 'false');
