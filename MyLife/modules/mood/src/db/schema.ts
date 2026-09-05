// MyMood SQLite schema - table prefix: mo_

export const CREATE_MOOD_ENTRIES = `
CREATE TABLE IF NOT EXISTS mo_entries (
  id TEXT PRIMARY KEY,
  score INTEGER NOT NULL CHECK(score >= 1 AND score <= 10),
  note TEXT,
  logged_at TEXT NOT NULL,
  date TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

export const CREATE_MOOD_ACTIVITIES = `
CREATE TABLE IF NOT EXISTS mo_activities (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  icon TEXT,
  category TEXT,
  is_default INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

export const CREATE_MOOD_EMOTION_TAGS = `
CREATE TABLE IF NOT EXISTS mo_emotion_tags (
  id TEXT PRIMARY KEY,
  entry_id TEXT NOT NULL REFERENCES mo_entries(id) ON DELETE CASCADE,
  emotion TEXT NOT NULL,
  intensity INTEGER NOT NULL DEFAULT 2 CHECK(intensity >= 1 AND intensity <= 3),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

export const CREATE_MOOD_ENTRY_ACTIVITIES = `
CREATE TABLE IF NOT EXISTS mo_entry_activities (
  id TEXT PRIMARY KEY,
  entry_id TEXT NOT NULL REFERENCES mo_entries(id) ON DELETE CASCADE,
  activity_id TEXT NOT NULL REFERENCES mo_activities(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

export const CREATE_BREATHING_SESSIONS = `
CREATE TABLE IF NOT EXISTS mo_breathing_sessions (
  id TEXT PRIMARY KEY,
  pattern TEXT NOT NULL,
  duration_seconds INTEGER NOT NULL,
  cycles_completed INTEGER NOT NULL DEFAULT 0,
  completed_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

export const CREATE_MOOD_SETTINGS = `
CREATE TABLE IF NOT EXISTS mo_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
)`;

export const CREATE_INDEXES = [
  `CREATE INDEX IF NOT EXISTS mo_entries_date_idx ON mo_entries(date DESC)`,
  `CREATE INDEX IF NOT EXISTS mo_entries_logged_at_idx ON mo_entries(logged_at DESC)`,
  `CREATE INDEX IF NOT EXISTS mo_entries_score_idx ON mo_entries(score)`,
  `CREATE INDEX IF NOT EXISTS mo_entries_date_logged_idx ON mo_entries(date, logged_at DESC)`,
  `CREATE INDEX IF NOT EXISTS mo_emotion_tags_entry_idx ON mo_emotion_tags(entry_id)`,
  `CREATE INDEX IF NOT EXISTS mo_entry_activities_entry_idx ON mo_entry_activities(entry_id)`,
  `CREATE INDEX IF NOT EXISTS mo_entry_activities_activity_idx ON mo_entry_activities(activity_id)`,
  `CREATE INDEX IF NOT EXISTS mo_breathing_sessions_completed_idx ON mo_breathing_sessions(completed_at DESC)`,
  `CREATE INDEX IF NOT EXISTS mo_activities_category_idx ON mo_activities(category)`,
];

export const ALL_TABLES = [
  CREATE_MOOD_ENTRIES,
  CREATE_MOOD_ACTIVITIES,
  CREATE_MOOD_EMOTION_TAGS,
  CREATE_MOOD_ENTRY_ACTIVITIES,
  CREATE_BREATHING_SESSIONS,
  CREATE_MOOD_SETTINGS,
];
