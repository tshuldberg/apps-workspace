/**
 * SQLite schema for MyBooks module — all tables, indexes, FTS5, and triggers.
 * All table names use the bk_ prefix to avoid collisions in the shared hub database.
 *
 * UUIDs stored as TEXT.
 * Dates stored as TEXT in ISO datetime format.
 * Booleans stored as INTEGER (0/1).
 * JSON arrays stored as TEXT.
 */

// -- 1. Books --
export const CREATE_BOOKS = `
CREATE TABLE IF NOT EXISTS bk_books (
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
CREATE TABLE IF NOT EXISTS bk_shelves (
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
CREATE TABLE IF NOT EXISTS bk_book_shelves (
  book_id TEXT NOT NULL REFERENCES bk_books(id) ON DELETE CASCADE,
  shelf_id TEXT NOT NULL REFERENCES bk_shelves(id) ON DELETE CASCADE,
  added_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (book_id, shelf_id)
);`;

// -- 4. Reading Sessions --
export const CREATE_READING_SESSIONS = `
CREATE TABLE IF NOT EXISTS bk_reading_sessions (
  id TEXT PRIMARY KEY NOT NULL,
  book_id TEXT NOT NULL REFERENCES bk_books(id) ON DELETE CASCADE,
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
CREATE TABLE IF NOT EXISTS bk_reviews (
  id TEXT PRIMARY KEY NOT NULL,
  book_id TEXT NOT NULL REFERENCES bk_books(id) ON DELETE CASCADE,
  session_id TEXT REFERENCES bk_reading_sessions(id) ON DELETE SET NULL,
  rating REAL CHECK (rating >= 0.5 AND rating <= 5.0),
  review_text TEXT,
  favorite_quote TEXT,
  is_favorite INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);`;

// -- 5b. Share Events --
export const CREATE_SHARE_EVENTS = `
CREATE TABLE IF NOT EXISTS bk_share_events (
  id TEXT PRIMARY KEY NOT NULL,
  actor_user_id TEXT NOT NULL,
  object_type TEXT NOT NULL
    CHECK (object_type IN ('book_rating', 'book_review', 'list_item', 'generic')),
  object_id TEXT NOT NULL,
  visibility TEXT NOT NULL DEFAULT 'private'
    CHECK (visibility IN ('private', 'friends', 'public')),
  payload_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);`;

// -- 5c. Reader Documents --
export const CREATE_READER_DOCUMENTS = `
CREATE TABLE IF NOT EXISTS bk_reader_documents (
  id TEXT PRIMARY KEY NOT NULL,
  book_id TEXT REFERENCES bk_books(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  author TEXT,
  source_type TEXT NOT NULL DEFAULT 'upload'
    CHECK (source_type IN ('upload', 'import', 'note')),
  mime_type TEXT,
  file_name TEXT,
  file_extension TEXT,
  text_content TEXT NOT NULL,
  content_hash TEXT,
  total_chars INTEGER NOT NULL DEFAULT 0,
  total_words INTEGER NOT NULL DEFAULT 0,
  current_position INTEGER NOT NULL DEFAULT 0,
  progress_percent REAL NOT NULL DEFAULT 0,
  last_opened_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);`;

export const CREATE_READER_NOTES = `
CREATE TABLE IF NOT EXISTS bk_reader_notes (
  id TEXT PRIMARY KEY NOT NULL,
  document_id TEXT NOT NULL REFERENCES bk_reader_documents(id) ON DELETE CASCADE,
  note_type TEXT NOT NULL DEFAULT 'note'
    CHECK (note_type IN ('note', 'highlight', 'bookmark')),
  selection_start INTEGER NOT NULL DEFAULT 0,
  selection_end INTEGER NOT NULL DEFAULT 0,
  selected_text TEXT,
  note_text TEXT,
  color TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);`;

export const CREATE_READER_PREFERENCES = `
CREATE TABLE IF NOT EXISTS bk_reader_preferences (
  document_id TEXT PRIMARY KEY NOT NULL REFERENCES bk_reader_documents(id) ON DELETE CASCADE,
  font_size INTEGER NOT NULL DEFAULT 20,
  line_height REAL NOT NULL DEFAULT 1.6,
  font_family TEXT NOT NULL DEFAULT 'serif',
  theme TEXT NOT NULL DEFAULT 'sepia'
    CHECK (theme IN ('dark', 'sepia', 'light')),
  margin_size INTEGER NOT NULL DEFAULT 20,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);`;

// -- 6. Tags --
export const CREATE_TAGS = `
CREATE TABLE IF NOT EXISTS bk_tags (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL UNIQUE,
  color TEXT,
  usage_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);`;

// -- 7. Book-Tag junction --
export const CREATE_BOOK_TAGS = `
CREATE TABLE IF NOT EXISTS bk_book_tags (
  book_id TEXT NOT NULL REFERENCES bk_books(id) ON DELETE CASCADE,
  tag_id TEXT NOT NULL REFERENCES bk_tags(id) ON DELETE CASCADE,
  PRIMARY KEY (book_id, tag_id)
);`;

// -- 8. Reading Goals --
export const CREATE_READING_GOALS = `
CREATE TABLE IF NOT EXISTS bk_reading_goals (
  id TEXT PRIMARY KEY NOT NULL,
  year INTEGER NOT NULL,
  target_books INTEGER NOT NULL,
  target_pages INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);`;

// -- 9. Open Library Cache --
export const CREATE_OL_CACHE = `
CREATE TABLE IF NOT EXISTS bk_ol_cache (
  isbn TEXT PRIMARY KEY NOT NULL,
  response_json TEXT NOT NULL,
  cover_downloaded INTEGER NOT NULL DEFAULT 0,
  fetched_at TEXT NOT NULL DEFAULT (datetime('now'))
);`;

