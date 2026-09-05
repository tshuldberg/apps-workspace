import type { Migration } from '@mylife/module-registry';

export const CREATE_CLASSES_SETTINGS = `
CREATE TABLE IF NOT EXISTS cs_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
)`;

export const ALL_TABLES = [CREATE_CLASSES_SETTINGS];

// -- v2: semesters / classes / teachers (P1-A) --
// Mirrors src/db/migrations/002_semesters_classes.sql for human review.

export const CREATE_SEMESTERS = `
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
);`;

export const CREATE_TEACHERS = `
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
);`;

export const CREATE_CLASSES = `
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
);`;

export const CREATE_V2_INDEXES = [
  `CREATE INDEX IF NOT EXISTS cs_semesters_is_current_idx ON cs_semesters(is_current) WHERE is_current = 1;`,
  `CREATE INDEX IF NOT EXISTS cs_classes_semester_idx ON cs_classes(semester_id);`,
  `CREATE INDEX IF NOT EXISTS cs_classes_teacher_idx ON cs_classes(teacher_id);`,
  `CREATE INDEX IF NOT EXISTS cs_teachers_name_idx ON cs_teachers(name COLLATE NOCASE);`,
];

// -- v3: study sessions (P4-A) --
// Mirrors src/db/migrations/003_study_sessions.sql for human review.

export const CREATE_STUDY_SESSIONS = `
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
);`;

export const CREATE_V3_INDEXES = [
  `CREATE INDEX IF NOT EXISTS cs_study_sessions_started_at_idx ON cs_study_sessions(started_at);`,
  `CREATE INDEX IF NOT EXISTS cs_study_sessions_class_idx ON cs_study_sessions(class_id);`,
];

// -- v4: assignments (P2-A) --
// Mirrors src/db/migrations/004_assignments.sql for human review.

export const CREATE_ASSIGNMENTS = `
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
);`;

export const CREATE_V4_INDEXES = [
  `CREATE INDEX IF NOT EXISTS cs_assignments_class_due_idx ON cs_assignments(class_id, due_at);`,
  `CREATE INDEX IF NOT EXISTS cs_assignments_status_idx ON cs_assignments(status);`,
  `CREATE INDEX IF NOT EXISTS cs_assignments_due_at_idx ON cs_assignments(due_at);`,
];

// -- v5: lifelong learning (P8-A) --
// Online courses, certifications, and learning goals.

export const CREATE_ONLINE_COURSES = `
CREATE TABLE IF NOT EXISTS cs_online_courses (
  id TEXT PRIMARY KEY NOT NULL,
  title TEXT NOT NULL,
  provider TEXT,
  url TEXT,
  instructor TEXT,
  category TEXT,
  status TEXT NOT NULL DEFAULT 'not_started' CHECK (status IN ('not_started','in_progress','completed','abandoned')),
  progress_percent REAL NOT NULL DEFAULT 0,
  started_at TEXT,
  completed_at TEXT,
  estimated_hours REAL,
  actual_hours REAL,
  notes_md TEXT,
  certificate_url TEXT,
  rating INTEGER CHECK (rating IS NULL OR (rating BETWEEN 1 AND 5)),
  tags TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);`;

export const CREATE_CERTIFICATIONS = `
CREATE TABLE IF NOT EXISTS cs_certifications (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  issuer TEXT,
  issued_at TEXT,
  expires_at TEXT,
  credential_id TEXT,
  credential_url TEXT,
  category TEXT,
  notes_md TEXT,
  renewal_reminder_days INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);`;

export const CREATE_LEARNING_GOALS = `
CREATE TABLE IF NOT EXISTS cs_learning_goals (
  id TEXT PRIMARY KEY NOT NULL,
  title TEXT NOT NULL,
  description_md TEXT,
  target_date TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','completed','paused','abandoned')),
  course_ids TEXT,
  certification_ids TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  completed_at TEXT
);`;

