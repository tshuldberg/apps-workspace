CREATE TABLE IF NOT EXISTS sl_streak_history (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN ('quality_above_3', 'on_time_bed', 'target_hours', 'no_snooze')),
  date TEXT NOT NULL,
  met INTEGER NOT NULL DEFAULT 0,
  current_count INTEGER NOT NULL DEFAULT 0,
  longest_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(type, date)
);

CREATE INDEX IF NOT EXISTS sl_streak_history_type_date_idx ON sl_streak_history(type, date);
