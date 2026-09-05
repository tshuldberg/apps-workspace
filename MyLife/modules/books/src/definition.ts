import type { ModuleDefinition, Migration } from '@mylife/module-registry';
import { booksCrossModule } from './cross-module';
import {
  ALL_TABLES,
  CREATE_BOOKS_FTS,
  CREATE_FTS_TRIGGERS,
  CREATE_INDEXES,
  CREATE_SHARE_EVENTS,
  CREATE_SHARE_INDEXES,
  CREATE_READER_DOCUMENTS,
  CREATE_READER_NOTES,
  CREATE_READER_PREFERENCES,
  CREATE_READER_INDEXES,
  CREATE_PROGRESS_UPDATES,
  CREATE_TIMED_SESSIONS,
  CREATE_SERIES,
  CREATE_SERIES_BOOKS,
  CREATE_MOOD_TAGS,
  CREATE_CONTENT_WARNINGS,
  CREATE_CHALLENGES,
  CREATE_CHALLENGE_PROGRESS,
  CREATE_JOURNAL_ENTRIES,
  CREATE_JOURNAL_PHOTOS,
  CREATE_JOURNAL_BOOK_LINKS,
  CREATE_JOURNAL_FTS,
  CREATE_JOURNAL_FTS_TRIGGERS,
  CREATE_FEATURE_INDEXES,
  SEED_SYSTEM_SHELVES,
  CREATE_BOOK_CLUBS,
  CREATE_CLUB_NOTES,
  CREATE_CLUB_HISTORY,
  CREATE_CLUB_INDEXES,
  CREATE_CLUB_MEMBERS,
  CREATE_CLUB_MEMBERS_INDEX,
  CREATE_BADGES,
  CREATE_BADGE_INDEXES,
  SEED_BADGES,
  CREATE_COMMUNITY_CHALLENGES,
  CREATE_COMMUNITY_CHALLENGE_PARTICIPATION,
  CREATE_COMMUNITY_CHALLENGE_INDEXES,
  SEED_COMMUNITY_CHALLENGE_PRESETS,
  CREATE_QUOTES,
  CREATE_QUOTES_FTS,
  CREATE_QUOTES_FTS_TRIGGERS,
  CREATE_QUOTES_INDEXES,
  REPLACE_JOURNAL_FTS_TRIGGERS,
} from './db/schema';
import { ADD_HUB_ATTACHMENT_ID_V10 } from './db/schema-v10';

const BOOKS_MIGRATION_V1: Migration = {
  version: 1,
  description: 'Initial books schema — 11 tables, FTS5, triggers, indexes, system shelves',
  up: [
    ...ALL_TABLES,
    CREATE_BOOKS_FTS,
    ...CREATE_FTS_TRIGGERS,
    ...CREATE_INDEXES,
    ...SEED_SYSTEM_SHELVES,
  ],
  down: [
    'DROP TABLE IF EXISTS bk_books_fts',
    'DROP TABLE IF EXISTS bk_book_tags',
    'DROP TABLE IF EXISTS bk_book_shelves',
    'DROP TABLE IF EXISTS bk_reading_sessions',
    'DROP TABLE IF EXISTS bk_reviews',
    'DROP TABLE IF EXISTS bk_reading_goals',
    'DROP TABLE IF EXISTS bk_import_log',
    'DROP TABLE IF EXISTS bk_ol_cache',
    'DROP TABLE IF EXISTS bk_settings',
    'DROP TABLE IF EXISTS bk_tags',
    'DROP TABLE IF EXISTS bk_shelves',
    'DROP TABLE IF EXISTS bk_books',
  ],
};

const BOOKS_MIGRATION_V2: Migration = {
  version: 2,
  description: 'Add sharing primitives for visibility-based social events',
  up: [
    CREATE_SHARE_EVENTS,
    ...CREATE_SHARE_INDEXES,
  ],
  down: [
    'DROP TABLE IF EXISTS bk_share_events',
  ],
};

const BOOKS_MIGRATION_V3: Migration = {
  version: 3,
  description: 'Add local e-reader documents, highlights, and reader preferences',
  up: [
    CREATE_READER_DOCUMENTS,
    CREATE_READER_NOTES,
    CREATE_READER_PREFERENCES,
    ...CREATE_READER_INDEXES,
  ],
  down: [
    'DROP TABLE IF EXISTS bk_reader_preferences',
    'DROP TABLE IF EXISTS bk_reader_notes',
    'DROP TABLE IF EXISTS bk_reader_documents',
  ],
};