export const CREATE_V5_INDEXES = [
  `CREATE INDEX IF NOT EXISTS cs_online_courses_status_idx ON cs_online_courses(status);`,
  `CREATE INDEX IF NOT EXISTS cs_certifications_expires_at_idx ON cs_certifications(expires_at);`,
  `CREATE INDEX IF NOT EXISTS cs_learning_goals_target_date_idx ON cs_learning_goals(target_date);`,
];

// -- v6: degree planning (P6-A) --
// Mirrors src/db/migrations/006_degree_planning.sql for human review.

export const CREATE_DEGREE_PROGRAMS = `
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
);`;

export const CREATE_REQUIREMENTS = `
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
);`;

export const CREATE_REQUIREMENT_SATISFACTIONS = `
CREATE TABLE IF NOT EXISTS cs_requirement_satisfactions (
  id TEXT PRIMARY KEY NOT NULL,
  requirement_id TEXT NOT NULL REFERENCES cs_requirements(id) ON DELETE CASCADE,
  class_id TEXT NOT NULL REFERENCES cs_classes(id) ON DELETE CASCADE,
  credits_applied INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'planned' CHECK (status IN ('planned','in_progress','completed')),
  approved_by TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(requirement_id, class_id)
);`;

export const CREATE_V6_INDEXES = [
  `CREATE INDEX IF NOT EXISTS cs_requirements_program_sort_idx ON cs_requirements(program_id, sort_order);`,
  `CREATE INDEX IF NOT EXISTS cs_requirement_satisfactions_requirement_idx ON cs_requirement_satisfactions(requirement_id);`,
  `CREATE INDEX IF NOT EXISTS cs_requirement_satisfactions_class_idx ON cs_requirement_satisfactions(class_id);`,
];

// -- v7: standardized tests + applications + application tasks (P7-A) --
// Mirrors src/db/migrations/007_tests_applications.sql for human review.

export const CREATE_STANDARDIZED_TESTS = `
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
);`;

export const CREATE_APPLICATIONS = `
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
);`;

export const CREATE_APPLICATION_TASKS = `
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
);`;

export const CREATE_V7_INDEXES = [
  `CREATE INDEX IF NOT EXISTS cs_standardized_tests_category_idx ON cs_standardized_tests(category);`,
  `CREATE INDEX IF NOT EXISTS cs_standardized_tests_test_date_idx ON cs_standardized_tests(test_date);`,
  `CREATE INDEX IF NOT EXISTS cs_standardized_tests_status_idx ON cs_standardized_tests(status);`,
  `CREATE INDEX IF NOT EXISTS cs_applications_deadline_idx ON cs_applications(deadline);`,
  `CREATE INDEX IF NOT EXISTS cs_applications_status_idx ON cs_applications(status);`,
  `CREATE INDEX IF NOT EXISTS cs_applications_type_idx ON cs_applications(type);`,
  `CREATE INDEX IF NOT EXISTS cs_application_tasks_app_sort_idx ON cs_application_tasks(application_id, sort_order);`,
  `CREATE INDEX IF NOT EXISTS cs_application_tasks_due_at_idx ON cs_application_tasks(due_at);`,
  `CREATE INDEX IF NOT EXISTS cs_application_tasks_status_idx ON cs_application_tasks(status);`,
];