// -- 10. Import Log --
export const CREATE_IMPORT_LOG = `
CREATE TABLE IF NOT EXISTS bk_import_log (
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
CREATE TABLE IF NOT EXISTS bk_settings (
  key TEXT PRIMARY KEY NOT NULL,
  value TEXT NOT NULL
);`;

// -- 13. Progress Updates --
export const CREATE_PROGRESS_UPDATES = `
CREATE TABLE IF NOT EXISTS bk_progress_updates (
  id TEXT PRIMARY KEY NOT NULL,
  session_id TEXT NOT NULL REFERENCES bk_reading_sessions(id) ON DELETE CASCADE,
  book_id TEXT NOT NULL REFERENCES bk_books(id) ON DELETE CASCADE,
  page_number INTEGER,
  percent_complete REAL,
  note TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);`;

// -- 14. Timed Sessions --
export const CREATE_TIMED_SESSIONS = `
CREATE TABLE IF NOT EXISTS bk_timed_sessions (
  id TEXT PRIMARY KEY NOT NULL,
  session_id TEXT NOT NULL REFERENCES bk_reading_sessions(id) ON DELETE CASCADE,
  book_id TEXT NOT NULL REFERENCES bk_books(id) ON DELETE CASCADE,
  started_at TEXT NOT NULL,
  ended_at TEXT,
  duration_ms INTEGER,
  start_page INTEGER,
  end_page INTEGER,
  pages_read INTEGER,
  pages_per_hour REAL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);`;

// -- 15. Series --
export const CREATE_SERIES = `
CREATE TABLE IF NOT EXISTS bk_series (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  total_books INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);`;

// -- 16. Series Books --
export const CREATE_SERIES_BOOKS = `
CREATE TABLE IF NOT EXISTS bk_series_books (
  series_id TEXT NOT NULL REFERENCES bk_series(id) ON DELETE CASCADE,
  book_id TEXT NOT NULL REFERENCES bk_books(id) ON DELETE CASCADE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (series_id, book_id)
);`;

// -- 17. Mood Tags --
export const CREATE_MOOD_TAGS = `
CREATE TABLE IF NOT EXISTS bk_mood_tags (
  id TEXT PRIMARY KEY NOT NULL,
  book_id TEXT NOT NULL REFERENCES bk_books(id) ON DELETE CASCADE,
  tag_type TEXT NOT NULL CHECK (tag_type IN ('mood', 'pace', 'genre')),
  value TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);`;

// -- 18. Content Warnings --
export const CREATE_CONTENT_WARNINGS = `
CREATE TABLE IF NOT EXISTS bk_content_warnings (
  id TEXT PRIMARY KEY NOT NULL,
  book_id TEXT NOT NULL REFERENCES bk_books(id) ON DELETE CASCADE,
  warning TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'moderate'
    CHECK (severity IN ('mild', 'moderate', 'severe')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);`;

// -- 19. Challenges --
export const CREATE_CHALLENGES = `
CREATE TABLE IF NOT EXISTS bk_challenges (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  challenge_type TEXT NOT NULL
    CHECK (challenge_type IN ('books_count', 'pages_count', 'minutes_count', 'themed')),
  target_value INTEGER NOT NULL,
  target_unit TEXT NOT NULL
    CHECK (target_unit IN ('books', 'pages', 'minutes')),
  time_frame TEXT NOT NULL
    CHECK (time_frame IN ('yearly', 'monthly', 'weekly', 'custom')),
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  theme_prompt TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);`;

// -- 20. Challenge Progress --
export const CREATE_CHALLENGE_PROGRESS = `
CREATE TABLE IF NOT EXISTS bk_challenge_progress (
  id TEXT PRIMARY KEY NOT NULL,
  challenge_id TEXT NOT NULL REFERENCES bk_challenges(id) ON DELETE CASCADE,
  book_id TEXT REFERENCES bk_books(id) ON DELETE SET NULL,
  session_id TEXT REFERENCES bk_reading_sessions(id) ON DELETE SET NULL,
  value_added INTEGER NOT NULL DEFAULT 0,
  note TEXT,
  logged_at TEXT NOT NULL DEFAULT (datetime('now'))
);`;

// -- 21. Journal Entries --
export const CREATE_JOURNAL_ENTRIES = `
CREATE TABLE IF NOT EXISTS bk_journal_entries (
  id TEXT PRIMARY KEY NOT NULL,
  title TEXT,
  content TEXT NOT NULL,
  content_encrypted INTEGER NOT NULL DEFAULT 0,
  encryption_salt TEXT,
  encryption_iv TEXT,
  word_count INTEGER NOT NULL DEFAULT 0,
  mood TEXT,
  is_favorite INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);`;

// -- 22. Journal Photos --
export const CREATE_JOURNAL_PHOTOS = `
CREATE TABLE IF NOT EXISTS bk_journal_photos (
  id TEXT PRIMARY KEY NOT NULL,
  entry_id TEXT NOT NULL REFERENCES bk_journal_entries(id) ON DELETE CASCADE,
  file_path TEXT NOT NULL,
  file_name TEXT,
  width INTEGER,
  height INTEGER,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);`;

// -- 23. Journal Book Links --
export const CREATE_JOURNAL_BOOK_LINKS = `
CREATE TABLE IF NOT EXISTS bk_journal_book_links (
  entry_id TEXT NOT NULL REFERENCES bk_journal_entries(id) ON DELETE CASCADE,
  book_id TEXT NOT NULL REFERENCES bk_books(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (entry_id, book_id)
);`;

