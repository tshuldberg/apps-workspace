export const MYNEWS_TABLE_NAMES = [
  'nw_follows',
  'nw_saved',
  'nw_read_cursor',
  'nw_feed_defs',
  'nw_feed_pins',
  'nw_drafts',
  'nw_settings',
] as const;

export const ALL_TABLES: string[] = [
  `CREATE TABLE IF NOT EXISTS nw_follows (
    id TEXT PRIMARY KEY,
    journalist_key TEXT NOT NULL,
    handle TEXT NOT NULL,
    created_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS nw_saved (
    id TEXT PRIMARY KEY,
    article_id TEXT NOT NULL,
    title TEXT NOT NULL,
    author_handle TEXT NOT NULL,
    saved_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS nw_read_cursor (
    article_id TEXT PRIMARY KEY,
    last_read_at TEXT NOT NULL,
    progress REAL NOT NULL DEFAULT 0
  )`,
  `CREATE TABLE IF NOT EXISTS nw_feed_defs (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    def_json TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS nw_feed_pins (
    id TEXT PRIMARY KEY,
    feed_id TEXT NOT NULL,
    position INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS nw_drafts (
    id TEXT PRIMARY KEY,
    headline TEXT,
    dek TEXT,
    body_md TEXT NOT NULL DEFAULT '',
    kind TEXT NOT NULL DEFAULT 'news',
    updated_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS nw_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  )`,
];

export const CREATE_INDEXES: string[] = [
  'CREATE UNIQUE INDEX IF NOT EXISTS idx_nw_follows_key ON nw_follows (journalist_key)',
  'CREATE UNIQUE INDEX IF NOT EXISTS idx_nw_saved_article ON nw_saved (article_id)',
  'CREATE INDEX IF NOT EXISTS idx_nw_feed_pins_feed ON nw_feed_pins (feed_id, position)',
];
