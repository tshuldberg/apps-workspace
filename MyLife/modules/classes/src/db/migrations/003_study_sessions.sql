-- MyClasses migration v3: study sessions
-- Source spec: docs/plans/myclasses-mission-control.html (P4-A)
-- Runtime SQL is mirrored in src/db/schema.ts as TS string constants
-- (mirror is the runtime source of truth; this file is the spec/doc artifact).

CREATE TABLE IF NOT EXISTS cs_study_sessions (
  id TEXT PRIMARY KEY NOT NULL,
  class_id TEXT REFERENCES cs_classes(id) ON DELETE SET NULL,
  started_at TEXT NOT NULL,
  duration_minutes INTEGER NOT NULL,
  location TEXT,
  productivity_rating INTEGER CHECK (productivity_rating IS NULL OR (productivity_rating BETWEEN 1 AND 5)),
  focus_notes TEXT,
  companion_ids TEXT,
  topics_covered TEXT,
  timer_type TEXT NOT NULL DEFAULT 'freeform' CHECK (timer_type IN ('pomodoro','custom','freeform')),
  pomodoro_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS cs_study_sessions_started_at_idx ON cs_study_sessions(started_at);
CREATE INDEX IF NOT EXISTS cs_study_sessions_class_idx ON cs_study_sessions(class_id);
