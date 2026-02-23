/**
 * SQLite schema for MyBooks — all tables, indexes, FTS5, and triggers.
 *
 * UUIDs stored as TEXT.
 * Dates stored as TEXT in ISO datetime format.
 * Booleans stored as INTEGER (0/1).
 * JSON arrays stored as TEXT.
 */

// -- 1. Books --
export const CREATE_BOOKS = `
CREATE TABLE IF NOT EXISTS books (
  id TEXT PRIMARY KEY NOT NULL,
  title TEXT NOT NULL,
  subtitle TEXT,
  authors TEXT NOT NULL,
  isbn_10 TEXT,
  isbn_13 TEXT,
  open_library_id TEXT,
  open_library_edition_id TEXT,
  cover_url TEXT,
  cover_cached_path TEXT,
  publisher TEXT,
  publish_year INTEGER,
  page_count INTEGER,
  subjects TEXT,
  description TEXT,
  language TEXT DEFAULT 'en',
  format TEXT DEFAULT 'physical'
    CHECK (format IN ('physical', 'ebook', 'audiobook')),
  added_source TEXT DEFAULT 'manual'
    CHECK (added_source IN ('search', 'scan', 'manual', 'import_goodreads', 'import_storygraph')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);`;

// -- 2. Shelves --
export const CREATE_SHELVES = `
CREATE TABLE IF NOT EXISTS shelves (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  icon TEXT,
  color TEXT,
  is_system INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0,
  book_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);`;

// -- 3. Book-Shelf junction --
export const CREATE_BOOK_SHELVES = `
CREATE TABLE IF NOT EXISTS book_shelves (
  book_id TEXT NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  shelf_id TEXT NOT NULL REFERENCES shelves(id) ON DELETE CASCADE,
  added_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (book_id, shelf_id)
);`;

// -- 4. Reading Sessions --
export const CREATE_READING_SESSIONS = `
CREATE TABLE IF NOT EXISTS reading_sessions (
  id TEXT PRIMARY KEY NOT NULL,
  book_id TEXT NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  started_at TEXT,
  finished_at TEXT,
  current_page INTEGER DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'want_to_read'
    CHECK (status IN ('want_to_read', 'reading', 'finished', 'dnf')),
  dnf_reason TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);`;

// -- 5. Reviews --
export const CREATE_REVIEWS = `
CREATE TABLE IF NOT EXISTS reviews (
  id TEXT PRIMARY KEY NOT NULL,
  book_id TEXT NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  session_id TEXT REFERENCES reading_sessions(id) ON DELETE SET NULL,
  rating REAL CHECK (rating >= 0.5 AND rating <= 5.0),
  review_text TEXT,
  favorite_quote TEXT,
  is_favorite INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);`;

// -- 6. Tags --
export const CREATE_TAGS = `
CREATE TABLE IF NOT EXISTS tags (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL UNIQUE,
  color TEXT,
  usage_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);`;

// -- 7. Book-Tag junction --
export const CREATE_BOOK_TAGS = `
CREATE TABLE IF NOT EXISTS book_tags (
  book_id TEXT NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  tag_id TEXT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (book_id, tag_id)
);`;

// -- 8. Reading Goals --
export const CREATE_READING_GOALS = `
CREATE TABLE IF NOT EXISTS reading_goals (
  id TEXT PRIMARY KEY NOT NULL,
  year INTEGER NOT NULL,
  target_books INTEGER NOT NULL,
  target_pages INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);`;

// -- 9. Open Library Cache --
export const CREATE_OL_CACHE = `
CREATE TABLE IF NOT EXISTS ol_cache (
  isbn TEXT PRIMARY KEY NOT NULL,
  response_json TEXT NOT NULL,
  cover_downloaded INTEGER NOT NULL DEFAULT 0,
  fetched_at TEXT NOT NULL DEFAULT (datetime('now'))
);`;

// -- 10. Import Log --
export const CREATE_IMPORT_LOG = `
CREATE TABLE IF NOT EXISTS import_log (
  id TEXT PRIMARY KEY NOT NULL,
  source TEXT NOT NULL,
  filename TEXT NOT NULL,
  books_imported INTEGER NOT NULL DEFAULT 0,
  books_skipped INTEGER NOT NULL DEFAULT 0,
  errors TEXT,
  imported_at TEXT NOT NULL DEFAULT (datetime('now'))
);`;

// -- 11. Settings --
export const CREATE_SETTINGS = `
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY NOT NULL,
  value TEXT NOT NULL
);`;

// -- 12. Schema Version --
export const CREATE_SCHEMA_VERSION = `
CREATE TABLE IF NOT EXISTS schema_version (
  version INTEGER PRIMARY KEY NOT NULL,
  applied_at TEXT NOT NULL DEFAULT (datetime('now'))
);`;

