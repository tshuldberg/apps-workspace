-- MyClasses migration v4: assignments
-- Source spec: docs/plans/myclasses-mission-control.html (P2-A)
-- Runtime SQL is mirrored in src/db/schema.ts as TS string constants
-- (mirror is the runtime source of truth; this file is the spec/doc artifact).

CREATE TABLE IF NOT EXISTS cs_assignments (
  id TEXT PRIMARY KEY NOT NULL,
  class_id TEXT NOT NULL REFERENCES cs_classes(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('homework','essay','project','quiz','exam','lab','presentation','reading','other')),
  description_md TEXT,
  due_at TEXT,
  submitted_at TEXT,
  graded_at TEXT,
  status TEXT NOT NULL DEFAULT 'not_started' CHECK (status IN ('not_started','in_progress','submitted','graded')),
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low','medium','high','critical')),
  estimated_minutes INTEGER,
  actual_minutes INTEGER,
  grade REAL,
  max_grade REAL DEFAULT 100,
  weight REAL,
  is_recurring INTEGER NOT NULL DEFAULT 0,
  recurrence_rule TEXT,
  group_members TEXT,
  submission_notes TEXT,
  late_policy TEXT,
  depends_on TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS cs_assignments_class_due_idx ON cs_assignments(class_id, due_at);
CREATE INDEX IF NOT EXISTS cs_assignments_status_idx ON cs_assignments(status);
CREATE INDEX IF NOT EXISTS cs_assignments_due_at_idx ON cs_assignments(due_at);
