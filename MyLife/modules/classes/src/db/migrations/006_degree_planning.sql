-- MyClasses migration v6: degree planning
-- Source spec: docs/plans/myclasses-mission-control.html (P6-A)
-- Runtime SQL is mirrored in src/db/schema.ts as TS string constants
-- (mirror is the runtime source of truth; this file is the spec/doc artifact).

CREATE TABLE IF NOT EXISTS cs_degree_programs (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  institution TEXT,
  degree_type TEXT CHECK (degree_type IS NULL OR degree_type IN ('BS','BA','MS','MA','PhD','Minor','Certificate','Other')),
  total_credits_required INTEGER NOT NULL,
  gpa_required REAL,
  catalog_year TEXT,
  start_date TEXT,
  expected_completion TEXT,
  is_primary INTEGER NOT NULL DEFAULT 0,
  notes_md TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS cs_requirements (
  id TEXT PRIMARY KEY NOT NULL,
  program_id TEXT NOT NULL REFERENCES cs_degree_programs(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  category TEXT CHECK (category IS NULL OR category IN ('major','minor','general_ed','elective','capstone','other')),
  credits_required INTEGER NOT NULL DEFAULT 0,
  course_count_required INTEGER NOT NULL DEFAULT 0,
  min_grade TEXT,
  allowed_course_codes TEXT,
  notes_md TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS cs_requirement_satisfactions (
  id TEXT PRIMARY KEY NOT NULL,
  requirement_id TEXT NOT NULL REFERENCES cs_requirements(id) ON DELETE CASCADE,
  class_id TEXT NOT NULL REFERENCES cs_classes(id) ON DELETE CASCADE,
  credits_applied INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'planned' CHECK (status IN ('planned','in_progress','completed')),
  approved_by TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(requirement_id, class_id)
);

CREATE INDEX IF NOT EXISTS cs_requirements_program_sort_idx ON cs_requirements(program_id, sort_order);
CREATE INDEX IF NOT EXISTS cs_requirement_satisfactions_requirement_idx ON cs_requirement_satisfactions(requirement_id);
CREATE INDEX IF NOT EXISTS cs_requirement_satisfactions_class_idx ON cs_requirement_satisfactions(class_id);