const BOOKS_MIGRATION_V4: Migration = {
  version: 4,
  description: 'Add reading progress, series, discovery, challenges, and journal tables',
  up: [
    CREATE_PROGRESS_UPDATES,
    CREATE_TIMED_SESSIONS,
    CREATE_SERIES,
    CREATE_SERIES_BOOKS,
    CREATE_MOOD_TAGS,
    CREATE_CONTENT_WARNINGS,
    CREATE_CHALLENGES,
    CREATE_CHALLENGE_PROGRESS,
    CREATE_JOURNAL_ENTRIES,
    CREATE_JOURNAL_PHOTOS,
    CREATE_JOURNAL_BOOK_LINKS,
    CREATE_JOURNAL_FTS,
    ...CREATE_JOURNAL_FTS_TRIGGERS,
    ...CREATE_FEATURE_INDEXES,
  ],
  down: [
    'DROP TABLE IF EXISTS bk_journal_book_links',
    'DROP TABLE IF EXISTS bk_journal_photos',
    'DROP TABLE IF EXISTS bk_journal_entries',
    'DROP TABLE IF EXISTS bk_journal_fts',
    'DROP TABLE IF EXISTS bk_challenge_progress',
    'DROP TABLE IF EXISTS bk_challenges',
    'DROP TABLE IF EXISTS bk_content_warnings',
    'DROP TABLE IF EXISTS bk_mood_tags',
    'DROP TABLE IF EXISTS bk_series_books',
    'DROP TABLE IF EXISTS bk_series',
    'DROP TABLE IF EXISTS bk_timed_sessions',
    'DROP TABLE IF EXISTS bk_progress_updates',
  ],
};

const BOOKS_MIGRATION_V5: Migration = {
  version: 5,
  description: 'Add book clubs, badges, and community challenges',
  up: [
    CREATE_BOOK_CLUBS,
    CREATE_CLUB_NOTES,
    CREATE_CLUB_HISTORY,
    ...CREATE_CLUB_INDEXES,
    CREATE_BADGES,
    ...CREATE_BADGE_INDEXES,
    ...SEED_BADGES,
    CREATE_COMMUNITY_CHALLENGES,
    CREATE_COMMUNITY_CHALLENGE_PARTICIPATION,
    ...CREATE_COMMUNITY_CHALLENGE_INDEXES,
    ...SEED_COMMUNITY_CHALLENGE_PRESETS,
  ],
  down: [
    'DROP TABLE IF EXISTS bk_community_challenge_participation',
    'DROP TABLE IF EXISTS bk_community_challenges',
    'DROP TABLE IF EXISTS bk_badges',
    'DROP TABLE IF EXISTS bk_club_history',
    'DROP TABLE IF EXISTS bk_club_notes',
    'DROP TABLE IF EXISTS bk_book_clubs',
  ],
};

const BOOKS_MIGRATION_V6: Migration = {
  version: 6,
  description: 'Add quote collection with FTS5 search',
  up: [
    CREATE_QUOTES,
    CREATE_QUOTES_FTS,
    ...CREATE_QUOTES_FTS_TRIGGERS,
    ...CREATE_QUOTES_INDEXES,
  ],
  down: [
    'DROP TABLE IF EXISTS bk_quotes_fts',
    'DROP TABLE IF EXISTS bk_quotes',
  ],
};

const BOOKS_MIGRATION_V7: Migration = {
  version: 7,
  description: 'Guard journal FTS triggers against indexing encrypted content',
  up: REPLACE_JOURNAL_FTS_TRIGGERS,
  down: [
    'DROP TRIGGER IF EXISTS bk_journal_fts_ai;',
    'DROP TRIGGER IF EXISTS bk_journal_fts_ad;',
    'DROP TRIGGER IF EXISTS bk_journal_fts_au;',
    // Restore original unguarded triggers
    `CREATE TRIGGER bk_journal_fts_ai AFTER INSERT ON bk_journal_entries BEGIN
      INSERT INTO bk_journal_fts(rowid, title, content)
      VALUES (new.rowid, new.title, new.content);
    END;`,
    `CREATE TRIGGER bk_journal_fts_ad AFTER DELETE ON bk_journal_entries BEGIN
      INSERT INTO bk_journal_fts(bk_journal_fts, rowid, title, content)
      VALUES ('delete', old.rowid, old.title, old.content);
    END;`,
    `CREATE TRIGGER bk_journal_fts_au AFTER UPDATE ON bk_journal_entries BEGIN
      INSERT INTO bk_journal_fts(bk_journal_fts, rowid, title, content)
      VALUES ('delete', old.rowid, old.title, old.content);
      INSERT INTO bk_journal_fts(rowid, title, content)
      VALUES (new.rowid, new.title, new.content);
    END;`,
  ],
};

