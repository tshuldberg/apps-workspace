/**
 * SQLite schema for the Manhattan module. All tables use the mh_ prefix.
 */

export const CREATE_EVENTS = `
CREATE TABLE IF NOT EXISTS mh_events (
    id TEXT PRIMARY KEY,
    source_id TEXT NOT NULL DEFAULT 'manual',
    external_id TEXT,
    title TEXT NOT NULL,
    description TEXT,
    venue_name TEXT,
    address TEXT,
    lat REAL,
    lng REAL,
    neighborhood TEXT,
    start_at TEXT,
    end_at TEXT,
    all_day INTEGER NOT NULL DEFAULT 0,
    category TEXT,
    purchase_url TEXT,
    ticket_provider TEXT,
    image_url TEXT,
    price_min REAL,
    price_max REAL,
    is_free INTEGER NOT NULL DEFAULT 0,
    saved INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'active',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    deleted_at TEXT
)`;

export const CREATE_EVENT_FACETS = `
CREATE TABLE IF NOT EXISTS mh_event_facets (
    id TEXT PRIMARY KEY,
    event_id TEXT NOT NULL REFERENCES mh_events(id) ON DELETE CASCADE,
    axis TEXT NOT NULL,
    value TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

export const CREATE_PINS = `
CREATE TABLE IF NOT EXISTS mh_pins (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    category TEXT,
    lat REAL,
    lng REAL,
    neighborhood TEXT,
    photo_ref TEXT,
    is_shareable INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    deleted_at TEXT
)`;

export const CREATE_PLANS = `
CREATE TABLE IF NOT EXISTS mh_plans (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    start_at TEXT NOT NULL,
    end_at TEXT,
    event_id TEXT REFERENCES mh_events(id) ON DELETE SET NULL,
    pin_id TEXT REFERENCES mh_pins(id) ON DELETE SET NULL,
    reminder_minutes INTEGER,
    calendar_event_id TEXT,
    has_reservation INTEGER NOT NULL DEFAULT 0,
    party_size INTEGER NOT NULL DEFAULT 1,
    source TEXT NOT NULL DEFAULT 'manual',
    status TEXT NOT NULL DEFAULT 'active',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    deleted_at TEXT
)`;

export const CREATE_PLAN_MEMBERS = `
CREATE TABLE IF NOT EXISTS mh_plan_members (
    id TEXT PRIMARY KEY,
    plan_id TEXT NOT NULL REFERENCES mh_plans(id) ON DELETE CASCADE,
    person_ref TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'guest',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

export const CREATE_SOURCES = `
CREATE TABLE IF NOT EXISTS mh_sources (
    id TEXT PRIMARY KEY,
    enabled INTEGER NOT NULL DEFAULT 1,
    last_synced_at TEXT,
    config_json TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

export const CREATE_SOURCE_CACHE = `
CREATE TABLE IF NOT EXISTS mh_source_cache (
    id TEXT PRIMARY KEY,
    source_id TEXT NOT NULL,
    fetched_at TEXT NOT NULL DEFAULT (datetime('now')),
    payload_json TEXT NOT NULL,
    ttl_seconds INTEGER NOT NULL DEFAULT 900
)`;

export const CREATE_SETTINGS = `
CREATE TABLE IF NOT EXISTS mh_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

export const CREATE_INDEXES = [
  `CREATE INDEX IF NOT EXISTS mh_events_start_idx ON mh_events(start_at)`,
  `CREATE INDEX IF NOT EXISTS mh_events_category_idx ON mh_events(category)`,
  `CREATE INDEX IF NOT EXISTS mh_events_saved_idx ON mh_events(saved)`,
  `CREATE INDEX IF NOT EXISTS mh_event_facets_event_idx ON mh_event_facets(event_id)`,
  `CREATE INDEX IF NOT EXISTS mh_event_facets_axis_idx ON mh_event_facets(axis, value)`,
  `CREATE INDEX IF NOT EXISTS mh_pins_shareable_idx ON mh_pins(is_shareable)`,
  `CREATE INDEX IF NOT EXISTS mh_plans_start_idx ON mh_plans(start_at)`,
  `CREATE INDEX IF NOT EXISTS mh_plans_event_idx ON mh_plans(event_id)`,
  `CREATE INDEX IF NOT EXISTS mh_plan_members_plan_idx ON mh_plan_members(plan_id)`,
  `CREATE INDEX IF NOT EXISTS mh_source_cache_source_idx ON mh_source_cache(source_id)`,
];

export const SEED_SETTINGS = [
  `INSERT OR IGNORE INTO mh_settings (key, value) VALUES ('defaultCity', 'New York')`,
  `INSERT OR IGNORE INTO mh_settings (key, value) VALUES ('defaultTimezone', 'America/New_York')`,
  `INSERT OR IGNORE INTO mh_settings (key, value) VALUES ('aiExtractionEnabled', 'false')`,
];

export const ALL_TABLES = [
  CREATE_EVENTS,
  CREATE_EVENT_FACETS,
  CREATE_PINS,
  CREATE_PLANS,
  CREATE_PLAN_MEMBERS,
  CREATE_SOURCES,
  CREATE_SOURCE_CACHE,
  CREATE_SETTINGS,
];
