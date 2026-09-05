// MyNotes V2 migration schema - consolidates all A-tier feature schema changes

// ── Daily Notes ───────────────────────────────────────────────────────
export const V2_DAILY_NOTES = [
  `ALTER TABLE nt_notes ADD COLUMN is_daily_note INTEGER NOT NULL DEFAULT 0`,
  `ALTER TABLE nt_notes ADD COLUMN daily_date TEXT`,
];

export const V2_DAILY_NOTES_INDEX = `CREATE UNIQUE INDEX IF NOT EXISTS nt_notes_daily_date_idx ON nt_notes(daily_date) WHERE daily_date IS NOT NULL`;

// ── Templates UI ──────────────────────────────────────────────────────
export const V2_TEMPLATES = [
  `ALTER TABLE nt_templates ADD COLUMN description TEXT DEFAULT ''`,
  `ALTER TABLE nt_templates ADD COLUMN category TEXT DEFAULT 'custom'`,
  `ALTER TABLE nt_templates ADD COLUMN icon TEXT DEFAULT '📄'`,
  `ALTER TABLE nt_templates ADD COLUMN use_count INTEGER NOT NULL DEFAULT 0`,
  `ALTER TABLE nt_templates ADD COLUMN is_built_in INTEGER NOT NULL DEFAULT 0`,
];

export const V2_TEMPLATES_INDEX = `CREATE INDEX IF NOT EXISTS nt_templates_category_idx ON nt_templates(category)`;