export const CLASSES_MIGRATIONS: Migration[] = [
  {
    version: 1,
    description: 'Create classes settings table',
    up: [...ALL_TABLES],
    down: ['DROP TABLE IF EXISTS cs_settings'],
  },
  {
    version: 2,
    description: 'Add semesters, teachers, and classes tables (P1-A)',
    up: [
      CREATE_SEMESTERS,
      CREATE_TEACHERS,
      CREATE_CLASSES,
      ...CREATE_V2_INDEXES,
    ],
    down: [
      'DROP INDEX IF EXISTS cs_teachers_name_idx',
      'DROP INDEX IF EXISTS cs_classes_teacher_idx',
      'DROP INDEX IF EXISTS cs_classes_semester_idx',
      'DROP INDEX IF EXISTS cs_semesters_is_current_idx',
      'DROP TABLE IF EXISTS cs_classes',
      'DROP TABLE IF EXISTS cs_teachers',
      'DROP TABLE IF EXISTS cs_semesters',
    ],
  },
  {
    version: 3,
    description: 'Add study sessions table (P4-A)',
    up: [CREATE_STUDY_SESSIONS, ...CREATE_V3_INDEXES],
    down: [
      'DROP INDEX IF EXISTS cs_study_sessions_class_idx',
      'DROP INDEX IF EXISTS cs_study_sessions_started_at_idx',
      'DROP TABLE IF EXISTS cs_study_sessions',
    ],
  },
  {
    version: 4,
    description: 'Add assignments table (P2-A)',
    up: [CREATE_ASSIGNMENTS, ...CREATE_V4_INDEXES],
    down: [
      'DROP INDEX IF EXISTS cs_assignments_due_at_idx',
      'DROP INDEX IF EXISTS cs_assignments_status_idx',
      'DROP INDEX IF EXISTS cs_assignments_class_due_idx',
      'DROP TABLE IF EXISTS cs_assignments',
    ],
  },
  {
    version: 5,
    description: 'Add lifelong learning tables: online courses, certifications, learning goals (P8-A)',
    up: [
      CREATE_ONLINE_COURSES,
      CREATE_CERTIFICATIONS,
      CREATE_LEARNING_GOALS,
      ...CREATE_V5_INDEXES,
    ],
    down: [
      'DROP INDEX IF EXISTS cs_learning_goals_target_date_idx',
      'DROP INDEX IF EXISTS cs_certifications_expires_at_idx',
      'DROP INDEX IF EXISTS cs_online_courses_status_idx',
      'DROP TABLE IF EXISTS cs_learning_goals',
      'DROP TABLE IF EXISTS cs_certifications',
      'DROP TABLE IF EXISTS cs_online_courses',
    ],
  },
  {
    version: 6,
    description: 'Add degree planning tables: programs, requirements, satisfactions (P6-A)',
    up: [
      CREATE_DEGREE_PROGRAMS,
      CREATE_REQUIREMENTS,
      CREATE_REQUIREMENT_SATISFACTIONS,
      ...CREATE_V6_INDEXES,
    ],
    down: [
      'DROP INDEX IF EXISTS cs_requirement_satisfactions_class_idx',
      'DROP INDEX IF EXISTS cs_requirement_satisfactions_requirement_idx',
      'DROP INDEX IF EXISTS cs_requirements_program_sort_idx',
      'DROP TABLE IF EXISTS cs_requirement_satisfactions',
      'DROP TABLE IF EXISTS cs_requirements',
      'DROP TABLE IF EXISTS cs_degree_programs',
    ],
  },
  {
    version: 7,
    description: 'Add standardized tests, applications, and application tasks (P7-A)',
    up: [
      CREATE_STANDARDIZED_TESTS,
      CREATE_APPLICATIONS,
      CREATE_APPLICATION_TASKS,
      ...CREATE_V7_INDEXES,
    ],
    down: [
      'DROP INDEX IF EXISTS cs_application_tasks_status_idx',
      'DROP INDEX IF EXISTS cs_application_tasks_due_at_idx',
      'DROP INDEX IF EXISTS cs_application_tasks_app_sort_idx',
      'DROP INDEX IF EXISTS cs_applications_type_idx',
      'DROP INDEX IF EXISTS cs_applications_status_idx',
      'DROP INDEX IF EXISTS cs_applications_deadline_idx',
      'DROP INDEX IF EXISTS cs_standardized_tests_status_idx',
      'DROP INDEX IF EXISTS cs_standardized_tests_test_date_idx',
      'DROP INDEX IF EXISTS cs_standardized_tests_category_idx',
      'DROP TABLE IF EXISTS cs_application_tasks',
      'DROP TABLE IF EXISTS cs_applications',
      'DROP TABLE IF EXISTS cs_standardized_tests',
    ],
  },
];
