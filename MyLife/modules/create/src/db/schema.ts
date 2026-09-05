import type { Migration } from '@mylife/module-registry';

export const CREATE_CREATE_SETTINGS = `
CREATE TABLE IF NOT EXISTS ct_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
)`;

export const CREATE_CREATE_PHOTOS = `
CREATE TABLE IF NOT EXISTS ct_photos (
  id TEXT PRIMARY KEY,
  project_id TEXT,
  portfolio_id TEXT,
  equipment_id TEXT,
  kind TEXT NOT NULL CHECK(kind IN ('process','final','detail','reference','setup')),
  local_uri TEXT NOT NULL,
  caption TEXT,
  taken_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

export const CREATE_CREATE_INDEXES = [
  'CREATE INDEX IF NOT EXISTS ct_photos_project_idx ON ct_photos(project_id)',
  'CREATE INDEX IF NOT EXISTS ct_photos_portfolio_idx ON ct_photos(portfolio_id)',
  'CREATE INDEX IF NOT EXISTS ct_photos_equipment_idx ON ct_photos(equipment_id)',
  'CREATE INDEX IF NOT EXISTS ct_photos_kind_idx ON ct_photos(kind)',
] as const;

export const CREATE_TABLES = [
  CREATE_CREATE_SETTINGS,
  CREATE_CREATE_PHOTOS,
] as const;

export const CREATE_CREATE_PROJECTS = `
CREATE TABLE IF NOT EXISTS ct_projects (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  type TEXT NOT NULL CHECK(type IN ('art','music','video','writing','code','craft','photo','design','game_dev','other')),
  description_md TEXT,
  status TEXT NOT NULL DEFAULT 'idea' CHECK(status IN ('idea','planning','in_progress','revising','complete','archived')),
  priority INTEGER NOT NULL DEFAULT 0,
  deadline TEXT,
  estimated_hours REAL,
  actual_hours REAL NOT NULL DEFAULT 0,
  tools_used TEXT NOT NULL DEFAULT '[]',
  collaborators TEXT NOT NULL DEFAULT '[]',
  outcome_notes TEXT,
  published_url TEXT,
  satisfaction_rating INTEGER CHECK(satisfaction_rating BETWEEN 1 AND 5),
  cover_photo_id TEXT,
  inspiration_refs TEXT NOT NULL DEFAULT '[]',
  started_at TEXT,
  completed_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

export const CREATE_CREATE_PROGRESS_ENTRIES = `
CREATE TABLE IF NOT EXISTS ct_progress_entries (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES ct_projects(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  notes_md TEXT,
  hours_spent REAL NOT NULL DEFAULT 0,
  milestone INTEGER NOT NULL DEFAULT 0,
  milestone_name TEXT,
  roadblock TEXT,
  breakthrough TEXT,
  mood TEXT,
  photo_ids TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

export const CREATE_V2_TABLES = [
  CREATE_CREATE_PROJECTS,
  CREATE_CREATE_PROGRESS_ENTRIES,
] as const;

export const CREATE_V2_INDEXES = [
  'CREATE INDEX IF NOT EXISTS ct_projects_status_idx ON ct_projects(status)',
  'CREATE INDEX IF NOT EXISTS ct_projects_type_idx ON ct_projects(type)',
  'CREATE INDEX IF NOT EXISTS ct_projects_deadline_idx ON ct_projects(deadline)',
  'CREATE INDEX IF NOT EXISTS ct_projects_priority_idx ON ct_projects(priority)',
  'CREATE INDEX IF NOT EXISTS ct_projects_updated_at_idx ON ct_projects(updated_at)',
  'CREATE INDEX IF NOT EXISTS ct_progress_entries_project_idx ON ct_progress_entries(project_id)',
  'CREATE INDEX IF NOT EXISTS ct_progress_entries_date_idx ON ct_progress_entries(date)',
  'CREATE INDEX IF NOT EXISTS ct_progress_entries_milestone_idx ON ct_progress_entries(milestone)',
] as const;

export const CREATE_MIGRATION_V1: Migration = {
  version: 1,
  description: 'Create MyCreate foundation settings and photo tables',
  up: [...CREATE_TABLES, ...CREATE_CREATE_INDEXES],
  down: [
    'DROP INDEX IF EXISTS ct_photos_kind_idx',
    'DROP INDEX IF EXISTS ct_photos_equipment_idx',
    'DROP INDEX IF EXISTS ct_photos_portfolio_idx',
    'DROP INDEX IF EXISTS ct_photos_project_idx',
    'DROP TABLE IF EXISTS ct_photos',
    'DROP TABLE IF EXISTS ct_settings',
  ],
};

export const CREATE_MIGRATION_V2: Migration = {
  version: 2,
  description: 'Add project tracker and progress journal tables',
  up: [...CREATE_V2_TABLES, ...CREATE_V2_INDEXES],
  down: [
    'DROP INDEX IF EXISTS ct_progress_entries_milestone_idx',
    'DROP INDEX IF EXISTS ct_progress_entries_date_idx',
    'DROP INDEX IF EXISTS ct_progress_entries_project_idx',
    'DROP INDEX IF EXISTS ct_projects_updated_at_idx',
    'DROP INDEX IF EXISTS ct_projects_priority_idx',
    'DROP INDEX IF EXISTS ct_projects_deadline_idx',
    'DROP INDEX IF EXISTS ct_projects_type_idx',
    'DROP INDEX IF EXISTS ct_projects_status_idx',
    'DROP TABLE IF EXISTS ct_progress_entries',
    'DROP TABLE IF EXISTS ct_projects',
  ],
};
