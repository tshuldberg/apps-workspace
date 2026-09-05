import type { Migration } from '@mylife/module-registry';

// ---------------------------------------------------------------------------
// V1 Tables (trips, destinations, settings)
// ---------------------------------------------------------------------------

export const CREATE_TRIPS = `
CREATE TABLE IF NOT EXISTS tv_trips (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  destination_ids TEXT DEFAULT '[]',
  trip_type TEXT CHECK(trip_type IN ('vacation','business','family','solo','road_trip','backpacking')),
  start_date TEXT,
  end_date TEXT,
  status TEXT CHECK(status IN ('planning','upcoming','active','completed','cancelled')) DEFAULT 'planning',
  companion_ids TEXT DEFAULT '[]',
  budget_planned_cents INTEGER,
  budget_actual_cents INTEGER DEFAULT 0,
  cover_photo_id TEXT,
  notes_md TEXT,
  rating INTEGER CHECK(rating BETWEEN 1 AND 5),
  template_id TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

export const CREATE_DESTINATIONS = `
CREATE TABLE IF NOT EXISTS tv_destinations (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  country TEXT,
  country_code TEXT,
  region TEXT,
  lat REAL,
  lng REAL,
  first_visited TEXT,
  last_visited TEXT,
  visit_count INTEGER DEFAULT 0,
  rating INTEGER CHECK(rating BETWEEN 1 AND 5),
  bucket_list INTEGER DEFAULT 0,
  priority INTEGER,
  notes_md TEXT,
  best_season TEXT,
  photo_id TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

export const CREATE_SETTINGS = `
CREATE TABLE IF NOT EXISTS tv_settings (
  key TEXT PRIMARY KEY,
  value TEXT
)`;

export const ALL_TABLES = [
  CREATE_TRIPS,
  CREATE_DESTINATIONS,
  CREATE_SETTINGS,
];

export const CREATE_INDEXES = [
  `CREATE INDEX IF NOT EXISTS idx_tv_trips_status ON tv_trips(status)`,
  `CREATE INDEX IF NOT EXISTS idx_tv_trips_start_date ON tv_trips(start_date)`,
  `CREATE INDEX IF NOT EXISTS idx_tv_destinations_country ON tv_destinations(country_code)`,
  `CREATE INDEX IF NOT EXISTS idx_tv_destinations_bucket ON tv_destinations(bucket_list)`,
];

// ---------------------------------------------------------------------------
// V2 Tables (itinerary days + activities)
// ---------------------------------------------------------------------------

export const CREATE_ITINERARY_DAYS = `
CREATE TABLE IF NOT EXISTS tv_itinerary_days (
  id TEXT PRIMARY KEY,
  trip_id TEXT NOT NULL REFERENCES tv_trips(id) ON DELETE CASCADE,
  date TEXT,
  day_number INTEGER NOT NULL,
  location TEXT,
  weather_notes TEXT,
  summary_md TEXT,
  photo_ids TEXT DEFAULT '[]',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

export const CREATE_ACTIVITIES = `
CREATE TABLE IF NOT EXISTS tv_activities (
  id TEXT PRIMARY KEY,
  day_id TEXT NOT NULL REFERENCES tv_itinerary_days(id) ON DELETE CASCADE,
  trip_id TEXT NOT NULL REFERENCES tv_trips(id) ON DELETE CASCADE,
  time TEXT,
  end_time TEXT,
  title TEXT NOT NULL,
  type TEXT CHECK(type IN ('flight','hotel','restaurant','sight','tour','hike','transport','other')),
  location TEXT,
  address TEXT,
  lat REAL,
  lng REAL,
  confirmation_code TEXT,
  cost_cents INTEGER,
  notes_md TEXT,
  booking_url TEXT,
  photo_id TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

export const V2_TABLES = [
  CREATE_ITINERARY_DAYS,
  CREATE_ACTIVITIES,
];

export const V2_INDEXES = [
  `CREATE INDEX IF NOT EXISTS idx_tv_itinerary_days_trip ON tv_itinerary_days(trip_id)`,
  `CREATE INDEX IF NOT EXISTS idx_tv_activities_day ON tv_activities(day_id)`,
  `CREATE INDEX IF NOT EXISTS idx_tv_activities_trip ON tv_activities(trip_id)`,
];

// ---------------------------------------------------------------------------
// V3 Tables (documents + loyalty programs)
// ---------------------------------------------------------------------------

export const CREATE_DOCUMENTS = `
CREATE TABLE IF NOT EXISTS tv_documents (
  id TEXT PRIMARY KEY,
  type TEXT CHECK(type IN ('passport','visa','insurance','vaccination','membership','other')) NOT NULL,
  name TEXT NOT NULL,
  number TEXT,
  country TEXT,
  issue_date TEXT,
  expiry_date TEXT,
  renewal_reminder_days INTEGER DEFAULT 90,
  notes_md TEXT,
  photo_id TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

export const CREATE_LOYALTY_PROGRAMS = `
CREATE TABLE IF NOT EXISTS tv_loyalty_programs (
  id TEXT PRIMARY KEY,
  type TEXT CHECK(type IN ('airline','hotel','car')) NOT NULL,
  provider TEXT NOT NULL,
  member_number TEXT,
  status_tier TEXT,
  points_balance INTEGER DEFAULT 0,
  miles_balance INTEGER DEFAULT 0,
  expiry_date TEXT,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

export const V3_TABLES = [
  CREATE_DOCUMENTS,
  CREATE_LOYALTY_PROGRAMS,
];

export const V3_INDEXES = [
  `CREATE INDEX IF NOT EXISTS idx_tv_documents_type ON tv_documents(type)`,
  `CREATE INDEX IF NOT EXISTS idx_tv_documents_expiry ON tv_documents(expiry_date)`,
  `CREATE INDEX IF NOT EXISTS idx_tv_loyalty_type ON tv_loyalty_programs(type)`,
];

// ---------------------------------------------------------------------------
// V4 Tables (bookings)
// ---------------------------------------------------------------------------

export const CREATE_BOOKINGS = `
CREATE TABLE IF NOT EXISTS tv_bookings (
  id TEXT PRIMARY KEY,
  trip_id TEXT NOT NULL REFERENCES tv_trips(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('flight','hotel','car','train','ferry','tour','other')),
  provider TEXT NOT NULL,
  confirmation_code TEXT,
  start_ts TEXT NOT NULL,
  end_ts TEXT,
  location TEXT,
  cost_cents INTEGER,
  currency TEXT,
  notes TEXT,
  attachments_ref TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
)`;

export const V4_TABLES = [CREATE_BOOKINGS];

export const V4_INDEXES = [
  `CREATE INDEX IF NOT EXISTS idx_tv_bookings_trip ON tv_bookings(trip_id)`,
  `CREATE INDEX IF NOT EXISTS idx_tv_bookings_type ON tv_bookings(type)`,
  `CREATE INDEX IF NOT EXISTS idx_tv_bookings_start_ts ON tv_bookings(start_ts)`,
];

// ---------------------------------------------------------------------------
// Migrations
// ---------------------------------------------------------------------------

export const TRAVEL_MIGRATION_V1: Migration = {
  version: 1,
  description:
    'Initial travel schema -- trips, destinations, settings + indexes',
  up: [...ALL_TABLES, ...CREATE_INDEXES],
  down: [
    'DROP TABLE IF EXISTS tv_settings',
    'DROP TABLE IF EXISTS tv_destinations',
    'DROP TABLE IF EXISTS tv_trips',
  ],
};

export const TRAVEL_MIGRATION_V2: Migration = {
  version: 2,
  description:
    'Itinerary days and activities -- trip planning schema + indexes',
  up: [...V2_TABLES, ...V2_INDEXES],
  down: [
    'DROP TABLE IF EXISTS tv_activities',
    'DROP TABLE IF EXISTS tv_itinerary_days',
  ],
};

export const TRAVEL_MIGRATION_V3: Migration = {
  version: 3,
  description:
    'Logistics schema -- documents and loyalty programs + indexes',
  up: [...V3_TABLES, ...V3_INDEXES],
  down: [
    'DROP TABLE IF EXISTS tv_loyalty_programs',
    'DROP TABLE IF EXISTS tv_documents',
  ],
};

export const TRAVEL_MIGRATION_V4: Migration = {
  version: 4,
  description:
    'Bookings schema -- flights, hotels, car rentals, trains, ferries, tours + indexes',
  up: [...V4_TABLES, ...V4_INDEXES],
  down: ['DROP TABLE IF EXISTS tv_bookings'],
};

// ---------------------------------------------------------------------------
// V5 Tables (emergency contacts, currency rates, trip checklists)
// ---------------------------------------------------------------------------

export const CREATE_EMERGENCY_CONTACTS = `
CREATE TABLE IF NOT EXISTS tv_emergency_contacts (
  id TEXT PRIMARY KEY,
  trip_id TEXT REFERENCES tv_trips(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  relationship TEXT,
  phone TEXT,
  email TEXT,
  country_code TEXT,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
)`;

export const CREATE_CURRENCIES = `
CREATE TABLE IF NOT EXISTS tv_currencies (
  id TEXT PRIMARY KEY,
  trip_id TEXT REFERENCES tv_trips(id) ON DELETE CASCADE,
  base TEXT NOT NULL,
  quote TEXT NOT NULL,
  rate REAL NOT NULL,
  fetched_at TEXT NOT NULL,
  source TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
)`;

export const CREATE_CHECKLIST_ITEMS = `
CREATE TABLE IF NOT EXISTS tv_checklist_items (
  id TEXT PRIMARY KEY,
  trip_id TEXT NOT NULL REFERENCES tv_trips(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  category TEXT,
  done INTEGER NOT NULL DEFAULT 0,
  done_at TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
)`;

export const V5_TABLES = [
  CREATE_EMERGENCY_CONTACTS,
  CREATE_CURRENCIES,
  CREATE_CHECKLIST_ITEMS,
];

export const V5_INDEXES = [
  `CREATE INDEX IF NOT EXISTS idx_tv_emergency_contacts_trip ON tv_emergency_contacts(trip_id)`,
  `CREATE INDEX IF NOT EXISTS idx_tv_currencies_trip ON tv_currencies(trip_id)`,
  `CREATE INDEX IF NOT EXISTS idx_tv_currencies_pair ON tv_currencies(base, quote)`,
  `CREATE INDEX IF NOT EXISTS idx_tv_checklist_items_trip ON tv_checklist_items(trip_id)`,
  `CREATE INDEX IF NOT EXISTS idx_tv_checklist_items_order ON tv_checklist_items(trip_id, sort_order)`,
];

export const TRAVEL_MIGRATION_V5: Migration = {
  version: 5,
  description:
    'Extended logistics -- emergency contacts, currency rates, trip checklists + indexes',
  up: [...V5_TABLES, ...V5_INDEXES],
  down: [
    'DROP TABLE IF EXISTS tv_checklist_items',
    'DROP TABLE IF EXISTS tv_currencies',
    'DROP TABLE IF EXISTS tv_emergency_contacts',
  ],
};

// ---------------------------------------------------------------------------
// V6 Tables (packing lists + packing items)
// ---------------------------------------------------------------------------

export const CREATE_PACKING_LISTS = `
CREATE TABLE IF NOT EXISTS tv_packing_lists (
  id TEXT PRIMARY KEY,
  trip_id TEXT REFERENCES tv_trips(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  template INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
)`;

export const CREATE_PACKING_ITEMS = `
CREATE TABLE IF NOT EXISTS tv_packing_items (
  id TEXT PRIMARY KEY,
  list_id TEXT NOT NULL REFERENCES tv_packing_lists(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  category TEXT,
  packed INTEGER NOT NULL DEFAULT 0,
  packed_at TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
)`;

export const V6_TABLES = [CREATE_PACKING_LISTS, CREATE_PACKING_ITEMS];

export const V6_INDEXES = [
  `CREATE INDEX IF NOT EXISTS idx_tv_packing_lists_trip ON tv_packing_lists(trip_id)`,
  `CREATE INDEX IF NOT EXISTS idx_tv_packing_lists_template ON tv_packing_lists(template)`,
  `CREATE INDEX IF NOT EXISTS idx_tv_packing_items_list_order ON tv_packing_items(list_id, sort_order)`,
];

export const TRAVEL_MIGRATION_V6: Migration = {
  version: 6,
  description:
    'Packing schema -- packing lists (trip or template) + packing items + indexes',
  up: [...V6_TABLES, ...V6_INDEXES],
  down: [
    'DROP TABLE IF EXISTS tv_packing_items',
    'DROP TABLE IF EXISTS tv_packing_lists',
  ],
};

// ---------------------------------------------------------------------------
// V7 Tables (journal entries + journal memories)
// ---------------------------------------------------------------------------

export const CREATE_JOURNAL_ENTRIES = `
CREATE TABLE IF NOT EXISTS tv_journal_entries (
  id TEXT PRIMARY KEY,
  trip_id TEXT REFERENCES tv_trips(id) ON DELETE SET NULL,
  destination_id TEXT REFERENCES tv_destinations(id) ON DELETE SET NULL,
  day_number INTEGER,
  entry_date TEXT NOT NULL,
  title TEXT,
  body_md TEXT NOT NULL DEFAULT '',
  mood INTEGER CHECK (mood IS NULL OR (mood BETWEEN 1 AND 5)),
  weather TEXT,
  location_label TEXT,
  lat REAL,
  lng REAL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
)`;

export const CREATE_JOURNAL_MEMORIES = `
CREATE TABLE IF NOT EXISTS tv_journal_memories (
  id TEXT PRIMARY KEY,
  entry_id TEXT NOT NULL REFERENCES tv_journal_entries(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('photo','quote','souvenir','video','audio','other')),
  media_ref TEXT,
  caption TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
)`;

export const V7_TABLES = [CREATE_JOURNAL_ENTRIES, CREATE_JOURNAL_MEMORIES];

export const V7_INDEXES = [
  `CREATE INDEX IF NOT EXISTS idx_tv_journal_entries_trip ON tv_journal_entries(trip_id)`,
  `CREATE INDEX IF NOT EXISTS idx_tv_journal_entries_destination ON tv_journal_entries(destination_id)`,
  `CREATE INDEX IF NOT EXISTS idx_tv_journal_entries_date ON tv_journal_entries(entry_date)`,
  `CREATE INDEX IF NOT EXISTS idx_tv_journal_entries_mood ON tv_journal_entries(mood)`,
  `CREATE INDEX IF NOT EXISTS idx_tv_journal_memories_entry_order ON tv_journal_memories(entry_id, sort_order)`,
];

export const TRAVEL_MIGRATION_V7: Migration = {
  version: 7,
  description:
    'Journal schema -- journal entries (trip/destination optional) + attached memories + indexes',
  up: [...V7_TABLES, ...V7_INDEXES],
  down: [
    'DROP TABLE IF EXISTS tv_journal_memories',
    'DROP TABLE IF EXISTS tv_journal_entries',
  ],
};

export const TRAVEL_MIGRATIONS: Migration[] = [
  TRAVEL_MIGRATION_V1,
  TRAVEL_MIGRATION_V2,
  TRAVEL_MIGRATION_V3,
  TRAVEL_MIGRATION_V4,
  TRAVEL_MIGRATION_V5,
  TRAVEL_MIGRATION_V6,
  TRAVEL_MIGRATION_V7,
];

export function getTravelMigrations(): Migration[] {
  return TRAVEL_MIGRATIONS;
}