// -- Journal FTS5 --
export const CREATE_JOURNAL_FTS = `
CREATE VIRTUAL TABLE IF NOT EXISTS bk_journal_fts USING fts5(
  title,
  content,
  content='bk_journal_entries',
  content_rowid='rowid',
  tokenize='porter unicode61'
);`;

// -- Journal FTS sync triggers --
// V4 originals (kept for initial migration, replaced by V7 encryption-guarded versions)
export const CREATE_JOURNAL_FTS_TRIGGERS = [
  `CREATE TRIGGER IF NOT EXISTS bk_journal_fts_ai AFTER INSERT ON bk_journal_entries BEGIN
    INSERT INTO bk_journal_fts(rowid, title, content)
    VALUES (new.rowid, new.title, new.content);
  END;`,
  `CREATE TRIGGER IF NOT EXISTS bk_journal_fts_ad AFTER DELETE ON bk_journal_entries BEGIN
    INSERT INTO bk_journal_fts(bk_journal_fts, rowid, title, content)
    VALUES ('delete', old.rowid, old.title, old.content);
  END;`,
  `CREATE TRIGGER IF NOT EXISTS bk_journal_fts_au AFTER UPDATE ON bk_journal_entries BEGIN
    INSERT INTO bk_journal_fts(bk_journal_fts, rowid, title, content)
    VALUES ('delete', old.rowid, old.title, old.content);
    INSERT INTO bk_journal_fts(rowid, title, content)
    VALUES (new.rowid, new.title, new.content);
  END;`,
];

// -- V7: Encryption-guarded journal FTS triggers --
// Only index plaintext entries; skip ciphertext to avoid useless FTS data.
export const REPLACE_JOURNAL_FTS_TRIGGERS = [
  'DROP TRIGGER IF EXISTS bk_journal_fts_ai;',
  'DROP TRIGGER IF EXISTS bk_journal_fts_ad;',
  'DROP TRIGGER IF EXISTS bk_journal_fts_au;',
  `CREATE TRIGGER bk_journal_fts_ai AFTER INSERT ON bk_journal_entries
   WHEN new.content_encrypted = 0 BEGIN
    INSERT INTO bk_journal_fts(rowid, title, content)
    VALUES (new.rowid, new.title, new.content);
  END;`,
  `CREATE TRIGGER bk_journal_fts_ad AFTER DELETE ON bk_journal_entries
   WHEN old.content_encrypted = 0 BEGIN
    INSERT INTO bk_journal_fts(bk_journal_fts, rowid, title, content)
    VALUES ('delete', old.rowid, old.title, old.content);
  END;`,
  `CREATE TRIGGER bk_journal_fts_au AFTER UPDATE ON bk_journal_entries
   WHEN old.content_encrypted = 0 OR new.content_encrypted = 0 BEGIN
    INSERT INTO bk_journal_fts(bk_journal_fts, rowid, title, content)
    VALUES ('delete', old.rowid, COALESCE(old.title, ''), old.content);
    INSERT OR IGNORE INTO bk_journal_fts(rowid, title, content)
    SELECT new.rowid, new.title, new.content WHERE new.content_encrypted = 0;
  END;`,
];

// -- FTS5 --
export const CREATE_BOOKS_FTS = `
CREATE VIRTUAL TABLE IF NOT EXISTS bk_books_fts USING fts5(
  title,
  subtitle,
  authors,
  subjects,
  content='bk_books',
  content_rowid='rowid',
  tokenize='porter unicode61'
);`;

// -- FTS sync triggers --
export const CREATE_FTS_TRIGGERS = [
  `CREATE TRIGGER IF NOT EXISTS bk_books_fts_ai AFTER INSERT ON bk_books BEGIN
    INSERT INTO bk_books_fts(rowid, title, subtitle, authors, subjects)
    VALUES (new.rowid, new.title, new.subtitle, new.authors, new.subjects);
  END;`,
  `CREATE TRIGGER IF NOT EXISTS bk_books_fts_ad AFTER DELETE ON bk_books BEGIN
    INSERT INTO bk_books_fts(bk_books_fts, rowid, title, subtitle, authors, subjects)
    VALUES ('delete', old.rowid, old.title, old.subtitle, old.authors, old.subjects);
  END;`,
  `CREATE TRIGGER IF NOT EXISTS bk_books_fts_au AFTER UPDATE ON bk_books BEGIN
    INSERT INTO bk_books_fts(bk_books_fts, rowid, title, subtitle, authors, subjects)
    VALUES ('delete', old.rowid, old.title, old.subtitle, old.authors, old.subjects);
    INSERT INTO bk_books_fts(rowid, title, subtitle, authors, subjects)
    VALUES (new.rowid, new.title, new.subtitle, new.authors, new.subjects);
  END;`,
];