// ── Image/File Attachments ────────────────────────────────────────────
export const V2_ATTACHMENTS = `
CREATE TABLE IF NOT EXISTS nt_attachments (
  id TEXT PRIMARY KEY NOT NULL,
  note_id TEXT NOT NULL REFERENCES nt_notes(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size_bytes INTEGER NOT NULL DEFAULT 0,
  mime_type TEXT NOT NULL,
  attachment_type TEXT NOT NULL DEFAULT 'image'
    CHECK (attachment_type IN ('image', 'pdf', 'file')),
  width INTEGER,
  height INTEGER,
  thumbnail_path TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

export const V2_ATTACHMENTS_INDEX = `CREATE INDEX IF NOT EXISTS nt_attachments_note_idx ON nt_attachments(note_id, sort_order)`;

// ── OCR ───────────────────────────────────────────────────────────────
export const V2_OCR = [
  `ALTER TABLE nt_attachments ADD COLUMN ocr_text TEXT`,
  `ALTER TABLE nt_attachments ADD COLUMN ocr_status TEXT DEFAULT 'none'`,
  `ALTER TABLE nt_attachments ADD COLUMN ocr_language TEXT DEFAULT 'en'`,
];

export const V2_OCR_FTS = `
CREATE VIRTUAL TABLE IF NOT EXISTS nt_attachments_fts USING fts5(
  ocr_text,
  content='nt_attachments',
  content_rowid='rowid'
)`;

// ── Web Clipper ───────────────────────────────────────────────────────
export const V2_WEB_CLIPPER = [
  `ALTER TABLE nt_notes ADD COLUMN source_url TEXT`,
  `ALTER TABLE nt_notes ADD COLUMN clipped_at TEXT`,
  `ALTER TABLE nt_notes ADD COLUMN clip_type TEXT`,
];

// ── AI Writing Assistant ──────────────────────────────────────────────
export const V2_AI_HISTORY = `
CREATE TABLE IF NOT EXISTS nt_ai_history (
  id TEXT PRIMARY KEY NOT NULL,
  note_id TEXT NOT NULL REFERENCES nt_notes(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  input_text TEXT NOT NULL,
  output_text TEXT NOT NULL,
  provider TEXT NOT NULL DEFAULT 'local',
  accepted INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

export const V2_AI_HISTORY_INDEX = `CREATE INDEX IF NOT EXISTS nt_ai_history_note_idx ON nt_ai_history(note_id)`;

// ── Relational Databases ──────────────────────────────────────────────
export const V2_DATABASES = `
CREATE TABLE IF NOT EXISTS nt_databases (
  id TEXT PRIMARY KEY NOT NULL,
  title TEXT NOT NULL DEFAULT 'Untitled Database',
  description TEXT DEFAULT '',
  folder_id TEXT REFERENCES nt_folders(id) ON DELETE SET NULL,
  default_view TEXT NOT NULL DEFAULT 'table',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

export const V2_DB_COLUMNS = `
CREATE TABLE IF NOT EXISTS nt_db_columns (
  id TEXT PRIMARY KEY NOT NULL,
  database_id TEXT NOT NULL REFERENCES nt_databases(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT '',
  column_type TEXT NOT NULL DEFAULT 'text',
  options_json TEXT DEFAULT '{}',
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_primary INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

export const V2_DB_ROWS = `
CREATE TABLE IF NOT EXISTS nt_db_rows (
  id TEXT PRIMARY KEY NOT NULL,
  database_id TEXT NOT NULL REFERENCES nt_databases(id) ON DELETE CASCADE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

export const V2_DB_CELLS = `
CREATE TABLE IF NOT EXISTS nt_db_cells (
  id TEXT PRIMARY KEY NOT NULL,
  row_id TEXT NOT NULL REFERENCES nt_db_rows(id) ON DELETE CASCADE,
  column_id TEXT NOT NULL REFERENCES nt_db_columns(id) ON DELETE CASCADE,
  value_text TEXT,
  value_number REAL,
  value_json TEXT,
  UNIQUE(row_id, column_id)
)`;

export const V2_DB_INDEXES = [
  `CREATE INDEX IF NOT EXISTS nt_databases_folder_idx ON nt_databases(folder_id)`,
  `CREATE INDEX IF NOT EXISTS nt_db_columns_database_idx ON nt_db_columns(database_id, sort_order)`,
  `CREATE INDEX IF NOT EXISTS nt_db_rows_database_idx ON nt_db_rows(database_id, sort_order)`,
  `CREATE INDEX IF NOT EXISTS nt_db_cells_row_idx ON nt_db_cells(row_id)`,
  `CREATE INDEX IF NOT EXISTS nt_db_cells_column_idx ON nt_db_cells(column_id)`,
];

// ── Plugin System ─────────────────────────────────────────────────────
export const V2_PLUGINS = `
CREATE TABLE IF NOT EXISTS nt_plugins (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  version TEXT NOT NULL DEFAULT '0.1.0',
  description TEXT DEFAULT '',
  author TEXT DEFAULT '',
  is_enabled INTEGER NOT NULL DEFAULT 0,
  is_built_in INTEGER NOT NULL DEFAULT 0,
  manifest_json TEXT NOT NULL DEFAULT '{}',
  installed_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

export const V2_PLUGIN_SETTINGS = `
CREATE TABLE IF NOT EXISTS nt_plugin_settings (
  plugin_id TEXT NOT NULL REFERENCES nt_plugins(id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  value TEXT NOT NULL,
  PRIMARY KEY (plugin_id, key)
)`;

export const V2_PLUGINS_INDEX = `CREATE INDEX IF NOT EXISTS nt_plugins_enabled_idx ON nt_plugins(is_enabled)`;

// ── Combined V2 migration ────────────────────────────────────────────

export const NOTES_V2_UP: string[] = [
  // Daily Notes
  ...V2_DAILY_NOTES,
  V2_DAILY_NOTES_INDEX,
  // Templates UI
  ...V2_TEMPLATES,
  V2_TEMPLATES_INDEX,
  // Attachments (must come before OCR)
  V2_ATTACHMENTS,
  V2_ATTACHMENTS_INDEX,
  // OCR (extends attachments)
  ...V2_OCR,
  V2_OCR_FTS,
  // Web Clipper
  ...V2_WEB_CLIPPER,
  // AI Writing Assistant
  V2_AI_HISTORY,
  V2_AI_HISTORY_INDEX,
  // Relational Databases
  V2_DATABASES,
  V2_DB_COLUMNS,
  V2_DB_ROWS,
  V2_DB_CELLS,
  ...V2_DB_INDEXES,
  // Plugin System
  V2_PLUGINS,
  V2_PLUGIN_SETTINGS,
  V2_PLUGINS_INDEX,
];

export const NOTES_V2_DOWN: string[] = [
  // Plugin System
  'DROP INDEX IF EXISTS nt_plugins_enabled_idx',
  'DROP TABLE IF EXISTS nt_plugin_settings',
  'DROP TABLE IF EXISTS nt_plugins',
  // Relational Databases
  'DROP INDEX IF EXISTS nt_db_cells_column_idx',
  'DROP INDEX IF EXISTS nt_db_cells_row_idx',
  'DROP INDEX IF EXISTS nt_db_rows_database_idx',
  'DROP INDEX IF EXISTS nt_db_columns_database_idx',
  'DROP INDEX IF EXISTS nt_databases_folder_idx',
  'DROP TABLE IF EXISTS nt_db_cells',
  'DROP TABLE IF EXISTS nt_db_rows',
  'DROP TABLE IF EXISTS nt_db_columns',
  'DROP TABLE IF EXISTS nt_databases',
  // AI Writing Assistant
  'DROP INDEX IF EXISTS nt_ai_history_note_idx',
  'DROP TABLE IF EXISTS nt_ai_history',
  // OCR FTS
  'DROP TABLE IF EXISTS nt_attachments_fts',
  // Attachments (includes OCR columns)
  'DROP INDEX IF EXISTS nt_attachments_note_idx',
  'DROP TABLE IF EXISTS nt_attachments',
  // Templates UI columns (SQLite doesn't support DROP COLUMN easily, skip)
  'DROP INDEX IF EXISTS nt_templates_category_idx',
  // Daily Notes index
  'DROP INDEX IF EXISTS nt_notes_daily_date_idx',
  // Note: ALTER TABLE DROP COLUMN not widely supported in SQLite < 3.35
  // V2 down is best-effort for the ALTER TABLE additions
];
