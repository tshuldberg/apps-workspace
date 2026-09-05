-- MyClasses migration v7: standardized tests + applications + application tasks
-- Source spec: docs/plans/myclasses-mission-control.html (P7-A)
-- Runtime SQL is mirrored in src/db/schema.ts as TS string constants
-- (mirror is the runtime source of truth; this file is the spec/doc artifact).

CREATE TABLE IF NOT EXISTS cs_standardized_tests (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('undergrad','grad','ap_ib','language','professional','other')),
  test_date TEXT,
  registration_deadline TEXT,
  location TEXT,
  score REAL,
  max_score REAL,
  percentile REAL,
  section_scores TEXT,
  status TEXT NOT NULL DEFAULT 'planned' CHECK (status IN ('planned','registered','completed','cancelled')),
  superscore_eligible INTEGER NOT NULL DEFAULT 0,
  notes_md TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS cs_applications (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  institution TEXT,
  type TEXT NOT NULL CHECK (type IN ('undergrad','grad','scholarship','fellowship','internship','job','other')),
  program TEXT,
  deadline TEXT,
  early_deadline TEXT,
  decision_date TEXT,
  status TEXT NOT NULL DEFAULT 'considering' CHECK (status IN ('considering','in_progress','submitted','accepted','rejected','waitlisted','deferred','withdrawn')),
  application_url TEXT,
  portal_url TEXT,
  application_fee REAL,
  fee_waiver_status TEXT,
  required_test_score_ids TEXT,
  required_essays_count INTEGER NOT NULL DEFAULT 0,
  essays_drafted INTEGER NOT NULL DEFAULT 0,
  essays_finalized INTEGER NOT NULL DEFAULT 0,
  recommenders_required INTEGER NOT NULL DEFAULT 0,
  recommenders_confirmed INTEGER NOT NULL DEFAULT 0,
  transcripts_requested INTEGER NOT NULL DEFAULT 0,
  transcripts_sent INTEGER NOT NULL DEFAULT 0,
  notes_md TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS cs_application_tasks (
  id TEXT PRIMARY KEY NOT NULL,
  application_id TEXT NOT NULL REFERENCES cs_applications(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('essay','recommendation','transcript','portal_step','fee','supplemental','other')),
  due_at TEXT,
  completed_at TEXT,
  word_target INTEGER,
  word_count INTEGER,
  status TEXT NOT NULL DEFAULT 'not_started' CHECK (status IN ('not_started','in_progress','done','skipped')),
  notes_md TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS cs_standardized_tests_category_idx ON cs_standardized_tests(category);
CREATE INDEX IF NOT EXISTS cs_standardized_tests_test_date_idx ON cs_standardized_tests(test_date);
CREATE INDEX IF NOT EXISTS cs_standardized_tests_status_idx ON cs_standardized_tests(status);
CREATE INDEX IF NOT EXISTS cs_applications_deadline_idx ON cs_applications(deadline);
CREATE INDEX IF NOT EXISTS cs_applications_status_idx ON cs_applications(status);
CREATE INDEX IF NOT EXISTS cs_applications_type_idx ON cs_applications(type);
CREATE INDEX IF NOT EXISTS cs_application_tasks_app_sort_idx ON cs_application_tasks(application_id, sort_order);
CREATE INDEX IF NOT EXISTS cs_application_tasks_due_at_idx ON cs_application_tasks(due_at);
CREATE INDEX IF NOT EXISTS cs_application_tasks_status_idx ON cs_application_tasks(status);