// -- Indexes --
export const CREATE_INDEXES = [
  `CREATE INDEX IF NOT EXISTS bk_books_isbn13_idx ON bk_books(isbn_13);`,
  `CREATE INDEX IF NOT EXISTS bk_books_isbn10_idx ON bk_books(isbn_10);`,
  `CREATE INDEX IF NOT EXISTS bk_books_ol_id_idx ON bk_books(open_library_id);`,
  `CREATE INDEX IF NOT EXISTS bk_books_title_idx ON bk_books(title COLLATE NOCASE);`,
  `CREATE INDEX IF NOT EXISTS bk_book_shelves_shelf_idx ON bk_book_shelves(shelf_id);`,
  `CREATE INDEX IF NOT EXISTS bk_sessions_book_idx ON bk_reading_sessions(book_id);`,
  `CREATE INDEX IF NOT EXISTS bk_sessions_status_idx ON bk_reading_sessions(status);`,
  `CREATE INDEX IF NOT EXISTS bk_sessions_finished_idx ON bk_reading_sessions(finished_at);`,
  `CREATE INDEX IF NOT EXISTS bk_sessions_started_idx ON bk_reading_sessions(started_at);`,
  `CREATE INDEX IF NOT EXISTS bk_reviews_book_idx ON bk_reviews(book_id);`,
  `CREATE INDEX IF NOT EXISTS bk_reviews_rating_idx ON bk_reviews(rating);`,
  `CREATE INDEX IF NOT EXISTS bk_reviews_favorite_idx ON bk_reviews(is_favorite) WHERE is_favorite = 1;`,
  `CREATE INDEX IF NOT EXISTS bk_tags_name_idx ON bk_tags(name);`,
  `CREATE INDEX IF NOT EXISTS bk_tags_usage_idx ON bk_tags(usage_count DESC);`,
  `CREATE INDEX IF NOT EXISTS bk_book_tags_tag_idx ON bk_book_tags(tag_id);`,
  `CREATE UNIQUE INDEX IF NOT EXISTS bk_goals_year_idx ON bk_reading_goals(year);`,
];

// -- Share indexes (added in migration v2) --
export const CREATE_SHARE_INDEXES = [
  `CREATE INDEX IF NOT EXISTS bk_share_events_actor_created_idx
     ON bk_share_events(actor_user_id, created_at DESC);`,
  `CREATE INDEX IF NOT EXISTS bk_share_events_object_idx
     ON bk_share_events(object_type, object_id);`,
  `CREATE INDEX IF NOT EXISTS bk_share_events_visibility_created_idx
     ON bk_share_events(visibility, created_at DESC);`,
];

export const CREATE_READER_INDEXES = [
  `CREATE INDEX IF NOT EXISTS bk_reader_documents_book_idx
     ON bk_reader_documents(book_id);`,
  `CREATE INDEX IF NOT EXISTS bk_reader_documents_last_opened_idx
     ON bk_reader_documents(last_opened_at DESC);`,
  `CREATE INDEX IF NOT EXISTS bk_reader_documents_updated_idx
     ON bk_reader_documents(updated_at DESC);`,
  `CREATE INDEX IF NOT EXISTS bk_reader_notes_document_created_idx
     ON bk_reader_notes(document_id, created_at DESC);`,
  `CREATE INDEX IF NOT EXISTS bk_reader_notes_type_idx
     ON bk_reader_notes(note_type);`,
];

// -- Feature set indexes (added in migration v4) --
export const CREATE_FEATURE_INDEXES = [
  // Progress + timed sessions
  `CREATE INDEX IF NOT EXISTS bk_progress_updates_session_idx ON bk_progress_updates(session_id);`,
  `CREATE INDEX IF NOT EXISTS bk_progress_updates_book_idx ON bk_progress_updates(book_id);`,
  `CREATE INDEX IF NOT EXISTS bk_progress_updates_created_idx ON bk_progress_updates(created_at);`,
  `CREATE INDEX IF NOT EXISTS bk_timed_sessions_session_idx ON bk_timed_sessions(session_id);`,
  `CREATE INDEX IF NOT EXISTS bk_timed_sessions_book_idx ON bk_timed_sessions(book_id);`,
  `CREATE INDEX IF NOT EXISTS bk_timed_sessions_started_idx ON bk_timed_sessions(started_at);`,
  // Series
  `CREATE INDEX IF NOT EXISTS bk_series_name_idx ON bk_series(name COLLATE NOCASE);`,
  `CREATE INDEX IF NOT EXISTS bk_series_books_book_idx ON bk_series_books(book_id);`,
  `CREATE INDEX IF NOT EXISTS bk_series_books_order_idx ON bk_series_books(series_id, sort_order);`,
  // Mood tags + content warnings
  `CREATE UNIQUE INDEX IF NOT EXISTS bk_mood_tags_book_type_value_idx ON bk_mood_tags(book_id, tag_type, value);`,
  `CREATE INDEX IF NOT EXISTS bk_mood_tags_type_value_idx ON bk_mood_tags(tag_type, value);`,
  `CREATE INDEX IF NOT EXISTS bk_content_warnings_book_idx ON bk_content_warnings(book_id);`,
  // Challenges
  `CREATE INDEX IF NOT EXISTS bk_challenges_active_idx ON bk_challenges(is_active) WHERE is_active = 1;`,
  `CREATE INDEX IF NOT EXISTS bk_challenges_type_idx ON bk_challenges(challenge_type);`,
  `CREATE INDEX IF NOT EXISTS bk_challenge_progress_challenge_idx ON bk_challenge_progress(challenge_id);`,
  `CREATE INDEX IF NOT EXISTS bk_challenge_progress_book_idx ON bk_challenge_progress(book_id);`,
  // Journal
  `CREATE INDEX IF NOT EXISTS bk_journal_entries_created_idx ON bk_journal_entries(created_at DESC);`,
  `CREATE INDEX IF NOT EXISTS bk_journal_entries_favorite_idx ON bk_journal_entries(is_favorite) WHERE is_favorite = 1;`,
  `CREATE INDEX IF NOT EXISTS bk_journal_photos_entry_idx ON bk_journal_photos(entry_id);`,
  `CREATE INDEX IF NOT EXISTS bk_journal_book_links_book_idx ON bk_journal_book_links(book_id);`,
  `CREATE INDEX IF NOT EXISTS bk_journal_book_links_entry_idx ON bk_journal_book_links(entry_id);`,
];