const BOOKS_MIGRATION_V8: Migration = {
  version: 8,
  description: 'Add Open Library community rating columns to bk_books',
  up: [
    'ALTER TABLE bk_books ADD COLUMN ol_rating_average REAL;',
    'ALTER TABLE bk_books ADD COLUMN ol_rating_count INTEGER;',
  ],
  down: [
    // SQLite doesn't support DROP COLUMN before 3.35; these are best-effort
    'SELECT 1;',
  ],
};

const BOOKS_MIGRATION_V9: Migration = {
  version: 9,
  description: 'Add club members table for local member tracking',
  up: [
    CREATE_CLUB_MEMBERS,
    CREATE_CLUB_MEMBERS_INDEX,
  ],
  down: [
    'DROP TABLE IF EXISTS bk_club_members',
  ],
};

const BOOKS_MIGRATION_V10: Migration = {
  version: 10,
  description: 'Add hub_attachment_id pointer on bk_journal_photos for hub_attachments shadow-write',
  up: ADD_HUB_ATTACHMENT_ID_V10,
  down: [
    // SQLite pre-3.35 cannot DROP COLUMN; best-effort no-op.
    'SELECT 1;',
  ],
};

export const BOOKS_MODULE: ModuleDefinition = {
  id: 'books',
  name: 'MyBooks',
  tagline: 'Read in peace',
  icon: '\uD83D\uDCDA',
  accentColor: '#C9894D',
  tier: 'premium',
  storageType: 'sqlite',
  migrations: [BOOKS_MIGRATION_V1, BOOKS_MIGRATION_V2, BOOKS_MIGRATION_V3, BOOKS_MIGRATION_V4, BOOKS_MIGRATION_V5, BOOKS_MIGRATION_V6, BOOKS_MIGRATION_V7, BOOKS_MIGRATION_V8, BOOKS_MIGRATION_V9, BOOKS_MIGRATION_V10],
  schemaVersion: 10,
  tablePrefix: 'bk_',
  syncPolicy: {
    defaultScope: 'personal_replica',
    shareable: false,
    entityRules: [
      {
        tableName: 'books',
        defaultScope: 'personal_replica',
        conflictStrategy: 'lww',
      },
      {
        tableName: 'reading_sessions',
        defaultScope: 'personal_replica',
        conflictStrategy: 'lww',
      },
      {
        tableName: 'reviews',
        defaultScope: 'personal_replica',
        conflictStrategy: 'lww',
      },
      {
        tableName: 'reading_goals',
        defaultScope: 'personal_replica',
        conflictStrategy: 'lww',
      },
      {
        tableName: 'journal_entries',
        defaultScope: 'personal_replica',
        conflictStrategy: 'lww',
      },
      {
        tableName: 'quotes',
        defaultScope: 'personal_replica',
        conflictStrategy: 'lww',
      },
    ],
  },
  navigation: {
    tabs: [
      { key: 'home', label: 'Home', icon: 'home' },
      { key: 'library', label: 'Library', icon: 'book' },
      { key: 'search', label: 'Search', icon: 'search' },
      { key: 'reader', label: 'Reader', icon: 'book-open' },
      { key: 'stats', label: 'Stats', icon: 'bar-chart' },
      { key: 'settings', label: 'Settings', icon: 'settings' },
    ],
    screens: [
      { name: 'book-detail', title: 'Book Details' },
      { name: 'add-book', title: 'Add Book' },
      { name: 'edit-review', title: 'Edit Review' },
    ],
  },
  requiresAuth: false,
  requiresNetwork: false,
  version: '0.1.0',
  crossModule: booksCrossModule,
};
