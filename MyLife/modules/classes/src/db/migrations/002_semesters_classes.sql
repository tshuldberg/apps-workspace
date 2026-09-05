-- MyClasses migration v2: semesters, classes, teachers
-- Source spec: docs/plans/myclasses-mission-control.html (P1-A)
-- Runtime SQL is mirrored in src/db/schema.ts as TS string constants
-- (mirror is the runtime source of truth; this file is the spec/doc artifact).

CREATE TABLE IF NOT EXISTS cs_semesters (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  start_date TEXT,
  end_date TEXT,
  institution TEXT,
  credit_hours INTEGER NOT NULL DEFAULT 0,
  gpa REAL,
  is_current INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS cs_teachers (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  title TEXT,
  department TEXT,
  email TEXT,
  office_location TEXT,
  office_hours TEXT,
  teaching_style_notes TEXT,
  grading_notes TEXT,
  rec_potential INTEGER,
  rating INTEGER CHECK (rating IS NULL OR (rating BETWEEN 1 AND 5)),
  notes_md TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS cs_classes (
  id TEXT PRIMARY KEY NOT NULL,
  semester_id TEXT NOT NULL REFERENCES cs_semesters(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  code TEXT,
  section TEXT,
  credits INTEGER NOT NULL DEFAULT 3,
  day_times TEXT,
  room TEXT,
  building TEXT,
  teacher_id TEXT REFERENCES cs_teachers(id) ON DELETE SET NULL,
  category_weights TEXT,
  current_grade REAL,
  target_grade REAL,
  color TEXT NOT NULL DEFAULT '#3B82F6',
  notes_md TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS cs_semesters_is_current_idx ON cs_semesters(is_current) WHERE is_current = 1;
CREATE INDEX IF NOT EXISTS cs_classes_semester_idx ON cs_classes(semester_id);
CREATE INDEX IF NOT EXISTS cs_classes_teacher_idx ON cs_classes(teacher_id);
CREATE INDEX IF NOT EXISTS cs_teachers_name_idx ON cs_teachers(name COLLATE NOCASE);
