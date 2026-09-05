// MyWords SQLite schema - table prefix: wd_

export const CREATE_WORD_LISTS = `
CREATE TABLE IF NOT EXISTS wd_word_lists (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  language_code TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

export const CREATE_SAVED_WORDS = `
CREATE TABLE IF NOT EXISTS wd_saved_words (
  id TEXT PRIMARY KEY NOT NULL,
  word TEXT NOT NULL,
  language_code TEXT NOT NULL,
  language_name TEXT NOT NULL,
  list_id TEXT REFERENCES wd_word_lists(id) ON DELETE SET NULL,
  definition_summary TEXT,
  part_of_speech TEXT,
  pronunciation_text TEXT,
  lookup_data TEXT,
  notes TEXT,
  mastery_level INTEGER NOT NULL DEFAULT 0,
  is_favorite INTEGER NOT NULL DEFAULT 0,
  looked_up_count INTEGER NOT NULL DEFAULT 1,
  last_looked_up_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

export const CREATE_INDEXES = [
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_wd_saved_words_word_lang ON wd_saved_words(word, language_code)`,
  `CREATE INDEX IF NOT EXISTS idx_wd_saved_words_list ON wd_saved_words(list_id)`,
  `CREATE INDEX IF NOT EXISTS idx_wd_saved_words_language ON wd_saved_words(language_code)`,
  `CREATE INDEX IF NOT EXISTS idx_wd_saved_words_favorite ON wd_saved_words(is_favorite)`,
  `CREATE INDEX IF NOT EXISTS idx_wd_saved_words_mastery ON wd_saved_words(mastery_level)`,
  `CREATE INDEX IF NOT EXISTS idx_wd_saved_words_last_lookup ON wd_saved_words(last_looked_up_at DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_wd_word_lists_sort ON wd_word_lists(sort_order)`,
];

export const ALL_TABLES = [CREATE_WORD_LISTS, CREATE_SAVED_WORDS];

// ── V2: Flash bridge column ───────────────────────────────────────────

export const V2_UP = [
  `ALTER TABLE wd_saved_words ADD COLUMN flash_card_id TEXT DEFAULT NULL`,
  `CREATE INDEX IF NOT EXISTS idx_wd_saved_words_flash ON wd_saved_words(flash_card_id)`,
];

// ── V3: Offline lookup cache ──────────────────────────────────────────

export const CREATE_LOOKUP_CACHE = `
CREATE TABLE IF NOT EXISTS wd_lookup_cache (
  id TEXT PRIMARY KEY NOT NULL,
  word TEXT NOT NULL,
  language_code TEXT NOT NULL,
  lookup_data TEXT NOT NULL,
  data_size_bytes INTEGER NOT NULL,
  fetched_at TEXT NOT NULL,
  last_accessed_at TEXT NOT NULL,
  access_count INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

export const V3_INDEXES = [
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_wd_lookup_cache_word_lang ON wd_lookup_cache(word, language_code)`,
  `CREATE INDEX IF NOT EXISTS idx_wd_lookup_cache_accessed ON wd_lookup_cache(last_accessed_at ASC)`,
  `CREATE INDEX IF NOT EXISTS idx_wd_lookup_cache_size ON wd_lookup_cache(data_size_bytes DESC)`,
];

export const V3_UP = [CREATE_LOOKUP_CACHE, ...V3_INDEXES];

// ── V4: FTS5 full-text search ─────────────────────────────────────────

export const V4_UP = [
  `CREATE VIRTUAL TABLE IF NOT EXISTS wd_saved_words_fts USING fts5(word, definition_summary, notes, content='wd_saved_words', content_rowid='rowid')`,
  `CREATE TRIGGER IF NOT EXISTS wd_saved_words_fts_insert AFTER INSERT ON wd_saved_words BEGIN INSERT INTO wd_saved_words_fts(rowid, word, definition_summary, notes) VALUES (NEW.rowid, NEW.word, NEW.definition_summary, NEW.notes); END`,
  `CREATE TRIGGER IF NOT EXISTS wd_saved_words_fts_delete AFTER DELETE ON wd_saved_words BEGIN INSERT INTO wd_saved_words_fts(wd_saved_words_fts, rowid, word, definition_summary, notes) VALUES ('delete', OLD.rowid, OLD.word, OLD.definition_summary, OLD.notes); END`,
  `CREATE TRIGGER IF NOT EXISTS wd_saved_words_fts_update AFTER UPDATE ON wd_saved_words BEGIN INSERT INTO wd_saved_words_fts(wd_saved_words_fts, rowid, word, definition_summary, notes) VALUES ('delete', OLD.rowid, OLD.word, OLD.definition_summary, OLD.notes); INSERT INTO wd_saved_words_fts(rowid, word, definition_summary, notes) VALUES (NEW.rowid, NEW.word, NEW.definition_summary, NEW.notes); END`,
  `INSERT INTO wd_saved_words_fts(wd_saved_words_fts) VALUES('rebuild')`,
];