// -- System shelf seeds --
export const SEED_SYSTEM_SHELVES = [
  `INSERT OR IGNORE INTO bk_shelves (id, name, slug, icon, is_system, sort_order) VALUES ('shelf-tbr', 'Want to Read', 'want-to-read', '📚', 1, 0);`,
  `INSERT OR IGNORE INTO bk_shelves (id, name, slug, icon, is_system, sort_order) VALUES ('shelf-reading', 'Currently Reading', 'currently-reading', '📖', 1, 1);`,
  `INSERT OR IGNORE INTO bk_shelves (id, name, slug, icon, is_system, sort_order) VALUES ('shelf-finished', 'Finished', 'finished', '✅', 1, 2);`,
];

// -- 24. Book Clubs --
export const CREATE_BOOK_CLUBS = `
CREATE TABLE IF NOT EXISTS bk_book_clubs (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  current_book_id TEXT REFERENCES bk_books(id) ON DELETE SET NULL,
  reading_start_date TEXT,
  reading_end_date TEXT,
  mode TEXT NOT NULL DEFAULT 'local'
    CHECK (mode IN ('local', 'connected')),
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);`;

// -- 25. Club Notes --
export const CREATE_CLUB_NOTES = `
CREATE TABLE IF NOT EXISTS bk_club_notes (
  id TEXT PRIMARY KEY NOT NULL,
  club_id TEXT NOT NULL REFERENCES bk_book_clubs(id) ON DELETE CASCADE,
  book_id TEXT REFERENCES bk_books(id) ON DELETE SET NULL,
  content TEXT NOT NULL,
  note_type TEXT NOT NULL DEFAULT 'discussion'
    CHECK (note_type IN ('discussion', 'prompt', 'schedule', 'milestone')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);`;

// -- 26. Club History --
export const CREATE_CLUB_HISTORY = `
CREATE TABLE IF NOT EXISTS bk_club_history (
  id TEXT PRIMARY KEY NOT NULL,
  club_id TEXT NOT NULL REFERENCES bk_book_clubs(id) ON DELETE CASCADE,
  book_id TEXT NOT NULL REFERENCES bk_books(id) ON DELETE CASCADE,
  started_at TEXT,
  finished_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);`;

// -- 26b. Club Members --
export const CREATE_CLUB_MEMBERS = `
CREATE TABLE IF NOT EXISTS bk_club_members (
  id TEXT PRIMARY KEY NOT NULL,
  club_id TEXT NOT NULL REFERENCES bk_book_clubs(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  current_page INTEGER NOT NULL DEFAULT 0,
  joined_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(club_id, name)
);`;

export const CREATE_CLUB_MEMBERS_INDEX =
  `CREATE INDEX IF NOT EXISTS bk_club_members_club_idx ON bk_club_members(club_id);`;

// -- 27. Badges --
export const CREATE_BADGES = `
CREATE TABLE IF NOT EXISTS bk_badges (
  id TEXT PRIMARY KEY NOT NULL,
  category TEXT NOT NULL
    CHECK (category IN ('volume', 'pages', 'genre', 'author', 'streak', 'challenge', 'speed', 'review', 'journal')),
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  tier TEXT NOT NULL
    CHECK (tier IN ('bronze', 'silver', 'gold')),
  threshold INTEGER NOT NULL,
  icon TEXT NOT NULL,
  earned_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);`;

// -- 28. Community Challenges --
export const CREATE_COMMUNITY_CHALLENGES = `
CREATE TABLE IF NOT EXISTS bk_community_challenges (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  challenge_type TEXT NOT NULL
    CHECK (challenge_type IN ('books_count', 'pages_count', 'themed', 'genre_diversity', 'author_diversity')),
  target_value INTEGER NOT NULL,
  target_unit TEXT NOT NULL
    CHECK (target_unit IN ('books', 'pages', 'genres', 'authors')),
  time_frame TEXT NOT NULL
    CHECK (time_frame IN ('monthly', 'quarterly', 'yearly', 'seasonal', 'custom')),
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  theme_prompt TEXT,
  theme_tags TEXT,
  difficulty TEXT NOT NULL DEFAULT 'medium'
    CHECK (difficulty IN ('easy', 'medium', 'hard', 'extreme')),
  is_preset INTEGER NOT NULL DEFAULT 1,
  participant_count INTEGER NOT NULL DEFAULT 0,
  source TEXT NOT NULL DEFAULT 'local'
    CHECK (source IN ('local', 'community')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);`;

// -- 29. Community Challenge Participation --
export const CREATE_COMMUNITY_CHALLENGE_PARTICIPATION = `
CREATE TABLE IF NOT EXISTS bk_community_challenge_participation (
  id TEXT PRIMARY KEY NOT NULL,
  challenge_id TEXT NOT NULL REFERENCES bk_community_challenges(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'completed', 'abandoned')),
  joined_at TEXT NOT NULL DEFAULT (datetime('now')),
  completed_at TEXT,
  current_value INTEGER NOT NULL DEFAULT 0,
  notes TEXT
);`;

// -- Club indexes --
export const CREATE_CLUB_INDEXES = [
  `CREATE INDEX IF NOT EXISTS bk_club_notes_club_idx ON bk_club_notes(club_id);`,
  `CREATE INDEX IF NOT EXISTS bk_club_notes_book_idx ON bk_club_notes(book_id);`,
  `CREATE INDEX IF NOT EXISTS bk_club_notes_created_idx ON bk_club_notes(created_at DESC);`,
  `CREATE INDEX IF NOT EXISTS bk_club_history_club_idx ON bk_club_history(club_id);`,
  `CREATE INDEX IF NOT EXISTS bk_club_history_book_idx ON bk_club_history(book_id);`,
  `CREATE INDEX IF NOT EXISTS bk_book_clubs_active_idx ON bk_book_clubs(is_active) WHERE is_active = 1;`,
];

