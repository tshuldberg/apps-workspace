// MyNotes SQLite schema - table prefix: nt_

export const CREATE_NOTES = `
CREATE TABLE IF NOT EXISTS nt_notes (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL DEFAULT '',
  body TEXT NOT NULL DEFAULT '',
  folder_id TEXT REFERENCES nt_folders(id) ON DELETE SET NULL,
  is_pinned INTEGER NOT NULL DEFAULT 0,
  is_favorite INTEGER NOT NULL DEFAULT 0,
  word_count INTEGER NOT NULL DEFAULT 0,
  char_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

export const CREATE_FOLDERS = `
CREATE TABLE IF NOT EXISTS nt_folders (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  parent_id TEXT REFERENCES nt_folders(id) ON DELETE CASCADE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

export const CREATE_TAGS = `
CREATE TABLE IF NOT EXISTS nt_tags (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  color TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

export const CREATE_NOTE_TAGS = `
CREATE TABLE IF NOT EXISTS nt_note_tags (
  note_id TEXT NOT NULL REFERENCES nt_notes(id) ON DELETE CASCADE,
  tag_id TEXT NOT NULL REFERENCES nt_tags(id) ON DELETE CASCADE,
  PRIMARY KEY (note_id, tag_id)
)`;

export const CREATE_NOTE_LINKS = `
CREATE TABLE IF NOT EXISTS nt_note_links (
  id TEXT PRIMARY KEY,
  source_note_id TEXT NOT NULL REFERENCES nt_notes(id) ON DELETE CASCADE,
  target_note_id TEXT NOT NULL REFERENCES nt_notes(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

export const CREATE_TEMPLATES = `
CREATE TABLE IF NOT EXISTS nt_templates (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  body TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

export const CREATE_SETTINGS = `
CREATE TABLE IF NOT EXISTS nt_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
)`;

// FTS5 virtual table for full-text search on note title + body
export const CREATE_FTS = `
CREATE VIRTUAL TABLE IF NOT EXISTS nt_notes_fts USING fts5(
  title,
  body,
  content='nt_notes',
  content_rowid='rowid'
)`;

// Triggers to keep FTS index in sync with the notes table
export const CREATE_FTS_INSERT_TRIGGER = `
CREATE TRIGGER IF NOT EXISTS nt_notes_fts_insert AFTER INSERT ON nt_notes BEGIN
  INSERT INTO nt_notes_fts(rowid, title, body) VALUES (new.rowid, new.title, new.body);
END`;

export const CREATE_FTS_DELETE_TRIGGER = `
CREATE TRIGGER IF NOT EXISTS nt_notes_fts_delete AFTER DELETE ON nt_notes BEGIN
  INSERT INTO nt_notes_fts(nt_notes_fts, rowid, title, body) VALUES ('delete', old.rowid, old.title, old.body);
END`;

export const CREATE_FTS_UPDATE_TRIGGER = `
CREATE TRIGGER IF NOT EXISTS nt_notes_fts_update AFTER UPDATE ON nt_notes BEGIN
  INSERT INTO nt_notes_fts(nt_notes_fts, rowid, title, body) VALUES ('delete', old.rowid, old.title, old.body);
  INSERT INTO nt_notes_fts(rowid, title, body) VALUES (new.rowid, new.title, new.body);
END`;

export const CREATE_INDEXES = [
  `CREATE INDEX IF NOT EXISTS nt_notes_folder_idx ON nt_notes(folder_id)`,
  `CREATE INDEX IF NOT EXISTS nt_notes_updated_idx ON nt_notes(updated_at DESC)`,
  `CREATE INDEX IF NOT EXISTS nt_notes_created_idx ON nt_notes(created_at DESC)`,
  `CREATE INDEX IF NOT EXISTS nt_notes_pinned_idx ON nt_notes(is_pinned)`,
  `CREATE INDEX IF NOT EXISTS nt_notes_favorite_idx ON nt_notes(is_favorite)`,
  `CREATE INDEX IF NOT EXISTS nt_folders_parent_idx ON nt_folders(parent_id)`,
  `CREATE INDEX IF NOT EXISTS nt_note_tags_tag_idx ON nt_note_tags(tag_id)`,
  `CREATE INDEX IF NOT EXISTS nt_note_links_source_idx ON nt_note_links(source_note_id)`,
  `CREATE INDEX IF NOT EXISTS nt_note_links_target_idx ON nt_note_links(target_note_id)`,
];

export const ALL_TABLES = [
  CREATE_FOLDERS,
  CREATE_NOTES,
  CREATE_TAGS,
  CREATE_NOTE_TAGS,
  CREATE_NOTE_LINKS,
  CREATE_TEMPLATES,
  CREATE_SETTINGS,
];

export const FTS_STATEMENTS = [
  CREATE_FTS,
  CREATE_FTS_INSERT_TRIGGER,
  CREATE_FTS_DELETE_TRIGGER,
  CREATE_FTS_UPDATE_TRIGGER,
];