// -- FTS5 --
export const CREATE_BOOKS_FTS = `
CREATE VIRTUAL TABLE IF NOT EXISTS books_fts USING fts5(
  title,
  subtitle,
  authors,
  subjects,
  content='books',
  content_rowid='rowid',
  tokenize='porter unicode61'
);`;

// -- FTS sync triggers --
export const CREATE_FTS_TRIGGERS = [
  `CREATE TRIGGER IF NOT EXISTS books_fts_ai AFTER INSERT ON books BEGIN
    INSERT INTO books_fts(rowid, title, subtitle, authors, subjects)
    VALUES (new.rowid, new.title, new.subtitle, new.authors, new.subjects);
  END;`,
  `CREATE TRIGGER IF NOT EXISTS books_fts_ad AFTER DELETE ON books BEGIN
    INSERT INTO books_fts(books_fts, rowid, title, subtitle, authors, subjects)
    VALUES ('delete', old.rowid, old.title, old.subtitle, old.authors, old.subjects);
  END;`,
  `CREATE TRIGGER IF NOT EXISTS books_fts_au AFTER UPDATE ON books BEGIN
    INSERT INTO books_fts(books_fts, rowid, title, subtitle, authors, subjects)
    VALUES ('delete', old.rowid, old.title, old.subtitle, old.authors, old.subjects);
    INSERT INTO books_fts(rowid, title, subtitle, authors, subjects)
    VALUES (new.rowid, new.title, new.subtitle, new.authors, new.subjects);
  END;`,
];

// -- Indexes --
export const CREATE_INDEXES = [
  `CREATE INDEX IF NOT EXISTS books_isbn13_idx ON books(isbn_13);`,
  `CREATE INDEX IF NOT EXISTS books_isbn10_idx ON books(isbn_10);`,
  `CREATE INDEX IF NOT EXISTS books_ol_id_idx ON books(open_library_id);`,
  `CREATE INDEX IF NOT EXISTS books_title_idx ON books(title COLLATE NOCASE);`,
  `CREATE INDEX IF NOT EXISTS book_shelves_shelf_idx ON book_shelves(shelf_id);`,
  `CREATE INDEX IF NOT EXISTS sessions_book_idx ON reading_sessions(book_id);`,
  `CREATE INDEX IF NOT EXISTS sessions_status_idx ON reading_sessions(status);`,
  `CREATE INDEX IF NOT EXISTS sessions_finished_idx ON reading_sessions(finished_at);`,
  `CREATE INDEX IF NOT EXISTS sessions_started_idx ON reading_sessions(started_at);`,
  `CREATE INDEX IF NOT EXISTS reviews_book_idx ON reviews(book_id);`,
  `CREATE INDEX IF NOT EXISTS reviews_rating_idx ON reviews(rating);`,
  `CREATE INDEX IF NOT EXISTS reviews_favorite_idx ON reviews(is_favorite) WHERE is_favorite = 1;`,
  `CREATE INDEX IF NOT EXISTS tags_name_idx ON tags(name);`,
  `CREATE INDEX IF NOT EXISTS tags_usage_idx ON tags(usage_count DESC);`,
  `CREATE INDEX IF NOT EXISTS book_tags_tag_idx ON book_tags(tag_id);`,
  `CREATE UNIQUE INDEX IF NOT EXISTS goals_year_idx ON reading_goals(year);`,
];

// -- System shelf seeds --
export const SEED_SYSTEM_SHELVES = [
  `INSERT OR IGNORE INTO shelves (id, name, slug, icon, is_system, sort_order) VALUES ('shelf-tbr', 'Want to Read', 'want-to-read', '📚', 1, 0);`,
  `INSERT OR IGNORE INTO shelves (id, name, slug, icon, is_system, sort_order) VALUES ('shelf-reading', 'Currently Reading', 'currently-reading', '📖', 1, 1);`,
  `INSERT OR IGNORE INTO shelves (id, name, slug, icon, is_system, sort_order) VALUES ('shelf-finished', 'Finished', 'finished', '✅', 1, 2);`,
];

/**
 * All table creation statements in dependency order.
 */
export const ALL_TABLES = [
  CREATE_BOOKS,
  CREATE_SHELVES,
  CREATE_BOOK_SHELVES,
  CREATE_READING_SESSIONS,
  CREATE_REVIEWS,
  CREATE_TAGS,
  CREATE_BOOK_TAGS,
  CREATE_READING_GOALS,
  CREATE_OL_CACHE,
  CREATE_IMPORT_LOG,
  CREATE_SETTINGS,
  CREATE_SCHEMA_VERSION,
];

/**
 * Schema version — increment this when changing the schema.
 */
export const SCHEMA_VERSION = 1;
