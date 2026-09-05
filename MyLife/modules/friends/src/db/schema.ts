/**
 * SQLite schema for MyFriends module.
 * All table names use the fn_ prefix to avoid collisions in the shared hub database.
 *
 * UUIDs stored as TEXT.
 * Dates stored as TEXT in ISO datetime format.
 * Booleans stored as INTEGER (0/1).
 * JSON arrays stored as TEXT.
 */

// ── Tables ─────────────────────────────────────────────────────────

export const INIT_TABLES: string[] = [
  `CREATE TABLE IF NOT EXISTS fn_people (
    id TEXT PRIMARY KEY,
    display_name TEXT NOT NULL,
    photo_local_uri TEXT,
    relationship_type TEXT NOT NULL DEFAULT 'friend',
    how_met TEXT,
    where_met TEXT,
    when_met TEXT,
    birthday TEXT,
    anniversary TEXT,
    city TEXT,
    contact_info TEXT,
    quick_facts TEXT,
    interests TEXT,
    communication_preference TEXT,
    energy_tag TEXT CHECK(energy_tag IN ('energizing','neutral','draining','complicated')),
    frequency_goal_days INTEGER,
    is_archived INTEGER NOT NULL DEFAULT 0,
    notes_md TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,

  `CREATE TABLE IF NOT EXISTS fn_circles (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    icon TEXT,
    color TEXT,
    member_ids TEXT NOT NULL DEFAULT '[]',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,

  `CREATE TABLE IF NOT EXISTS fn_hangouts (
    id TEXT PRIMARY KEY,
    people_ids TEXT NOT NULL DEFAULT '[]',
    happened_at TEXT NOT NULL,
    duration_minutes INTEGER,
    location_name TEXT,
    location_lat REAL,
    location_lng REAL,
    activity_tags TEXT DEFAULT '[]',
    quality_rating INTEGER CHECK(quality_rating BETWEEN 1 AND 5),
    notes_md TEXT,
    photo_ids TEXT DEFAULT '[]',
    group_id TEXT,
    linked_dining_visit_id TEXT,
    linked_concert_id TEXT,
    linked_trail_id TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,

  `CREATE TABLE IF NOT EXISTS fn_gifts (
    id TEXT PRIMARY KEY,
    person_id TEXT NOT NULL,
    direction TEXT NOT NULL CHECK(direction IN ('given','received')),
    description TEXT NOT NULL,
    occasion TEXT,
    amount_cents INTEGER,
    date TEXT,
    reaction_notes TEXT,
    photo_id TEXT,
    link_url TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (person_id) REFERENCES fn_people(id)
  )`,

  `CREATE TABLE IF NOT EXISTS fn_gift_ideas (
    id TEXT PRIMARY KEY,
    person_id TEXT NOT NULL,
    description TEXT NOT NULL,
    estimated_price_cents INTEGER,
    priority INTEGER DEFAULT 0,
    source_note TEXT,
    link_url TEXT,
    is_purchased INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (person_id) REFERENCES fn_people(id)
  )`,

  `CREATE TABLE IF NOT EXISTS fn_memories (
    id TEXT PRIMARY KEY,
    person_ids TEXT DEFAULT '[]',
    circle_id TEXT,
    title TEXT NOT NULL,
    description_md TEXT,
    happened_at TEXT,
    photo_ids TEXT DEFAULT '[]',
    voice_memo_id TEXT,
    tags TEXT DEFAULT '[]',
    is_inside_joke INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,

  `CREATE TABLE IF NOT EXISTS fn_life_events (
    id TEXT PRIMARY KEY,
    person_id TEXT NOT NULL,
    type TEXT NOT NULL CHECK(type IN ('move','job','baby','engaged','married','graduated','other')),
    description TEXT,
    happened_at TEXT,
    acknowledged INTEGER NOT NULL DEFAULT 0,
    notes_md TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (person_id) REFERENCES fn_people(id)
  )`,

  `CREATE TABLE IF NOT EXISTS fn_nudges (
    id TEXT PRIMARY KEY,
    person_id TEXT NOT NULL,
    type TEXT NOT NULL CHECK(type IN ('havent_seen','birthday_coming','anniversary')),
    triggered_at TEXT NOT NULL,
    dismissed INTEGER NOT NULL DEFAULT 0,
    snoozed_until TEXT,
    acted_on INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (person_id) REFERENCES fn_people(id)
  )`,

  `CREATE TABLE IF NOT EXISTS fn_photos (
    id TEXT PRIMARY KEY,
    hangout_id TEXT,
    memory_id TEXT,
    person_id TEXT,
    local_uri TEXT NOT NULL,
    caption TEXT,
    taken_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,

  `CREATE TABLE IF NOT EXISTS fn_settings (
    key TEXT PRIMARY KEY,
    value TEXT
  )`,
];

// ── V2 Migration: Journal types on fn_memories ────────────────────

export const V2_MIGRATION_STATEMENTS: string[] = [
  `ALTER TABLE fn_memories ADD COLUMN type TEXT NOT NULL DEFAULT 'memory' CHECK(type IN ('memory','gratitude','conflict','growth'))`,
  `CREATE INDEX idx_fn_memories_type ON fn_memories(type)`,
  `CREATE INDEX idx_fn_memories_person ON fn_memories(person_ids)`,
];

// ── Indexes ────────────────────────────────────────────────────────

export const INIT_INDEXES: string[] = [
  'CREATE INDEX IF NOT EXISTS idx_fn_people_name ON fn_people(display_name)',
  'CREATE INDEX IF NOT EXISTS idx_fn_people_type ON fn_people(relationship_type)',
  'CREATE INDEX IF NOT EXISTS idx_fn_people_archived ON fn_people(is_archived)',
  'CREATE INDEX IF NOT EXISTS idx_fn_hangouts_date ON fn_hangouts(happened_at)',
  'CREATE INDEX IF NOT EXISTS idx_fn_gifts_person ON fn_gifts(person_id)',
  'CREATE INDEX IF NOT EXISTS idx_fn_gift_ideas_person ON fn_gift_ideas(person_id)',
  'CREATE INDEX IF NOT EXISTS idx_fn_life_events_person ON fn_life_events(person_id)',
  'CREATE INDEX IF NOT EXISTS idx_fn_nudges_person ON fn_nudges(person_id)',
  'CREATE INDEX IF NOT EXISTS idx_fn_photos_hangout ON fn_photos(hangout_id)',
  'CREATE INDEX IF NOT EXISTS idx_fn_photos_memory ON fn_photos(memory_id)',
];