// -- Badge indexes --
export const CREATE_BADGE_INDEXES = [
  `CREATE INDEX IF NOT EXISTS bk_badges_category_idx ON bk_badges(category);`,
  `CREATE INDEX IF NOT EXISTS bk_badges_earned_idx ON bk_badges(earned_at) WHERE earned_at IS NOT NULL;`,
  `CREATE INDEX IF NOT EXISTS bk_badges_tier_idx ON bk_badges(tier);`,
];

// -- Community challenge indexes --
export const CREATE_COMMUNITY_CHALLENGE_INDEXES = [
  `CREATE INDEX IF NOT EXISTS bk_community_challenges_type_idx ON bk_community_challenges(challenge_type);`,
  `CREATE INDEX IF NOT EXISTS bk_community_challenges_timeframe_idx ON bk_community_challenges(time_frame);`,
  `CREATE INDEX IF NOT EXISTS bk_community_challenges_active_idx ON bk_community_challenges(start_date, end_date);`,
  `CREATE INDEX IF NOT EXISTS bk_community_challenge_participation_challenge_idx ON bk_community_challenge_participation(challenge_id);`,
  `CREATE INDEX IF NOT EXISTS bk_community_challenge_participation_status_idx ON bk_community_challenge_participation(status);`,
];

// -- Badge seed data (31 badges) --
export const SEED_BADGES = [
  // Volume badges
  `INSERT OR IGNORE INTO bk_badges (id, category, name, description, tier, threshold, icon) VALUES ('volume_10', 'volume', 'First Steps', 'Finish 10 books', 'bronze', 10, '📖');`,
  `INSERT OR IGNORE INTO bk_badges (id, category, name, description, tier, threshold, icon) VALUES ('volume_25', 'volume', 'Bookworm', 'Finish 25 books', 'silver', 25, '🐛');`,
  `INSERT OR IGNORE INTO bk_badges (id, category, name, description, tier, threshold, icon) VALUES ('volume_50', 'volume', 'Avid Reader', 'Finish 50 books', 'gold', 50, '🏆');`,
  `INSERT OR IGNORE INTO bk_badges (id, category, name, description, tier, threshold, icon) VALUES ('volume_100', 'volume', 'Century Reader', 'Finish 100 books', 'gold', 100, '💯');`,
  // Pages badges
  `INSERT OR IGNORE INTO bk_badges (id, category, name, description, tier, threshold, icon) VALUES ('pages_1000', 'pages', 'Page Turner', 'Read 1,000 pages', 'bronze', 1000, '📄');`,
  `INSERT OR IGNORE INTO bk_badges (id, category, name, description, tier, threshold, icon) VALUES ('pages_5000', 'pages', 'Deep Reader', 'Read 5,000 pages', 'silver', 5000, '📚');`,
  `INSERT OR IGNORE INTO bk_badges (id, category, name, description, tier, threshold, icon) VALUES ('pages_10000', 'pages', 'Marathon Reader', 'Read 10,000 pages', 'gold', 10000, '🏅');`,
  `INSERT OR IGNORE INTO bk_badges (id, category, name, description, tier, threshold, icon) VALUES ('pages_50000', 'pages', 'Library Walker', 'Read 50,000 pages', 'gold', 50000, '🏛️');`,
  // Genre badges
  `INSERT OR IGNORE INTO bk_badges (id, category, name, description, tier, threshold, icon) VALUES ('genre_3', 'genre', 'Genre Curious', 'Read from 3 different genres', 'bronze', 3, '🎭');`,
  `INSERT OR IGNORE INTO bk_badges (id, category, name, description, tier, threshold, icon) VALUES ('genre_5', 'genre', 'Genre Explorer', 'Read from 5 different genres', 'silver', 5, '🧭');`,
  `INSERT OR IGNORE INTO bk_badges (id, category, name, description, tier, threshold, icon) VALUES ('genre_10', 'genre', 'Genre Master', 'Read from 10 different genres', 'gold', 10, '🌍');`,
  // Author badges
  `INSERT OR IGNORE INTO bk_badges (id, category, name, description, tier, threshold, icon) VALUES ('author_5', 'author', 'Author Sampler', 'Read 5 different authors', 'bronze', 5, '✍️');`,
  `INSERT OR IGNORE INTO bk_badges (id, category, name, description, tier, threshold, icon) VALUES ('author_10', 'author', 'Author Explorer', 'Read 10 different authors', 'silver', 10, '🔍');`,
  `INSERT OR IGNORE INTO bk_badges (id, category, name, description, tier, threshold, icon) VALUES ('author_25', 'author', 'Author Connoisseur', 'Read 25 different authors', 'gold', 25, '🎩');`,
  // Streak badges
  `INSERT OR IGNORE INTO bk_badges (id, category, name, description, tier, threshold, icon) VALUES ('streak_7', 'streak', 'Week Warrior', 'Read 7 days in a row', 'bronze', 7, '🔥');`,
  `INSERT OR IGNORE INTO bk_badges (id, category, name, description, tier, threshold, icon) VALUES ('streak_30', 'streak', 'Monthly Devotee', 'Read 30 days in a row', 'silver', 30, '📅');`,
  `INSERT OR IGNORE INTO bk_badges (id, category, name, description, tier, threshold, icon) VALUES ('streak_100', 'streak', 'Reading Machine', 'Read 100 days in a row', 'gold', 100, '⚡');`,
  `INSERT OR IGNORE INTO bk_badges (id, category, name, description, tier, threshold, icon) VALUES ('streak_365', 'streak', 'Year of Reading', 'Read 365 days in a row', 'gold', 365, '👑');`,
  // Challenge badges
  `INSERT OR IGNORE INTO bk_badges (id, category, name, description, tier, threshold, icon) VALUES ('challenge_1', 'challenge', 'Challenger', 'Complete 1 reading challenge', 'bronze', 1, '🎯');`,
  `INSERT OR IGNORE INTO bk_badges (id, category, name, description, tier, threshold, icon) VALUES ('challenge_5', 'challenge', 'Goal Setter', 'Complete 5 reading challenges', 'silver', 5, '🏹');`,
  `INSERT OR IGNORE INTO bk_badges (id, category, name, description, tier, threshold, icon) VALUES ('challenge_10', 'challenge', 'Challenge Champion', 'Complete 10 reading challenges', 'gold', 10, '🏆');`,
  // Speed badges
  `INSERT OR IGNORE INTO bk_badges (id, category, name, description, tier, threshold, icon) VALUES ('speed_1day', 'speed', 'Speed Reader', 'Finish a book in 1 day', 'bronze', 1, '⚡');`,
  `INSERT OR IGNORE INTO bk_badges (id, category, name, description, tier, threshold, icon) VALUES ('speed_3day', 'speed', 'Quick Finisher', 'Finish a book in 3 days or less', 'silver', 3, '🚀');`,
  `INSERT OR IGNORE INTO bk_badges (id, category, name, description, tier, threshold, icon) VALUES ('speed_weekend', 'speed', 'Weekend Reader', 'Finish a book in 2 days or less', 'silver', 2, '📖');`,
  // Review badges
  `INSERT OR IGNORE INTO bk_badges (id, category, name, description, tier, threshold, icon) VALUES ('review_5', 'review', 'Thoughtful Reader', 'Write 5 reviews', 'bronze', 5, '💭');`,
  `INSERT OR IGNORE INTO bk_badges (id, category, name, description, tier, threshold, icon) VALUES ('review_10', 'review', 'Critic', 'Write 10 reviews', 'silver', 10, '🎬');`,
  `INSERT OR IGNORE INTO bk_badges (id, category, name, description, tier, threshold, icon) VALUES ('review_25', 'review', 'Book Reviewer', 'Write 25 reviews', 'gold', 25, '📝');`,
  `INSERT OR IGNORE INTO bk_badges (id, category, name, description, tier, threshold, icon) VALUES ('review_50', 'review', 'Review Master', 'Write 50 reviews', 'gold', 50, '🏅');`,
  // Journal badges
  `INSERT OR IGNORE INTO bk_badges (id, category, name, description, tier, threshold, icon) VALUES ('journal_5', 'journal', 'Diarist', 'Write 5 journal entries', 'bronze', 5, '📓');`,
  `INSERT OR IGNORE INTO bk_badges (id, category, name, description, tier, threshold, icon) VALUES ('journal_10', 'journal', 'Reflective Reader', 'Write 10 journal entries', 'silver', 10, '🪞');`,
  `INSERT OR IGNORE INTO bk_badges (id, category, name, description, tier, threshold, icon) VALUES ('journal_25', 'journal', 'Journaling Pro', 'Write 25 journal entries', 'gold', 25, '✨');`,
];

// -- Community challenge preset seed data (12 templates) --
export const SEED_COMMUNITY_CHALLENGE_PRESETS = [
  `INSERT OR IGNORE INTO bk_community_challenges (id, name, description, challenge_type, target_value, target_unit, time_frame, start_date, end_date, difficulty, is_preset) VALUES ('cc_monthly_5', 'Read 5 Books This Month', 'A manageable goal for consistent readers. Pick up 5 books this month and finish them all.', 'books_count', 5, 'books', 'monthly', '2026-01-01', '2026-12-31', 'easy', 1);`,
  `INSERT OR IGNORE INTO bk_community_challenges (id, name, description, challenge_type, target_value, target_unit, time_frame, start_date, end_date, difficulty, is_preset) VALUES ('cc_monthly_1000', '1,000 Pages This Month', 'Turn pages like a champion. Read 1,000 pages in a single month.', 'pages_count', 1000, 'pages', 'monthly', '2026-01-01', '2026-12-31', 'medium', 1);`,
  `INSERT OR IGNORE INTO bk_community_challenges (id, name, description, challenge_type, target_value, target_unit, time_frame, start_date, end_date, difficulty, is_preset) VALUES ('cc_quarterly_15', '15 Books This Quarter', 'Step up your reading game with 15 books over three months.', 'books_count', 15, 'books', 'quarterly', '2026-01-01', '2026-12-31', 'medium', 1);`,
  `INSERT OR IGNORE INTO bk_community_challenges (id, name, description, challenge_type, target_value, target_unit, time_frame, start_date, end_date, difficulty, is_preset) VALUES ('cc_yearly_52', 'Book a Week', 'The classic challenge: read one book every week for a full year. 52 books total.', 'books_count', 52, 'books', 'yearly', '2026-01-01', '2026-12-31', 'hard', 1);`,
  `INSERT OR IGNORE INTO bk_community_challenges (id, name, description, challenge_type, target_value, target_unit, time_frame, start_date, end_date, difficulty, is_preset) VALUES ('cc_yearly_100', 'Century Club', 'For the truly ambitious: finish 100 books in a single year.', 'books_count', 100, 'books', 'yearly', '2026-01-01', '2026-12-31', 'extreme', 1);`,
  `INSERT OR IGNORE INTO bk_community_challenges (id, name, description, challenge_type, target_value, target_unit, time_frame, start_date, end_date, difficulty, is_preset) VALUES ('cc_genre_5', 'Genre Explorer', 'Branch out and read from 5 different genres this quarter.', 'genre_diversity', 5, 'genres', 'quarterly', '2026-01-01', '2026-12-31', 'easy', 1);`,
  `INSERT OR IGNORE INTO bk_community_challenges (id, name, description, challenge_type, target_value, target_unit, time_frame, start_date, end_date, difficulty, is_preset) VALUES ('cc_genre_10', 'Genre Master', 'Become a true literary explorer by reading from 10 different genres this year.', 'genre_diversity', 10, 'genres', 'yearly', '2026-01-01', '2026-12-31', 'medium', 1);`,
  `INSERT OR IGNORE INTO bk_community_challenges (id, name, description, challenge_type, target_value, target_unit, time_frame, start_date, end_date, difficulty, is_preset) VALUES ('cc_author_10', 'Author Sampler', 'Discover new voices: read books by 10 different authors this quarter.', 'author_diversity', 10, 'authors', 'quarterly', '2026-01-01', '2026-12-31', 'easy', 1);`,
  `INSERT OR IGNORE INTO bk_community_challenges (id, name, description, challenge_type, target_value, target_unit, time_frame, start_date, end_date, difficulty, is_preset) VALUES ('cc_author_25', 'Author Explorer', 'Expand your reading world with 25 unique authors over the year.', 'author_diversity', 25, 'authors', 'yearly', '2026-01-01', '2026-12-31', 'medium', 1);`,
  `INSERT OR IGNORE INTO bk_community_challenges (id, name, description, challenge_type, target_value, target_unit, time_frame, start_date, end_date, difficulty, is_preset) VALUES ('cc_themed_scifi', 'Science Fiction Month', 'Dive into science fiction: read 3 sci-fi books this month.', 'themed', 3, 'books', 'monthly', '2026-01-01', '2026-12-31', 'easy', 1);`,
  `INSERT OR IGNORE INTO bk_community_challenges (id, name, description, challenge_type, target_value, target_unit, time_frame, start_date, end_date, difficulty, is_preset) VALUES ('cc_themed_classic', 'Classics Quarter', 'Revisit the greats: read 5 classic literature books this quarter.', 'themed', 5, 'books', 'quarterly', '2026-01-01', '2026-12-31', 'medium', 1);`,
  `INSERT OR IGNORE INTO bk_community_challenges (id, name, description, challenge_type, target_value, target_unit, time_frame, start_date, end_date, difficulty, is_preset) VALUES ('cc_themed_diverse', 'Around the World in Books', 'Read 7 books set in or by authors from different countries this year.', 'themed', 7, 'books', 'yearly', '2026-01-01', '2026-12-31', 'hard', 1);`,
];

// -- 30. Quotes --
export const CREATE_QUOTES = `
CREATE TABLE IF NOT EXISTS bk_quotes (
  id TEXT PRIMARY KEY NOT NULL,
  book_id TEXT NOT NULL REFERENCES bk_books(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  page_number INTEGER,
  chapter TEXT,
  note TEXT,
  is_favorite INTEGER NOT NULL DEFAULT 0,
  source TEXT NOT NULL DEFAULT 'manual'
    CHECK (source IN ('manual', 'reader', 'import')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);`;

// -- Quotes FTS5 --
export const CREATE_QUOTES_FTS = `
CREATE VIRTUAL TABLE IF NOT EXISTS bk_quotes_fts USING fts5(
  content,
  note,
  content='bk_quotes',
  content_rowid='rowid',
  tokenize='porter unicode61'
);`;

// -- Quotes FTS sync triggers --
export const CREATE_QUOTES_FTS_TRIGGERS = [
  `CREATE TRIGGER IF NOT EXISTS bk_quotes_fts_ai AFTER INSERT ON bk_quotes BEGIN
    INSERT INTO bk_quotes_fts(rowid, content, note)
    VALUES (new.rowid, new.content, new.note);
  END;`,
  `CREATE TRIGGER IF NOT EXISTS bk_quotes_fts_ad AFTER DELETE ON bk_quotes BEGIN
    INSERT INTO bk_quotes_fts(bk_quotes_fts, rowid, content, note)
    VALUES ('delete', old.rowid, old.content, old.note);
  END;`,
  `CREATE TRIGGER IF NOT EXISTS bk_quotes_fts_au AFTER UPDATE ON bk_quotes BEGIN
    INSERT INTO bk_quotes_fts(bk_quotes_fts, rowid, content, note)
    VALUES ('delete', old.rowid, old.content, old.note);
    INSERT INTO bk_quotes_fts(rowid, content, note)
    VALUES (new.rowid, new.content, new.note);
  END;`,
];

// -- Quotes indexes --
export const CREATE_QUOTES_INDEXES = [
  `CREATE INDEX IF NOT EXISTS bk_quotes_book_idx ON bk_quotes(book_id);`,
  `CREATE INDEX IF NOT EXISTS bk_quotes_favorite_idx ON bk_quotes(is_favorite) WHERE is_favorite = 1;`,
  `CREATE INDEX IF NOT EXISTS bk_quotes_created_idx ON bk_quotes(created_at DESC);`,
  `CREATE INDEX IF NOT EXISTS bk_quotes_source_idx ON bk_quotes(source);`,
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
];
